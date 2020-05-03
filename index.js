#!/usr/bin/env node
'use strict'

const util = require('util');
const path = require("path");
const chalk = require('chalk');
const ora = require("ora");
const unzipper = require('unzipper');
const request_original = require('request');//TODO: maybe use got or smth else as request is deprecated
const request = util.promisify(request_original);

const args = process.argv.slice(2);

(async () => {
    const spinner = ora('Fetching latest release version').start();

    const {error, response, body} = await request({
        url:'https://api.github.com/repos/h5bp/html5-boilerplate/releases/latest',
        headers: {
            'User-Agent': 'request'
        }
    });
    if(error){
        Promise.reject("smth wrong TODO: error message");
    }
    const data = JSON.parse(body);
    const version = data.name;
    const zipURL = data.assets[0].browser_download_url;
    if(!zipURL){
        Promise.reject('Unexpected error: zipURL not defined')
    }
    const extractPath = path.normalize(args[0] || '');
	spinner.text = `Copying html5-boilerplate ${version} to ${extractPath}`;
    await unzipper.Open.url(request_original, zipURL).then(d=>d.extract({path: path.resolve(extractPath)}));
	spinner.text = `html5-boilerplate copied ${version} to ${extractPath}. Have fun!`;
    spinner.succeed();
})();