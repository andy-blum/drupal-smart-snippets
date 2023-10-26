import { readFile } from "fs/promises";
import { parse } from 'yaml';

export async function getServices() {
  return new Promise(async (res) => {

		const serviceYmlContents = await readFile(`tmp/drupal/core/core.services.yml`, {
      encoding: 'utf-8',
    });

    const { services } = parse(serviceYmlContents);

    res(Object.entries(services));
	});
}
