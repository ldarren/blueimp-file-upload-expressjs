/*jslint node: true */
'use strict';

var fs = require('fs');
var path = require('path');
var formidable = require('formidable');
var FileInfo = require('./lib/fileinfo');
var configs = require('./lib/configs');

function getTransporters(opts, storages){
	var transporters = [];
	storages.forEach(function(storage){
		switch(storage.type){
		case 'local':
			transporters.push(require('./lib/transport/local')(opts, storage));
			break;
		case 's3':
			transporters.push(require('./lib/transport/aws')(opts, storage));
			break;
		}
	});
	return transporters;
}

function calls(transporters, method, params, callback){
	var count = transporters.length;
	function cb(){
		if (0 === --count) return callback.apply(null, arguments);
	}

	transporters.forEach(function(transporter){
		transporter[method].apply(transporter, params.concat(cb));
	});
}

function getFileKey(filePath) {
    return path.basename(filePath);
}

function setNoCacheHeaders(res) {
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
	res.setHeader('Content-Disposition', 'inline; filename="files.json"');
}

function validate(fileInfo, opts) {
	if (opts.minFileSize && opts.minFileSize > fileInfo.size) {
		fileInfo.error = 'File is too small';
	} else if (opts.maxFileSize && opts.maxFileSize < fileInfo.size) {
		fileInfo.error = 'File is too big';
	} else if (!opts.acceptFileTypes.test(fileInfo.name)) {
		fileInfo.error = 'Filetype not allowed';
	}
	return !fileInfo.error;
}

module.exports = function uploadService(opts) {
    var options = configs(opts);
	var storages = options.storages;
	var transporters = getTransporters(options, storages);

    return {
		get: function(req, res, callback) {
			options.host = req.headers.host;
			transporters[0].get(callback);
		},
		post: function(req, res, callback) {
			setNoCacheHeaders(res);
			var form = new formidable.IncomingForm();
			var tmpFiles = [];
			var files = [];
			var fields = {};
			var redirect;

			options.host = req.headers.host;

			req.body = req.body || {};

			function finish(error, fileInfo) {
				if (error) return callback(error, {
					files: files
				}, redirect);

				if (!fileInfo) return callback(null, {
					files: files
				}, redirect);

				var allFilesProccessed = true;

				files.forEach(function(file, idx) {
					allFilesProccessed = allFilesProccessed && file.proccessed;
				});

				if (allFilesProccessed) {
					callback(null, {
						files: files
					}, redirect);
				}
			}

			form.uploadDir = options.tmpDir;
			form.maxFieldsSize = options.maxPostSize;
			form.maxFileSize = options.maxFileSize;

			form.on('fileBegin', function(name, file) {
			}).on('field', function(name, value) {
				fields[name] = value;
				if (name === 'redirect') {
					redirect = value;
				}
			}).on('file', function(name, file) {
				tmpFiles.push(file.path);

				options.saveFile = true;
				transporters.forEach(function(transporter, i){
					var fileInfo = transporter.createFileInfo(file, fields);

					if (!validate(fileInfo, options)) {
						finish(fileInfo.error);
						fs.unlink(file.path);
						return;
					}

					if (!i) {
						files.push(fileInfo);
						transporter.post(fileInfo, file, finish);
					} else {
						transporter.post(fileInfo, file, function(){});
					}
				});
			}).on('aborted', function() {
				// error will be triggered after this
				tmpFiles.forEach(function(file) {
					fs.unlink(file);
				});
			}).on('error', function(e) {
				console.log('form.error', e);
				finish(e);
			}).on('progress', function(bytesReceived) {
				if (bytesReceived > options.maxPostSize) {
					req.connection.destroy();
				}
			}).on('end', function() {
			}).parse(req);
		},
		delete: function(req, res, callback) {
			calls(transporters, 'delete', [req, res], callback);
		}
	};
}
