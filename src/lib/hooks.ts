import parser from "../util/parser";
import type * as PHP from "php-parser";

export function findHooks(text: string, filename = 'unknown.api.php') {
  const parsed = parser.parseCode(text, filename);
  const hooks = parsed.children
    .filter((child: PHP.Node) => {
      if (child.kind === 'function') {
        const fnName = (child as PHP.Function).name as PHP.Identifier;
        return fnName.name.startsWith('hook_');
      }
      return false;
    })
    .map((hook: PHP.Function) => {
      const docs = hook.leadingComments?.at(-1);
      const name = (hook.name as PHP.Identifier).name || (hook.name as string);
      const definition = hook.loc?.source || '';
      const deprecation = deprecationMessage(docs);

      return {name, definition, docs, isDeprecated: deprecation !== null, deprecation};
    });

  return hooks;
}

/**
 * Converts a hook function definition into a procedural VS Code snippet string
 */
/**
 * The text of a docblock's `@deprecated` tag, collapsed to one line, or null.
 */
export function deprecationMessage(docs: PHP.CommentBlock | undefined): string | null {
  const match = docs?.value?.match(/@deprecated\b([\s\S]*?)(?=\n\s*\*\s*@|\n\s*\*\s*\n|\n\s*\*\/)/);
  if (!match) {
    return null;
  }
  return match[1].replace(/\n\s*\*\s?/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The docblock lines shared by both snippet shapes.
 */
function docblock(name: string, deprecation: string | null) {
  const lines = [`/**`, ` * Implements ${name}().`];
  if (deprecation !== null) {
    lines.push(` *`, ` * @deprecated ${deprecation}`.trimEnd());
  }
  lines.push(` */`);
  return lines;
}

export function formatProceduralHookSnippetString(name: string, definition: string, deprecation: string | null = null) {
  const placeholderRegex = /[A-Z]+(_(?=[A-Z])[A-Z]+)*/g;

  const placeholders = [
    'hook',
    ...Array.from(
      name.match(placeholderRegex) || []
    )
  ];

  let titleWithPlaceholders = definition.replaceAll('$', '\\$');

  placeholders.forEach((placeholder, i) => {
    titleWithPlaceholders = titleWithPlaceholders
      .replace(placeholder, `\${${i + 1}:${placeholder}}`);
  });

  titleWithPlaceholders = titleWithPlaceholders
    .replace("${1:hook}", "${1:${TM_FILENAME_BASE:hook}}");

  return [
    ...docblock(name, deprecation),
    `${titleWithPlaceholders} {`,
    `  $0`,
    `}`
  ].join('\n');
}

/**
 * Converts a hook function definition into an OOP VS Code snippet string
 */
export function formatOOPHookSnippetString(name: string, definition: string, deprecation: string | null = null) {
  const hookNameNoPrefix = name.replace(/^hook_/, '');

  // Extract arguments from definition: "function hook_name(args)" -> "args"
  const argsMatch = definition.match(/\((.*)\)/s);
  const args = argsMatch ? argsMatch[1] : '';
  const escapedArgs = args.replaceAll('$', '\\$');

  const placeholderRegex = /[A-Z]+(_(?=[A-Z])[A-Z]+)*/g;

  // Find all placeholders and their positions
  const matches = Array.from(hookNameNoPrefix.matchAll(placeholderRegex));

  // Build parts list: alternating between static and placeholder
  let lastIndex = 0;
  const parts: Array<{text: string, isPlaceholder: boolean, placeholderIndex?: number}> = [];
  let pIndex = 1;

  for (const match of matches) {
    if (match.index! > lastIndex) {
      parts.push({
        text: hookNameNoPrefix.slice(lastIndex, match.index),
        isPlaceholder: false
      });
    }
    parts.push({
      text: match[0],
      isPlaceholder: true,
      placeholderIndex: pIndex++
    });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < hookNameNoPrefix.length) {
    parts.push({
      text: hookNameNoPrefix.slice(lastIndex),
      isPlaceholder: false
    });
  }

  let attributeSnippet = "";
  let methodSnippet = "";

  parts.forEach((part, index) => {
    if (part.isPlaceholder) {
      attributeSnippet += `\${${part.placeholderIndex}:${part.text}}`;
      const transform = (index === 0) ? "camelcase" : "capitalize";
      methodSnippet += `\${${part.placeholderIndex}/(.*)/\${1:/${transform}}/}`;
    } else {
      attributeSnippet += part.text;
      const subParts = part.text.split('_').filter(s => s !== '');
      subParts.forEach((sub, subIndex) => {
        if (index === 0 && subIndex === 0 && !part.text.startsWith('_')) {
          methodSnippet += sub.toLowerCase();
        } else {
          methodSnippet += sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase();
        }
      });
    }
  });

  return [
    ...docblock(`hook_${hookNameNoPrefix}`, deprecation),
    `#[Hook('${attributeSnippet}')]`,
    `public function ${methodSnippet}(${escapedArgs}) {`,
    `  $0`,
    `}`
  ].join('\n');
}

/**
 * Formats the hook documentation from PHP comments into Markdown
 */
export function formatHookDocumentation({docs, definition, name, isDeprecated}: {docs: PHP.CommentBlock | undefined, definition: string, name: string, isDeprecated: boolean}) {
  const desc = [];
  if (docs?.value) {
    desc.push(...docs.value
      .split('\n')
      .map(line => {
        if (line !== '/**' && line !== ' */') {
          return line
            .replace(/^\s\*\s{0,1}/g, '')
            .replaceAll("&quot;", "\"")
            .replaceAll(/<([^>]*)>/g, "");
        }
      })
      .filter(line => line !== undefined));
  }

  desc.splice(0, 0,
    '**Drupal Smart Snippets**', '',
    `\`${definition.replace('function ', '')}\``, ''
  );

  if (isDeprecated) {
    desc.splice(2, 0, '_This hook is deprecated._', '');
  }

  return desc.join('\n');
}

/**
 * Shapes parsed hook data into a format ready for metadata storage
 */
export function formatHook({name, definition, docs, isDeprecated, deprecation}: {name: string, definition: string, docs: PHP.CommentBlock | undefined, isDeprecated: boolean, deprecation: string | null}) {
  const desc = formatHookDocumentation({docs, definition, name, isDeprecated});

  return {
    name,
    definition,
    description: desc,
    deprecation,
  };
}
