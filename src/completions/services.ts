/**
 * Drupal Service Completions Provider
 *
 * This module provides IntelliSense completions for Drupal services in YAML files.
 * It scans *.services.yml files within the Drupal codebase to extract service definitions
 * and provides them as completion items with properly formatted documentation.
 *
 * The service completions include:
 * - Properly formatted service injection code with placeholders
 * - Documentation from the service class comments
 * - Automatic integration with VS Code's snippet system
 */

import logger from "../util/logger";
import getWebRoot from "../util/getWebRoot";
import { parse } from 'yaml';
import * as vscode from "vscode";

/**
 * Provides service completions for the VS Code editor
 *
 * This function:
 * 1. Finds all *.services.yml files in the Drupal codebase
 * 2. Extracts service definitions from these files
 * 3. Formats them as completion items
 * 4. Registers them with the VS Code completion system
 *
 * @returns {Promise<vscode.Disposable[]>} Array of completion item providers that can be registered with VS Code
 */
export default async function serviceCompletions() {
  const webRoot = await getWebRoot();
  if (!webRoot) {
    return [];
  }

  const files = await vscode.workspace.findFiles(`**/*.services.yml`)
    .then(files => (
      files.filter(({path}) => path.startsWith(webRoot))
    ));

  const serviceCompletions = [];
  let errorCount = 0;

  for (const file of files) {
    try {
      const services = await findServices(file);
      const formattedServices = services.map(formatService);
      const completions = formattedServices.map(generateCompletionItem);
      serviceCompletions.push(...completions);
    } catch (error) {
      errorCount++;
      logger.appendLine(`Error reading file ${file.fsPath}: ${error}`);
    }
  }

  if (errorCount > 0) {
    logger.appendLine(`Completed with ${errorCount} errors. Some services may not be available.`);
  }

  return serviceCompletions;
}

/**
 * Extracts services from a services.yml file
 *
 * @param {vscode.Uri} file - The URI of the services YAML file to scan
 * @returns {Promise<Array<{name: string, value: any}>>} Array of service objects
 * @throws {Error} If the file cannot be read or parsed
 */
async function findServices(file: vscode.Uri) {
  const content = await vscode.workspace.fs.readFile(file);
  const text = Buffer.from(content).toString('utf8');
  const parsed = parse(text);
  const { services } = parsed || {};

  if (!services) {
    return [];
  }

  return Object.entries(services).map(([name, value]) => ({ name, value }));
}

/**
 * Creates a service snippet with properly formatted service injection code
 *
 * @param {string} name - The service name
 * @param {any} value - The service definition
 * @returns {string} A formatted snippet string ready for VS Code completion
 */
function formatServiceSnippetString(name: string, value: any) {
  // Replace dots with underscores for variable name
  const variableName = name.replaceAll('.', '_');

  return [
    `/**`,
    ` * @var ${value?.class || 'Unknown'}`,
    ` */`,
    `\${1:\\$${variableName}_service} = \\Drupal::service('${name}');`,
    ``
  ].join('\n');
}

// /**
//  * Extracts and formats service documentation
//  *
//  * @param {string} name - The service name
//  * @param {any} value - The service definition
//  * @returns {string} Markdown-formatted documentation text
//  */
function formatServiceDocumentation(name: string, value: any) {
  const description = [];

  description.push(
    '**Drupal Smart Snippets**', '',
    `\`${value?.class || 'Unknown'}\``, '',
    `Service ID: \`${name}\``
  );

  if (value?.deprecated) {
    const message = value.deprecated.message || value.deprecated;
    const deprecationWarning = message
      .replaceAll('%alias_id%', name)
      .replaceAll('%service_id%', name);

    description.splice(2, 0, `_DEPRECATED: ${deprecationWarning}_`);
  }

  // Add any additional documentation if available
  if (value?.description) {
    description.push('', value?.description);
  }

  return description.join('\n');
}

/**
 * Shapes parsed service data into a format ready for VS Code completion items
 *
 * @param {Object} service - The service data object
 * @param {string} service.name - The service name
 * @param {any} service.value - The service definition
 * @returns {Object} An object with name, snippet, and description ready for completion item creation
 */
function formatService({ name, value }: { name: string, value: any }) {
  const snippet = formatServiceSnippetString(name, value);
  const description = formatServiceDocumentation(name, value);

  return {
    name,
    snippet,
    description,
  };
}

/**
 * Creates a VS Code completion item provider for PHP files with service completions
 *
 * @param {Object} serviceData - The processed service data
 * @param {string} serviceData.name - The service name
 * @param {string} serviceData.snippet - The snippet string
 * @param {string} serviceData.description - The markdown documentation
 * @returns {vscode.Disposable} A completion item provider registration
 */
function generateCompletionItem({ name, snippet, description }: { name: string, snippet: string, description: string }) {
  return vscode.languages.registerCompletionItemProvider('php', {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken,
      context: vscode.CompletionContext
    ) {
      // Only offer service completions in Drupal project structure
      const isDrupalProject = (
        document.fileName.includes('themes/') ||
        document.fileName.includes('modules/')
      );

      // Check if we're in an OOP context
      const isOOP = document.fileName.includes('/src/');

      // Early return if not in a Drupal project structure
      if (!isDrupalProject) { return []; }

      const completions = [];

      if (isOOP) {
        // TODO: Implement OOP service injection completion
        // For now, skip OOP completions
      } else {
        const completion = new vscode.CompletionItem(`service:${name}`);
        completion.kind = vscode.CompletionItemKind.Class;
        completion.documentation = new vscode.MarkdownString(description);
        completion.insertText = new vscode.SnippetString(snippet);
        completions.push(completion);
      }

      return completions;
    }
  });
}
