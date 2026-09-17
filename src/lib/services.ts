import { parse } from 'yaml';

export interface Service {
  name: string;
  value: any;
}

/**
 * Resolves the concrete class a service ID refers to. Handles:
 *  - explicit `class:` keys
 *  - class-keyed (autowired) services, where the ID is the FQCN
 *  - aliases, either `foo: '@bar'` or `foo: { alias: bar }`
 *  - `parent:` definitions that inherit the parent's class
 */
export function resolveClass(name: string, value: any, byName: Map<string, any>, depth = 0): string | null {
  const aliasTarget = typeof value === 'string' && value.startsWith('@')
    ? value.slice(1)
    : value?.alias;

  if (aliasTarget && depth < 5 && byName.has(aliasTarget)) {
    return resolveClass(aliasTarget, byName.get(aliasTarget), byName, depth + 1);
  }

  const cls = value?.class || (name.includes('\\') ? name : null);
  if (cls) {
    return cls.replace(/^\\/, '');
  }

  if (value?.parent && depth < 5 && byName.has(value.parent)) {
    return resolveClass(value.parent, byName.get(value.parent), byName, depth + 1);
  }

  return null;
}

/**
 * Whether a service should be offered as a completion. Excluded:
 *  - abstract services, which only exist as `parent:` targets
 *  - named autowiring aliases (`Foo\BarInterface $baz`), which are for
 *    constructor injection, not `\Drupal::service()`
 * Both stay in the registry so alias and parent lookups still resolve.
 */
export function isCompletable({ name, value }: Service): boolean {
  return value?.abstract !== true && !/\s/.test(name);
}

export function findServices(text: string): Service[] {
  // Core uses Symfony tags like `!tagged_iterator`; the values are irrelevant here.
  const parsed = parse(text, { logLevel: 'silent' });
  const { services } = parsed || {};

  if (!services) {
    return [];
  }

  return Object.entries(services)
    .filter(([name]) => !name.startsWith('_'))
    .map(([name, value]) => ({ name, value }));
}

/**
 * Creates a service snippet
 */
export function formatServiceSnippetString(name: string, className: string | undefined, isOOP: boolean) {
  const variableName = name.replace(/\W+/g, '_');
  const lines = [];

  if (isOOP) {
    lines.push(`// @todo: Consider using Dependency Injection instead of \\Drupal::service().`);
  }

  lines.push(`\\$\${1:${variableName}_service} = \\Drupal::service('${name}');`);

  if (className) {
    lines.push(`assert(\\$\${1} instanceof ${className});`);
  }

  lines.push(``);

  return lines.join('\n');
}

export function formatServiceDocumentation(name: string, value: any, fullClass: string | null) {
  const description = [
    '**Drupal Smart Snippets**', '',
    `\`${fullClass || 'Unknown'}\``, '',
    `Service ID: \`${name}\``
  ];

  if (value?.deprecated) {
    // Either a bare string or a Symfony-style `{ package, version, message }` map.
    const message = typeof value.deprecated === 'string'
      ? value.deprecated
      : value.deprecated.message;
    const deprecationWarning = typeof message === 'string'
      ? message.replaceAll('%alias_id%', name).replaceAll('%service_id%', name)
      : 'This service is deprecated.';

    description.splice(2, 0, `_DEPRECATED: ${deprecationWarning}_`, ``);
  }

  if (value?.description) {
    description.push('', value.description);
  }

  return description.join('\n');
}
