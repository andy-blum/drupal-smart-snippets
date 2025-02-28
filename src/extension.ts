// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	const logger = vscode.window.createOutputChannel('Drupal Smart Snippets');
	logger.appendLine('Drupal Smart Snippets is now active!');
	vscode.window.showInformationMessage('Drupal Smart Snippets is now active!');
}

// This method is called when your extension is deactivated
export function deactivate() {}
