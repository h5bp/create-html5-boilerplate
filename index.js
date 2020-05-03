#!/usr/bin/env node
const request = require('request');//TODO: use got or smth else
const unzipper = require('unzipper');

const url = 'https://github.com/h5bp/html5-boilerplate/releases/latest/download/html5-boilerplate_v7.3.0.zip';

(async () => {
  unzipper.Open.url(request, url).then(d=>d.extract({path: ''}));
})();