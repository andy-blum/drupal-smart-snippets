# Contributing

## How the extension works

Version 3 replaced the static snippet files with completion providers that
index the Drupal codebase open in the workspace. Nothing is bundled with the
extension; everything it offers comes from the project's own files.

### Activation

`src/extension.ts` runs on `onStartupFinished`:

1. `getWebRoot()` finds `core/lib/Drupal.php` in the workspace and treats the
   directory three levels up as the Drupal web root. If there is none, the
   extension does nothing.
2. Each of the three completion modules is given the web root and returns its
   provider and file watcher, which are pushed onto the extension context.

Providers are registered before indexing finishes. They read a live registry,
so completions appear as soon as the first files are parsed.

### Indexing

`src/util/indexer.ts` holds the one piece of shared machinery, `createIndexer`.
Given a glob and a parse function it:

- runs `workspace.findFiles` scoped to the web root and parses every match in
  parallel, storing results per file;
- creates a `FileSystemWatcher` for the same glob so edits, new files, and
  deletions update the registry without a reload;
- exposes `all()` for the provider to read.

`isInWebRoot()` is the gate every provider applies first. It compares
`document.uri.path`, not `fileName`, so it behaves the same on Windows.

### Completion modules

Each module in `src/completions/` is the VS Code wiring only. The parsing and
snippet formatting live in `src/lib/` and take plain strings, which is what
makes them unit-testable.

| Module | Indexes | Trigger | Notes |
| --- | --- | --- | --- |
| `hooks` | `**/*.api.php` | any word in a file under the web root | Skipped inside `src/` unless the path contains `src/Hook/`, where the snippet becomes a `#[Hook]` method instead of a procedural function. |
| `services` | `**/*.services.yml` | `service:` prefix | Resolves the class through `class:`, class-keyed autowired IDs, `alias:` / `'@id'` aliases, and `parent:`. Abstract services and named-autowire aliases (`Foo\Bar $baz`) stay in the registry for lookups but are not offered. |
| `elements` | `**/Element/*.php` | `element:` prefix | Reads `#[FormElement]` / `#[RenderElement]` attributes, falling back to `@FormElement` / `@RenderElement` annotations. Properties listed under `Properties:` in the docblock become tab stops. |

PHP is parsed with [php-parser](https://github.com/glayzzle/php-parser)
(`src/util/parser.ts`), YAML with [yaml](https://eemeli.org/yaml/).

## Development

```bash
npm ci
npm start        # esbuild + tsc in watch mode
```

Press F5 in VS Code ("Run Drupal Smart Snippets") to launch an Extension
Development Host; open a Drupal project in it. Output goes to the
"Drupal Smart Snippets" channel in the Output panel.

`npm run build` runs type-checking, lint, the unit tests, and the production
bundle, and is what `vsce package` calls.

## Testing

### Unit tests

```bash
npm test
```

Vitest suites in `src/lib/*.test.ts` exercise the parse and format functions
against `test/fixtures/`. The fixtures are trimmed copies of real core files
plus hand-written edge cases (legacy annotations, aliases, `parent:`,
Symfony-style `deprecated:` maps, alias cycles, multi-placeholder hooks).
When fixing a bug in snippet output, add the failing case here first.

### Drupal core compatibility

```bash
npm run fetch-core                      # main branch
DRUPAL_CORE_REF=11.x npm run fetch-core # any branch or tag
npm run test:core
```

`src/lib/core.test.ts` runs the same functions over every `*.api.php`,
`*.services.yml`, and `Element/*.php` in a real core checkout in
`test/drupal-core/` (gitignored). It asserts invariants rather than exact
counts so it keeps passing as core changes: well-known hooks, services, and
elements are found and typed correctly, every generated snippet is
well-formed, and fewer than 1% of completable services lack a resolvable
class. The suite skips itself when the checkout is absent, so `npm test`
works without a download.

### Continuous integration

`.github/workflows/test.yml` runs on every pull request and push to `main`:

- **test**: type-check, lint, unit tests.
- **drupal-core (main)** and **drupal-core (11.x)**: fetch that core branch
  and run the compatibility suite.

The workflow also runs weekly on a schedule so that changes in core's `main`
branch that break parsing are noticed between PRs.

## Releasing

Bump `version` in `package.json`, add a `CHANGELOG.md` entry, then
`npx @vscode/vsce package`. Only `dist/`, `package.json`, the docs, and
`images/` end up in the VSIX (see `.vscodeignore`).
