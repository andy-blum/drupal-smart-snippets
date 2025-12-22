import * as vscode from 'vscode';
import logger from "../util/logger";

export default async function() {
  const drupal_php = await vscode.workspace.findFiles('**/core/lib/Drupal.php').then(([file]) => (file?.path));
  if (!drupal_php) {
    logger.appendLine('Could not find Drupal root. Snippets will not be available.');
    return null;
  }
  return drupal_php.replace('core/lib/Drupal.php', '');
}
