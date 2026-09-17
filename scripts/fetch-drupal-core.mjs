// Downloads a Drupal core tarball into test/drupal-core for the core
// compatibility suite (src/lib/core.test.ts). Uses the GitHub mirror, which
// tracks git.drupalcode.org and serves archives reliably.
//
//   node scripts/fetch-drupal-core.mjs            # main branch
//   DRUPAL_CORE_REF=11.x node scripts/fetch-drupal-core.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ref = process.env.DRUPAL_CORE_REF || 'main';
const dest = process.env.DRUPAL_CORE_DIR || join(import.meta.dirname, '..', 'test', 'drupal-core');
const url = `https://github.com/drupal/drupal/archive/refs/heads/${ref}.tar.gz`;

console.log(`Fetching ${url}`);
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`${response.status} ${response.statusText} fetching ${url}`);
}

const tarball = join(tmpdir(), `drupal-${ref}.tar.gz`);
writeFileSync(tarball, Buffer.from(await response.arrayBuffer()));

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
execFileSync('tar', ['xzf', tarball, '-C', dest, '--strip-components=1']);
rmSync(tarball);

console.log(`Extracted Drupal ${ref} to ${dest}`);
