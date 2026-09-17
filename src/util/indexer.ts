import * as vscode from 'vscode';
import logger from './logger';

export interface Indexer<T> extends vscode.Disposable {
  /** Every indexed item across all files. */
  all(): T[];
  /** Resolves once the initial scan has finished. */
  ready: Promise<void>;
  /** Drops the registry and rescans from scratch. */
  reindex(): Promise<void>;
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

  const indexDirectory = async (base: vscode.Uri) => {
    const files = await vscode.workspace.findFiles(new vscode.RelativePattern(base, glob));
    logger.appendLine(`Indexing ${label} from ${files.length} files...`);
    await Promise.all(files.map(indexFile));
    logger.appendLine(`Successfully indexed ${label}.`);
  };

  const reindex = () => {
    registry.clear();
    return indexDirectory(webRoot);
  };

  const ready = indexDirectory(webRoot);

  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  watcher.onDidChange(indexFile);
  watcher.onDidCreate(indexFile);
  watcher.onDidDelete(uri => registry.delete(uri.toString()));

  // Package managers drop whole directories in place via rename (composer
  // installing a module, for instance), which fires a single event for the
  // directory rather than one per file, so the glob watcher above never sees
  // them. Watch everything, ignoring changes, and handle directories here.
  const directoryWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(webRoot, '**'), false, true, false
  );
  directoryWatcher.onDidCreate(async uri => {
    const stat = await vscode.workspace.fs.stat(uri).then(s => s, () => null);
    if (stat?.type === vscode.FileType.Directory) {
      await indexDirectory(uri);
    }
  });
  directoryWatcher.onDidDelete(uri => {
    const prefix = uri.toString() + '/';
    for (const key of registry.keys()) {
      if (key.startsWith(prefix)) {
        registry.delete(key);
      }
    }
  });

  return {
    all: () => Array.from(registry.values()).flat(),
    ready,
    reindex,
    dispose: () => {
      watcher.dispose();
      directoryWatcher.dispose();
    },
  };
}

/**
 * Whether a document lives inside the Drupal web root. Compares `uri.path`
 * (always forward-slashed) rather than `fileName` so it works on Windows.
 */
export function isInWebRoot(document: vscode.TextDocument, webRoot: vscode.Uri): boolean {
  return document.uri.path.startsWith(webRoot.path.replace(/\/?$/, '/'));
}
