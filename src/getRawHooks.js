import { stdout } from "node:process";
import { readFile } from "fs/promises";
import engine from "php-parser";

export async function getRawHooks(apiFiles) {

  const rawHooks = [];

  let i = 0;
  let pct = Math.floor(i / apiFiles.length);
  stdout.write(`  - ${pct}% scanning\r`)

  for (const file of apiFiles) {

    const contents = await readFile(file, {
      encoding: 'utf-8',
    });

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

    const parsedHooks = parser.parseCode(contents).children;

    parsedHooks
      .filter(hook => (
        hook.kind === 'function' &&
        hook.name.name.startsWith('hook_')
      ))
      .forEach(hook => {
        const docs = hook.leadingComments.at(-1);
        const { name } = hook.name;
        const definition = hook.loc.source;

        rawHooks.push({name, definition, docs});
      });
  }

  return rawHooks;
}
