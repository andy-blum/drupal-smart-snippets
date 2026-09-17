import { describe, expect, it } from 'vitest';
import { fixture } from './test-helpers';
import { deprecationMessage, findServices, formatServiceDocumentation, formatServiceSnippetString, isCompletable, resolveClass } from './services';

const services = findServices(fixture('fixture.services.yml'));
const byName = new Map(services.map(s => [s.name, s.value]));
const classFor = (name: string) => resolveClass(name, byName.get(name), byName);

describe('findServices', () => {
  it('lists services and skips _defaults', () => {
    const names = services.map(s => s.name);
    expect(names).toContain('current_user');
    expect(names).not.toContain('_defaults');
  });

  it('keeps abstract parents and named autowire aliases in the registry but not in completions', () => {
    expect(byName.has('logger.channel_base')).toBe(true);
    expect(byName.has('Drupal\\fixture\\Named $named')).toBe(true);
    const completable = services.filter(isCompletable).map(s => s.name);
    expect(completable).not.toContain('logger.channel_base');
    expect(completable).not.toContain('Drupal\\fixture\\Named $named');
  });

  it('does not offer private services', () => {
    expect(byName.has('private.thing')).toBe(true);
    expect(services.filter(isCompletable).map(s => s.name)).not.toContain('private.thing');
  });

  it('tolerates Symfony YAML tags', () => {
    expect(byName.get('tagged').class).toBe('Drupal\\fixture\\Tagged');
  });

  it('returns nothing when there is no services key', () => {
    expect(findServices(fixture('empty.services.yml'))).toEqual([]);
    expect(findServices('')).toEqual([]);
  });
});

describe('resolveClass', () => {
  it('uses an explicit class', () => {
    expect(classFor('current_user')).toBe('Drupal\\Core\\Session\\AccountProxy');
  });

  it('strips a leading backslash', () => {
    expect(classFor('leading.slash')).toBe('Drupal\\fixture\\LeadingSlash');
  });

  it('treats a class-keyed service as its own class', () => {
    expect(classFor('Drupal\\fixture\\Autowired')).toBe('Drupal\\fixture\\Autowired');
  });

  it('follows string aliases', () => {
    expect(classFor('Drupal\\Core\\Session\\AccountInterface')).toBe('Drupal\\Core\\Session\\AccountProxy');
  });

  it('follows map aliases', () => {
    expect(classFor('legacy.alias')).toBe('Drupal\\Core\\Session\\AccountProxy');
  });

  it('inherits the class from an abstract parent', () => {
    expect(classFor('logger.channel.fixture')).toBe('Drupal\\Core\\Logger\\LoggerChannel');
  });

  it('returns null when nothing identifies the class', () => {
    expect(classFor('no.class')).toBeNull();
  });

  it('gives up on alias cycles', () => {
    expect(classFor('alias.loop.a')).toBeNull();
  });
});

describe('formatServiceSnippetString', () => {
  it('assigns and asserts the class', () => {
    expect(formatServiceSnippetString('current_user', 'AccountProxy', false)).toBe([
      "\\$${1:current_user_service} = \\Drupal::service('current_user');",
      'assert(\\$${1} instanceof AccountProxy);',
      '',
    ].join('\n'));
  });

  it('adds the DI reminder in OOP files', () => {
    expect(formatServiceSnippetString('current_user', 'AccountProxy', true)).toMatch(/^\/\/ @todo: Consider using Dependency Injection/);
  });

  it('omits the assert when the class is unknown', () => {
    expect(formatServiceSnippetString('no.class', undefined, false)).not.toContain('assert(');
  });

  it('adds a @deprecated comment when given a deprecation', () => {
    const snippet = formatServiceSnippetString('locale.project', 'LocaleProjectStorage', true, 'The "locale.project" service is deprecated.');
    expect(snippet.split('\n').slice(0, 2)).toEqual([
      '// @deprecated The "locale.project" service is deprecated.',
      '// @todo: Consider using Dependency Injection instead of \\Drupal::service().',
    ]);
  });

  it('makes a valid variable name from a class-keyed ID', () => {
    expect(formatServiceSnippetString('Drupal\\fixture\\Autowired', 'Autowired', false))
      .toContain('${1:Drupal_fixture_Autowired_service}');
  });
});

describe('deprecationMessage', () => {
  it('returns null when not deprecated', () => {
    expect(deprecationMessage('current_user', byName.get('current_user'))).toBeNull();
  });

  it('fills in %service_id% for string deprecations', () => {
    expect(deprecationMessage('locale.project', byName.get('locale.project'))).toMatch(/^The "locale.project" service is deprecated/);
  });

  it('handles Symfony-style maps with and without a message', () => {
    expect(deprecationMessage('symfony.deprecated', byName.get('symfony.deprecated'))).toBe('This service is deprecated.');
    expect(deprecationMessage('symfony.deprecated.message', byName.get('symfony.deprecated.message'))).toBe('The symfony.deprecated.message service goes away in 3.0.');
  });
});

describe('formatServiceDocumentation', () => {
  it('shows the class and service ID', () => {
    const doc = formatServiceDocumentation('current_user', byName.get('current_user'), classFor('current_user'));
    expect(doc).toBe([
      '**Drupal Smart Snippets**', '',
      '`Drupal\\Core\\Session\\AccountProxy`', '',
      'Service ID: `current_user`',
    ].join('\n'));
  });

  it('substitutes %service_id% in a string deprecation', () => {
    const doc = formatServiceDocumentation('locale.project', byName.get('locale.project'), classFor('locale.project'));
    expect(doc.split('\n').slice(0, 5)).toEqual([
      '**Drupal Smart Snippets**', '',
      expect.stringMatching(/^_DEPRECATED: The "locale.project" service is deprecated in drupal:11\.4\.0/), '',
      '`Drupal\\locale\\LocaleProjectStorage`',
    ]);
  });

  it('handles a Symfony-style deprecation map without a message', () => {
    const doc = formatServiceDocumentation('symfony.deprecated', byName.get('symfony.deprecated'), classFor('symfony.deprecated'));
    expect(doc).toContain('_DEPRECATED: This service is deprecated._');
  });

  it('uses the message from a Symfony-style deprecation map', () => {
    const doc = formatServiceDocumentation('symfony.deprecated.message', byName.get('symfony.deprecated.message'), classFor('symfony.deprecated.message'));
    expect(doc).toContain('_DEPRECATED: The symfony.deprecated.message service goes away in 3.0._');
  });

  it('falls back to Unknown and appends a description', () => {
    const doc = formatServiceDocumentation('described', byName.get('described'), classFor('described'));
    expect(doc).toContain('A service with a description.');
    expect(formatServiceDocumentation('no.class', byName.get('no.class'), null)).toContain('`Unknown`');
  });
});
