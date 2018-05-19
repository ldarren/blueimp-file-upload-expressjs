/*jslint node: true */
var path			= require('path');
var pObj			= require('pico-common').export('pico/obj');
var checkExists		= require('./checkFolder');

var OPTIONS = {
    tmpDir: 'tmp/',
    uploadUrl: 'files/',
    maxPostSize: 11 * 1024 * 1024, // 11 MB
    minFileSize: 1024,
    maxFileSize: 10 * 1024 * 1024, // 10 MB
    acceptFileTypes: /.+/i,
    useSSL: false,
    // Files not matched by this regular expression force a download dialog,
    // to prevent executing any scripts in the context of the service domain:
    inlineFileTypes: /\.(gif|jpe?g|png)/i,
    imageTypes: /\.(gif|jpe?g|png)/i,
    accessControl: {
      allowOrigin: '*',
      allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE',
      allowHeaders: 'Content-Type, Content-Range, Content-Disposition'
    }
};

function validate(opts){
	checkExists(opts.tmpDir);

	if (!opts.storages) throw new Error('Should has at least one storage defined');
	opts.storages.forEach(function(storage){
		switch(storage.type){
		case 'local':
			checkExists(storage.uploadDir);
			if (!storage.imageVersions) break;
			Object.keys(storage.imageVersions).forEach(function(version) {
				checkExists(path.join(storage.uploadDir, version));
			});
			break;
		case 's3':
			if (!storage.config.bucketName) {
				throw new Error('Please enter valid AWS S3 details');
			}
			break;
		}
	});

	return opts;
}

/*
 * default configurations
 */
module.exports = function (opts){
	return validate(pObj.extends({}, [OPTIONS, opts]));
};
