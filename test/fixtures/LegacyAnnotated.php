<?php

namespace Drupal\legacy_module\Element;

use Drupal\Core\Render\Element\FormElementBase;

/**
 * Provides a legacy annotated form element.
 *
 * Properties:
 * - #size: The width of the field.
 * - #maxlength: The maximum characters allowed.
 *
 * Usage example:
 * @code
 * $form['thing'] = [
 *   '#type' => 'legacy_thing',
 * ];
 * @endcode
 *
 * @FormElement("legacy_thing")
 */
class LegacyAnnotated extends FormElementBase {

  /**
   * {@inheritdoc}
   */
  public function getInfo() {
    return [];
  }

}
