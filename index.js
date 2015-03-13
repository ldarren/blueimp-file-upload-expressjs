'use strict';

var FileInfo        = require('./lib/fileinfo.js');
var configs         = require('./lib/configs');
var formidable      = require('formidable');
var fs              = require('fs');
var path            = require('path');

module.exports = uploadService;

function uploadService(opts) {
    var options = configs.apply(opts);
    var transporter = require('./lib/transport/'+options.storage.type === 'local'?'aws':'local')(options);
    transporter = transporter(options);

    var fileUploader = {};

    fileUploader.config = options;

    function setNoCacheHeaders(res) {
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Content-Disposition', 'inline; filename="files.json"');
    }

    fileUploader.get = function(req, res, callback) {
        setNoCacheHeaders(res);
        transporter.get(callback);
    }; 
  
    fileUploader.post = function(req, res, callback) {
        setNoCacheHeaders(res);
        var form = new formidable.IncomingForm();
        var tmpFiles = [];
        var files = [];
        var map = {};
        var redirect;
   
        req.body = req.body || {};

        function finish(error,sss,versions) {
            finish.counter -= 1;
            if (!finish.counter) {
                files.forEach(function(fileInfo) {
                    fileInfo.initUrls(req, sss,versions);
                });
                callback(error,{files: files,versions:versions}, redirect);
            }
        }

        finish.counter = 1;
        
        form.uploadDir = options.tmpDir;

        form.on('fileBegin', function(name, file) {
            tmpFiles.push(file.path);
            var fileInfo = new FileInfo(file, options, req, true);
            fileInfo.safeName();
            map[path.basename(file.path)] = fileInfo;
            files.push(fileInfo);
        }).on('field', function(name, value) {
            if (name === 'redirect') {
                redirect = value;
            }
        }).on('file', function(name, file) {
            var fileInfo = map[path.basename(file.path)];
            fileInfo.size = file.size;
            if (!fileInfo.validate()) {
                finish(fileInfo.error);
                fs.unlink(file.path);
                return;
            }

            transporter.post(fileInfo,file,finish);

        }).on('aborted', function() {
            finish('aborted');
            tmpFiles.forEach(function(file) {
                fs.unlink(file);
            });
        }).on('error', function(e) {
            console.log('form.error',e);
            finish(e);
        }).on('progress', function(bytesReceived) {
            if (bytesReceived > options.maxPostSize) {
                req.connection.destroy();
            }
        }).on('end', function() {
            if (options.storage.type == 'local') {
                finish();
            }
        }).parse(req);
    };

    fileUploader.delete = function(req, res, callback) {
        transporter.delete(req,res,callback);    
    };

    return fileUploader;
}
