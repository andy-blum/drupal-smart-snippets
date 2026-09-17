/**
 * Drupal Hook Completions Provider
 *
 * Indexes every `*.api.php` under the web root and offers the `hook_*`
 * definitions found there as completions. Inside `src/Hook/` the snippet is an
 * OOP `#[Hook]` method; elsewhere it is a procedural function.
 */

import { createIndexer, isInWebRoot } from "../util/indexer";
import { findHooks, formatHook, formatOOPHookSnippetString, formatProceduralHookSnippetString } from "../lib/hooks";
import { readText } from "../util/readText";
import * as vscode from "vscode";

export default function hookCompletions(webRoot: vscode.Uri): vscode.Disposable[] {
  const index = createIndexer({
    label: 'hooks',
    webRoot,
    glob: '**/*.api.php',
    parse: async file => findHooks(await readText(file), file.path).map(formatHook),
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
