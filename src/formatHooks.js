import he from "he";
export function formatHooks(rawHooks, version) {

  const majVersion = version.split('.')[0];

  const formattedHooks = rawHooks
    .map(({code, tags}) => {

      // Strip function keyword and contents.
      const fn = code.substr(9).match(/(\w)*\([^\)]*\)/g)[0];

      // Function name, no parentheses/params.
      const title = fn.match(/(\w)*/g)[0];

      // Function parentheses & params.
      const params = fn.substr(title.length);

      // Parts of the function name that need replaced.
      const placeholders = [
        'hook',
        ...Array.from(
          title.match(/[A-Z]+(_(?=[A-Z])[A-Z]+)*/g) || []
        )
      ];

      // Create tab-stops at placeholders
      let titleWithPlaceholders = title;
      placeholders.forEach((placeholder, i) => {
        titleWithPlaceholders = titleWithPlaceholders
          .replace(placeholder, `\${${i + 1}:${placeholder}}`);
      })

      // Auto-replace `hook`
      titleWithPlaceholders = titleWithPlaceholders
        .replace("${1:hook}", "${1:${TM_FILENAME_BASE:hook}}");

      const descArray = tags.description
      .replaceAll("&quot;", "\"")
      .split("\n")
      .filter(line => Boolean(line));

      const hookObj = {
        prefix: title,
        body: [
          `/**`,
          ` * Implements ${title}().`,
          ` */`,
          `function ${titleWithPlaceholders}${params} {`,
          `  $0`,
          `}`
        ],
        description: [
          `${title}${tags.deprecated ? " (Deprecated)" : ''}`,
          `Drupal ${majVersion}+`,
          "",
          `${tags.title.replaceAll("&quot;", "\"")}`,
          ...descArray,
        ],
        scope: 'php',
      }

      if (tags.deprecated) {
        hookObj.body.push("// deprecated");
      }

      if (title === 'hook_entity_extra_field_info') {
        debugger;
      }

      return hookObj;
    });

  return formattedHooks;
}
