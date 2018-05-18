/*jslint node: true */
'use strict';

var fs              = require('fs');
var path            = require('path');
var AWS             = require('aws-sdk');
var FileInfo        = require('../fileinfo.js');

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
module.exports = function (opts){

    var configs = opts.storage.aws;

    // init aws
    AWS.config.update({
        accessKeyId: configs.accessKeyId,
        secretAccessKey: configs.secretAccessKey
    });
    if (configs.region) AWS.config.region = configs.region;

    var api = {
        s3:new AWS.S3({computeChecksums:true}),
        configs:configs,
        options:opts,
        /**
         * get files
         */
        get:function(callback){
            var params = {
                Bucket: api.configs.bucketName, // required
                //Delimiter: 'STRING_VALUE',
                //EncodingType: 'url',
                //Marker: 'STRING_VALUE',
                //MaxKeys: 0,
                Prefix: opts.uploadDir
            };
            var files = [];
            var options = this.options;
            this.s3.listObjectsV2(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack); 
                    return callback(err);
                }
                data.Contents.forEach(function(o) {
                    var sss = {
                        url: getURL(api.s3, o.Key, configs)
                    };
                    var fileInfo = new FileInfo({
                        name: o.Key,
                        size: o.Size,
                        awsFile:sss
                    }, options);
                    fileInfo.initUrls();
                    files.push(fileInfo);

                });
                callback(null,{files: files});
            });
        },
        post:function(fileInfo,file,finish){
            
            uploadFile(this.s3, fileInfo.name, file.path, opts, function(err, awsFile){
                if(!err){
                    fileInfo.awsFile = awsFile;
                    fileInfo.proccessed = true;
                    fileInfo.initUrls();
                }
                finish(err, fileInfo);
			});    
        },
        delete:function(req,res,callback){
            var options = api.options;
            var params = {
                Bucket: options.storage.aws.bucketName, // required
                Key: decodeURIComponent(req.url.split('/')[req.url.split('/').length - 1]) // required
            };
            console.log(params);
            this.s3.deleteObject(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack); 
                    return callback(err);
                }

                console.log(data); // successful response
                callback(null,data);
            });
        }
    };

    return api;
};

function getContentTypeByFile(fileName) {
	var rc = 'application/octet-stream';
	var fn = fileName.toLowerCase();

	if (fn.indexOf('.html') >= 0) rc = 'text/html';
	else if (fn.indexOf('.css') >= 0) rc = 'text/css';
	else if (fn.indexOf('.json') >= 0) rc = 'application/json';
	else if (fn.indexOf('.js') >= 0) rc = 'application/x-javascript';
	else if (fn.indexOf('.png') >= 0) rc = 'image/png';
	else if (fn.indexOf('.jpg') >= 0) rc = 'image/jpg';

	return rc;
}

function getURL(s3, key, opts){
	// getSignedUrl documentation
	// http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getSignedUrl-property
	return s3.getSignedUrl('getObject', {
		Bucket: opts.bucketName,
		Key: key,
		Expires: opts.signedUrlExpires || 900
	});
}

function uploadFile(s3, fileName, filePath, config, callback) {
	var opts = config.storage.aws;
	fs.readFile(filePath, function(err, fileBuffer){
		if (err) return callback(err);
		var metaData = getContentTypeByFile(fileName);
		var remoteFilename = path.join(config.uploadDir, fileName);
		var params = {
			ACL: opts.acl,
			Bucket: opts.bucketName,
			Key: remoteFilename,
			Body: fileBuffer,
			ContentType: metaData
		};

		// consider setting params.CacheControl by default to 'max-age=630720000, public'
		if (typeof opts.cacheControl !== 'undefined') {
			params.CacheControl = opts.cacheControl;
		}

		// consider setting params.Expires by default to new Date(Date.now() + 63072000000)
		if (typeof opts.expiresInMilliseconds !== 'undefined') {
			params.Expires = new Date(Date.now() + opts.expiresInMilliseconds);
		}

		s3.putObject(params, function(err) {
			if (err) return callback(err);
			callback(err, { url: getURL(s3, remoteFilename, opts) });
		});
	});
}
