// Downloads a Drupal core tarball into test/drupal-core for the core
// compatibility suite (src/lib/core.test.ts).
//
//   node scripts/fetch-drupal-core.mjs            # main branch
//   DRUPAL_CORE_REF=11.2.x node scripts/fetch-drupal-core.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ref = process.env.DRUPAL_CORE_REF || 'main';
const dest = process.env.DRUPAL_CORE_DIR || join(import.meta.dirname, '..', 'test', 'drupal-core');
// `ref_type=heads` is required for branch names containing dots, e.g. `11.x`.
const url = `https://git.drupalcode.org/project/drupal/-/archive/${ref}/drupal-${ref}.tar.gz?ref_type=heads`;

// GitLab intermittently answers archive requests with 406 while it builds
// the tarball, so retry a few times before giving up.
async function download(attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`Fetching ${url} (attempt ${attempt})`);
    const response = await fetch(url);
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }
    console.warn(`${response.status} ${response.statusText}`);
    await new Promise(resolve => setTimeout(resolve, attempt * 5000));
  }
  throw new Error(`Failed to fetch ${url} after ${attempts} attempts`);
}

const tarball = join(tmpdir(), `drupal-${ref}.tar.gz`);
writeFileSync(tarball, await download());

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
execFileSync('tar', ['xzf', tarball, '-C', dest, '--strip-components=1']);
rmSync(tarball);

console.log(`Extracted Drupal ${ref} to ${dest}`);
