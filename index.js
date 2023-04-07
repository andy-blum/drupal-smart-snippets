import { rm, readdir, writeFile } from "node:fs/promises";
import he from "he";
import { getApiFiles } from "./src/getApiFiles.js";
import { getCoreVersion } from "./src/getCoreVersion.js";
import { getRawHooks } from "./src/getRawHooks.js";
import { formatHooks } from "./src/formatHooks.js";
import { getElementFiles } from "./src/getElementFiles.js";
import { getRawElements } from "./src/getRawElements.js";
import { formatElements } from "./src/formatElements.js";

const SUPPORTED_VERSIONS = [
  '10.0.0',
  '9.5.0',
];

// 1. Set up final snippets file.
let allHooks = {};
let allElements = {};

// 2. Clean tmp directory.
try {
  const contents = await readdir('./tmp');
  for (const item of contents) {
    await rm(`./tmp/${item}`, {
      force: true,
      recursive: true
    });
  }
} catch (error) {}

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
  const formattedHooks = formatHooks(rawHooks);

  // 7. Add hook snippet to full set.
  formattedHooks.forEach(hook => {
    allHooks[hook.prefix] = hook;
  });

  // 8. Find all .php files for element.
  const elementFiles = await getElementFiles(version);
  console.log(`  - Found ${elementFiles.length} files under core/lib/Drupal/Core/Render/Element`);

  // 9. Find all Element docblocks.
  const rawElements = await getRawElements(elementFiles);
  console.log(`  - Found ${rawElements.length} defined Elements`);

  // 10. Format element objects for VS Code usage.
  const formattedElements = formatElements(rawElements);

  // 11. Add element snippet to full set.
  formattedElements.forEach(element => {
    allElements[element.prefix[1]] = element;
  });
}

// 12. Sort hooks alphabetically
allHooks = Object.fromEntries(
  Object
    .entries(allHooks)
    .sort((a, b) => {
      const aName = a[0].toLowerCase()
      const bName = b[0].toLowerCase()
      if (aName > bName) {
        return 1;
      }

      if (aName < bName) {
        return -1;
      }

      return 0;
    })
)

// 13. Write final hook file.
await writeFile(
  './snippets/hooks.json',
  he.unescape(JSON.stringify(allHooks, null, 2)),
);

// 14. Write final element file.
await writeFile(
  './snippets/elements.json',
  he.unescape(JSON.stringify(allElements, null, 2)),
);
