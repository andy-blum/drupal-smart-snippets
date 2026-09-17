# Architecture

Version 3 replaced the static snippet files with completion providers that
index the Drupal codebase open in the workspace. Nothing is bundled with the
extension; everything it offers comes from the project's own files.

## Activation

`src/extension.ts` runs on `onStartupFinished`:

1. `getWebRoot()` (`src/util/getWebRoot.ts`) finds `core/lib/Drupal.php` in
   the workspace and treats the directory three levels up as the Drupal web
   root. If there is none, the extension does nothing.
2. Each of the three completion modules is given the web root and returns its
   provider and file watcher, which are pushed onto the extension context.

Providers are registered before indexing finishes. They read a live registry,
so completions appear as soon as the first files are parsed.

## Indexing

`src/util/indexer.ts` holds the shared machinery, `createIndexer`. Given a
glob and a parse function it:

- runs `workspace.findFiles` scoped to the web root and parses every match in
  parallel, storing results per file;
- creates a `FileSystemWatcher` for the same glob so edits, new files, and
  deletions update the registry without a reload;
- creates a second watcher for directory events, because tools like composer
  install a module by renaming a whole directory into place, which VS Code
  reports as one event for the directory rather than one per file; a new
  directory is scanned with the same glob, a deleted one has its entries
  dropped;
- exposes `all()` for the provider to read and `reindex()` for the
  **Drupal Smart Snippets: Reindex** command, the fallback when a change is
  missed.

`isInWebRoot()` is the gate every provider applies first. It compares
`document.uri.path`, not `fileName`, so it behaves the same on Windows.

## Completion modules

Each module in `src/completions/` is the VS Code wiring only: it creates an
indexer, registers a provider, and maps registry entries to `CompletionItem`s.
The parsing and snippet formatting live in `src/lib/` and take plain strings,
which is what makes them unit-testable.

| Module | Indexes | Trigger | Notes |
| --- | --- | --- | --- |
| `hooks` | `**/*.api.php` | any word in a file under the web root | Skipped inside `src/` unless the path contains `src/Hook/`, where the snippet becomes a `#[Hook]` method instead of a procedural function. |
| `services` | `**/*.services.yml` | `service:` prefix | Resolves the class through `class:`, class-keyed autowired IDs, `alias:` / `'@id'` aliases, and `parent:`. Abstract, private (`public: false`), and named-autowire alias (`Foo\Bar $baz`) services stay in the registry for lookups but are not offered. |
| `elements` | `**/Element/*.php` | `element:` prefix | Reads `#[FormElement]` / `#[RenderElement]` attributes, falling back to `@FormElement` / `@RenderElement` annotations. Properties listed under `Properties:` in the docblock become tab stops. |

### Hooks

`findHooks` walks the top-level functions of an `.api.php` file and keeps
those named `hook_*`, along with the source of the signature and the leading
docblock. Two snippet shapes are generated from each:

- **Procedural**: `hook` becomes `${1:${TM_FILENAME_BASE:hook}}` so the
  module name is filled from the file name; each `UPPER_CASE` segment
  (`ENTITY_TYPE`, `FORM_ID`) becomes a further tab stop.
- **OOP**: the same segments become tab stops inside the `#[Hook('...')]`
  attribute, and the method name mirrors them with VS Code's `camelcase` /
  `capitalize` transforms so editing the attribute updates the method name.

A hook whose docblock carries `@deprecated` gets that message in the
generated docblock and is tagged deprecated in the completion list, as are
deprecated services.

### Services

`findServices` returns every entry under `services:` except `_defaults` and
`_instanceof`. `resolveClass` is called at completion time, with the whole
registry available, so aliases and parents defined in other files resolve.
The snippet assigns `\Drupal::service('id')` to a variable and adds an
`assert($var instanceof Class)` line for type hinting; the assert is omitted
when no class can be determined. A deprecated service gets a `// @deprecated`
comment carrying the message from the YAML; inside `src/` a `@todo` comment
recommends dependency injection instead.

### Elements

`findElements` walks class declarations looking for a `FormElement` or
`RenderElement` attribute, then falls back to the same names as docblock
annotations. The snippet always starts with `'#type'`; form elements also get
`#title`, `#title_display`, `#description`, and `#required` tab stops; any
other `#property` named in the docblock's `Properties:` list is appended.

## Dependencies

PHP is parsed with [php-parser](https://github.com/glayzzle/php-parser),
configured in `src/util/parser.ts` with locations and docblock extraction
enabled. YAML is parsed with [yaml](https://eemeli.org/yaml/), with unknown
tags such as Symfony's `!tagged_iterator` silently accepted.

## Build

`esbuild.js` bundles `src/extension.ts` into `dist/extension.js` as CommonJS
with `vscode` marked external. `npm run build` runs type-checking, lint, the
unit tests, and the production bundle, and is what `vsce package` calls. Only
`dist/`, `package.json`, the docs, and `images/` end up in the VSIX (see
`.vscodeignore`).
