import engine from "php-parser";
import { readFile } from "fs/promises";

export async function formatServices(rawServices, version) {
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
        classNamespace = rawServices[`${value.parent}`]?.class;
      }

      if (!classNamespace && value.alias) {
        classNamespace = rawServices[`${value.alias}`]?.class;
      }

      if (classNamespace && value.public !== false) {
        const classFile = classNamespace.split('\\').join('/');

        let description = [];
        if (classFile.startsWith('Drupal')) {
          const classFileContents = await readFile(`tmp/drupal-${version}/core/lib/${classFile}.php`, {
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

        services.push([name, snippet]);
      }
    }

    return services;
}
