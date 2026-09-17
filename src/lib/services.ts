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
 */
export function resolveClass(name: string, value: any, byName: Map<string, any>, depth = 0): string | null {
  const aliasTarget = typeof value === 'string' && value.startsWith('@')
    ? value.slice(1)
    : value?.alias;

  if (aliasTarget && depth < 5 && byName.has(aliasTarget)) {
    return resolveClass(aliasTarget, byName.get(aliasTarget), byName, depth + 1);
  }

  const cls = value?.class || (name.includes('\\') ? name : null);
  return cls ? cls.replace(/^\\/, '') : null;
}

export function findServices(text: string): Service[] {
  const parsed = parse(text);
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
  const variableName = name.replaceAll('.', '_').replaceAll('\\', '_');
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
