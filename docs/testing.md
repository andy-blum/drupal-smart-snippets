# Testing

## Unit tests

```bash
npm test
```

Vitest suites in `src/lib/*.test.ts` exercise the parse and format functions
against `test/fixtures/`. The fixtures are trimmed copies of real core files
plus hand-written edge cases: legacy `@FormElement` annotations, string and
map aliases, `parent:` inheritance, Symfony-style `deprecated:` maps, alias
cycles, and hooks with several placeholders.

The tests import from `src/lib/`, which has no dependency on the `vscode`
module, so they run in plain Node with no extension host. When fixing a bug in
snippet output, add the failing case here first.

## Drupal core compatibility

```bash
npm run fetch-core                      # main branch
DRUPAL_CORE_REF=11.x npm run fetch-core # any branch or tag
npm run test:core
```

`scripts/fetch-drupal-core.mjs` downloads a tarball from
git.drupalcode.org into `test/drupal-core/` (gitignored). GitLab needs
`?ref_type=heads` for branch names containing dots and intermittently returns
406 while it builds the archive, so the script retries.

`src/lib/core.test.ts` then runs the same functions over every `*.api.php`,
`*.services.yml`, and `Element/*.php` in that tree. It asserts invariants
rather than exact counts so it keeps passing as core changes:

- well-known hooks, services, and elements are found and typed correctly;
- every generated snippet is well-formed (balanced, no unescaped `$`);
- fewer than 1% of completable services lack a resolvable class.

The suite skips itself when the checkout is absent, so `npm test` works
without a download. `vitest.config.ts` limits test discovery to `src/` so
core's own `*.test.js` files are ignored.

## Continuous integration

`.github/workflows/test.yml` runs on every pull request and push to `main`:

| Job | Steps |
| --- | --- |
| `test` | `npm ci`, type-check, lint, unit tests |
| `drupal-core (main)` | fetch core `main`, run the compatibility suite |
| `drupal-core (11.x)` | fetch core `11.x`, run the compatibility suite |

The workflow also runs weekly on a schedule so that changes in core's `main`
branch that break parsing are noticed between PRs.

## Manual testing

Press F5 in VS Code ("Run Drupal Smart Snippets") to launch an Extension
Development Host with the built extension, then open a Drupal project in it.
`npm start` keeps the bundle rebuilt on save. Indexing progress and parse
errors are written to the "Drupal Smart Snippets" channel in the Output panel.
