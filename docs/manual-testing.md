# Manual testing

The automated suites cover parsing and snippet generation. Everything that
touches VS Code itself (activation, file watching, path gating, completion
triggers, the rendered snippets) needs a person with the extension installed.
This walkthrough goes from a fresh install to every feature in the PR. It
takes about twenty minutes.

## 1. Set up a Drupal project

Any Drupal 10/11 codebase works. For a clean one:

```bash
composer create-project drupal/recommended-project dss-test
cd dss-test
```

The site does not need to be installed or served; the extension only reads
files. Add a custom module to type into:

```bash
mkdir -p web/modules/custom/dsstest/src/Hook web/modules/custom/dsstest/src/Form
cat > web/modules/custom/dsstest/dsstest.info.yml <<'YML'
name: DSS Test
type: module
core_version_requirement: ^10 || ^11
YML
printf '<?php\n\n' > web/modules/custom/dsstest/dsstest.module
printf '<?php\n\nnamespace Drupal\\dsstest\\Hook;\n\nuse Drupal\\Core\\Hook\\Attribute\\Hook;\n\nclass DsstestHooks {\n\n}\n' > web/modules/custom/dsstest/src/Hook/DsstestHooks.php
printf '<?php\n\nnamespace Drupal\\dsstest\\Form;\n\nclass TestForm {\n\n}\n' > web/modules/custom/dsstest/src/Form/TestForm.php
```

## 2. Install the extension from the PR's `.vsix`

1. On the pull request, find the sticky **Try this PR** comment and download
   the linked artifact. It is a zip; unzip it to get
   `drupal-smart-snippets-<version>-<sha>.vsix`.
2. If you have the marketplace version of Drupal Smart Snippets installed,
   disable or uninstall it first so you know which one is answering.
3. Install: `code --install-extension drupal-smart-snippets-*.vsix`, or in
   VS Code open the Extensions view, click the `...` menu, choose
   **Install from VSIX...**.
4. Open the `dss-test` folder in VS Code.

Check activation: **View → Output**, pick **Drupal Smart Snippets** from the
dropdown. Expect, roughly:

```
Drupal Smart Snippets is now active!
Indexing services from N files...
Indexing hooks from N files...
Indexing elements from N files...
Successfully indexed services.
Successfully indexed hooks.
Successfully indexed elements.
```

- [ ] The Output panel did **not** open by itself on startup.
- [ ] Opening a folder with no Drupal in it logs only `Could not find Drupal root` and nothing errors.

Recommended while testing, so Intelephense's own hook suggestions don't
muddy the list (from the README):

```json
"intelephense.files.exclude": ["**/*.api.php"]
```

## 3. Hooks, procedural

Open `web/modules/custom/dsstest/dsstest.module` and type `hook_form` on a
blank line.

- [ ] Completions starting with `hook_form_` appear at the top of the list.
- [ ] Accept `hook_form_FORM_ID_alter`. Expected insertion:

  ```php
  /**
   * Implements hook_form_FORM_ID_alter().
   */
  function dsstest_form_FORM_ID_alter(&$form, \Drupal\Core\Form\FormStateInterface $form_state, $form_id): void {
    |
  }
  ```

  `dsstest` is prefilled from the file name and selected; Tab moves to
  `FORM_ID`, then to the body. `$form` and friends are literal.
- [ ] Type `hook_ENTITY_TYPE_view` and accept: `ENTITY_TYPE` is a tab stop.
- [ ] Repeat the first check in a `.install`, `.theme`, `.inc`, and `.profile`
  file (create empty ones in the module). All should offer hooks; `.profile`
  did not before this PR.
- [ ] Open `web/modules/custom/dsstest/src/Form/TestForm.php` and type
  `hook_form` inside the class. **No** hook completions: classes outside
  `src/Hook/` can't implement hooks.

## 4. Hooks, OOP

Open `web/modules/custom/dsstest/src/Hook/DsstestHooks.php` and type
`hook_ENTITY_TYPE_view` inside the class body.

- [ ] Accept it. Expected insertion:

  ```php
  /**
   * Implements hook_ENTITY_TYPE_view().
   */
  #[Hook('ENTITY_TYPE_view')]
  public function entityTypeView(array &$build, \Drupal\Core\Entity\EntityInterface $entity, \Drupal\Core\Entity\Display\EntityViewDisplayInterface $display, $view_mode) {
    |
  }
  ```

  `ENTITY_TYPE` in the attribute is selected.
- [ ] Type `node` over it. The method name updates live to `nodeView`.
- [ ] Try `hook_form_FORM_ID_alter`: attribute `form_${FORM_ID}_alter`,
  method `form<FormId>Alter`; typing `user_login` gives `formUser_loginAlter`
  (VS Code's `capitalize` only touches the first letter; that's expected).
- [ ] Try `hook_cron`: attribute `cron`, method `cron`, no tab stops beyond
  the body.

## 5. Deprecated hooks

Core `main` has no deprecated hooks at the moment, so make one. In any
`*.api.php` under `web/core` (say `web/core/modules/node/node.api.php`), add
to the docblock of `hook_node_grants`:

```
 * @deprecated in drupal:11.0.0 and is removed from drupal:12.0.0. Use
 *   hook_node_access() instead.
```

Save, go back to `dsstest.module`, type `hook_node_gr`.

- [ ] `hook_node_grants` is shown struck through.
- [ ] Its docs panel shows `_This hook is deprecated._` on its own line.
- [ ] Accepting it inserts the docblock with
  ` * @deprecated in drupal:11.0.0 and is removed from drupal:12.0.0. Use hook_node_access() instead.`
  on one line.
- [ ] Same in `DsstestHooks.php` (OOP form).

Revert the change to `node.api.php` afterward (`git checkout` won't help in
`web/core`; just delete the two lines).

## 6. Services

In `dsstest.module`, on a blank line type `service:`.

- [ ] The list opens on the colon and contains `service:current_user`,
  `service:entity_type.manager`, and interface-keyed IDs like
  `service:Drupal\Core\Session\AccountInterface`.
- [ ] Accept `service:current_user`. Expected:

  ```php
  $current_user_service = \Drupal::service('current_user');
  assert($current_user_service instanceof AccountProxy);
  ```

  The variable name is selected in both places.
- [ ] `service:Drupal\Core\Session\AccountInterface` asserts `AccountProxy`
  too (alias followed).
- [ ] `service:logger.channel.default` asserts `LoggerChannel` (class
  inherited from `parent: logger.channel_base`).
- [ ] `logger.channel_base` itself is **not** in the list (abstract), and no
  ID containing a space or `$` is listed (named-autowire aliases).
- [ ] Type `service:` in the middle of an existing line, after other text,
  and accept something: only the text from `service:` onward is replaced.
- [ ] Open `src/Form/TestForm.php`, type `service:current_user` inside the
  class: the snippet gains a first line
  `// @todo: Consider using Dependency Injection instead of \Drupal::service().`

### Deprecated services

Find one that is deprecated in your core version:

```bash
grep -rn -B3 "deprecated:" web/core/core.services.yml web/core/modules/*/*.services.yml | grep -E "^\S+-  [a-z_.]+:$"
```

Pick an ID from the output (on 11.3+, `cache.backend.memory` works).

- [ ] It is struck through in the list.
- [ ] Its docs panel shows `_DEPRECATED: ..._` on its own line above the class.
- [ ] Accepting it inserts a `// @deprecated <message>` line above the
  assignment, with `%service_id%` replaced by the real ID.

## 7. Elements

In `dsstest.module`, type `element:`.

- [ ] Accept `element:checkbox`. Expected:

  ```php
  [
    '#type' => 'checkbox',
    '#title' => t(''),
    '#title_display' => 'before',
    '#description' => t(''),
    '#required' => TRUE,
    '#return_value' => '',
  ],
  ```

  `#title` is a choice between `t('')` and `$this->t('')`; `#title_display`
  cycles `before/after/invisible/attribute`; `#required` is `TRUE/FALSE`;
  the trailing character is a choice of `,` or `;`.
- [ ] `element:details`: no `#title`/`#required` block (render element), has
  `'#open' => ''` and `'#summary_attributes' => ''`.
- [ ] `element:html_tag` inserts with `'#tag' => ''`.

## 8. File watching

- [ ] Add `function hook_dss_manual_test() {}` with a docblock to
  `web/core/modules/node/node.api.php`, save: `hook_dss_manual_test` is
  offered in `dsstest.module` without reloading. Remove it: gone.
- [ ] Create `web/modules/custom/dsstest/dsstest.services.yml`:

  ```yaml
  services:
    dsstest.thing:
      class: Drupal\dsstest\Thing
  ```

  `service:dsstest.thing` appears, asserting `Thing`. Delete the file: gone.
- [ ] Create `web/modules/custom/dsstest/src/Element/DssBox.php` with
  `#[RenderElement('dss_box')]` on a class: `element:dss_box` appears.
- [ ] Edit a PHP file under `vendor/`: nothing is logged.

## 9. Webform (contrib)

With VS Code still open on the project:

```bash
composer require drupal/webform
```

- [ ] Within a few seconds the Output panel logs a new round of
  `Indexing hooks from N files...` / services / elements for the new
  directory, without a reload. (Composer moves the directory into place, so
  this exercises the directory watcher.)

If that didn't happen, run **Drupal Smart Snippets: Reindex** from the
command palette and note it in your report; it should not be necessary.

### Webform, procedural

In `dsstest.module`:

- [ ] `hook_webform_element_alter` is offered; accepting gives
  `dsstest_webform_element_alter(array &$element, \Drupal\Core\Form\FormStateInterface $form_state, array $context)`.
- [ ] `service:webform.request` asserts `WebformRequest`.
- [ ] `service:logger.channel.webform` asserts `LoggerChannel` (contrib
  child of a core abstract parent).
- [ ] `element:webform_signature` inserts a form element (`#title` etc.)
  with `'#type' => 'webform_signature'`. Webform's elements use
  `@FormElement` docblock annotations, not attributes, so this is the only
  real-world check of the annotation path.

### Webform, OOP

In `DsstestHooks.php`:

- [ ] `hook_webform_element_alter` gives `#[Hook('webform_element_alter')]`
  and `public function webformElementAlter(...)`.
- [ ] `hook_webform_handler_info_alter` gives `webformHandlerInfoAlter`.
- [ ] `service:webform.token_manager` includes the DI `@todo` line and
  asserts `WebformTokenManager`.

### Webform removal

```bash
composer remove drupal/webform
```

- [ ] `hook_webform_element_alter`, `service:webform.request`, and
  `element:webform_signature` are no longer offered, without a reload.

## 10. Reindex command

- [ ] Command palette → **Drupal Smart Snippets: Reindex** logs three fresh
  `Indexing ... from N files...` lines and completions keep working.

## Reporting

Note the VS Code version, OS, and the `.vsix` SHA from its file name. For
anything that failed, paste the relevant Output panel lines and, for wrong
snippet output, the exact inserted text.
