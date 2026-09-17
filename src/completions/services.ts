/**
 * Drupal Service Completions Provider
 *
 * Indexes every `*.services.yml` under the web root and offers a
 * `\\Drupal::service()` snippet for each service on the `service:` prefix.
 */

import { createIndexer, isInWebRoot } from "../util/indexer";
import { findServices, formatServiceDocumentation, formatServiceSnippetString, resolveClass } from "../lib/services";
import { readText } from "../util/readText";
import * as vscode from "vscode";

export default function serviceCompletions(webRoot: vscode.Uri): vscode.Disposable[] {
  const index = createIndexer({
    label: 'services',
    webRoot,
    glob: '**/*.services.yml',
    parse: async file => findServices(await readText(file)),
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
