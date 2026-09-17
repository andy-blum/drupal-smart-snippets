import * as vscode from 'vscode';

import hookCompletions from './completions/hooks';
import serviceCompletions from './completions/services';
import elementCompletions from './completions/elements';
import getWebRoot from './util/getWebRoot';
import logger from './util/logger';

export async function activate(context: vscode.ExtensionContext) {
  logger.appendLine('Drupal Smart Snippets is now active!');

  const webRoot = await getWebRoot();
  if (!webRoot) {
    return;
  }

  // Providers read live registries, so register them before indexing finishes.
  const modules = [hookCompletions(webRoot), serviceCompletions(webRoot), elementCompletions(webRoot)];
  const indexers = modules.map(([, indexer]) => indexer);

  context.subscriptions.push(
    ...modules.flat(),
    vscode.commands.registerCommand('drupalSmartSnippets.reindex', () => Promise.all(indexers.map(indexer => indexer.reindex()))),
  );
}

export function deactivate() {}
