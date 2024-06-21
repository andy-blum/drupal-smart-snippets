import find from "find";

function filterElementFiles(files) {
	return files.filter((filename) => (
		filename.match(/\/Element\/[^\.]*\.php/g)
	));
}

export async function getElementFiles(version) {
	return new Promise(async (res) => {
		const lib = await find.fileSync(`tmp/drupal-${version}/core/lib`);
		const mod = await find.fileSync(`tmp/drupal-${version}/core/modules`);
		const files = filterElementFiles([...lib]);
		res(files);
	});
}
