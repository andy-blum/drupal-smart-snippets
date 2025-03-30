import * as vscode from 'vscode';

export default async function() {
  const drupal_php = await vscode.workspace.findFiles('**/core/lib/Drupal.php').then(([file]) => (file?.path));
  return drupal_php.replace('core/lib/Drupal.php', '');
}
