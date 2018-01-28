#!/usr/bin/env node

'use strict';

process.title = 'rockety';

let pkg = require('./package.json');
let fs = require('fs');
let path = require('path');
let copydir = require('copy-dir');
let request = require('request');
let unzip = require('unzip');
let child = require('child_process');
let exec = child.exec;
let execSync = child.execSync;
let spawn = child.spawn;
let find = require('find');
let chalk = require('chalk');
let confirm = require('confirm-simple');
let help = require('./help').help();
let Spinner = require('cli-spinner').Spinner;
Spinner.setDefaultSpinnerString(18);

let args = process.argv.slice(2);
let dev = args.indexOf('--dev') > -1;
let noupdate = args.indexOf('--noupdate') > -1;

let githubHeaders = {
    'User-Agent': 'Rockety-cli'
};

let log = (msg) => { console.log(msg); }
let err = (err) => { console.warn(chalk.red(err)); }
let msg = (msg) => { console.log(chalk.cyan(msg)); }
let cmd = (cmd) => { console.log(chalk.yellow(cmd)); }
let success = (msg) => { console.log(chalk.green.bold(msg)); }

let checkForUpdate = (fn) => {
    let release;

    if (noupdate) {
        fn();
        return;
    }

    request({
        url: 'https://api.github.com/repos/ivandokov/rockety-cli/tags',
        headers: githubHeaders
    }, (error, response, body) => {
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

let validateProjectName = (project, fn) => {
    if (!project) {
        err('Project name is required!');
        return;
    }

    try {
        fs.statSync(project).isFile();
        confirm(path.resolve(project) + ' already exists. Do you want to continue', ['yes', 'no'], ok => {
            ok ? fn() : process.exit();
        });
    } catch(e) {
        fn();
    }
}

let getRelease = (fn) => {
    let lastCommit, downloadUrl, release;

    if (dev) {
        release = 'master';
        downloadUrl = 'https://github.com/ivandokov/rockety/archive/' + release + '.zip';
        fn(downloadUrl, release);
        return;
    }

    request({
        url: 'https://api.github.com/repos/ivandokov/rockety/tags',
        headers: githubHeaders
    }, (error, response, body) => {
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

let download = (downloadUrl, release, fn) => {
    let cacheDir = path.join(process.env.HOME, '.rockety');
    let releaseCacheDir = path.join(process.env.HOME, '.rockety/' + release);

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
    } catch (e) {}

    msg('Downloading Rockety ' + release);

    request({
        url: downloadUrl,
        headers: {
            'User-Agent': 'Rockety-cli'
        }
    }).pipe(fs.createWriteStream('rockety.zip')).on('close', () => {
        fs.createReadStream('rockety.zip').pipe(unzip.Extract({ path: './' })).on('close', () => {
            fs.unlink('rockety.zip', () => {});
            find.dir(/ivandokov-rockety-.*|rockety-master/, process.cwd(), dirs => {
                let extractedDir = dirs[0];
                fs.rename(extractedDir, releaseCacheDir, () => {});
                fn(releaseCacheDir);
            });
        });
    });
}

let setup = (source, project, fn) => {
    let packageManager = 'npm';
    let spin = new Spinner('%s');
    let opts;

    if (dev) {
        copydir.sync(source, project);
        execSync('rm -rf ' + source, {
            shell: true
        });
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

    msg('Running ' + packageManager + ' install');
    spin.start();
    opts = {
        env: process.env,
        cwd: project
    };

    exec(packageManager + ' install --loglevel error', opts, (error, stdout, stderr) => {
        let errMsg = (error || stderr);
        if (errMsg && errMsg.indexOf('warning') !== 0) {
            err(packageManager + " " + errMsg);
        }

        spin.stop(true);
        fn();
    });
}

let proxy = () => {
    let args = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
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
        checkForUpdate(() => {
            let project = args[1];
            validateProjectName(project, () => {
                getRelease((downloadUrl, release) => {
                    download(downloadUrl, release, (extractedDir) => {
                        setup(extractedDir, project, () => {
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
