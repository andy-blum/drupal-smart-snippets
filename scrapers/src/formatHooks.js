export function formatHooks(rawHooks) {

  const formattedHooks = rawHooks
    .map(({name, definition, docs}) => {

      // Parts of the function name that need replaced.
      const placeholders = [
        'hook',
        ...Array.from(
          name.match(/[A-Z]+(_(?=[A-Z])[A-Z]+)*/g) || []
        )
      ];

      // Escape variable names.
      // @see https://code.visualstudio.com/docs/editor/userdefinedsnippets#_how-do-i-have-a-snippet-place-a-variable-in-the-pasted-script
      let titleWithPlaceholders = definition.replaceAll('$', '\\$');

      // Create tab-stops at placeholders.
      placeholders.forEach((placeholder, i) => {
        titleWithPlaceholders = titleWithPlaceholders
          .replace(placeholder, `\${${i + 1}:${placeholder}}`);
      })

      // Auto-replace `hook` with filename.
      titleWithPlaceholders = titleWithPlaceholders
        .replace("${1:hook}", "${1:${TM_FILENAME_BASE:hook}}");

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

      const hookObj = {
        prefix: name,
        body: [
          `/**`,
          ` * Implements ${name}().`,
          ` */`,
          `${titleWithPlaceholders} {`,
          `  $0`,
          `}`
        ],
        description: desc,
        scope: 'php',
      }

      // Add notices of deprecated hooks.
      if (docs.value.includes('@deprecated')) {
        hookObj.description.splice(0, 0, 'DEPRECATED', '');
        hookObj.body.splice(2, 0, ' * @deprecated');
      }

      return hookObj;
    });

  return formattedHooks;
}
