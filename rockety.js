#!/usr/bin/env node

'use strict';

process.title = 'rockety';

var fs = require('fs');
var request = require('request');
var unzip = require('unzip');
var child = require('child_process');

var args = process.argv.slice(2);
var projectName = args[0];
var dev = args.indexOf('--dev') > -1;

if (!projectName) {
    console.error('Project name is required!');
    return;
}

try {
    fs.statSync(projectName).isFile();
    console.error(projectName + ' directory already exists!');
    return;
} catch(e) {}

function getRelease(fn) {
    var release, downloadUrl, releaseName, extractDirName;

    if (dev) {
        downloadUrl = 'https://github.com/ivandokov/rockety/archive/dev.zip';
        releaseName = 'dev';
        extractDirName = 'rockety-dev';
        fn(downloadUrl, releaseName, extractDirName);
        return;
    }

    request({
        url: 'https://api.github.com/repos/ivandokov/rockety/tags',
        headers: {
            'User-Agent': 'Rockety'
        }
    }, function(error, response, body) {
        if (error) {
            console.error(error);
            return;
        }
        if (response.statusCode !== 200) {
            console.error(response.statusCode + ' cannot connect to Github');
            return;
        }

        release = JSON.parse(body)[0];
        downloadUrl = release.zipball_url;
        releaseName = release.name;
        extractDirName = 'ivandokov-rockety-' + release.commit.sha.substring(0,7);
        fn(downloadUrl, releaseName, extractDirName);
    });
}

function download(downloadUrl, releaseName, extractDirName) {
    console.log('Installing Rockety ' + releaseName);

    request({
        url: downloadUrl,
        headers: {
            'User-Agent': 'Rockety'
        }
    }).pipe(fs.createWriteStream('rockety.zip')).on('close', function() {
        fs.createReadStream('rockety.zip').pipe(unzip.Extract({ path: './' })).on('close', function() {
            fs.unlink('rockety.zip');
            setup(extractDirName);
        });
    });
}

function setup(extractDirName) {
    fs.rename(extractDirName, projectName);
    console.log('Running npm install');
    child.execSync('npm install', {cwd: __dirname + '/' + projectName});
    cleanup();
}

function cleanup() {
    fs.unlink(__dirname + '/' + projectName + '/CHANGELOG.md');
    fs.unlink(__dirname + '/' + projectName + '/LICENSE');
    fs.unlink(__dirname + '/' + projectName + '/README.md');
    console.log('Done!');
}

getRelease(function(downloadUrl, releaseName, extractDirName) {
    download(downloadUrl, releaseName, extractDirName);
});