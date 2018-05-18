var lwip = require('pajk-lwip');

function processVersionFile(versionObj, fileInfo, buffer, cbk) {
	lwip.open(buffer, fileInfo.ext, function(err, image) {
		if (err) return cbk(err, versionObj);

		//update pics width and height
		if (!fileInfo.width) {
			fileInfo.width = image.width() || 50; //incase we don't get a valid width
			fileInfo.height = image.height() || fileInfo.width;
		}

		var vo = versionObj;
		var width = 'auto' === vo.width ? (vo.height / fileInfo.height) * fileInfo.width: vo.width;
		var height = 'auto' === vo.height ? (vo.width / fileInfo.width) * fileInfo.height : vo.height;
		image.batch().resize(width, height).toBuffer(fileInfo.ext, function(err, output){
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
