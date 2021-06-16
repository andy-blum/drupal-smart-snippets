const del = require('del');
const download = require('download');
const tar = require('tar');
const find = require('find');
const fs = require('fs');
const writeJsonFile = require('write-json-file');

// Set up dest object for hooks snippets
const hooks = {};

(async () => {
  const versions = [
    '9.2.0',
    '8.9.16'
  ];
  const drupal_org = 'https://ftp.drupal.org/files/projects/';

  // Remove previously downloaded/extracted files if they exist
  await del('./tmp');

  // Download & Extract each version
  for (const version of versions) {
    const file = `drupal-${version}.tar.gz`
    console.log(`Downloading Drupal ${version}`);
    await download(`${drupal_org}/${file}`, 'tmp');
    console.log(`Extracting Drupal ${version}`);
    await tar.x({
      gzip: true,
      file: `tmp/${file}`,
      cwd: `tmp`
    });
  }

  console.log(`${versions.length} versions of Drupal core downloaded.`)

  // Iterate over core versions
  for (const version of versions) {

    // Find all files ending in .api.php
    const apis = await new Promise((res, rej) => {
      find.file(`tmp/drupal-${version}/`, (file) => {
        const filtered = file.filter((filename) => filename.endsWith('.api.php'));
        res(filtered);
      });
    });

    console.log(`Found ${apis.length} files matching "*.api.php" in Drupal ${version}.`);

    // Iterate over each file.api.php
    for (const api of apis) {

      const contents = await new Promise((res, rej) => {
        fs.readFile(api, 'utf8', (err, data) => {
          res(data);
        });
      });

      // Get all hook definitions & documentation
      const funcDefs = contents.match(/function hook.* \{/g);
      const funcDocs = contents.match(/\/\*(\*(?!\/)|[^*])*\*\/\s*function hook[^\(]*/g);

      // Iterate over each hook definition
      if (funcDefs) {
        for (const def of funcDefs) {


          let usage = def.substr(9, (def.length - 11));
          const hookName = usage.match(/\w*/g)[0];
          const coreVersion = version.substr(0, 1);

          //Prevent PHP vars from being placholders
          usage = usage.replace(/\$/g, '\\$');

          //Check for additional placeholders
          const secondaryVars = hookName.match(/[A-Z]+(_(?=[A-Z])[A-Z]+)*/g);
          if (secondaryVars) {
            for (const secondaryVar in secondaryVars) {
              if (secondaryVars.hasOwnProperty(secondaryVar)) {
                const secondaryVarValue = secondaryVars[secondaryVar];
                const i = parseInt(secondaryVar);

                if (secondaryVarValue != "NULL") {
                  const replacement = `${i + 2}:${secondaryVarValue}`
                  usage = usage.replace(secondaryVarValue, '${' + replacement + '}');
                }
              }
            }
          }

          //Use filename_base as 'hook'
          usage = usage.replace(/hook_/g, '${1:${TM_FILENAME_BASE:hook}}_');

          hooks[hookName] = {
            "prefix": hookName,
            "body": [
              `/**`,
              ` * Implements ${hookName}().`,
              ` */`,
              `function ${usage} {`,
              `  $0`,
              `}`
            ],
            "description": [
              `${hookName}`,
              `Drupal ${coreVersion}+`,
              ``
            ],
            "scope": "php"
          };

        }
      }

      // Iterate over each hook doc block
      if (funcDocs) {
        for (const doc of funcDocs) {
          const hookName = doc.match(/hook_.*$/g)[0];
          let block = doc.match(/\*(\*(?!\/)|[^*])*\*/g)[0];

          // Compress whitespace, remove '*' characters
          let lines = block.match(/\ \*\ .+\n/g);
          block = [];
          for (let line of lines) {
            line = line.substr(3);
            if (line.trim()) {
              block.push(line.trim());
            }
          }
          block = block.join('\n').trim();

          // Add hook description to hooks object
          let hookDesc = block.match(/^[^@]*/g)[0];
          hookDesc = hookDesc.trim().split(/\n/g);
          hooks[hookName].description.push(...hookDesc);

          // Iterate over notes, add deprecation warnings
          const notes = block.match(/@[^@]*/g);
          if (notes) {
            for (let note of notes) {
              note = note.substr(1);
              const type = note.match(/^\w*/g)[0];

              if (type == 'deprecated') {

                hooks[hookName].description[0] = `${hookName} (Deprecated)`;
                note = note.trim().split(/\n/g);
                hooks[hookName].description.push("", ...note);
                hooks[hookName].body.push('//deprecated');
              }
            }
          }
        }
      }
    }
  }

  console.log(`Writing hooks snippet file.`);
  await writeJsonFile('./snippets/hooks.json', hooks);

  // Remove downloaded/extracted files
  await del('./tmp');

})();
