import * as vscode from 'vscode';
import logger from "../util/logger";

/**
 * Locates the Drupal web root (the directory containing `core/`) by searching
 * the workspace for `core/lib/Drupal.php`.
 */
export default async function(): Promise<vscode.Uri | null> {
  const [drupalPhp] = await vscode.workspace.findFiles('**/core/lib/Drupal.php', '**/node_modules/**', 1);
  if (!drupalPhp) {
    logger.appendLine('Could not find Drupal root. Snippets will not be available.');
    return null;
  }
  return vscode.Uri.joinPath(drupalPhp, '..', '..', '..');
}
