import engine from "php-parser";
import { readFile } from "fs/promises";

export async function formatServices(rawServices) {
    // Prepare to receive formatted hooks.
    const services = [];

    const parser = new engine({
      parser: {
        locations: true,
        extractDoc: true,
      },
      ast: {
        withPositions: true,
        withSource: true
      }
    });

    // Iterate over each service.
    for (const service of rawServices) {

      const [name, value] = service;

      let { class: classNamespace } = value;

      if (!classNamespace && value.parent) {
        const parentService = rawServices.find(service => service[0] === value.parent);
        classNamespace = parentService[1].class;
      }

      if (!classNamespace && value.alias) {
        const aliasedService = rawServices.find(service => service[0] === value.alias);
        classNamespace = aliasedService[1].class;
      }

      if (classNamespace && value.public !== false) {
        const classFile = classNamespace.split('\\').join('/');

        const deprecationWarning = value.deprecated
          ?.replaceAll('%alias_id%', name)
          ?.replaceAll('%service_id%', name);

        let description = [];

        if (classFile.startsWith('Drupal')) {
          const classFileContents = await readFile(`tmp/drupal/core/lib/${classFile}.php`, {
            encoding: 'utf-8',
          });

          const { comments } = parser.parseCode(classFileContents);

          description = comments[0].value
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
        }

        const snippet = {
          prefix: [
            `@Service ("${name}")`
          ],
          body: [
            `/**`,
            ` * @var ${classNamespace}`,
            ` */`,
            `\${1:\\$${name.replaceAll('.', '_')}_service} = \\Drupal::service('${name}');`,
            ``
          ],
          description,
          scope: "php",
        };

        if (deprecationWarning) {
          snippet.description.splice(0, 0, 'DEPRECATED');
          snippet.body.splice(2, 0, ` * @deprecated ${deprecationWarning}`);
        }

        services.push([name, snippet]);
      }
    }

    return services;
}
