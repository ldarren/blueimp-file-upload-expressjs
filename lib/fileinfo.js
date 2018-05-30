/*jslint node: true */
'use strict';

var fs = require('fs');
var path = require('path');
var URL = require('url');

// Since Node 0.8, .existsSync() moved from path to fs: 
var _existsSync = fs.existsSync || path.existsSync;
var udf;
var nameCountRegexp = /(?:(?: \(([\d]+)\))?(\.[^.]+))?$/;

function nameCountFunc(s, index, ext) {
	return ' (' + ((parseInt(index, 10) || 0) + 1) + ')' + (ext || '');
}

function safeFile (name, storage) {
    // Prevent directory traversal and creating hidden system files:
    name = path.basename(name).replace(/^\.+/, '');
    // Prevent overwriting existing files:
    while (_existsSync(path.join(storage.uploadDir, name))) {
        name = name.replace(nameCountRegexp, nameCountFunc);
    }
	return name;
};

function FileInfo(file, opts, storage, fields) {
    this.name = opts.saveFile ? safeFile(file.name, storage) : file.name;
    this.size = file.size;
    this.type = file.type;
    this.modified = file.lastMod;
    this.deleteType = 'DELETE';
    this.versions = {};
    this.proccessed = false;
    this.width = udf;
    this.height = udf;
    this.fields = fields;
	this.awsFile = file.awsFile;
	this.error = void 0;
	this.hasVersion = storage.imageVersions && opts.imageTypes.test(this.name);
}

FileInfo.prototype = {
	update: function(file) {
    	this.size = file.size;
	},
	initUrls: function(opts, storage) {
		if (this.error) return;

		var that = this;
		if (this.awsFile) {
			that.url = that.awsFile.url;
			that.deleteUrl = opts.uploadUrl + that.url.split('/')[that.url.split('/').length - 1].split('?')[0];
			if (!that.hasVersionImages()) return;
			var baseUrl = URL.parse(that.url);
			baseUrl.search = undefined;
			var pathname = path.posix.dirname(baseUrl.pathname);
			Object.keys(storage.imageVersions).forEach(function(version) {
				baseUrl.pathname = path.posix.join(pathname, version, that.name);
				that[version + 'Url'] = URL.format(baseUrl);
			});
			return;
		}

		var baseUrl = (opts.useSSL ? 'https:' : 'http:') + '//' + opts.host + opts.uploadUrl;
		that.url = baseUrl + encodeURIComponent(that.name);
		that.deleteUrl = baseUrl + encodeURIComponent(that.name);
		if (!that.hasVersionImages()) return;
		Object.keys(storage.imageVersions).forEach(function(version) {
			if (_existsSync(storage.uploadDir + '/' + version + '/' + that.name)) {
				that[version + 'Url'] = baseUrl + version + '/' + encodeURIComponent(that.name);
			} else {
				// create version failed, use the default url as version url
				that[version + 'Url'] = that.url;
			}
		});
	},
	addVersion: function(version, err, width, height){
		this.versions[version] = {
			err: err ? err: void 0,
			width: width,
			height: height
		};
	},
	hasVersionImages: function() {
		return this.hasVersion;
	}
};

module.exports = FileInfo;
