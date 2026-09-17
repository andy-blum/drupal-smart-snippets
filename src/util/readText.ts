import * as vscode from 'vscode';

export async function readText(file: vscode.Uri): Promise<string> {
  const content = await vscode.workspace.fs.readFile(file);
  return Buffer.from(content).toString('utf8');
}
