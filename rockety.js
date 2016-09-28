var fs = require('fs');
var request = require('request');
var unzip = require('unzip');

var projectName = process.argv[2];

if (!projectName) {
    console.error('Project name is required!');
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

    var parsed = JSON.parse(body);
        var release = parsed[0];
        var sha = release.commit.sha.substring(0,7);
        var extractDirName = 'ivandokov-rockety-' + sha;

        console.log('Installing Rockety ' + release.name);

        request({
            url: release.zipball_url,
            headers: {
                'User-Agent': 'Rockety'
            }
        }).pipe(fs.createWriteStream('rockety.zip')).on('close', function() {
            fs.createReadStream('rockety.zip').pipe(unzip.Extract({ path: './' })).on('close', function() {
                fs.unlink('rockety.zip');
                fs.rename(extractDirName, projectName);
                console.log('Done!');
            });
        });
});