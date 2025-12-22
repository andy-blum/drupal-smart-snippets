/**
 * Drupal Element Completions Provider
 *
 * This module provides IntelliSense completions for Drupal render elements in PHP files.
 * It scans Element classes within the Drupal codebase to extract element definitions
 * and provides them as completion items with properly formatted documentation.
 *
 * The element completions include:
 * - Properly formatted element arrays with placeholders
 * - Documentation from the element class comments
 * - Automatic integration with VS Code's snippet system
 */

import logger from "../util/logger";
import getWebRoot from "../util/getWebRoot";
import parser from "../util/parser";
import * as vscode from "vscode";
import type * as PHP from "php-parser";

/**
 * Provides element completions for the VS Code editor
 *
 * This function:
 * 1. Finds all Element classes in the Drupal codebase
 * 2. Extracts element definitions from these files
 * 3. Formats them as metadata objects
 * 4. Registers a single completion item provider that maps metadata to VS Code completions
 *
 * @returns {Promise<vscode.Disposable>} A completion item provider registration
 */
export default async function elementCompletions() {
  const webRoot = await getWebRoot();
  if (!webRoot) {
    logger.appendLine('Could not find Drupal root. Element completions will not be available.');
    return [];
  }

  const elementRegistry = new Map<string, Array<{name: string, snippet: string, description: string}>>();

  const indexFile = async (file: vscode.Uri) => {
    try {
      const elements = await findElements(file);
      const formattedElements = elements.map(formatElement);
      elementRegistry.set(file.fsPath, formattedElements);
    } catch (error) {
      logger.appendLine(`Error reading file ${file.fsPath}: ${error}`);
    }
  };

  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(webRoot, '**/Element/*.php')
  );

  logger.appendLine(`Indexing elements from ${files.length} files...`);

  for (const file of files) {
    await indexFile(file);
  }

  logger.appendLine(`Successfully indexed elements.`);

  // Setup watcher for future changes
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(webRoot, '**/Element/*.php')
  );
  watcher.onDidChange(uri => indexFile(uri));
  watcher.onDidCreate(uri => indexFile(uri));
  watcher.onDidDelete(uri => elementRegistry.delete(uri.fsPath));

  // Register a single completion item provider for all elements
  const provider = vscode.languages.registerCompletionItemProvider('php', {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken,
      context: vscode.CompletionContext
    ) {
      // Only offer element completions in Drupal project structure
      const isDrupalProject = (
        document.fileName.includes('themes/') ||
        document.fileName.includes('modules/')
      );

      if (!isDrupalProject) {
        return [];
      }

      // Gatekeeper: Only parse if 'element:' is in the current line
      const lineText = document.lineAt(position).text;
      const linePrefix = lineText.substring(0, position.character);
      const elementIndex = linePrefix.lastIndexOf('element:');

      if (elementIndex === -1) {
        return [];
      }

      const allElements = Array.from(elementRegistry.values()).flat();

      const wordRange = document.getWordRangeAtPosition(position);
      const replaceRange = new vscode.Range(
        new vscode.Position(position.line, elementIndex),
        wordRange ? wordRange.end : position
      );

      return allElements.map(element => {
        const completion = new vscode.CompletionItem(`element:${element.name}`, vscode.CompletionItemKind.Struct);
        completion.range = replaceRange;
        completion.documentation = new vscode.MarkdownString(element.description);
        completion.insertText = new vscode.SnippetString(element.snippet);
        completion.sortText = `000-${element.name}`;
        return completion;
      });
    }
  }, ':');

  return [provider, watcher];
}

/**
 * Scans a file for Element class definitions with #[FormElement] or #[RenderElement] attributes
 *
 * @param {vscode.Uri} file - The URI of the PHP file to scan
 * @returns {Promise<Array<{name: string, type: string, docs: PHP.CommentBlock | undefined}>>} Array of element objects
 * @throws {Error} If the file cannot be read or parsed
 */
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
