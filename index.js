#!/usr/bin/env node
const request = require('request');//TODO: use got or smth else
const unzipper = require('unzipper');
const path = require("path");

const args = process.argv.slice(2);

(async () => {
    console.log('downloading...');
    const release = request({
        url:'https://api.github.com/repos/h5bp/html5-boilerplate/releases/latest',
        headers: {
          'User-Agent': 'request'
        }
    }, async(error, response, body) =>{
        const data = JSON.parse(body);
        const zipURL = data.assets[0].browser_download_url;
        if(!zipURL){
            throw new Error('Unexpected error')
        }
        const extractPath = path.resolve(path.normalize(args[0] || ''));
        await unzipper.Open.url(request, zipURL).then(d=>d.extract({path: extractPath}));
        console.log('done');
    });
})();