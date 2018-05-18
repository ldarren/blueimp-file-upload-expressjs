/*jslint node: true */
var fs              = require('fs');
var path            = require('path');
var FileInfo        = require('../fileinfo');
var thumbnail		= require('../thumbnail');

module.exports = function(opts) {
    var api = {
        options: opts,
        /**
         * get files
         */
        get: function(callback) {
            var files = [],
                options = this.options;
            // fix #41
            options.saveFile = false;
            fs.readdir(options.uploadDir, function(err, list) {
                list.forEach(function(name) {
                    var stats = fs.statSync(options.uploadDir + '/' + name);
                    if (stats.isFile() && name[0] !== '.') {
                        var fileInfo = new FileInfo({
                            name: name,
                            size: stats.size,
                            lastMod: stats.mtime
                        }, options);
                        fileInfo.initUrls();
                        files.push(fileInfo);
                    }
                });
                callback(null, {
                    files: files
                });
            });
        },
        post: function(fileInfo, file, finish) {
            var me = this;
            var options = this.options;
			var fpath = path.join(options.uploadDir, fileInfo.name);

            fs.rename(file.path, fpath, function(err){
				if (err) return finish(err, fileInfo);
				if (!fileInfo.hasVersionImages()){
					fileInfo.proccessed = true;
					fileInfo.initUrls();
					return finish(null, fileInfo);
				}

				fs.readFile(fpath, function(err, buffer){
					if (err) return finish(err);

					thumbnail(fileInfo, buffer, options.imageVersions, function(version, buffer){
						fs.writeFile(path.join(options.uploadDir, version, fileInfo.name), buffer);
					}, function(err){
						if (err) return finish(err);
						fileInfo.proccessed = true;
						fileInfo.initUrls();
						finish(err, fileInfo);
					})
				});
			});
        },
        delete: function(req, res, callback) {
            var options = this.options;
            var fileName = '';
            if (req.url.slice(0, options.uploadUrl.length) === options.uploadUrl) {
                fileName = path.basename(decodeURIComponent(req.url));
                if (fileName[0] !== '.') {
                    fs.unlink(options.uploadDir + '/' + fileName, function(ex) {
                        Object.keys(options.imageVersions).forEach(function(version) {
                            // TODO - Missing callback
                            fs.unlink(options.uploadDir + '/' + version + '/' + fileName, function(){});
                        });
                        callback(null, {
                            success: true
                        });
                    });
                    return;
                }
            }
            callback(new Error('File name invalid:' + fileName), null);
        }
    };

    return api;

};
