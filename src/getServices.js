import { readFile } from "fs/promises";
import { parse } from 'yaml';

export async function getServices(version) {
  return new Promise(async (res) => {

		const serviceYmlContents = await readFile(`tmp/drupal-${version}/core/core.services.yml`, {
      encoding: 'utf-8',
    });

    // Parse YAML with custom tags for Symfony/Drupal service definitions
    // These tags are used by Symfony's dependency injection but we just need to preserve them as strings
    const { services } = parse(serviceYmlContents, {
      customTags: [
        {
          tag: '!tagged_iterator',
          resolve: (str) => `!tagged_iterator ${str}`
        },
        {
          tag: '!tagged',
          resolve: (str) => `!tagged ${str}`
        },
        {
          tag: '!service_locator',
          resolve: (str) => `!service_locator ${str}`
        }
      ]
    });

    res(Object.entries(services));
	});
}
