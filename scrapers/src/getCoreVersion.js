import { createWriteStream } from "fs";
import download from "download";
import tar from "tar";

const DRUPAL_URL = 'https://ftp.drupal.org/files/projects';

export async function getCoreVersion(version) {
  const versionFile = `drupal-${version}.tar.gz`;

  await download(`${DRUPAL_URL}/${versionFile}`, 'tmp');

  await tar.x({
    gzip: true,
    file: `tmp/${versionFile}`,
    cwd: `tmp`
  });
}
