'use strict';
describe('FileInfo package', function() {
  var FileInfo = require('../lib/fileinfo');
  // TODO - FileInfo default constructor or mock parameters

  it('should provide a safe name for new files');

  it('should generate URLs for the files');

  it('should check against certain rules');

  it('should check or create folders');
});

describe('AWS transport package', function() {
  var uploadFileAWS = require('../lib/transport/aws');
});

describe('Uploader configuration', function() {
  var uploader;
  var configs;

  beforeEach(function() {
    // TODO - Create a mock object for the filesystem
    uploader = require('../index');
  });
 
  it('can require configs without error',function(){
    configs = require('../lib/configs');
    expect(configs).not.toBe(null);
  });

  it('should have default config values', function() {
    expect(configs({
		storages: [
			{
				type: 's3',
				uploadDir: 'upload',
				config:{
					bucketName: 'bucket'
				}
			},{
				type: 'local',
				uploadDir: 'upload'
			}
		]
	  })).toBeDefined();
  });

  it('should support the local filesystem', function() {
    var opts = configs({
		tmpDir: 'tmp/foo',
		storages: [
			{
				type: 'local',
				uploadDir: 'tmp/bar'
			}
		]
	});
    expect(opts.tmpDir).toEqual('tmp/foo');
    expect(opts.storages[0].uploadDir).toEqual('tmp/bar');
  });

  it('should support Amazon Simple Storage Service', function() {
    var awsConfig = {
      type: 's3',
      config: {
        bucketName: 'ali-baba',
        acl: 'private'
      }
    };
    var options = {
      storages: [awsConfig]
    };
    expect(configs(options).storages[0]).toEqual(awsConfig);
  });

  it('should support SSL', function() {
    var options = {
      useSSL: true,
	  storages:[{
	  	type: 'local',
		uploadDir: 'tmp'
	  }]
    };
    expect(configs(options).useSSL).toBe(true);
  });
});

describe('Uploader REST services', function() {
  var options = {
  	storages:[{
		type: 'local',
		uploadDir: 'tmp'
	}]
  };
  var uploader = require('../index')(options);

  it('should provide a GET method', function() {
    expect(uploader.get).toBeDefined();
    expect(uploader.get.length).toEqual(3);
  });

  it('should provide a POST method', function() {
    expect(uploader.post).toBeDefined();
    expect(uploader.post.length).toEqual(3);
  });

  it('should provide a DELETE method', function() {
    expect(uploader.delete).toBeDefined();
    expect(uploader.delete.length).toEqual(3);
  });
});
