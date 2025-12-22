import * as vscode from 'vscode';
import parser from './parser';

interface CachedAnalysis {
  version: number;
  data: {
    namespace: string;
    useStatements: Map<string, string>;
    lastUseStatementEnd: number;
    namespaceEnd: number;
    firstNodeStart: number;
  };
}

const cache = new Map<string, CachedAnalysis>();

export function getCachedAnalysis(document: vscode.TextDocument) {
  const uri = document.uri.toString();
  const existing = cache.get(uri);

  if (existing && existing.version === document.version) {
    return existing.data;
  }

  const data = parseDocument(document);
  cache.set(uri, { version: document.version, data });
  return data;
}

function parseDocument(document: vscode.TextDocument) {
  let namespace = '';
  const useStatements = new Map<string, string>(); // FQN -> alias/name
  let lastUseStatementEnd = 0;
  let namespaceEnd = 0;
  let firstNodeStart = 0;

  try {
    const parsed = parser.parseCode(document.getText(), document.fileName);
    
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (firstNodeStart === 0 && node.kind !== 'inline') {
          firstNodeStart = node.loc.start.line;
        }

        if (node.kind === 'namespace') {
          namespace = node.name;
          namespaceEnd = node.loc.end.line;
          if (node.children) {
            walk(node.children);
          }
        } else if (node.kind === 'usegroup') {
          for (const item of node.items) {
            const fqn = item.name;
            const alias = item.alias ? (typeof item.alias === 'string' ? item.alias : item.alias.name) : fqn.split('\\').pop();
            useStatements.set(fqn, alias);
          }
          lastUseStatementEnd = node.loc.end.line;
        }
      }
    };

    if (parsed && parsed.children) {
      walk(parsed.children);
    }
  } catch (e) {
    // Ignore parse errors
  }

  return { namespace, useStatements, lastUseStatementEnd, namespaceEnd, firstNodeStart };
}
