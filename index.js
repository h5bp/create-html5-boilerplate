#!/usr/bin/env node
'use strict'
const argv = require('yargs-parser')(process.argv.slice(2), {alias:{release: ['r']}})
const path = require("path");
const chalk = require('chalk');
const ora = require("ora");
const { extract } = require('pacote');
const fs = require("fs-extra");
const os = require('os');
const packageName = 'html5-boilerplate';

(async () => {
    const version = argv['release'] || '';
    const targetDir = path.resolve(argv['_'][0] || './');
    const spinner = ora(`Downloading ${packageName} ${version ? 'version '+version : 'latest version'} to ${targetDir}`).start();
    const tempDir = os.tmpdir()+`/${packageName}-staging`;
    await fs.ensureDir(tempDir);
    try{
        const { from: nameWithVersion } = await extract(packageName+'@'+version, tempDir, {});
	    spinner.text = `${nameWithVersion} copied to ${targetDir}. Have fun!`;
    }catch(err){
        if(err.code === 'ETARGET' && err.type === 'tag'){
            spinner.fail(chalk.red(`version '${err.wanted}' not found in npm registry\navaialable versions:`));
            console.log(err.versions.reverse().join(' | '));
        }else{
            spinner.fail('Unexpected error');
            console.error(err);
        }
        process.exit(0);
    }
    await fs.copy(tempDir+'/dist', targetDir);
    await fs.remove(tempDir);
    spinner.succeed();
    return;
})();