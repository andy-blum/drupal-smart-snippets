/**
 * Escapes text for literal insertion into a VS Code `SnippetString`, where
 * `$`, `}` and `\` are syntax. Used for content copied from the codebase
 * (deprecation messages) that may mention PHP variables like `$form`.
 */
export function escapeSnippet(text: string): string {
  return text.replace(/[\\$}]/g, '\\$&');
}
