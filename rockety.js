#!/usr/bin/env node

'use strict';

process.title = 'rockety';

var pkg = require('./package.json');
var fs = require('fs');
var request = require('request');
var unzip = require('unzip');
var exec = require('child_process').exec;
var chalk = require('chalk');
var Spinner = require('cli-spinner').Spinner;
Spinner.setDefaultSpinnerString(18);

var args = process.argv.slice(2);
var projectName = args[0];
var dev = args.indexOf('--dev') > -1;

var githubHeaders = {
    'User-Agent': 'Rockety-cli'
};

function err(err) {
    console.warn(chalk.red(err));
}
function msg(msg) {
    console.log(chalk.cyan(msg));
}
function cmd(cmd) {
    console.log(chalk.yellow(cmd));
}
function success(msg) {
    console.log(chalk.green.bold(msg));
}

function checkForUpdate(fn) {
    var release;

    request({
        url: 'https://api.github.com/repos/ivandokov/rockety-cli/tags',
        headers: githubHeaders
    }, function(error, response, body) {
        if (error) {
            err(error);
            return;
        }
        if (response.statusCode !== 200) {
            err(response.statusCode + ' cannot connect to Github');
            err(body.message);
            return;
        }

        release = JSON.parse(body)[0];
        if (release.name !== 'v' + pkg.version) {
            err('You are using ' + release.name + ' version of rockety-cli and the latest is v' + pkg.version);
            err('Please upgrade rockety-cli by running:');
            cmd('npm install rockety-cli -g');
            return;
        }
        fn();
    });
}

function validateProjectName() {
    if (!projectName) {
        err('Project name is required!');
        return;
    }

    try {
        fs.statSync(projectName).isFile();
        err(projectName + ' directory already exists!');
        return;
    } catch(e) {}
}

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
        headers: githubHeaders
    }, function(error, response, body) {
        if (error) {
            err(error);
            return;
        }
        if (response.statusCode !== 200) {
            err(response.statusCode + ' cannot connect to Github');
            err(body.message);
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
    msg('Downloading Rockety ' + releaseName);

    request({
        url: downloadUrl,
        headers: {
            'User-Agent': 'Rockety-cli'
        }
    }).pipe(fs.createWriteStream('rockety.zip')).on('close', function() {
        fs.createReadStream('rockety.zip').pipe(unzip.Extract({ path: './' })).on('close', function() {
            fs.unlink('rockety.zip');
            setup(extractDirName);
        });
    });
}

function cleanup() {
    msg('Removing unnecessary files');
    fs.unlink(projectName + '/LICENSE');
    fs.unlink(projectName + '/README.md');
    fs.unlink(projectName + '/public/.gitignore');
}

function setup(extractDirName) {
    var bower, npm;
    var spin = new Spinner('%s');

    fs.rename(extractDirName, projectName);

    cleanup();

    var complete = function() {
        if (!bower || !npm) {
            return;
        }
        spin.stop(true);
        success('Done!');
    };

    msg('Running npm and bower install');
    spin.start();
    exec('bower install', {cwd: projectName, shell:'/bin/bash'}, function(error, stdout, stderr) {
        bower = true;
        complete();
    });
    exec('npm install', {cwd: projectName, shell:'/bin/bash'}, function(error, stdout, stderr) {
        npm = true;
        complete();
    });
}

checkForUpdate(function() {
    validateProjectName();
    getRelease(function(downloadUrl, releaseName, extractDirName) {
        download(downloadUrl, releaseName, extractDirName);
    });
});