/**
 * Compatibility suite against a real Drupal core checkout, with the webform
 * module under modules/contrib as a sample of contrib code.
 *
 * Skipped unless test/drupal-core exists (or DRUPAL_CORE_DIR points somewhere).
 * Populate it with `npm run fetch-core`. Assertions are invariants that must
 * hold for any recent core, not exact counts, so the suite tracks core drift
 * without needing updates on every release.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findHooks, formatHook, formatOOPHookSnippetString, formatProceduralHookSnippetString } from './hooks';
import { deprecationMessage, findServices, formatServiceDocumentation, formatServiceSnippetString, isCompletable, resolveClass } from './services';
import { findElements, formatElement } from './elements';

const root = process.env.DRUPAL_CORE_DIR || join(__dirname, '..', '..', 'test', 'drupal-core');
const available = existsSync(join(root, 'core', 'lib', 'Drupal.php'));
const webform = join(root, 'modules', 'contrib', 'webform');
const webformAvailable = existsSync(join(webform, 'webform.info.yml'));

// Called at collection time even when the suite is skipped, so guard the read.
const listFiles = (test: (path: string) => boolean) => available
  ? (readdirSync(root, { recursive: true }) as string[]).filter(test).map(file => join(root, file))
  : [];

// Any `$` in a snippet must be escaped (`\$`), start a tabstop, or sit inside
// a choice (`${1|a,$b|}`), where VS Code reads it literally.
const hasStrayDollar = (snippet: string) =>
  /(?<!\\)\$(?![{\d])/.test(snippet.replace(/\$\{\d+\|[^}]*\|\}/g, ''));

describe.skipIf(!available)('Drupal core compatibility', () => {
  describe('hooks', () => {
    const files = listFiles(path => path.endsWith('.api.php'));
    const hooks = files.flatMap(file => findHooks(readFileSync(file, 'utf8'), file));
    const names = new Set(hooks.map(hook => hook.name));

    it('parses every *.api.php', () => {
      expect(files.length).toBeGreaterThan(30);
      expect(hooks.length).toBeGreaterThan(250);
    });

    it('finds well-known hooks', () => {
      for (const name of ['hook_form_alter', 'hook_ENTITY_TYPE_view', 'hook_theme', 'hook_cron', 'hook_entity_presave']) {
        expect(names.has(name), name).toBe(true);
      }
    });

    it('captures a definition for every hook', () => {
      for (const hook of hooks) {
        expect(hook.name).toMatch(/^hook_\w+$/);
        expect(hook.definition, hook.name).toMatch(/^function hook_\w+\(/);
      }
    });

    it('produces valid snippets and documentation for every hook', () => {
      for (const hook of hooks) {
        const procedural = formatProceduralHookSnippetString(hook.name, hook.definition, hook.deprecation);
        const oop = formatOOPHookSnippetString(hook.name, hook.definition, hook.deprecation);

        expect(procedural, hook.name).toContain('${1:${TM_FILENAME_BASE:hook}}');
        expect(hasStrayDollar(procedural), `${hook.name} procedural: ${procedural}`).toBe(false);
        expect(hasStrayDollar(oop), `${hook.name} oop: ${oop}`).toBe(false);
        expect(oop, hook.name).toMatch(/#\[Hook\('.+'\)\]\npublic function [\w$]/);

        const { description } = formatHook(hook);
        expect(description, hook.name).toMatch(/^\*\*Drupal Smart Snippets\*\*/);
        expect(description, hook.name).not.toContain('/**');
      }
    });
  });

  describe('services', () => {
    const files = listFiles(path => path.endsWith('.services.yml'));
    const services = files.flatMap(file => findServices(readFileSync(file, 'utf8')));
    const byName = new Map(services.map(service => [service.name, service.value]));
    const classFor = (name: string) => resolveClass(name, byName.get(name), byName);

    it('parses every *.services.yml', () => {
      expect(files.length).toBeGreaterThan(100);
      expect(services.length).toBeGreaterThan(1000);
    });

    it('resolves well-known services to their classes', () => {
      expect(classFor('current_user')).toBe('Drupal\\Core\\Session\\AccountProxy');
      expect(classFor('entity_type.manager')).toBe('Drupal\\Core\\Entity\\EntityTypeManager');
      expect(classFor('Drupal\\Core\\Session\\AccountInterface')).toBe('Drupal\\Core\\Session\\AccountProxy');
      expect(classFor('logger.channel.default')).toBe('Drupal\\Core\\Logger\\LoggerChannel');
    });

    it('resolves a class for nearly every completable service', () => {
      const completable = services.filter(isCompletable);
      const unresolved = completable.filter(service => classFor(service.name) === null).map(service => service.name);
      expect(unresolved.length / completable.length, `unresolved: ${unresolved.join(', ')}`).toBeLessThan(0.01);
    });

    it('produces snippets and documentation for every service', () => {
      for (const service of services.filter(isCompletable)) {
        const fullClass = classFor(service.name);
        const snippet = formatServiceSnippetString(service.name, fullClass, false, deprecationMessage(service.name, service.value));
        expect(snippet, service.name).toContain(`\\Drupal::service('${service.name}')`);
        expect(hasStrayDollar(snippet), `${service.name}: ${snippet}`).toBe(false);
        expect(() => formatServiceDocumentation(service.name, service.value, fullClass), service.name).not.toThrow();
      }
    });
  });

  describe('elements', () => {
    const files = listFiles(path => /[\\/]Element[\\/][^\\/]+\.php$/.test(path));
    const elements = files.flatMap(file => findElements(readFileSync(file, 'utf8'), file));
    const byName = new Map(elements.map(element => [element.name, element]));

    it('parses every Element/*.php', () => {
      expect(files.length).toBeGreaterThan(50);
      expect(elements.length).toBeGreaterThan(50);
    });

    it('finds well-known elements with the right type', () => {
      expect(byName.get('checkbox')?.type).toBe('FormElement');
      expect(byName.get('textfield')?.type).toBe('FormElement');
      expect(byName.get('details')?.type).toBe('RenderElement');
      expect(byName.get('html_tag')?.type).toBe('RenderElement');
    });

    it('gives every element a unique name and a docblock', () => {
      expect(new Set(elements.map(element => element.name)).size).toBe(elements.length);
      for (const element of elements) {
        expect(element.docs?.value, element.name).toBeTruthy();
      }
    });

    it('produces valid snippets for every element', () => {
      for (const element of elements) {
        const { snippet, description } = formatElement(element);
        expect(snippet, element.name).toMatch(/^\[\n  '#type' => '.+',\n[\s\S]*\]\$\{5\|\\,,;\|\}$/);
        expect(hasStrayDollar(snippet), `${element.name}: ${snippet}`).toBe(false);
        expect(description, element.name).toContain(`@${element.type}("${element.name}")`);
      }
    });

    it('extracts documented properties', () => {
      expect(formatElement(byName.get('checkbox')!).snippet).toContain("'#return_value' => ''");
      expect(formatElement(byName.get('details')!).snippet).toContain("'#open' => ''");
    });
  });

  // Contrib modules are indexed the same way as core; webform is a good sample
  // because it ships its own hooks, services, and a large set of elements that
  // still use docblock annotations rather than attributes.
  describe.skipIf(!webformAvailable)('webform (contrib)', () => {
    const under = (path: string) => join(root, path).startsWith(webform);

    it('finds hooks from webform.api.php', () => {
      const files = listFiles(path => path.endsWith('.api.php') && under(path));
      const names = new Set(files.flatMap(file => findHooks(readFileSync(file, 'utf8'), file)).map(hook => hook.name));
      expect(files.length).toBeGreaterThanOrEqual(1);
      expect(names.size).toBeGreaterThan(20);
      expect(names.has('hook_webform_element_alter')).toBe(true);
      expect(names.has('hook_webform_element_info_alter')).toBe(true);
    });

    it('resolves webform services, including aliases into core', () => {
      const files = listFiles(path => path.endsWith('.services.yml'));
      const services = files.flatMap(file => findServices(readFileSync(file, 'utf8')));
      const byName = new Map(services.map(service => [service.name, service.value]));
      const classFor = (name: string) => resolveClass(name, byName.get(name), byName);

      expect(classFor('webform.request')).toBe('Drupal\\webform\\WebformRequest');
      expect(classFor('webform.token_manager')).toBe('Drupal\\webform\\WebformTokenManager');
      expect(classFor('logger.channel.webform')).toBe('Drupal\\Core\\Logger\\LoggerChannel');
    });

    it('finds annotation-based elements', () => {
      const files = listFiles(path => /[\\/]Element[\\/][^\\/]+\.php$/.test(path) && under(path));
      const elements = files.flatMap(file => findElements(readFileSync(file, 'utf8'), file));
      const byName = new Map(elements.map(element => [element.name, element]));

      expect(elements.length).toBeGreaterThan(60);
      expect(byName.get('webform_signature')?.type).toBe('FormElement');
      expect(byName.get('webform_message')?.type).toBe('FormElement');
      for (const element of elements) {
        const { snippet } = formatElement(element);
        expect(snippet, element.name).toMatch(/^\[\n  '#type' => '.+',\n[\s\S]*\]\$\{5\|\\,,;\|\}$/);
        expect(hasStrayDollar(snippet), `${element.name}: ${snippet}`).toBe(false);
      }
    });
  });
});
