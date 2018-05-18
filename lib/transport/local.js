/*jslint node: true */
var fs              = require('fs');
var path            = require('path');
var FileInfo        = require('../fileinfo');
var thumbnail		= require('../thumbnail');

module.exports = function(opts, storage) {
    var api = {
        /**
         * get files
         */
        get: function(callback) {
            var files = []
            // fix #41
            opts.saveFile = false;
            fs.readdir(storage.uploadDir, function(err, list) {
				if (err) return callback(err);
                list.forEach(function(name) {
					if ('.' === name[0]) return;
                    var stats = fs.statSync(path.join(storage.uploadDir, name));
                    if (stats.isFile()) {
                        var fileInfo = new FileInfo({
                            name: name,
                            size: stats.size,
                            lastMod: stats.mtime
                        }, opts, storage);
                        fileInfo.initUrls(opts, storage);
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
			var fpath = path.join(storage.uploadDir, fileInfo.name);

            fs.rename(file.path, fpath, function(err){
				if (err) return finish(err, fileInfo);
				if (!fileInfo.hasVersionImages()){
					fileInfo.proccessed = true;
					fileInfo.initUrls(opts, storage);
					return finish(null, fileInfo);
				}

				fs.readFile(fpath, function(err, buffer){
					if (err) return finish(err);

					thumbnail(fileInfo, buffer, storage.imageVersions, function(version, buffer){
						fs.writeFile(path.join(storage.uploadDir, version, fileInfo.name), buffer);
					}, function(err){
						if (err) return finish(err);
						fileInfo.proccessed = true;
						fileInfo.initUrls(opts, storage);
						finish(err, fileInfo);
					})
				});
			});
        },
        delete: function(req, res, callback) {
            var fileName = '';
            if (req.url.slice(0, storage.uploadUrl.length) === storage.uploadUrl) {
                fileName = path.basename(decodeURIComponent(req.url));
                if (fileName[0] !== '.') {
                    fs.unlink(storage.uploadDir + '/' + fileName, function(ex) {
                        Object.keys(storage.imageVersions).forEach(function(version) {
                            // TODO - Missing callback
                            fs.unlink(storage.uploadDir + '/' + version + '/' + fileName, function(){});
                        });
                        callback(null, {
                            success: true
                        });
                    });
                    return;
                }
            }
            callback(new Error('File name invalid:' + fileName), null);
        },
		createFileInfo: function(file, field){
			return new FileInfo(file, opts, storage, field);
		}
    };

    return api;

};
