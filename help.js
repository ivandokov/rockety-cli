var chalk = require('chalk');

exports.help = function () {
    return [chalk.bold("NAME"),
        "    rockety\n",
        chalk.bold("SYNOPSIS"),
        "    rockety [options]\n",
        chalk.bold("DESCRIPTION"),
        "    This is a flexible ready to use front-end development toolbox.",
        "    More information you can find at http://ivandokov.github.io/rockety/\n",
        chalk.bold("OPTIONS"),
        "    Rockety-cli delegates the arguments which are not used internally to Gulp so any Gulp arguments will work.\n",
        "    "+chalk.bold("help")+" - displays this help\n",
        "    "+chalk.bold("create <project-name> [args]")+" - creates a new Rockety project. There are few possible arguments:",
        "        --dev - installs latest cutting edge development version",
        "        --noupdate - do not check for newer version of the rockety-cli",
        "",
        "    "+chalk.bold("tasks")+" - lists all tasks\n",
        "    "+chalk.bold("build")+" - runs all tasks\n",
        "    "+chalk.bold("watch")+" - runs all tasks and watches for changes"
        ].join("\n");
}
