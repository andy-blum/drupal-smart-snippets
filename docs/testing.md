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
npm run fetch-core                                       # core main + webform 6.3.x
DRUPAL_CORE_REF=11.x WEBFORM_REF=6.3.x npm run fetch-core # other branches
npm run test:core
```

`scripts/fetch-drupal-core.mjs` downloads a core branch tarball from the
[GitHub mirror](https://github.com/drupal/drupal) into `test/drupal-core/`
(gitignored), then drops the webform module from ftp.drupal.org into
`modules/contrib/webform` inside it. The mirror is used because
git.drupalcode.org's own archive endpoint intermittently returns 406.

Webform stands in for contrib code: it ships its own `*.api.php`, services
that alias into core (`logger.channel.webform`), and about 90 elements that
still use `@FormElement` docblock annotations, whereas core has moved to
attributes. Because it sits inside the web root, the core assertions run over
it too; a `webform (contrib)` block adds checks specific to it.

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
| `package` (PRs only) | `npm run package` builds a `.vsix`, uploads it as a workflow artifact, and posts or updates a sticky PR comment linking to it |

The `package` job is what to reach for when testing a PR by hand: download
the artifact, unzip it, and install the `.vsix` with
`code --install-extension <file>.vsix` or **Install from VSIX...** in the
Extensions view. Artifacts are kept for 14 days. Pull requests from forks
still get the artifact, but the comment is skipped because their token cannot
write to the repository.

The workflow also runs weekly on a schedule so that changes in core's `main`
branch that break parsing are noticed between PRs.

## Manual testing

Press F5 in VS Code ("Run Drupal Smart Snippets") to launch an Extension
Development Host with the built extension, then open a Drupal project in it.
`npm start` keeps the bundle rebuilt on save. Indexing progress and parse
errors are written to the "Drupal Smart Snippets" channel in the Output panel.
