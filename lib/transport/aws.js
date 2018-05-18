/*jslint node: true */
'use strict';

var fs              = require('fs');
var path            = require('path');
var AWS             = require('aws-sdk');
var FileInfo        = require('../fileinfo');
var thumbnail		= require('../thumbnail');

function getContentTypeByFile(fileName) {
	switch(path.extname(fileName.toLowerCase())){
	case '.html': return 'text/html';
	case '.css': return 'text/css';
	case '.json': return 'application/json';
	case '.js': return  'application/x-javascript';
	case '.png': return 'image/png';
	case '.jpg': return  'image/jpg';
	}

	return 'application/octet-stream';
}

function getURL(s3, key, config){
	// getSignedUrl documentation
	// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
	return s3.getSignedUrl('getObject', {
		Bucket: config.bucketName,
		Key: key,
		Expires: config.signedUrlExpires || 900
	});
}

function uploadFile(s3, fileName, fileBuffer, storage, callback) {
	var metaData = getContentTypeByFile(fileName);
	var remoteFilename = path.join(storage.uploadDir, fileName);
	var config = storage.config;
	var params = {
		ACL: config.acl,
		Bucket: config.bucketName,
		Key: remoteFilename,
		Body: fileBuffer,
		ContentType: metaData
	};

	// consider setting params.CacheControl by default to 'max-age=630720000, public'
	if (typeof config.cacheControl !== 'undefined') {
		params.CacheControl = config.cacheControl;
	}

	// consider setting params.Expires by default to new Date(Date.now() + 63072000000)
	if (typeof config.expiresInMilliseconds !== 'undefined') {
		params.Expires = new Date(Date.now() + config.expiresInMilliseconds);
	}

	s3.putObject(params, function(err) {
		if (err) return callback(err);
		callback(err, { url: getURL(s3, remoteFilename, config) });
	});
}

/**
 * AWS transport
 *
 * @param {Object} opts
 * @param {Object} opts.storage
 * @param {Object} opts.storage.aws
 * @param {string} opts.storage.aws.accessKeyId
 * @param {string} opts.storage.aws.secretAccessKey
 * @param {string} opts.storage.aws.region
 * @param {string} opts.storage.aws.bucketName
 * @param {string} opts.storage.aws.acl
 * @param {string} [opts.storage.aws.cacheControl] - Sets the S3 CacheControl
 *   param.
 * @param {Number} [opts.storage.aws.expiresInMilliseconds] - Sets the S3
 *   Expires param with expiresInMilliseconds from the current time
 * @param {boolean} [opts.storage.aws.getSignedUrl=true] - If set to true, the
 *   upload callback will pass a signed URL of the file, that will expire in
 *   signedUrlExpiresSeconds if set (default 900s = 15m). If set to false, the
 *   callback will pass the actual URL. More info about the signed URL here:
 *   http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
 * @param {boolean} [opts.storage.aws.signedUrlExpiresSeconds=900] - For use
 *   with getSignedUrl=true.
 * @param {string} [opts.storage.aws.path] - Path on bucket to store uploads
 *
 * @example
 * awsTransport({
 *   storage: {
 *     type: 'aws',
 *     aws: {
 *       accessKeyId: '...',
 *       secretAccessKey: '...',
 *       region: 'us-west-2',
 *       bucketName: '...',
 *       acl: 'public-read',
 *       cacheControl: 'max-age=630720000, public',
 *       expiresInMilliseconds: 63072000000,
 *       getSignedUrl: false
 *     }
 *   }
 * });
 */
module.exports = function (opts, storage){

    var config = storage.config;
    var s3 = new AWS.S3({ computeChecksums: true });

    var api = {
        /**
         * get files
         */
        get:function(callback){
            var params = {
                Bucket: config.bucketName, // required
                //Delimiter: 'STRING_VALUE',
                //EncodingType: 'url',
                //Marker: 'STRING_VALUE',
                //MaxKeys: 0,
                Prefix: storage.uploadDir
            };
            var files = [];
            s3.listObjectsV2(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack); 
                    return callback(err);
                }
                data.Contents.forEach(function(o) {
                    var sss = {
                        url: getURL(s3, o.Key, config)
                    };
                    var fileInfo = new FileInfo({
                        name: o.Key,
                        size: o.Size,
                        awsFile:sss
                    }, opts, storage);
                    fileInfo.initUrls(opts, storage);
                    files.push(fileInfo);

                });
                callback(null,{files: files});
            });
        },
        post:function(fileInfo, file, finish){
			fs.readFile(file.path, function(err, fileBuffer){
				if (err) return finish(err);
				uploadFile(s3, fileInfo.name, fileBuffer, storage, function(err, awsFile){
					if (err) return finish(err, fileInfo);
					fileInfo.awsFile = awsFile;
					if (!fileInfo.hasVersionImages()){
						fileInfo.proccessed = true;
						fileInfo.initUrls(opts, storage);
						return finish(null, fileInfo);
					}
					
					var count = Object.keys(storage.imageVersions).length;
					thumbnail(fileInfo, fileBuffer, storage.imageVersions, function(version, buffer){
						uploadFile(s3, path.join(version, fileInfo.name), buffer, storage, function(err, awsFile){
							if (0 >= --count){
								fileInfo.proccessed = true;
								fileInfo.initUrls(opts, storage);
								finish(err, fileInfo);
							}
						});
					}, function(err){
						if (err) return finish(err);
					})
				});    
			});
        },
        delete:function(req,res,callback){
            var params = {
                Bucket: config.bucketName,
                Key: path.join(storage.uploadDir, path.basename(req.url))
            };
            s3.deleteObject(params, function(err, data) {
                if (err) return callback(err);

				Object.keys(storage.imageVersions).forEach(function(version) {
					params = {
						Bucket: config.bucketName,
						Key: path.join(storage.uploadDir, version, path.basename(req.url))
					};
					// TODO - Missing callback
					s3.deleteObject(params, function(err, data) {});
				});
                callback(null,data);
            });
        },
		createFileInfo: function(file, field){
			return new FileInfo(file, opts, storage, field);
        }
    };

    return api;
};
