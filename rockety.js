#!/usr/bin/env node

'use strict';

process.title = 'rockety';

var pkg = require('./package.json');
var fs = require('fs');
var path = require('path');
var request = require('request');
var unzip = require('unzip');
var child = require('child_process');
var find = require('find');
var chalk = require('chalk');
var help = require('./help').help();
var Spinner = require('cli-spinner').Spinner;
Spinner.setDefaultSpinnerString(18);

var args = process.argv.slice(2);
var dev = args.indexOf('--dev') > -1;
var noupdate = args.indexOf('--noupdate') > -1;

var githubHeaders = {
    'User-Agent': 'Rockety-cli'
};

function log(msg) {
    console.log(msg);
}
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

    if (noupdate) {
        fn();
        return;
    }

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
            err('You are using ' + pkg.version + ' version of rockety-cli and the latest is v' + release.name);
            err('Please upgrade rockety-cli by running:');
            cmd('npm install rockety-cli -g');
            return;
        }
        fn();
    });
}

function validateProjectName(project) {
    if (!project) {
        err('Project name is required!');
        return;
    }

    try {
        fs.statSync(project).isFile();
        err(project + ' directory already exists!');
        return;
    } catch(e) {}
}

function getRelease(fn) {
    var lastCommit, downloadUrl, release;

    if (dev) {
        downloadUrl = 'https://github.com/ivandokov/rockety/archive/dev.zip';
        release = 'dev';
        fn(downloadUrl, release);
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

        lastCommit = JSON.parse(body)[0];
        downloadUrl = lastCommit.zipball_url;
        release = lastCommit.name;
        fn(downloadUrl, release);
    });
}

function download(downloadUrl, release, fn) {
    msg('Downloading Rockety ' + release);

    request({
        url: downloadUrl,
        headers: {
            'User-Agent': 'Rockety-cli'
        }
    }).pipe(fs.createWriteStream('rockety.zip')).on('close', function() {
        fs.createReadStream('rockety.zip').pipe(unzip.Extract({ path: './' })).on('close', function() {
            fs.unlink('rockety.zip');
            find.dir(/ivandokov-rockety-.*|rockety-dev/, __dirname, function(dirs) {
                var extractedDir = dirs[0];
                fn(extractedDir);
            });
        });
    });
}

function cleanup(project, fn) {
    msg('Removing unnecessary files');
    fs.unlinkSync(project + '/LICENSE');
    fs.unlinkSync(project + '/README.md');
    fs.unlinkSync(project + '/public/.gitignore');
    fn();
}

function setup(extractedDir, project, fn) {
    var bower, npm;
    var spin = new Spinner('%s');
    var opts;

    fs.rename(extractedDir, project);

    var complete = function() {
        if (!bower || !npm) {
            return;
        }
        spin.stop(true);
        fn();
    };

    msg('Running npm and bower install (will take a few minutes)');
    spin.start();
    opts = {cwd: project};

    child.exec('bower install', opts, function(error, stdout, stderr) {
        if (error || stderr) {
            err("bower " + (error || stderr));
        }

        spin.stop(true);
        msg('Bower is done');
        spin.start();

        bower = true;
        complete();
    });

    child.exec('npm install --loglevel error', opts, function(error, stdout, stderr) {
        if (error || stderr) {
            err("npm " + (error || stderr));
        }

        spin.stop(true);
        msg('Npm is done');
        spin.start();

        npm = true;
        complete();
    });
}

function proxy() {
    var args = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
    child.spawn('gulp', args, {
        shell: true,
        cwd: process.cwd(),
        stdio: "inherit"
    });
}

switch (args[0]) {
    case "help":
    case undefined:
        log(help);
        break;

    case "install":
        checkForUpdate(function () {
            var project = args[1];
            validateProjectName(project);
            getRelease(function (downloadUrl, release) {
                download(downloadUrl, release, function(extractedDir) {
                    setup(extractedDir, project, function() {
                        cleanup(project, function() {
                            success('Done!');
                        });
                    });
                });
            });
        });
        break;

    case "tasks":
        proxy('--tasks');
        break;

    default:
        proxy(args);
        break;
}