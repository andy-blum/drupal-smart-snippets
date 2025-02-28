import find from "find";

export async function getApiFiles(version) {
  return new Promise((res) => {
    find.file(`tmp/drupal-${version}/`, (file) => {
      const filtered = file.filter((filename) => filename.endsWith('.api.php'));
      res(filtered);
    });
  });
}
