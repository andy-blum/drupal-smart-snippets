import { describe, expect, it } from 'vitest';
import { fixture } from './test-helpers';
import { findElements, formatElement } from './elements';

describe('findElements', () => {
  it('reads #[FormElement] attributes', () => {
    const [element] = findElements(fixture('Checkbox.php'), 'Checkbox.php');
    expect(element.name).toBe('checkbox');
    expect(element.type).toBe('FormElement');
    expect(element.docs?.value).toContain('Provides a form element for a single checkbox.');
  });

  it('reads #[RenderElement] attributes', () => {
    const [element] = findElements(fixture('Details.php'), 'Details.php');
    expect(element).toMatchObject({ name: 'details', type: 'RenderElement' });
  });

  it('falls back to legacy @FormElement annotations', () => {
    const [element] = findElements(fixture('LegacyAnnotated.php'), 'LegacyAnnotated.php');
    expect(element).toMatchObject({ name: 'legacy_thing', type: 'FormElement' });
  });

  it('ignores classes that are not elements', () => {
    expect(findElements('<?php\nnamespace Foo;\nclass Bar {}\n')).toEqual([]);
  });
});

describe('formatElement', () => {
  it('builds a form element snippet with title/description/required and documented properties', () => {
    const [element] = findElements(fixture('Checkbox.php'), 'Checkbox.php');
    const { snippet } = formatElement(element);
    expect(snippet).toBe([
      '[',
      "  '#type' => 'checkbox',",
      "  '#title' => ${1|t(''),$this->t('')|},",
      "  '#title_display' => '${2|before,after,invisible,attribute|}',",
      "  '#description' => ${3|t(''),$this->t('')|},",
      "  '#required' => ${4|TRUE,FALSE|},",
      "  '#return_value' => '',",
      ']${5|\\,,;|}',
    ].join('\n'));
  });

  it('builds a render element snippet without form-only properties', () => {
    const [element] = findElements(fixture('Details.php'), 'Details.php');
    const { snippet } = formatElement(element);
    expect(snippet).toBe([
      '[',
      "  '#type' => 'details',",
      "  '#open' => '',",
      "  '#summary_attributes' => '',",
      ']${5|\\,,;|}',
    ].join('\n'));
  });

  it('renders documentation with the annotation header and stripped comment markers', () => {
    const [element] = findElements(fixture('LegacyAnnotated.php'), 'LegacyAnnotated.php');
    const { description } = formatElement(element);
    expect(description.startsWith('**Drupal Smart Snippets**\n\n@FormElement("legacy_thing")\n\n')).toBe(true);
    expect(description).toContain('Provides a legacy annotated form element.');
    expect(description).not.toContain(' * ');
  });
});
