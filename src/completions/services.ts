/**
 * Drupal Service Completions Provider
 *
 * Indexes every `*.services.yml` under the web root and offers a
 * `\\Drupal::service()` snippet for each service on the `service:` prefix.
 */

import { createIndexer, isInWebRoot } from "../util/indexer";
import { parse } from 'yaml';
import * as vscode from "vscode";

interface Service {
  name: string;
  value: any;
}

export default function serviceCompletions(webRoot: vscode.Uri): vscode.Disposable[] {
  const index = createIndexer({
    label: 'services',
    webRoot,
    glob: '**/*.services.yml',
    parse: findServices,
  });

  const provider = vscode.languages.registerCompletionItemProvider('php', {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
      if (!isInWebRoot(document, webRoot)) {
        return [];
      }

      const linePrefix = document.lineAt(position).text.substring(0, position.character);
      const serviceIndex = linePrefix.lastIndexOf('service:');

      if (serviceIndex === -1) {
        return [];
      }

      const isOOP = document.uri.path.includes('/src/');
      const services = index.all();
      const byName = new Map(services.map(service => [service.name, service.value]));

      const wordRange = document.getWordRangeAtPosition(position);
      const replaceRange = new vscode.Range(
        new vscode.Position(position.line, serviceIndex),
        wordRange ? wordRange.end : position
      );

      return services.map(({ name, value }) => {
        const fullClass = resolveClass(name, value, byName);
        const className = fullClass?.split('\\').pop();

        const completion = new vscode.CompletionItem(`service:${name}`, vscode.CompletionItemKind.Class);
        completion.range = replaceRange;
        completion.documentation = new vscode.MarkdownString(formatServiceDocumentation(name, value, fullClass));
        completion.sortText = `000-${name}`;
        completion.insertText = new vscode.SnippetString(formatServiceSnippetString(name, className, isOOP));

        return completion;
      });
    }
  }, ':');

  return [provider, index];
}

/**
 * Resolves the concrete class a service ID refers to. Handles:
 *  - explicit `class:` keys
 *  - class-keyed (autowired) services, where the ID is the FQCN
 *  - aliases, either `foo: '@bar'` or `foo: { alias: bar }`
 */
function resolveClass(name: string, value: any, byName: Map<string, any>, depth = 0): string | null {
  const aliasTarget = typeof value === 'string' && value.startsWith('@')
    ? value.slice(1)
    : value?.alias;

  if (aliasTarget && depth < 5 && byName.has(aliasTarget)) {
    return resolveClass(aliasTarget, byName.get(aliasTarget), byName, depth + 1);
  }

  const cls = value?.class || (name.includes('\\') ? name : null);
  return cls ? cls.replace(/^\\/, '') : null;
}

async function findServices(file: vscode.Uri): Promise<Service[]> {
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
function formatServiceSnippetString(name: string, className: string | undefined, isOOP: boolean) {
  const variableName = name.replaceAll('.', '_').replaceAll('\\', '_');
  const lines = [];

  if (isOOP) {
    lines.push(`// @todo: Consider using Dependency Injection instead of \\Drupal::service().`);
  }

  lines.push(`\\$\${1:${variableName}_service} = \\Drupal::service('${name}');`);

  if (className) {
    lines.push(`assert(\\$\${1} instanceof ${className});`);
  }

  lines.push(``);

  return lines.join('\n');
}

function formatServiceDocumentation(name: string, value: any, fullClass: string | null) {
  const description = [
    '**Drupal Smart Snippets**', '',
    `\`${fullClass || 'Unknown'}\``, '',
    `Service ID: \`${name}\``
  ];

  if (value?.deprecated) {
    // Either a bare string or a Symfony-style `{ package, version, message }` map.
    const message = typeof value.deprecated === 'string'
      ? value.deprecated
      : value.deprecated.message;
    const deprecationWarning = typeof message === 'string'
      ? message.replaceAll('%alias_id%', name).replaceAll('%service_id%', name)
      : 'This service is deprecated.';

    description.splice(2, 0, `_DEPRECATED: ${deprecationWarning}_`);
  }

  if (value?.description) {
    description.push('', value.description);
  }

  return description.join('\n');
}
