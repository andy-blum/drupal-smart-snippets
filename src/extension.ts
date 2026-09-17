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
  context.subscriptions.push(
    ...hookCompletions(webRoot),
    ...serviceCompletions(webRoot),
    ...elementCompletions(webRoot),
  );
}

export function deactivate() {}
