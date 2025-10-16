import { stdout } from "node:process";
import { readFile } from "fs/promises";
import engine from "php-parser";

export async function getRawElements(elementFiles) {

  const rawElements = [];

  let i = 0;
  let pct = Math.floor(i / elementFiles.length);
  stdout.write(`  - ${pct}% scanning\r`)

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

  for (const file of elementFiles) {

    const contents = await readFile(file, {
      encoding: 'utf-8',
    });

    // #[*Element(*)]
    if (contents.match(/#\[[\w]+Element\([^\s]*\)\]/g)) {
      const parsedElements = parser.parseCode(contents).children;

      for (const element of parsedElements) {
        const phpClass = element.children?.find(child => child.kind === 'class');

        // Skip if no class was found in this element
        if (!phpClass) {
          continue;
        }

        const attributeType = phpClass.attrGroups?.at(0)?.attrs?.at(0)?.name;
        const attributeValue = phpClass.attrGroups?.at(0)?.attrs?.at(0)?.args[0]?.value;
        const docs = phpClass?.leadingComments?.at(-1) ||
          phpClass.attrGroups?.at(0)?.leadingComments?.at(-1) ||
          "";

        rawElements.push({
          name: attributeValue,
          type: attributeType,
          docs
        })
      }
    }
  }

  return rawElements;
}
