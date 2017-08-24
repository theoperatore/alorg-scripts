#!/usr/bin/env node

'use strict';

const commander = require('commander');
const chalk = require('chalk');
const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs-extra');

commander
  .description('Deploy an Alorg project based on alorg.json')
  .option('-c, --config <path>', 'path to alorg.json deployment file; defaults to alorg.json in local directory')
  .option('-q, --quiet', 'do not print command output; only helper text')
  .parse(process.argv);

const configPath = commander.config === true
  ? './alorg.json'
  : (commander.config || './alorg.json');
const pathToAlorgJson = path.resolve(process.cwd(), configPath);

const run = ([command, ...args], env = {}) => new Promise((resolve, reject) => {
  const output = commander.quiet
    ? {}
    : { stdio: [0, 1, 2] };

  const cmd = spawn(
    command,
    args,
    Object.assign(
      {},
      { env: Object.assign({}, process.env, env) },
      output,
    )
  );

  cmd.on('error', err => {
    reject(err);
  });

  cmd.on('close', code => code === 0
    ? resolve()
    : reject());
});

const deploy = (cfg, max) => async (ip, idx) => {
  console.log(chalk.grey(`[${6 + idx}/${max}]`), '🚀 ', 'Deploying to', chalk.magenta(ip));
  await run([
    'ssh',
    ip,
    'bash',
    '-s',
    '<',
    `${path.resolve(process.cwd(), './docker/image-upgrade.sh')}`,
    `${cfg.registry}:${cfg.tag}`,
    `${cfg.name}`,
  ]);
}

const deployIt = async () => {
  console.log('');

  let cfg;
  try {
    cfg = await fs.readJsonSync(pathToAlorgJson);
  } catch (error) {
    console.error(chalk.red('error'), 'Cannot read alorg.json file at path', chalk.cyan(pathToAlorgJson));
    console.error(chalk.red('error'), 'Please ensure that an alorg.json file exists in the root of your project.');
    console.log('');
    process.exit(1);
  }

  if (!cfg.name) {
    console.error(chalk.red('deploy-error'), 'Invalid config file missing property:', chalk.cyan('name'));
    console.log(chalk.red('deploy-error'), 'Run the help for more info on config files:');
    console.log(chalk.red('deploy-error'));
    console.log(chalk.red('deploy-error'), chalk.cyan('  alorg-scripts help deploy'));
    console.log(chalk.red('deploy-error'));
    console.log('');
    process.exit(1);
  }

  // validate config file properties
  if (!cfg.registry) {
    console.error(chalk.red('deploy-error'), 'Invalid config file missing property:', chalk.cyan('registry'));
    console.log(chalk.red('deploy-error'), 'Run the help for more info on config files:');
    console.log(chalk.red('deploy-error'));
    console.log(chalk.red('deploy-error'), chalk.cyan('  alorg-scripts help deploy'));
    console.log(chalk.red('deploy-error'));
    console.log('');
    process.exit(1);
  }

  if (!cfg.tag) {
    console.error(chalk.red('deploy-error'), 'Invalid config file missing property:', chalk.cyan('tag'));
    console.log(chalk.red('deploy-error'), 'Run the help for more info on config files:');
    console.log(chalk.red('deploy-error'));
    console.log(chalk.red('deploy-error'), chalk.cyan('  alorg-scripts help deploy'));
    console.log(chalk.red('deploy-error'));
    console.log('');
    process.exit(1);
  }

  console.log('Using config:', chalk.magenta(pathToAlorgJson));

  const hasServersToDeploy = typeof cfg.servers !== undefined && cfg.servers.length !== 0;
  const serverLength = hasServersToDeploy ? cfg.servers.length : -1;
  const stepMax = serverLength === -1
    ? 4
    : 5 + serverLength;

  const BUILD_NAME = `${cfg.name}-tmp-build`;

  if (!hasServersToDeploy) {
    console.log(chalk.yellow('warning'), 'No deploy servers specified. Only building and testing; no deployment.');
  }
  console.log('');

  // build and test
  console.log(chalk.grey(`[1/${stepMax}]`), '🏗 ', 'Building env');
  await run([
    'docker',
    'build',
    '-t', BUILD_NAME,
    '-f', path.resolve(process.cwd(), './internals/docker/Dockerfile-js'),
    '.',
  ]);

  console.log(chalk.grey(`[2/${stepMax}]`), '🛠 ', 'Running tests');
  await run([
    'docker',
    'run',
    '--rm',
    '-e', 'CI=true',
    BUILD_NAME,
    'yarn',
    'test',
  ]);

  console.log(chalk.grey(`[3/${stepMax}]`), '📦 ', 'Building production app');
  await run([
    'docker',
    'run',
    '--rm',
    '-v', `${path.resolve(process.cwd(), './build')}:/app/build`,
    '-w', '/app',
    BUILD_NAME,
    'yarn',
    'build',
  ]);

  console.log(chalk.grey(`[4/${stepMax}]`), '📦 ', 'Building nginx image', chalk.magenta(`${cfg.registry}:${cfg.tag}`));
  await run([
    'docker',
    'build',
    '-t', `${cfg.registry}:${cfg.tag}`,
    '-f', path.resolve(process.cwd(), './internals/docker/Dockerfile-nginx'),
    '.',
  ]);

  if (hasServersToDeploy) {
    console.log(chalk.grey(`[5/${stepMax}]`), '☁️ ', 'Pushing to registry', chalk.magenta(`${cfg.registry}:${cfg.tag}`));
    await run([
      'docker',
      'push',
      `${cfg.registry}:${cfg.tag}`,
    ]);

    await Promise.all(cfg.servers.map(deploy(cfg, stepMax)));
  }
}

deployIt()
  .then(() => {
    console.log('');
    console.log('🔥 ', chalk.green('Kick the tires and light the fires!'));
    console.log('');
    process.exit(0);
  })
  // let the command currently running error out
  .catch(() => process.exit(1));
