var chalk = require('chalk');

exports.help = function () {
    return [chalk.bold("NAME"),
        "    rockety\n",
        chalk.bold("SYNOPSIS"),
        "    rockety [options]\n",
        chalk.bold("DESCRIPTION"),
        "    This is a flexible ready to use front-end development toolbox based on Gulp.\n",
        "    More information you can find at http://ivandokov.github.io/rockety/\n",
        chalk.bold("OPTIONS"),
        "    help - displays this help\n",
        "    install <project-name> [args] - creates a new Rockety project. There are few possible arguments:",
        "        --dev - installs latest cutting edge development version",
        "        --noupdate - do not check for newer version of the rockety-cli",
        "",
        "    tasks - lists all tasks\n",
        "    build - runs all tasks\n",
        "    watch - runs all tasks and watches for changes"
        ].join("\n");
}