import find from "find";

export async function getApiFiles() {
  return new Promise((res) => {
    find.file(`tmp/drupal/`, (file) => {
      const filtered = file.filter((filename) => filename.endsWith('.api.php'));
      res(filtered);
    });
  });
}
