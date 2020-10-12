const del = require('del');
const download = require('download');
const tar = require('tar');
const find = require('find');
const fs = require('fs');
const writeJsonFile = require('write-json-file');

const hooks = {};
const renderElements = {};

(async () => {
  const versions = [
    '9.0.6',
    '8.9.6'
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

      const funcDefs = contents.match(/function hook.* \{/g);

      // Iterate over each hook definition
      if (funcDefs) {
        for (const def of funcDefs) {


          let usage = def.substr(9, (def.length - 11));
          const hookName = usage.match(/\w*/g)[0];
          const coreVersion = version.substr(0, 1);

          //Prevent PHP vars from being placholders
          usage = usage.replace(/\$/g, '\\$');

          //Check for additional placeholders
          const secondaryVars = usage.match(/([A-Z][A-Z_]*[A-Z])/g);
          if (secondaryVars) {
            for (const secondaryVar in secondaryVars) {
              if (secondaryVars.hasOwnProperty(secondaryVar)) {
                const secondaryVarValue = secondaryVars[secondaryVar];

                if (secondaryVarValue != "NULL") {
                  const replacement = `${secondaryVar + 2}: ${secondaryVarValue}`
                  usage = usage.replace(secondaryVarValue, '${' + replacement + '}');
                }
              }
            }
          }

          //Use filename_base as 'hook'
          usage = usage.replace(/hook_/g, '${1:${TM_FILENAME_BASE:hook}}_');

          hooks[hookName] = {
            "prefix": hookName,
            "minCore": coreVersion,
            "body": [
              `/**`,
              ` * Implements ${hookName}.`,
              ` */`,
              `function ${usage} {`,
              `  $0`,
              `}`
            ],
            "description": [
              `Drupal ${coreVersion}+`,
              ``
            ],
            "scope": "php"
          };

        }
      }
    }



  }

  console.log(`Writing hooks snippet file.`);
  await writeJsonFile('./snippets/hooks.json', hooks);

})();