import find from "find";

export async function getElementFiles(version) {
	return new Promise((res) => {
		find.file(`tmp/drupal-${version}/core/lib/Drupal/Core/Render/Element/`, (file) => {
			const filtered = file.filter((filename) => filename.endsWith('.php'));
			res(filtered);
		});
	});
}