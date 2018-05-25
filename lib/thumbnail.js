var Jimp = require('jimp');

function processVersionFile(versionObj, fileInfo, buffer, cbk) {
	Jimp.read(buffer, function(err, image) {
		if (err) return cbk(err, versionObj);

		//update pics width and height
		if (!fileInfo.width) {
			fileInfo.width = image.bitmap.width || 50; //incase we don't get a valid width
			fileInfo.height = image.bitmap.height || fileInfo.width;
		}

		var vo = versionObj;
		var width = 'auto' === vo.width ? Jimp.AUTO : vo.width;
		var height = 'auto' === vo.height ? Jimp.AUTO : vo.height;
		image.resize(width, height, Jimp.RESIZE_NEAREST_NEIGHBOR).getBuffer(fileInfo.type, function(err, output){
			cbk(err, output, width, height);
		});
	});
}

module.exports = function resize(fileInfo, buffer, imageVersions, save, last){
	var versions = Object.keys(imageVersions);
	var count = versions.length;
	var error;

	versions.forEach(function(version) {
		processVersionFile(imageVersions[version], fileInfo, buffer, function(err, output, width, height){
			count--;
			if (err){
				error = error || err;
			}else{
				fileInfo.addVersion(version, err, width, height);
				save(version, output);
			}
			if (!count) last(error)
		})
	});
};
