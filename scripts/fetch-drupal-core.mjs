// Downloads Drupal core, plus the webform module as a contrib sample, into
// test/drupal-core for the compatibility suite (src/lib/core.test.ts).
// Core comes from the GitHub mirror, which tracks git.drupalcode.org and
// serves archives reliably; contrib comes from ftp.drupal.org.
//
//   node scripts/fetch-drupal-core.mjs
//   DRUPAL_CORE_REF=11.x WEBFORM_REF=6.3.x node scripts/fetch-drupal-core.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const coreRef = process.env.DRUPAL_CORE_REF || 'main';
const webformRef = process.env.WEBFORM_REF || '6.3.x';
const dest = process.env.DRUPAL_CORE_DIR || join(import.meta.dirname, '..', 'test', 'drupal-core');

async function fetchTarball(url, into) {
  console.log(`Fetching ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} fetching ${url}`);
  }

  const tarball = join(tmpdir(), `drupal-smart-snippets-${Date.now()}.tar.gz`);
  writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));
  mkdirSync(into, { recursive: true });
  execFileSync('tar', ['xzf', tarball, '-C', into, '--strip-components=1']);
  rmSync(tarball);
}

rmSync(dest, { recursive: true, force: true });

await fetchTarball(`https://github.com/drupal/drupal/archive/refs/heads/${coreRef}.tar.gz`, dest);
await fetchTarball(`https://ftp.drupal.org/files/projects/webform-${webformRef}-dev.tar.gz`, join(dest, 'modules', 'contrib', 'webform'));

console.log(`Extracted Drupal ${coreRef} with webform ${webformRef} to ${dest}`);
