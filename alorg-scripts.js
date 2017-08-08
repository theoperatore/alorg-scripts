#!/usr/bin/env node

'use strict';

const commander = require('commander');
const pkgJson = require('./package.json');

let tag;

commander
  .version(pkgJson.version)
  .command('deploy', 'packages and deploys current directory to specified registry and servers')
  .parse(process.argv);
