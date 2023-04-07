const del = require('del');
const download = require('download');
const tar = require('tar');
const find = require('find');
const fs = require('fs');
const writeJsonFile = require('write-json-file');

// Set up dest object for formElements snippets
const formElements = {};

(async () => {
  const versions = [
    '9.4.0',
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
    // Find all files under folders named "Element"
    const elements = await new Promise((res, rej) => {
      find.file(`tmp/drupal-${version}/core/lib/Drupal/Core/Render/Element/`, (file) => {
        const filtered = file.filter((filename) => filename.endsWith('.php'));
        res(filtered);
      });
    });

    console.log(`Found ${elements.length} files under folders named "Element" in Drupal.`)

        // Iterate over each file.api.php
        for (const element of elements) {

          const contents = await new Promise((res, rej) => {
            fs.readFile(element, 'utf8', (err, data) => {
              res(data);
            });
          });

          // Get all formElement definitions & documentation
          const elementTypes = [
            'RenderElement',
            'FormElement',
          ];

          for (const elementType of elementTypes) {
            const formElementTypesRegex = new RegExp(`@${elementType}\\("(.*?)"\\)`, 'g');
            const formElementDocsRegex = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/[\\s\\S]*?extends`, 'g');
  
            const formElementTypes = contents.match(formElementTypesRegex);
            const formElementDocs = contents.match(formElementDocsRegex);
            
            // Iterate over each element types
            if (formElementTypes) {
              for (const type of formElementTypes) {
                const matches = type.match(new RegExp(`@${elementType}\\("([^"]+)"\\)`));
                const elementName = matches ? matches[1] : null;
                const coreVersion = version.split('.')[0];
                const formElementName = '${0:' + elementName + '}';

                formElements[elementName] = {
                  "prefix": [matches[0] , elementName],
                  "body": [
                    `[`,
                    `  '#type' => '${elementName}',`,
                  ],
                  "description": [
                    `${elementName}`,
                    `Drupal ${coreVersion}+`,
                    ``
                  ],
                  "scope": "php"
                };

                if (elementType == 'FormElement') {
                  // tab stops for FormElement
                  const titleInput = "${1|t(''),$this->t('')|}";
                  const titleDisplayOption = '${2|before,after,invisible,attribute|}';
                  const descriptionInput = "${3|t(''),$this->t('')|}";
                  const boolOption = '${4|TRUE,FALSE|}';

                  const defaultSettings = [
                    `  '#title' => ${titleInput},`,
                    `  '#title_display' => '${titleDisplayOption}',`,
                    `  '#description' => ${descriptionInput},`,
                    `  '#required' => '${boolOption}',`
                  ];
                  defaultSettings.forEach(setting => {
                    formElements[elementName].body.push(setting);
                  })
                }
      
              }
            }
            if (formElementTypes && formElementDocs) {
              for (const doc of formElementDocs) {
                const matches = doc.match(new RegExp(`@${elementType}\\("([^"]+)"\\)`));
                const elementName = matches ? matches[1] : null;

                // Get properties from docblock description
                const propertiesRegex = /Properties:(.*)(?=(@code\n))/s;
                const propertiesMatch = doc.match(propertiesRegex);
                const propertiesString = propertiesMatch ? propertiesMatch[1] : '';
                const properties = propertiesString.match(/(#\w+):{1}/g) || [];
                
                // Push property found in description
                if (properties.length > 0) {
                  properties.forEach(element => {
                    const excludeProperties = [
                      '#type',
                      '#title',
                      '#title_display',
                      '#description',
                      '#required',
                    ];

                    // Remove colon
                    let property = element.slice(0, -1);
                    if (excludeProperties.includes(property)) {
                      // Skip adding this property
                      return;
                    }
                    let newPropertyArray = `  '${property}' => '',`;
                    formElements[elementName].body.push(newPropertyArray)
                  });
                }
                
                // Close body
                formElements[elementName].body.push(`];`);
  
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
  
                // Add description
                formDocDesc = block.trim().split(/\n/g);
  
                formElements[elementName].description.push(...formDocDesc);
              }
            }
          }

        }
  }

  console.log(`Writing formElements snippet file.`);
  await writeJsonFile('./snippets/elements.json', formElements);

  // Remove downloaded/extracted files
  await del('./tmp');

})();
