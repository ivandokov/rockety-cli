#!/usr/bin/env node

'use strict';

process.title = 'rockety';

var pkg = require('./package.json');
var fs = require('fs');
var path = require('path');
var copydir = require('copy-dir');
var request = require('request');
var unzip = require('unzip');
var child = require('child_process');
var exec = child.exec;
var execSync = child.execSync;
var spawn = child.spawn;
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
            err('You are using version ' + pkg.version + ' of rockety-cli and the latest is ' + release.name);
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
        process.exit();
    } catch(e) {}
}

function getRelease(fn) {
    var lastCommit, downloadUrl, release;

    if (dev) {
        release = 'master';
        downloadUrl = 'https://github.com/ivandokov/rockety/archive/' + release + '.zip';
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
    var cacheDir = path.join(process.env.HOME, '.rockety');
    var releaseCacheDir = path.join(process.env.HOME, '.rockety/' + release);

    /**
     * Create cache directory for releases
     */
    try {
        fs.statSync(cacheDir).isFile();
    } catch(e) {
        fs.mkdirSync(cacheDir);
    }

    /**
     * Check for cached version of this release
     */
    try {
        fs.statSync(releaseCacheDir).isFile();
        msg('Using cached Rockety ' + release);
        fn(releaseCacheDir);
        return;
    } catch (e) {
    }

    msg('Downloading Rockety ' + release);

    request({
        url: downloadUrl,
        headers: {
            'User-Agent': 'Rockety-cli'
        }
    }).pipe(fs.createWriteStream('rockety.zip')).on('close', function() {
        fs.createReadStream('rockety.zip').pipe(unzip.Extract({ path: './' })).on('close', function() {
            fs.unlink('rockety.zip');
            find.dir(/ivandokov-rockety-.*|rockety-master/, process.cwd(), function(dirs) {
                var extractedDir = dirs[0];
                fs.rename(extractedDir, releaseCacheDir);
                fn(releaseCacheDir);
            });
        });
    });
}

function setup(source, project, fn) {
    var bower, npm, packageManager = 'npm';
    var spin = new Spinner('%s');
    var opts;

    if (dev) {
        fs.rename(source, project);
    } else {
        copydir.sync(source, project);
    }

    msg('Checking if yarn is installed');
    try {
        execSync('yarn --version 2>/dev/null', {
            shell: true
        });
        packageManager = 'yarn';
        msg('Selecting yarn');
    } catch(e) {
        msg('Falling back to npm');
    }

    var complete = function() {
        if (!bower || !npm) {
            return;
        }
        spin.stop(true);
        fn();
    };

    msg('Running ' + packageManager + ' and bower install');
    spin.start();
    opts = {
        env: process.env,
        cwd: project
    };

    exec('bower install', opts, function(error, stdout, stderr) {
        if (error || stderr) {
            err("bower " + (error || stderr));
        }

        spin.stop(true);
        msg('bower is done');
        spin.start();

        bower = true;
        complete();
    });

    exec(packageManager + ' install --loglevel error', opts, function(error, stdout, stderr) {
        var errMsg = (error || stderr);
        if (errMsg && errMsg.indexOf('warning') !== 0) {
            err(packageManager + " " + errMsg);
        }

        spin.stop(true);
        msg(packageManager + ' is done');
        spin.start();

        npm = true;
        complete();
    });
}

function proxy() {
    var args = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
    spawn('gulp', args, {
        shell: true,
        env: process.env,
        cwd: process.cwd(),
        stdio: "inherit"
    });
}

switch (args[0]) {
    case "help":
    case undefined:
        log(help);
        break;

    case "create":
        checkForUpdate(function () {
            var project = args[1];
            validateProjectName(project);
            getRelease(function (downloadUrl, release) {
                download(downloadUrl, release, function(extractedDir) {
                    setup(extractedDir, project, function() {
                        success('Done!');
                    });
                });
            });
        });
        break;

    case "tasks":
        proxy('--tasks');
        break;

    default:
        try {
            fs.statSync('gulpfile.js').isFile();
            fs.statSync('rockety.yml').isFile();
        } catch(e) {
            err('You are not in Rockety project directory!');
            process.exit();
        }
        proxy(args);
        break;
}
