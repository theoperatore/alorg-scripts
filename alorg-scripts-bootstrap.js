#!/usr/bin/env node

'use strict';

const spawn = require('child_process').spawn;
const commander = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ownPkgJson = require(path.resolve(__dirname, './package.json'));

const projectRoot = path.resolve(process.cwd());
const templatePath = path.resolve(__dirname, 'template');

const baseAlorgFile = require(path.resolve(__dirname, './base-alorg.json'));
const packageJson = require(path.resolve(projectRoot, 'package.json'));

commander
  .version(ownPkgJson.version)
  .description('Bootstrap a project to be deployed following Alorg convention.')
  .option('-v, --verbose', 'print command output for each stuf')
  .parse(process.argv);

const run = ([command, ...args]) => new Promise(async (resolve, reject) => {
  const output = commander.verbose
    ? { stdio: [0, 1, 2] }
    : {};

  const cmd = spawn(
    command,
    args,
    Object.assign(
      {},
      output
    )
  );

  cmd.on('error', err => {
    reject(err);
  });

  cmd.on('close', code => code === 0
    ? resolve()
    : reject());
});

console.log('\nBootstrapping alorg project for deployment...');
console.log('');

const bootstrapIt = async () => {
  // add deployment entry point to package.json
  const deployScriptJson = Object.assign({}, packageJson, {
    scripts: Object.assign({}, packageJson.scripts || {}, {
      deploy: 'node internals/deploy.js',
    }),
  });

  // write package.json changes
  await fs.writeJson(
    path.resolve(projectRoot, 'package.json'),
    deployScriptJson,
    { spaces: 2 }
  );

  // install all deploy.js dependencies and save to package.json
  await run([
    'yarn',
    'add',
    '--dev',
    ...Object.keys(ownPkgJson.dependencies),
  ]);

  // create template alorg.json file with info from packageJson
  const alorgJson = Object.assign({}, baseAlorgFile, {
    name: packageJson.name,
    tag: packageJson.name,
    servers: [
      `root@${packageJson.name}.alorg.net`,
    ],
  });

  // save alorg.json
  await fs.writeJson(
    path.resolve(projectRoot, 'alorg.json'),
    alorgJson,
    { spaces: 2 }
  );

  // copy internal files
  await fs.copy(templatePath, projectRoot);
}

bootstrapIt()
  .then(() => {
    commander.verbose && console.log('');
    console.log('🚀  done');
    console.log('');
    process.exit(0);
  })
  .catch(err => {
    console.log(err)
    process.exit(1);
  });
