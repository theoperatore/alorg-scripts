#!/usr/bin/env node

'use strict';

const commander = require('commander');
const pkgJson = require('./package.json');

commander
  .version(pkgJson.version)
  .command('deploy', 'packages and deploys current directory to specified registry and servers')
  .command('eject', 'handle deployment yourself! [Use at your own risk]')
  .parse(process.argv);
