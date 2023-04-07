export function formatElements(rawElements) {

  const formattedElements = rawElements
    .map(({name, type, docs}) => {

      // Format description text
      const desc = docs.value
        .split('\n')
        .map(line => {
          if (line !== '/**' && line !== ' */') {
            return line
              // Remove PHP comment markup
              .replace(/^\s\*\s{0,1}/g, '')

              // Special/escaped character replacement
              .replaceAll("&quot;", "\"")
              .replaceAll(/<([^>]*)>/g, "");
          }
        })
        .filter(line => line !== undefined)

      const elementObj = {
        prefix: [`@${type} ("${name}")` ,`@Element ("${name}")` , name],
        body: [
          `[`,
          `  '#type' => '${name}',`,
        ],
        description: desc,
        scope: 'php',
      }

      if (type == 'FormElement') {
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
          elementObj.body.push(setting);
        })
      }

      // Get properties from docblock description
      const propertiesRegex = /Properties:(.*)(?=(@code\n))/s;
      const propertiesMatch = docs.value.match(propertiesRegex);
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
          elementObj.body.push(newPropertyArray)
        });
      }
      
      // Close body
      elementObj.body.push(']${5|\\,,;|}');
      

      return elementObj;
    });

  return formattedElements;
}
