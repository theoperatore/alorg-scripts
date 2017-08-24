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
  .option('-q, --quiet', 'do not print command output for each step')
  .on('--help', () => {
    console.log('  Specify which registry and which release of this app via config file.');
    console.log('  Example custom config usage:')
    console.log('');
    console.log(chalk.cyan('    alorg-scripts deploy --config ./alorg-staging.json'));
    console.log('');
    console.log('  Valid configs need at a minimum: name, registry, tag, servers.');
    console.log('  Name, Registry, and Tag are strings, while servers is an array of ip adresses or FQDN adresses (via ssh)');
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

const configPath = commander.config === true
  ? './alorg.json'
  : (commander.config || './alorg.json');

const stagingPath = path.resolve(__dirname, './staging');
const templatePath = path.resolve(__dirname, './template');

const run = ([command, ...args], options = {}) => new Promise(async (resolve, reject) => {
  const opts = Object.assign(
    {},
    options,
    command.quiet
      ? {}
      : { stdio: [0, 1, 2] }
  );

  const cmd = spawn(command, args, opts);

  cmd.on('error', err => {
    reject(err);
  });

  cmd.on('close', code => code === 0
    ? resolve()
    : reject());
});

async function doIt() {
  console.log('');
  console.log('🏠 ', 'Preparing environment...');

  // copy source to staging environment
  await run([
    'rsync',
    '-aqz',
    '--exclude-from', `${path.resolve(__dirname, './.stagingIgnore')}`,
    `${path.resolve(process.cwd())}/`,
    stagingPath,
  ]);

  // copy internals to staging environment
  await run([
    'rsync',
    '-aqz',
    `${templatePath}/`,
    stagingPath,
  ]);

  // run the deploy.js script
  await run([
    'node',
    'internals/deploy.js',
    '-c',
    configPath,
  ], { cwd: path.resolve(__dirname, './staging' )});

  // destroy staging env
  await run([
    'rm',
    '-rf',
    path.resolve(__dirname, './staging'),
  ]);
}

// errors should be handled by deploy.js
doIt().catch(() => process.exit(1));
