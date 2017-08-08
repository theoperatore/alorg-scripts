#!/usr/bin/env node

'use strict';

const readline = require('readline');
const path = require('path');
const commander = require('commander');
const chalk = require('chalk');
const doesFileExistSync = require('fs').accessSync;
const spawn = require('child_process').spawn;

commander
  .option('-c, --config <path>', 'path to alorg.json deployment file; defaults to alorg.json in local directory')
  .on('--help', () => {
    console.log('')
    console.log('  Specify which registry and which release of this app via config file.');
    console.log('');
    console.log('  Example custom config usage:')
    console.log('');
    console.log(chalk.cyan('    alorg-scripts deploy --config ./alorg-staging.json'));
    console.log('');
    console.log('  Valid configs need at a minimum: registry, tag, servers.');
    console.log('  Registry and Tag are strings, while servers is an array of ip adresses or FQDN adresses (via ssh)');
    console.log('');
    console.log('  Example alorg.json:');
    console.log('');
    console.log(chalk.cyan('    {'));
    console.log(chalk.cyan('      "name": "my-project-name"'));
    console.log(chalk.cyan('      "registry": "theopertore/alorg"'));
    console.log(chalk.cyan('      "tag": "my-project"'));
    console.log(chalk.cyan('      "servers": ["root@127.0.0.1"]'));
    console.log(chalk.cyan('    }'));
    console.log('');
    process.exit(1);
  })
  .parse(process.argv);

process.on('unhandledRejection', error => {
  console.error(chalk.red('deploy-error-rejection'), error);
  process.exit(1);
});

const BUILD_IMAGE = 'tmp-build-img';

const rawPath = commander.config === true
  ? './alorg.json'
  : (commander.config || './alorg.json');

const configPath = path.resolve(rawPath);

let fileExists;
try {
  doesFileExistSync(configPath);
  fileExists = true;
} catch (e) {
  fileExists = false;
}

if (!fileExists) {
  console.error(chalk.red('deploy-error'), 'Cannot find config file at path:', chalk.cyan(configPath));
  process.exit(1);
}

const clearLine = () => {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const run = async ([command, ...args]) => new Promise(async (resolve, reject) => {
  process.stdout.write(`\r${command} ${args.join(' ')}`);
  await sleep(Math.random() * 3000 + 1000)
  clearLine();
  resolve();

  // const cmd = spawn(command, args);
  //
  // cmd.stdout.on('data', dat => {
  //   clearLine();
  //   process.stdout.write(`${dat}`);
  // });
  //
  // cmd.stderr.on('data', dat => {
  //   clearLine();
  //   process.stdout.write(`${dat}`);
  // });
  //
  // cmd.on('error', err => {
  //   reject(err);
  // });
  //
  // cmd.on('close', code => code === 0
  //   ? resolve()
  //   : reject());
});

const deploy = (cfg, max) => async (ip, idx) => {
  console.log(chalk.grey(`[${6 + idx}/${max}]`), '🚀 ', 'Deploying to', chalk.magenta(ip));
  await run(['ssh', ip, 'bash', '-s', '<', `${path.resolve(__dirname, './docker/image-upgrade.sh')} ${cfg.registry}:${cfg.tag}`, `${cfg.name}`]);
}

async function doIt(cfg) {
  console.log('');

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
  if (!cfg.servers || cfg.servers.length === 0) {
    console.error(chalk.red('deploy-error'), 'Invalid config file missing property:', chalk.cyan('servers'));
    console.log(chalk.red('deploy-error'), 'Run the help for more info on config files:');
    console.log(chalk.red('deploy-error'));
    console.log(chalk.red('deploy-error'), chalk.cyan('  alorg-scripts help deploy'));
    console.log(chalk.red('deploy-error'));
    console.log('');
    process.exit(1);
  }

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

  const serverLength = cfg.servers.length;
  const stepMax = 5 + serverLength;

  console.log('Using config:', chalk.magenta(configPath));
  console.log('');

  // [1/6] build docker image for transpiling and testing
  console.log(chalk.grey(`[1/${stepMax}]`), '🏗 ', 'Building env');
  await run(['docker', 'build', '-t', BUILD_IMAGE, '-f', path.resolve(__dirname, './docker/Dockerfile-js'), path.resolve(process.cwd(), '.')]);

  // [2/6] run all tests
  console.log(chalk.grey(`[2/${stepMax}]`), '🛠 ', 'Running tests');
  await run(['docker', 'run', '-e', 'CI=true', '--rm', BUILD_IMAGE, 'yarn', 'test']);

  // [3/6] build productionized app
  console.log(chalk.grey(`[3/${stepMax}]`), '📦 ', 'Building production app');
  await run(['docker', 'run', '-v', `${path.resolve(__dirname, 'build')}:/app/build`, '--rm', '-w', '/app', BUILD_IMAGE, 'yarn', 'build']);

  // [4/6] build nginx image
  console.log(chalk.grey(`[4/${stepMax}]`), '📦 ', 'Building nginx image', chalk.magenta(`${cfg.registry}:${cfg.tag}`));
  await run(['docker', 'build', '-t', `${cfg.registry}:${cfg.tag}`, '-f', path.resolve(__dirname, './docker/Dockerfile-nginx'), path.resolve(__dirname, './')]);

  // [5/6] docker push nginx image
  console.log(chalk.grey(`[5/${stepMax}]`), '☁️ ', 'Pushing to registry', chalk.magenta(`${cfg.registry}:${cfg.tag}`));
  await run(['docker', 'push', `${cfg.registry}:${cfg.tag}`]);

  // [6/6] deploy to all servers
  await Promise.all(cfg.servers.map(deploy(cfg, stepMax)));

  console.log('🔥 ', chalk.green('Kick the tires and light the fires!'));
  console.log('');
}

try {
  doIt(require(configPath));
} catch (e) {
  console.error(chalk.red('deploy-error'), e);
  process.exit(1);
}
