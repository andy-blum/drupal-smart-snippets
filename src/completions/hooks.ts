/**
 * Drupal Hook Completions Provider
 *
 * This module provides IntelliSense completions for Drupal hooks in PHP files.
 * It scans *.api.php files within the Drupal codebase to extract hook definitions
 * and provides them as completion items with properly formatted documentation.
 *
 * The hook completions include:
 * - Properly formatted function signatures with placeholder replacements
 * - Documentation from the API comments
 * - Automatic integration with VS Code's snippet system
 */

import logger from "../util/logger";
import parser from "../util/parser";
import getWebRoot from "../util/getWebRoot";
import type * as PHP from "php-parser";
import * as vscode from "vscode";

/**
 * Provides hook completions for the VS Code editor
 *
 * This function:
 * 1. Finds all *.api.php files in the Drupal codebase
 * 2. Extracts hook definitions from these files
 * 3. Formats them as completion items
 * 4. Registers them with the VS Code completion system
 *
 * @returns {Promise<vscode.Disposable[]>} Array of completion item providers that can be registered with VS Code
 */
export default async function hookCompletions() {
  const webRoot = await getWebRoot();
  if (!webRoot) {
    return [];
  }

  const files = await vscode.workspace.findFiles(`**/*.api.php`)
    .then(files => (
      // Filter out files that aren't within DRUPAL_ROOT
      files.filter(({path}) => path.startsWith(webRoot))
    ));

  logger.appendLine(files.length.toString());

  const hookCompletions = [];
  let errorCount = 0;

  for (const file of files) {
    try {
      const hooks = await findHooks(file);
      const formattedHooks = hooks.map(formatHook);
      const completions = formattedHooks.map(generateCompletionItem);
      hookCompletions.push(...completions);
    } catch (error) {
      errorCount++;
      logger.appendLine(`Error reading file ${file.fsPath}: ${error}`);
    }
  }

  if (errorCount > 0) {
    logger.appendLine(`Completed with ${errorCount} errors. Some hooks may not be available.`);
  }

  return hookCompletions;
}

/**
 * Scans a file for all defined functions beginning with "hook_"
 *
 * This function parses PHP code to extract hook definitions and their documentation.
 * It uses the php-parser library to parse the PHP code and extract function definitions.
 *
 * @param {vscode.Uri} file - The URI of the API file to scan
 * @returns {Promise<Array<{name: string, definition: string, docs: PHP.CommentBlock, isDeprecated: boolean}>>}
 *          Array of hook objects containing name, definition, documentation, and deprecation status
 * @throws {Error} If the file cannot be read or parsed
 */
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
 * Converts a hook function definition into a VS Code snippet string with placeholders
 *
 * This function:
 * 1. Identifies placeholders in hook names (like 'hook', 'HOOK', 'ENTITY_TYPE')
 * 2. Replaces them with tabstops and placeholders in VS Code snippet format
 * 3. Formats the result with proper implementation comment
 * 4. Sets the cursor position with $0
 *
 * @param {string} name - The original hook name (e.g., 'hook_entity_view')
 * @param {string} definition - The function definition from the API file
 * @returns {string} A formatted snippet string ready for VS Code completion
 */
function formatHookSnippetString(name, definition) {

  // This regex looks for:
  // [A-Z]+ - One or more uppercase letters
  // (_(?=[A-Z])[A-Z]+)* - Optionally followed by an underscore and more uppercase letters
  // This captures placeholder patterns like: ENTITY_TYPE, NODE_TYPE, BUNDLE, etc.
  const placeholderRegex = /[A-Z]+(_(?=[A-Z])[A-Z]+)*/g;

  // Parts of the function name that need replaced.
  // "hook", "HOOK", "MULTI_WORD"
  const placeholders = [
    'hook',
    ...Array.from(
      name.match(placeholderRegex) || []
    )
  ];

  // Escape variable names.
  // @see https://code.visualstudio.com/docs/editor/userdefinedsnippets#_how-do-i-have-a-snippet-place-a-variable-in-the-pasted-script
  let titleWithPlaceholders = definition.replaceAll('$', '\\$');

  // Create tab-stops at placeholders.
  placeholders.forEach((placeholder, i) => {
    titleWithPlaceholders = titleWithPlaceholders
      .replace(placeholder, `\${${i + 1}:${placeholder}}`);
  });

  // Auto-replace `hook` with filename.
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
 * Formats the hook documentation from PHP comments into Markdown for VS Code hover/completion
 *
 * This function:
 * 1. Extracts the hook's description from its PHP doc block
 * 2. Cleans up the comment syntax and formats it as Markdown
 * 3. Adds extension title and function signature
 * 4. Adds deprecation notice if applicable
 *
 * @param {Object} params - The hook documentation parameters
 * @param {PHP.CommentBlock} params.docs - The PHP comment block associated with the hook
 * @param {string} params.definition - The function definition string
 * @param {string} params.name - The hook name
 * @param {boolean} params.isDeprecated - Whether the hook is marked as deprecated
 * @returns {string} Markdown-formatted documentation text
 */
function formatHookDocumentation({docs, definition, name, isDeprecated}: {docs: PHP.CommentBlock | undefined, definition: string, name: string, isDeprecated: boolean}) {
  const desc = [];
  if (docs?.value) {
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

  // Add extension title

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
 * Shapes parsed hook data into a format ready for VS Code completion items
 *
 * This function coordinates the transformation of raw hook data into the format
 * needed for VS Code completions by:
 * 1. Creating a snippet string with the formatHookSnippetString function
 * 2. Formatting the documentation with the formatHookDocumentation function
 *
 * @param {Object} hook - The hook data object
 * @param {string} hook.name - The hook name
 * @param {string} hook.definition - The function definition
 * @param {PHP.CommentBlock} hook.docs - The documentation comment block
 * @param {boolean} hook.isDeprecated - Whether the hook is deprecated
 * @returns {Object} An object with name, snippet, and description ready for completion item creation
 */
function formatHook({name, definition, docs, isDeprecated}: {name: string, definition: string, docs: PHP.CommentBlock | undefined, isDeprecated: boolean}) {
  // convert function definition to snippet string with tab-stops & placeholders.
  const titleWithPlaceholders = formatHookSnippetString(name, definition);

  // Format description text
  const desc = formatHookDocumentation({docs, definition, name, isDeprecated});

  return {
    name,
    snippet: titleWithPlaceholders,
    description: desc,
  };
}

/**
 * Creates a VS Code completion item provider for PHP files with hook completions
 *
 * This function registers a completion item provider that:
 * 1. Checks if the current file is in a Drupal project
 * 2. Determines if it should provide OOP or procedural hook completions
 * 3. Creates and returns appropriate completion items
 *
 * @param {Object} hookData - The processed hook data
 * @param {string} hookData.name - The hook name
 * @param {string} hookData.snippet - The snippet string with placeholders
 * @param {string} hookData.description - The markdown documentation
 * @returns {vscode.Disposable} A completion item provider registration
 */
function generateCompletionItem({name, snippet, description}: {name: string, snippet: string, description: string}) {
  return vscode.languages.registerCompletionItemProvider('php', {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken,
      context: vscode.CompletionContext
    ) {
      // Only offer hook completions in Drupal project structure
      // This simple heuristic checks if the file is in a themes or modules directory
      const isDrupalProject = (
        document.fileName.includes('themes/') ||
        document.fileName.includes('modules/')
      );

      // Check if we're in an OOP-style hook implementation class
      // Drupal 11+ allows OOP hook implementations via classes in src/Hook directories
      const isOOP = document.fileName.includes('src/Hook');

      // Early return if not in a Drupal project structure
      if (!isDrupalProject) { return []; }

      const completions = [];

        if (isOOP) {
          const completion = new vscode.CompletionItem(name);
          completion.documentation = new vscode.MarkdownString(description);
          // const file = document.getText().split('\n').filter((lineText, lineNum) => lineNum !== position.line).join('\n');
          // const parsed = parser.parseCode(file, document.uri.fsPath);
          completion.insertText = new vscode.SnippetString(snippet);
          completion.kind = vscode.CompletionItemKind.Method;
          completions.push(completion);
        } else {
          const completion = new vscode.CompletionItem(name);
          completion.sortText = '000-' + name;
          completion.documentation = new vscode.MarkdownString(description);
          completion.insertText = new vscode.SnippetString(snippet);
          completion.kind = vscode.CompletionItemKind.Function;
          completions.push(completion);
        }

      return completions;
    }
  });
}
