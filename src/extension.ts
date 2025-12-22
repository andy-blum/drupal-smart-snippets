import * as vscode from 'vscode';

import hookCompletions from './completions/hooks';
import serviceCompletions from './completions/services';
import elementCompletions from './completions/elements';
import logger from './util/logger';

export async function activate(context: vscode.ExtensionContext) {
	// TODO: Remove these lines before publishing.
	logger.show();
	logger.appendLine('Drupal Smart Snippets is now active!');

	const hooks = await hookCompletions();
	const services = await serviceCompletions();
	const elements = await elementCompletions();

	context.subscriptions.push(
    ...(Array.isArray(hooks) ? hooks : [hooks]),
    ...(Array.isArray(services) ? services : [services]),
    ...(Array.isArray(elements) ? elements : [elements])
  );
}

export function deactivate() {}
