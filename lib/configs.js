/*jslint node: true */
var pObj = require('pico-common').export('pico/obj');
var checkExists     = require('./checkFolder.js');

var OPTIONS = {
    uploadUrl: '/files/',
    maxPostSize: 11000000000, // 11 GB
    minFileSize: 1,
    maxFileSize: 10000000000, // 10 GB
    acceptFileTypes: /.+/i,
    copyImgAsThumb: true,
    useSSL: false,
    UUIDRegex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    // Files not matched by this regular expression force a download dialog,
    // to prevent executing any scripts in the context of the service domain:
    inlineFileTypes: /\.(gif|jpe?g|png)/i,
    imageTypes: /\.(gif|jpe?g|png)/i,
    imageVersions: {
      'thumbnail': {
        width: 99,
        height: 'auto'
      }
    },
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
