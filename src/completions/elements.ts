/**
 * Drupal Element Completions Provider
 *
 * Indexes every `Element/*.php` class under the web root, reading the
 * `#[FormElement]` / `#[RenderElement]` attribute (or legacy annotation), and
 * offers a render array snippet for each on the `element:` prefix.
 */

import parser from "../util/parser";
import { createIndexer, isInWebRoot } from "../util/indexer";
import * as vscode from "vscode";
import type * as PHP from "php-parser";

export default function elementCompletions(webRoot: vscode.Uri): vscode.Disposable[] {
  const index = createIndexer({
    label: 'elements',
    webRoot,
    glob: '**/Element/*.php',
    parse: async file => (await findElements(file)).map(formatElement),
  });

  const provider = vscode.languages.registerCompletionItemProvider('php', {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
      if (!isInWebRoot(document, webRoot)) {
        return [];
      }

      const linePrefix = document.lineAt(position).text.substring(0, position.character);
      const elementIndex = linePrefix.lastIndexOf('element:');

      if (elementIndex === -1) {
        return [];
      }

      const wordRange = document.getWordRangeAtPosition(position);
      const replaceRange = new vscode.Range(
        new vscode.Position(position.line, elementIndex),
        wordRange ? wordRange.end : position
      );

      return index.all().map(element => {
        const completion = new vscode.CompletionItem(`element:${element.name}`, vscode.CompletionItemKind.Struct);
        completion.range = replaceRange;
        completion.documentation = new vscode.MarkdownString(element.description);
        completion.insertText = new vscode.SnippetString(element.snippet);
        completion.sortText = `000-${element.name}`;
        return completion;
      });
    }
  }, ':');

  return [provider, index];
}

async function findElements(file: vscode.Uri) {
  const content = await vscode.workspace.fs.readFile(file);
  const text = Buffer.from(content).toString('utf8');
  const parsed = parser.parseCode(text, file.toString());

  const elements = [];

  const findClasses = (nodes: any[]) => {
    for (const node of nodes) {
      if (node.kind === 'class') {
        const phpClass = node as PHP.Class;
        let name = '';
        let type = '';
        let docs = phpClass.leadingComments?.at(-1);

        // 1. Try modern PHP Attributes
        if (phpClass.attrGroups) {
          for (const attributeGroup of phpClass.attrGroups) {
            for (const attribute of attributeGroup.attrs) {
              const attrName = typeof attribute.name === 'string' ? attribute.name : (attribute.name as any).name;
              if (attrName === 'FormElement' || attrName === 'RenderElement') {
                name = attribute.args[0]?.kind === 'string' ? (attribute.args[0] as any).value : '';
                type = attrName;
                docs = docs || attributeGroup.leadingComments?.at(-1);
              }
            }
          }
        }

        // 2. Fallback to legacy DocBlock Annotations
        if (!name && docs?.value) {
          const annotationRegex = /@(\w+Element)\("([^"]+)"\)/;
          const match = docs.value.match(annotationRegex);
          if (match) {
            type = match[1];
            name = match[2];
          }
        }

        if (name && type) {
          elements.push({ name, type, docs });
        }
      } else if (node.children) {
        findClasses(node.children);
      }
    }
  };

  if (parsed && parsed.children) {
    findClasses(parsed.children);
  }

  return elements;
}

/**
 * Creates a snippet string for an element with proper formatting and placeholders
 *
 * @param {string} name - The element name
 * @param {string} type - The element type (FormElement or RenderElement)
 * @param {PHP.CommentBlock} docs - The documentation comment block
 * @returns {string} A formatted snippet string ready for VS Code completion
 */
function formatElementSnippetString(name: string, type: string, docs: PHP.CommentBlock | undefined) {
  const body = [`[`, `  '#type' => '${name}',`];

  if (type === 'FormElement') {
    // Add form element specific properties with placeholders
    body.push(
      `  '#title' => \${1|t(''),$this->t('')|},`,
      `  '#title_display' => '\${2|before,after,invisible,attribute|}',`,
      `  '#description' => \${3|t(''),$this->t('')|},`,
      `  '#required' => \${4|TRUE,FALSE|},`
    );
  }

  if (docs?.value) {
    // Extract properties from docblock
    const propertiesRegex = /Properties:(.*)(?=(@code\n))/s;
    const propertiesMatch = docs.value.match(propertiesRegex);
    const propertiesString = propertiesMatch ? propertiesMatch[1] : '';
    const properties = propertiesString.match(/(#\w+):{1}/g) || [];

    // Add properties found in description
    if (properties.length > 0) {
      const excludeProperties = [
        '#type',
        '#title',
        '#title_display',
        '#description',
        '#required',
      ];

      properties.forEach(prop => {
        const property = prop.slice(0, -1); // Remove colon
        if (!excludeProperties.includes(property)) {
          body.push(`  '${property}' => '',`);
        }
      });
    }
  }

  body.push(`]\${5|\\,,;|}`);
  return body.join('\n');
}

/**
 * Formats the element documentation from PHP comments into Markdown
 *
 * @param {Object} params - The element documentation parameters
 * @returns {string} Markdown-formatted documentation text
 */
function formatElementDocumentation({ name, type, docs }: { name: string, type: string, docs: PHP.CommentBlock | undefined }) {
  const desc = [];

  if (docs?.value) {
    // Format description text
    desc.push(...docs.value
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
      .filter(line => line !== undefined));
  }

  // Add extension title and element info
  desc.splice(0, 0,
    '**Drupal Smart Snippets**', '',
    `@${type}("${name}")`, ''
  );

  return desc.join('\n');
}

/**
 * Shapes parsed element data into a format ready for metadata storage
 *
 * @param {Object} element - The element data object
 * @returns {Object} An object with name, snippet, and description
 */
function formatElement({ name, type, docs }: { name: string, type: string, docs: PHP.CommentBlock | undefined }) {
  const snippet = formatElementSnippetString(name, type, docs);
  const description = formatElementDocumentation({ name, type, docs });

  return {
    name,
    snippet,
    description,
  };
}
