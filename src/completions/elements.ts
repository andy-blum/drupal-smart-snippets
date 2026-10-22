/**
 * Drupal Element Completions Provider
 *
 * Indexes every `Element/*.php` class under the web root, reading the
 * `#[FormElement]` / `#[RenderElement]` attribute (or legacy annotation), and
 * offers a render array snippet for each on the `element:` prefix.
 */

import { createIndexer, isInWebRoot, type Indexer } from "../util/indexer";
import { findElements, formatElement } from "../lib/elements";
import { readText } from "../util/readText";
import * as vscode from "vscode";

export default function elementCompletions(webRoot: vscode.Uri): [vscode.Disposable, Indexer<unknown>] {
  const index = createIndexer({
    label: 'elements',
    webRoot,
    glob: '**/Element/*.php',
    parse: async file => findElements(await readText(file), file.path).map(formatElement),
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
