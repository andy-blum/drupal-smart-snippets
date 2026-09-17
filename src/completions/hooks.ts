/**
 * Drupal Hook Completions Provider
 *
 * Indexes every `*.api.php` under the web root and offers the `hook_*`
 * definitions found there as completions. Inside `src/Hook/` the snippet is an
 * OOP `#[Hook]` method; elsewhere it is a procedural function.
 */

import parser from "../util/parser";
import { createIndexer, isInWebRoot } from "../util/indexer";
import type * as PHP from "php-parser";
import * as vscode from "vscode";

export default function hookCompletions(webRoot: vscode.Uri): vscode.Disposable[] {
  const index = createIndexer({
    label: 'hooks',
    webRoot,
    glob: '**/*.api.php',
    parse: async file => (await findHooks(file)).map(formatHook),
  });

  const provider = vscode.languages.registerCompletionItemProvider('php', {
    provideCompletionItems(document: vscode.TextDocument) {
      if (!isInWebRoot(document, webRoot)) {
        return [];
      }

      const path = document.uri.path;
      const isOOPHookDir = path.includes('/src/Hook/');

      // Classes outside src/Hook can't implement hooks.
      if (!isOOPHookDir && path.includes('/src/')) {
        return [];
      }

      return index.all().map(hook => {
        const completion = new vscode.CompletionItem(hook.name);
        completion.documentation = new vscode.MarkdownString(hook.description);
        completion.sortText = `000-${hook.name}`;

        if (isOOPHookDir) {
          completion.insertText = new vscode.SnippetString(formatOOPHookSnippetString(hook.name, hook.definition));
          completion.kind = vscode.CompletionItemKind.Method;
        } else {
          completion.insertText = new vscode.SnippetString(formatProceduralHookSnippetString(hook.name, hook.definition));
          completion.kind = vscode.CompletionItemKind.Function;
        }

        return completion;
      });
    }
  });

  return [provider, index];
}

async function findHooks(file: vscode.Uri) {
  const content = await vscode.workspace.fs.readFile(file);
  const text = Buffer.from(content).toString('utf8');
  const parsed = parser.parseCode(text, file.toString());
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
      const isDeprecated = docs?.value?.includes('@deprecated') || false;

      return {name, definition, docs, isDeprecated};
    });

  return hooks;
}

/**
 * Converts a hook function definition into a procedural VS Code snippet string
 */
function formatProceduralHookSnippetString(name, definition) {
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
    `/**`,
    ` * Implements ${name}().`,
    ` */`,
    `${titleWithPlaceholders} {`,
    `  $0`,
    `}`
  ].join('\n');
}

/**
 * Converts a hook function definition into an OOP VS Code snippet string
 */
function formatOOPHookSnippetString(name: string, definition: string) {
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
    `/**`,
    ` * Implements hook_${hookNameNoPrefix}().`,
    ` */`,
    `#[Hook('${attributeSnippet}')]`,
    `public function ${methodSnippet}(${escapedArgs}) {`,
    `  $0`,
    `}`
  ].join('\n');
}

/**
 * Formats the hook documentation from PHP comments into Markdown
 */
function formatHookDocumentation({docs, definition, name, isDeprecated}: {docs: PHP.CommentBlock | undefined, definition: string, name: string, isDeprecated: boolean}) {
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
    desc.splice(2, 0, '_This hook is deprecated._');
  }

  return desc.join('\n');
}

/**
 * Shapes parsed hook data into a format ready for metadata storage
 */
function formatHook({name, definition, docs, isDeprecated}: {name: string, definition: string, docs: PHP.CommentBlock | undefined, isDeprecated: boolean}) {
  const desc = formatHookDocumentation({docs, definition, name, isDeprecated});

  return {
    name,
    definition,
    description: desc,
  };
}
