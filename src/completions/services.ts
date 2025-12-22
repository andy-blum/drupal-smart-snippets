/**
 * Drupal Service Completions Provider
 *
 * This module provides IntelliSense completions for Drupal services in YAML files.
 * It scans *.services.yml files within the Drupal codebase to extract service definitions
 * and provides them as completion items with properly formatted documentation.
 */

import logger from "../util/logger";
import getWebRoot from "../util/getWebRoot";
import parser from "../util/parser";
import { parse } from 'yaml';
import * as vscode from "vscode";
import type * as PHP from "php-parser";

/**
 * Provides service completions for the VS Code editor
 */
export default async function serviceCompletions() {
  const webRoot = await getWebRoot();
  if (!webRoot) {
    logger.appendLine('Could find Drupal root. Service completions will not be available.');
    return [];
  }

  const serviceRegistry = new Map<string, Array<{name: string, value: any, description: string}>>();

  const indexFile = async (file: vscode.Uri) => {
    try {
      const services = await findServices(file);
      const formattedServices = services.map(formatService);
      serviceRegistry.set(file.fsPath, formattedServices);
    } catch (error) {
      logger.appendLine(`Error reading file ${file.fsPath}: ${error}`);
    }
  };

  const files = await vscode.workspace.findFiles(`**/*.services.yml`)
    .then(files => (
      files.filter(({path}) => path.startsWith(webRoot))
    ));

  logger.appendLine(`Indexing services from ${files.length} files...`);

  for (const file of files) {
    await indexFile(file);
  }

  logger.appendLine(`Successfully indexed services.`);

  // Setup watcher for future changes
  const watcher = vscode.workspace.createFileSystemWatcher(`**/*.services.yml`);
  watcher.onDidChange(uri => indexFile(uri));
  watcher.onDidCreate(uri => indexFile(uri));
  watcher.onDidDelete(uri => serviceRegistry.delete(uri.fsPath));

  // Register a single completion item provider for all services
  const provider = vscode.languages.registerCompletionItemProvider('php', {
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

      if (!isDrupalProject) {
        return [];
      }

      // Gatekeeper: Only parse if 'service:' is in the current line
      const lineText = document.lineAt(position).text;
      const linePrefix = lineText.substring(0, position.character);
      const serviceIndex = linePrefix.lastIndexOf('service:');

      if (serviceIndex === -1) {
        return [];
      }

      // Check if we're in an OOP context
      const isOOP = document.fileName.includes('/src/');

      // Parse the current document to find namespaces and use statements
      const { namespace, useStatements, lastUseStatementEnd, namespaceEnd, firstNodeStart } = parseDocument(document);

      const allServices = Array.from(serviceRegistry.values()).flat();

      const wordRange = document.getWordRangeAtPosition(position);
      const replaceRange = new vscode.Range(
        new vscode.Position(position.line, serviceIndex),
        wordRange ? wordRange.end : position
      );

      return allServices.map(service => {
        const fullClass = service.value?.class;
        const completion = new vscode.CompletionItem(`service:${service.name}`, vscode.CompletionItemKind.Class);
        completion.range = replaceRange;
        completion.documentation = new vscode.MarkdownString(service.description);
        completion.sortText = `000-${service.name}`;

        let classToUse = fullClass || 'Unknown';
        const additionalTextEdits: vscode.TextEdit[] = [];

        if (fullClass && fullClass.startsWith('\\')) {
          // Remove leading backslash for comparison
          const normalizedFullClass = fullClass.substring(1);
          classToUse = handleClassImport(normalizedFullClass, document, namespace, useStatements, lastUseStatementEnd, namespaceEnd, firstNodeStart, additionalTextEdits);
        } else if (fullClass && !fullClass.includes('%')) {
          classToUse = handleClassImport(fullClass, document, namespace, useStatements, lastUseStatementEnd, namespaceEnd, firstNodeStart, additionalTextEdits);
        }

        completion.insertText = new vscode.SnippetString(formatServiceSnippetString(service.name, classToUse, isOOP));
        completion.additionalTextEdits = additionalTextEdits;
        
        return completion;
      });
    }
  }, ':');

  return [provider, watcher];
}

/**
 * Parses the document to extract namespace and use statements
 */
function parseDocument(document: vscode.TextDocument) {
  let namespace = '';
  const useStatements = new Map<string, string>(); // FQN -> alias/name
  let lastUseStatementEnd = 0;
  let namespaceEnd = 0;
  let firstNodeStart = 0;

  try {
    const parsed = parser.parseCode(document.getText(), document.fileName);
    
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (firstNodeStart === 0 && node.kind !== 'inline') {
          firstNodeStart = node.loc.start.line;
        }

        if (node.kind === 'namespace') {
          namespace = node.name;
          namespaceEnd = node.loc.end.line;
          if (node.children) {
            walk(node.children);
          }
        } else if (node.kind === 'usegroup') {
          for (const item of node.items) {
            const fqn = item.name;
            const alias = item.alias ? (typeof item.alias === 'string' ? item.alias : item.alias.name) : fqn.split('\\').pop();
            useStatements.set(fqn, alias);
          }
          lastUseStatementEnd = node.loc.end.line;
        }
      }
    };

    if (parsed && parsed.children) {
      walk(parsed.children);
    }
  } catch (e) {
    // Ignore parse errors in the current document
  }

  return { namespace, useStatements, lastUseStatementEnd, namespaceEnd, firstNodeStart };
}

/**
 * Determines the best way to reference a class and prepares additional edits if needed
 */
function handleClassImport(
  fullClass: string, 
  document: vscode.TextDocument,
  namespace: string, 
  useStatements: Map<string, string>, 
  lastUseStatementEnd: number, 
  namespaceEnd: number, 
  firstNodeStart: number,
  additionalTextEdits: vscode.TextEdit[]
): string {
  const parts = fullClass.split('\\');
  const className = parts.pop() || '';
  const classNamespace = parts.join('\\');

  // 1. Already imported (via parser)?
  if (useStatements.has(fullClass)) {
    return useStatements.get(fullClass) || className;
  }

  // 2. Backup check: exists in text? (In case parser failed on broken document)
  const docText = document.getText();
  if (docText.includes(`use ${fullClass};`)) {
    return className;
  }

  // 3. Same namespace?
  if (classNamespace === namespace) {
    return className;
  }

  // Check if the short name is already taken by another use statement
  const isShortNameTaken = Array.from(useStatements.values()).includes(className);

  if (isShortNameTaken) {
    // Fallback to FQN if short name is taken
    return `\\${fullClass}`;
  }

  // Not imported, let's add a use statement
  let insertLine = 0;
  if (lastUseStatementEnd) {
    insertLine = lastUseStatementEnd;
  } else if (namespaceEnd) {
    insertLine = namespaceEnd;
  } else if (firstNodeStart > 1) {
    insertLine = firstNodeStart - 1;
  } else {
    insertLine = 1;
  }

  const useText = `use ${fullClass};\n`;
  
  // Only add if not already in edits (multiple services might use same class)
  additionalTextEdits.push(vscode.TextEdit.insert(new vscode.Position(insertLine, 0), useText));

  return className;
}

/**
 * Extracts services from a services.yml file
 */
async function findServices(file: vscode.Uri) {
  const content = await vscode.workspace.fs.readFile(file);
  const text = Buffer.from(content).toString('utf8');
  const parsed = parse(text);
  const { services } = parsed || {};

  if (!services) {
    return [];
  }

  return Object.entries(services)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, value]) => ({ name, value }));
}

/**
 * Creates a service snippet
 */
function formatServiceSnippetString(name: string, className: string, isOOP: boolean) {
  const variableName = name.replaceAll('.', '_');
  const lines = [];

  if (isOOP) {
    lines.push(`// @todo: Consider using Dependency Injection instead of \\Drupal::service().`);
  }

  lines.push(`\\$\${1:${variableName}_service} = \\Drupal::service('${name}');`);
  lines.push(`assert(\\$\${1} instanceof ${className});`);
  lines.push(``);

  return lines.join('\n');
}

/**
 * Extracts and formats service documentation
 */
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

  if (value?.description) {
    description.push('', value?.description);
  }

  return description.join('\n');
}

/**
 * Shapes parsed service data
 */
function formatService({ name, value }: { name: string, value: any }) {
  const description = formatServiceDocumentation(name, value);

  return {
    name,
    value,
    description,
  };
}
