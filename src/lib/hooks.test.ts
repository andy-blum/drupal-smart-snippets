import { describe, expect, it } from 'vitest';
import { fixture } from './test-helpers';
import { deprecationMessage, findHooks, formatHook, formatOOPHookSnippetString, formatProceduralHookSnippetString } from './hooks';

const hooks = findHooks(fixture('fixture.api.php'), 'fixture.api.php');
const byName = Object.fromEntries(hooks.map(hook => [hook.name, hook]));

describe('findHooks', () => {
  it('finds every hook_* function and nothing else', () => {
    expect(hooks.map(h => h.name)).toEqual([
      'hook_node_grants',
      'hook_node_links_alter',
      'hook_ENTITY_TYPE_access',
      'hook_entity_bundle_info_alter',
      'hook_form_alter',
      'hook_form_FORM_ID_alter',
      'hook_legacy_thing',
    ]);
  });

  it('captures the full signature as the definition', () => {
    expect(byName.hook_form_alter.definition).toBe(
      'function hook_form_alter(&$form, \\Drupal\\Core\\Form\\FormStateInterface $form_state, $form_id): void'
    );
  });

  it('flags @deprecated hooks and captures the message on one line', () => {
    expect(byName.hook_legacy_thing.isDeprecated).toBe(true);
    expect(byName.hook_legacy_thing.deprecation).toBe(
      'in drupal:10.1.0 and is removed from drupal:11.0.0. Use hook_something_else() instead.'
    );
    expect(byName.hook_form_alter.isDeprecated).toBe(false);
    expect(byName.hook_form_alter.deprecation).toBeNull();
  });

  it('attaches the docblock', () => {
    expect(byName.hook_node_grants.docs?.value).toContain('Inform the node access system what permissions the user has.');
  });

  it('returns nothing for a file with no hooks', () => {
    expect(findHooks('<?php\nfunction foo() {}\n')).toEqual([]);
  });
});

describe('formatProceduralHookSnippetString', () => {
  it('replaces the hook prefix with the file basename and escapes variables', () => {
    const snippet = formatProceduralHookSnippetString(
      byName.hook_form_alter.name,
      byName.hook_form_alter.definition
    );
    expect(snippet).toBe([
      '/**',
      ' * Implements hook_form_alter().',
      ' */',
      'function ${1:${TM_FILENAME_BASE:hook}}_form_alter(&\\$form, \\Drupal\\Core\\Form\\FormStateInterface \\$form_state, \\$form_id): void {',
      '  $0',
      '}',
    ].join('\n'));
  });

  it('turns UPPER_CASE segments into tabstops', () => {
    const snippet = formatProceduralHookSnippetString(
      byName.hook_ENTITY_TYPE_access.name,
      byName.hook_ENTITY_TYPE_access.definition
    );
    expect(snippet).toContain('function ${1:${TM_FILENAME_BASE:hook}}_${2:ENTITY_TYPE}_access(');
  });

  it('handles multiple placeholders in one hook', () => {
    const snippet = formatProceduralHookSnippetString(
      byName.hook_form_FORM_ID_alter.name,
      byName.hook_form_FORM_ID_alter.definition
    );
    expect(snippet).toContain('_form_${2:FORM_ID}_alter(');
  });

  it('writes the deprecation into the docblock', () => {
    const { name, definition, deprecation } = byName.hook_legacy_thing;
    expect(formatProceduralHookSnippetString(name, definition, deprecation).split('\n').slice(0, 5)).toEqual([
      '/**',
      ' * Implements hook_legacy_thing().',
      ' *',
      ' * @deprecated in drupal:10.1.0 and is removed from drupal:11.0.0. Use hook_something_else() instead.',
      ' */',
    ]);
    expect(formatOOPHookSnippetString(name, definition, deprecation)).toContain(' * @deprecated in drupal:10.1.0');
  });
});

describe('deprecationMessage', () => {
  it('stops at the next tag', () => {
    expect(deprecationMessage({ kind: 'commentblock', value: '/**\n * Foo.\n *\n * @deprecated Gone.\n * @see x\n */' } as any)).toBe('Gone.');
  });

  it('handles a bare tag', () => {
    expect(deprecationMessage({ kind: 'commentblock', value: '/**\n * @deprecated\n */' } as any)).toBe('');
  });
});

describe('formatOOPHookSnippetString', () => {
  it('produces a #[Hook] attribute and camelCase method', () => {
    const snippet = formatOOPHookSnippetString(
      byName.hook_form_alter.name,
      byName.hook_form_alter.definition
    );
    expect(snippet).toBe([
      '/**',
      ' * Implements hook_form_alter().',
      ' */',
      "#[Hook('form_alter')]",
      'public function formAlter(&\\$form, \\Drupal\\Core\\Form\\FormStateInterface \\$form_state, \\$form_id) {',
      '  $0',
      '}',
    ].join('\n'));
  });

  it('mirrors placeholders into the method name with case transforms', () => {
    const snippet = formatOOPHookSnippetString(
      byName.hook_ENTITY_TYPE_access.name,
      byName.hook_ENTITY_TYPE_access.definition
    );
    expect(snippet).toContain("#[Hook('${1:ENTITY_TYPE}_access')]");
    expect(snippet).toContain('public function ${1/(.*)/${1:/camelcase}/}Access(');
  });

  it('capitalizes placeholders that are not first', () => {
    const snippet = formatOOPHookSnippetString(
      byName.hook_form_FORM_ID_alter.name,
      byName.hook_form_FORM_ID_alter.definition
    );
    expect(snippet).toContain("#[Hook('form_${1:FORM_ID}_alter')]");
    expect(snippet).toContain('public function form${1/(.*)/${1:/capitalize}/}Alter(');
  });
});

describe('formatHook', () => {
  it('renders documentation with the signature and a deprecation notice', () => {
    const { description } = formatHook(byName.hook_legacy_thing);
    expect(description.startsWith([
      '**Drupal Smart Snippets**', '',
      '_This hook is deprecated._', '',
      '`hook_legacy_thing(array &$stuff)`', '',
      'Old hook kept for the deprecation test.',
    ].join('\n'))).toBe(true);
    expect(description).toContain('Old hook kept for the deprecation test.');
    expect(description).not.toContain('/**');
  });
});
