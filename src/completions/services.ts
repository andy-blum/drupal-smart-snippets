/**
 * Drupal Service Completions Provider
 *
 * This module provides IntelliSense completions for Drupal services in YAML files.
 * It scans *.services.yml files within the Drupal codebase to extract service definitions
 * and provides them as completion items with properly formatted documentation.
 */

import logger from "../util/logger";
import getWebRoot from "../util/getWebRoot";
import { getCachedAnalysis } from "../util/parserCache";
import { parse } from 'yaml';
import * as vscode from "vscode";

interface ServiceCompletionMetadata {
  fullClass: string;
  isOOP: boolean;
  serviceName: string;
  documentUri: string;
}

/**
 * Custom CompletionItem that includes service metadata
 */
class ServiceCompletionItem extends vscode.CompletionItem {
  data?: ServiceCompletionMetadata;
}

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

      const allServices = Array.from(serviceRegistry.values()).flat();

      const wordRange = document.getWordRangeAtPosition(position);
      const replaceRange = new vscode.Range(
        new vscode.Position(position.line, serviceIndex),
        wordRange ? wordRange.end : position
      );

      return allServices.map(service => {
        const fullClass = service.value?.class || 'Unknown';
        
        // Lightweight completion item creation
        const completion = new ServiceCompletionItem(`service:${service.name}`, vscode.CompletionItemKind.Class);
        completion.range = replaceRange;
        completion.documentation = new vscode.MarkdownString(service.description);
        completion.sortText = `000-${service.name}`;
        
        // Enforce short name immediately in the snippet
        const className = fullClass.split('\\').pop() || 'Unknown';
        completion.insertText = new vscode.SnippetString(formatServiceSnippetString(service.name, className, isOOP));

        // Store metadata for lazy resolution of use statements
        const metadata: ServiceCompletionMetadata = {
          fullClass,
          isOOP,
          serviceName: service.name,
          documentUri: document.uri.toString()
        };
        completion.data = metadata;
        
        return completion;
      });
    },

    resolveCompletionItem(item: ServiceCompletionItem) {
      const metadata = item.data;
      if (!metadata || metadata.fullClass === 'Unknown') {
        return item;
      }

      const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === metadata.documentUri);
      if (!document) {
        return item;
      }

      // Heavy lifting happens only for the selected item
      const normalizedFullClass = metadata.fullClass.startsWith('\\') 
        ? metadata.fullClass.substring(1) 
        : metadata.fullClass;

      // Only add use statement if it's not a parameter (contains %)
      if (!normalizedFullClass.includes('%')) {
        const analysis = getCachedAnalysis(document);
        const additionalTextEdits: vscode.TextEdit[] = [];
        
        handleClassImport(
          normalizedFullClass, 
          document, 
          analysis.namespace, 
          analysis.useStatements, 
          analysis.lastUseStatementEnd, 
          analysis.namespaceEnd, 
          analysis.firstNodeStart, 
          additionalTextEdits
        );

        item.additionalTextEdits = additionalTextEdits;
      }

      return item;
    }
  }, ':');

  return [provider, watcher];
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

  // 1. Already imported?
  if (useStatements.has(fullClass)) {
    return useStatements.get(fullClass) || className;
  }

  // 2. Backup check: exists in text?
  const docText = document.getText();
  if (docText.includes(`use ${fullClass};`)) {
    return className;
  }

  // 3. Same namespace?
  if (classNamespace === namespace) {
    return className;
  }

  // Not imported, let's add a use statement
  let insertLine = 0;
  let useText = `use ${fullClass};\n`;

  if (lastUseStatementEnd) {
    insertLine = lastUseStatementEnd;
    const nextLine = document.lineAt(Math.min(lastUseStatementEnd, document.lineCount - 1));
    if (nextLine.text.trim() !== '') {
      useText += '\n';
    }
  } else if (namespaceEnd) {
    insertLine = namespaceEnd;
    const lineAfterNamespace = document.lineAt(Math.min(namespaceEnd, document.lineCount - 1));
    const hasBlankAfterNamespace = lineAfterNamespace.text.trim() === '';
    
    if (hasBlankAfterNamespace) {
      // Use the existing blank line
      insertLine = namespaceEnd + 1;
      const lineAfterBlank = document.lineAt(Math.min(namespaceEnd + 1, document.lineCount - 1));
      if (lineAfterBlank.text.trim() !== '') {
        useText += '\n';
      }
    } else {
      // Create a blank line
      useText = `\nuse ${fullClass};\n\n`;
    }
  } else {
    insertLine = firstNodeStart > 1 ? firstNodeStart - 1 : 0;
    useText = `use ${fullClass};\n\n`;
  }

  // Only add if not already in edits
  if (!additionalTextEdits.some(edit => edit.newText.includes(fullClass))) {
    additionalTextEdits.push(vscode.TextEdit.insert(new vscode.Position(insertLine, 0), useText));
  }

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
