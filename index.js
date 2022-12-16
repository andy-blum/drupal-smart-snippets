import { rm, readdir, writeFile } from "node:fs/promises";
import he from "he";
import { getApiFiles } from "./src/getApiFiles.js";
import { getCoreVersion } from "./src/getCoreVersion.js";
import { getRawHooks } from "./src/getRawHooks.js";
import { formatHooks } from "./src/formatHooks.js";

const SUPPORTED_VERSIONS = [
  '10.0.0',
  '9.5.0',
];

// 1. Set up final snippets file.
const allHooks = {};

// 2. Clean tmp directory.
try {
  const contents = await readdir('./tmp');
  for (const item of contents) {
    await rm(`./tmp/${item}`, {
      force: true,
      recursive: true
    });
  }
} catch (error) {
  // If ./tmp doesn't exist, no worries.
}

for (const version of SUPPORTED_VERSIONS) {
  console.log(`Drupal ${version}`);

  // 3. Download & un-archive tarball.
  await getCoreVersion(version);
  console.log(`  - Downloaded`);

  // 4. Find all *.api.php files.
  const apiFiles = await getApiFiles(version);
  console.log(`  - Found ${apiFiles.length} files matching *.api.php`);

  // 5. Find all hook docblocks.
  const rawHooks = await getRawHooks(apiFiles);
  console.log(`  - Found ${rawHooks.length} defined hooks`);

  // 6. Format hook object for VS Code usage.
  const formattedHooks = formatHooks(rawHooks, version);

  // 7. Add hook snippet to full set.
  formattedHooks.forEach(hook => {
    allHooks[hook.prefix] = hook;
  });
}

// 8. Write final file.
await writeFile(
  './snippets/hooks.json',
  he.unescape(JSON.stringify(allHooks, null, 2)),
);
