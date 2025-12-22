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
 * 3. Formats them as completion items
 * 4. Registers them with the VS Code completion system
 *
 * @returns {Promise<vscode.Disposable[]>} Array of completion item providers that can be registered with VS Code
 */
export default async function elementCompletions() {
  const webRoot = await getWebRoot();
  if (!webRoot) {
    return [];
  }

  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(webRoot, '**/Element/*.php')
  );

  const elementCompletions = [];
  let errorCount = 0;

  for (const file of files) {
    try {
      const elements = await findElements(file);
      const formattedElements = elements.map(formatElement);
      const completions = formattedElements.map(generateCompletionItem);
      elementCompletions.push(...completions);
    } catch (error) {
      errorCount++;
      logger.appendLine(`Error reading file ${file.fsPath}: ${error}`);
    }
  }

  if (errorCount > 0) {
    logger.appendLine(`Completed with ${errorCount} errors. Some elements may not be available.`);
  }

  return elementCompletions;
}

/**
 * Scans a file for Element class definitions with #[FormElement] or #[RenderElement] attributes
 *
 * @param {vscode.Uri} file - The URI of the PHP file to scan
 * @returns {Promise<Array<{name: string, type: string, docs: PHP.CommentBlock}>>} Array of element objects
 * @throws {Error} If the file cannot be read or parsed
 */
async function findElements(file: vscode.Uri) {
  const content = await vscode.workspace.fs.readFile(file);
  const text = Buffer.from(content).toString('utf8');
  const parsed = parser.parseCode(text, file.toString());

  const elements = [];

  if (parsed && parsed.children) {
    for (const node of parsed.children) {
      if (node.kind === 'class') {
        const phpClass = node as PHP.Class;
        const attributeGroup = phpClass.attrGroups?.at(0);
        const attribute = attributeGroup?.attrs?.at(0);

        if (attribute && (attribute.name === 'FormElement' || attribute.name === 'RenderElement')) {
          const name = attribute.args[0]?.value;
          const type = attribute.name;
          const docs = phpClass.leadingComments?.at(-1) || attributeGroup.leadingComments?.at(-1);

          elements.push({ name, type, docs });
        }
      }
    }
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
 * @param {string} params.name - The element name
 * @param {string} params.type - The element type
 * @param {PHP.CommentBlock} params.docs - The documentation comment block
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
 * Shapes parsed element data into a format ready for VS Code completion items
 *
 * @param {Object} element - The element data object
 * @param {string} element.name - The element name
 * @param {string} element.type - The element type
 * @param {PHP.CommentBlock} element.docs - The documentation comment block
 * @returns {Object} An object with name, snippet, and description ready for completion item creation
 */
function formatElement({ name, type, docs }: { name: string, type: string, docs: PHP.CommentBlock | undefined }) {
  const snippet = formatElementSnippetString(name, type, docs);
  const description = formatElementDocumentation({ name, type, docs });

  return {
    name,
    type,
    snippet,
    description,
  };
}

/**
 * Creates a VS Code completion item provider for PHP files with element completions
 *
 * @param {Object} elementData - The processed element data
 * @param {string} elementData.name - The element name
 * @param {string} elementData.type - The element type
 * @param {string} elementData.snippet - The snippet string
 * @param {string} elementData.description - The markdown documentation
 * @returns {vscode.Disposable} A completion item provider registration
 */
function generateCompletionItem({ name, type, snippet, description }: { name: string, type: string, snippet: string, description: string }) {
  return vscode.languages.registerCompletionItemProvider('php', {
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

      // Early return if not in a Drupal project structure
      if (!isDrupalProject) { return []; }

      const completions = [];

      const completion = new vscode.CompletionItem(`element: ${name}`);
      completion.kind = vscode.CompletionItemKind.Struct;
      completion.documentation = new vscode.MarkdownString(description);
      completion.insertText = new vscode.SnippetString(snippet);
      completions.push(completion);

      return completions;
    }
  });
}
