import { stdout } from "node:process";
import { readFile } from "fs/promises";
import DocBlock from "docblock";

export async function getRawHooks(apiFiles) {

  const rawHooks = [];

  let i = 0;
  let pct = Math.floor(i / apiFiles.length);
  stdout.write(`  - ${pct}% scanning\r`)

  for (const file of apiFiles) {

    const contents = await readFile(file, {
      encoding: 'utf-8',
    });

    (new DocBlock())
      .parse(contents, 'php')
      .filter(block => block.code.startsWith('function hook'))
      .forEach(block => rawHooks.push(block));

    i++;
    pct = Math.floor(i / apiFiles.length);
    stdout.write(`  - ${pct}% scanning\r`);
  }

  return rawHooks;
}
