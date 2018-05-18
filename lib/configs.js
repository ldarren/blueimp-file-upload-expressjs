/*jslint node: true */
var pObj = require('pico-common').export('pico/obj');
var checkExists     = require('./checkFolder.js');

var OPTIONS = {
    uploadUrl: '/files/',
    maxPostSize: 11000000, // 11 MB
    minFileSize: 1,
    maxFileSize: 10000000, // 10 MB
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
    },
    storage: {
      type: 'local'
    }
};

function validate(opt){
	if ( opt.storage.type === 'local' ) {
		checkExists(opt.tmpDir);
		checkExists(opt.uploadDir);
		if (opt.copyImgAsThumb) {
			Object.keys(opt.imageVersions).forEach(function(version) {
				checkExists(opt.uploadDir + '/' + version);
			});
		}
	}

	if( opt.storage.type === 'aws') {
		   
		if (!opt.storage.aws.accessKeyId || !opt.storage.aws.secretAccessKey || !opt.storage.aws.bucketName) {
			throw new Error('Please enter valid AWS S3 details');
		}
	}
	return opt;
}

/*
 * default configurations
 */
module.exports = function (opts){
	return validate(pObj.extends({}, [OPTIONS, opts]));
};
