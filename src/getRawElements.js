import { stdout } from "node:process";
import { readFile } from "fs/promises";
import engine from "php-parser";

export async function getRawElements(apiFiles) {

  const rawElements = [];

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

    const parsedElements = parser.parseCode(contents).children;

    parsedElements
      .filter(element => (
        element.kind === 'namespace' &&
        (element.loc.source.includes('@RenderElement') ||
        element.loc.source.includes('@FormElement'))
      ))
      .forEach(element => {
        const classElement = element.children.find(child => child.kind === 'class');
        const docs = classElement ? classElement.leadingComments.at(-1) : undefined;
        const name = classElement ? classElement.name.name.toLowerCase(): undefined;
        const type = element.loc.source.includes('@RenderElement') ? 'RenderElement' : 'FormElement';

        rawElements.push({name, type, docs});
      });
  }

  return rawElements;
}
