import * as vscode from 'vscode';
import logger from './logger';

export interface Indexer<T> extends vscode.Disposable {
  /** Every indexed item across all files. */
  all(): T[];
  /** Resolves once the initial scan has finished. */
  ready: Promise<void>;
}

interface IndexerOptions<T> {
  label: string;
  webRoot: vscode.Uri;
  glob: string;
  parse: (file: vscode.Uri) => Promise<T[]>;
}

/**
 * Scans the web root for files matching `glob`, keeps a per-file registry of
 * parsed items, and re-indexes files as they change.
 */
export function createIndexer<T>({ label, webRoot, glob, parse }: IndexerOptions<T>): Indexer<T> {
  const registry = new Map<string, T[]>();
  const pattern = new vscode.RelativePattern(webRoot, glob);

  const indexFile = async (file: vscode.Uri) => {
    try {
      registry.set(file.toString(), await parse(file));
    } catch (error) {
      logger.appendLine(`Error reading file ${file.fsPath}: ${error}`);
    }
  };

  const ready = Promise.resolve(vscode.workspace.findFiles(pattern)).then(async files => {
    logger.appendLine(`Indexing ${label} from ${files.length} files...`);
    await Promise.all(files.map(indexFile));
    logger.appendLine(`Successfully indexed ${label}.`);
  });

  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  watcher.onDidChange(indexFile);
  watcher.onDidCreate(indexFile);
  watcher.onDidDelete(uri => registry.delete(uri.toString()));

  return {
    all: () => Array.from(registry.values()).flat(),
    ready,
    dispose: () => watcher.dispose(),
  };
}

/**
 * Whether a document lives inside the Drupal web root. Compares `uri.path`
 * (always forward-slashed) rather than `fileName` so it works on Windows.
 */
export function isInWebRoot(document: vscode.TextDocument, webRoot: vscode.Uri): boolean {
  return document.uri.path.startsWith(webRoot.path.replace(/\/?$/, '/'));
}
