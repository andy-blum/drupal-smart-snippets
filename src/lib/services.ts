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
 *  - private services (`public: false`), which the container won't hand out
 *  - named autowiring aliases (`Foo\BarInterface $baz`), which are for
 *    constructor injection, not `\Drupal::service()`
 * All stay in the registry so alias and parent lookups still resolve.
 */
export function isCompletable({ name, value }: Service): boolean {
  return value?.abstract !== true && value?.public !== false && !/\s/.test(name);
}

/**
 * The deprecation message for a service, with Symfony's placeholders filled
 * in. `deprecated:` is either a bare string or a `{ package, version, message }`
 * map, where `message` is optional.
 */
export function deprecationMessage(name: string, value: any): string | null {
  if (!value?.deprecated) {
    return null;
  }

  const message = typeof value.deprecated === 'string'
    ? value.deprecated
    : value.deprecated.message;

  return typeof message === 'string'
    ? message.replaceAll('%alias_id%', name).replaceAll('%service_id%', name)
    : 'This service is deprecated.';
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
export function formatServiceSnippetString(name: string, fullClass: string | null, isOOP: boolean, deprecation: string | null = null) {
  const variableName = name.replace(/\W+/g, '_');
  const lines = [];

  if (deprecation) {
    lines.push(`// @deprecated ${deprecation}`);
  }

  if (isOOP) {
    lines.push(`// @todo: Consider using Dependency Injection instead of \\Drupal::service().`);
  }

  lines.push(`\\$\${1:${variableName}_service} = \\Drupal::service('${name}');`);

  // Fully qualified so no `use` statement is needed; other extensions don't
  // add imports for names that arrive inside a snippet.
  if (fullClass) {
    lines.push(`assert(\\$\${1} instanceof \\${fullClass});`);
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

  const deprecation = deprecationMessage(name, value);
  if (deprecation) {
    description.splice(2, 0, `_DEPRECATED: ${deprecation}_`, ``);
  }

  if (value?.description) {
    description.push('', value.description);
  }

  return description.join('\n');
}
