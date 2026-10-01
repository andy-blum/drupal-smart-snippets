import * as vscode from 'vscode';

import hookCompletions from './completions/hooks';
import serviceCompletions from './completions/services';
import elementCompletions from './completions/elements';
import getWebRoot from './util/getWebRoot';
import logger from './util/logger';
import type { Indexer } from './util/indexer';

export async function activate(context: vscode.ExtensionContext) {
  logger.appendLine('Drupal Smart Snippets is now active!');

  let indexers: Indexer<unknown>[] | null = null;

  const start = async () => {
    const webRoot = await getWebRoot();
    if (!webRoot) {
      return false;
    }

    // Providers read live registries, so register them before indexing finishes.
    const modules = [hookCompletions(webRoot), serviceCompletions(webRoot), elementCompletions(webRoot)];
    indexers = modules.map(([, indexer]) => indexer);
    context.subscriptions.push(...modules.flat());
    return true;
  };

  // Registered before looking for the web root so the palette entry always
  // resolves, and so it can pick up a Drupal install created after activation.
  context.subscriptions.push(
    vscode.commands.registerCommand('drupalSmartSnippets.reindex', async () => {
      if (indexers) {
        await Promise.all(indexers.map(indexer => indexer.reindex()));
      } else if (!await start()) {
        vscode.window.showWarningMessage('Drupal Smart Snippets: could not find a Drupal web root (core/lib/Drupal.php) in this workspace.');
      }
    }),
  );

  await start();
}

export function deactivate() {}
