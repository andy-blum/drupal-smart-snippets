import he from "he";
export function formatHooks(rawHooks, version) {

  const majVersion = version.split('.')[0];

  const formattedHooks = rawHooks
    .map(({name, definition, docs}) => {

      const desc = docs.value
        .split('\n')
        .map(line => (
          line
            // Remove PHP comment markup
            .replace(/^\/\*\*/g, '!!!')
            .replace(/\s\*\//g, '!!!')
            .replace(/^\s\*\s{0,1}/g, '')

            // Special/escaped character replacement
            .replaceAll("&quot;", "\"")
            .replaceAll(/<([^>]*)>/g, "")
        ))
        .filter(line => line !== '!!!')

      const hookObj = {
        prefix: name,
        body: [
          `/**`,
          ` * Implements ${name}().`,
          ` */`,
          `${definition} {`,
          `  $0`,
          `}`
        ],
        description: [
          `Drupal ${majVersion}+`,
          "",
          ...desc,
        ],
        scope: 'php',
      }

      if (docs.value.includes('@deprecated')) {
        hookObj.body.push("// deprecated");
      }

      return hookObj;
    });

  return formattedHooks;
}
