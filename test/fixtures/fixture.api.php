<?php

/**
 * @file
 * Hooks specific to the Node module.
 */

use Drupal\Core\Session\AccountInterface;
use Drupal\node\NodeInterface;

/**
 * @addtogroup hooks

/**
 * Inform the node access system what permissions the user has.
 *
 * This hook is for implementation by node access modules. In this hook,
 * the module grants a user different "grant IDs" within one or more
 * "realms". In hook_node_access_records(), the realms and grant IDs are
 * associated with permission to view, edit, and delete individual nodes.
 *
 * Grant IDs can be arbitrarily defined by a node access module using a list of
 * integer IDs associated with users.
 *
 * A node access module may implement as many realms as necessary to properly
 * define the access privileges for the nodes. Note that the system makes no
 * distinction between published and unpublished nodes. It is the module's
 * responsibility to provide appropriate realms to limit access to unpublished
 * content.
 *
 * Node access records are stored in the {node_access} table and define which
 * grants are required to access a node. There is a special case for the view
 * operation -- a record with node ID 0 corresponds to a "view all" grant for
 * the realm and grant ID of that record. If there are no node access modules
 * enabled, the core node module adds a node ID 0 record for realm 'all'. Node
 * access modules can also grant "view all" permission on their custom realms;
 * for example, a module could create a record in {node_access} with:
 * @code
 * $record = [
 *   'nid' => 0,
 *   'gid' => 888,
 *   'realm' => 'example_realm',
 *   'grant_view' => 1,
 *   'grant_update' => 0,
 *   'grant_delete' => 0,
 * ];
 * \Drupal::database()->insert('node_access')->fields($record)->execute();
 * @endcode
 * And then in its hook_node_grants() implementation, it would need to return:
 * @code
 * if ($op == 'view') {
 *   $grants['example_realm'] = [888];
 * }
 * @endcode
 * If you decide to do this, be aware that
 * \Drupal\node\NodeAccessRebuild::rebuild() will erase any node ID 0 entry when
 * it is called, so you will need to make sure to restore your {node_access}
 * record after \Drupal\node\NodeAccessRebuild::rebuild() is called.
 *
 * @param \Drupal\Core\Session\AccountInterface $account
 *   The account object whose grants are requested.
 * @param string $operation
 *   The node operation to be performed, such as 'view', 'update', or 'delete'.
 *
 * @return array
 *   An array whose keys are "realms" of grants, and whose values are arrays of
 *   the grant IDs within this realm that this user is being granted.
 *
 * @see \Drupal\node\NodeGrantDatabaseStorage::checkAllGrants()
 * @see \Drupal\node\NodeAccessRebuild::rebuild()
 * @ingroup node_access
 */
function hook_node_grants(AccountInterface $account, $operation): array {
  $grants = [];
  if ($account->hasPermission('access private content')) {
    $grants['example'] = [1];
  }
  if ($account->id()) {
    $grants['example_author'] = [$account->id()];
  }
  return $grants;
}

/**
 * Alter the links of a node.
 *
 * @param array &$links
 *   A renderable array representing the node links.
 * @param \Drupal\node\NodeInterface $entity
 *   The node being rendered.
 * @param array &$context
 *   Various aspects of the context in which the node links are going to be
 *   displayed, with the following keys:
 *   - 'view_mode': the view mode in which the node is being viewed.
 *   - 'langcode': the language in which the node is being viewed.
 *
 * @see \Drupal\node\NodeViewBuilder::renderLinks()
 * @see \Drupal\node\NodeViewBuilder::buildLinks()
 * @see entity_crud
 */
function hook_node_links_alter(array &$links, NodeInterface $entity, array &$context) {
  $links['my_module'] = [
    '#theme' => 'links__node__my_module',
    '#attributes' => ['class' => ['links', 'inline']],
    '#links' => [
      'node-report' => [
        'title' => t('Report'),
        'url' => Url::fromRoute('node_test.report', ['node' => $entity->id()], ['query' => ['token' => \Drupal::getContainer()->get('csrf_token')->get("node/{$entity->id()}/report")]]),
      ],
    ],
  ];
}

/**
 * Control entity operation access for a specific entity type.
 *
 * Note that this hook is not called for listings (e.g., from entity queries
 * and Views). For nodes, see @link node_access Node access rights @endlink for
 * a full explanation. For other entity types, see hook_query_TAG_alter().
 *
 * @param \Drupal\Core\Entity\EntityInterface $entity
 *   The entity to check access to.
 * @param string $operation
 *   The operation that is to be performed on $entity. Usually one of:
 *   - "view"
 *   - "update"
 *   - "delete".
 * @param \Drupal\Core\Session\AccountInterface $account
 *   The account trying to access the entity.
 *
 * @return \Drupal\Core\Access\AccessResultInterface
 *   The access result. hook_entity_access() has detailed documentation.
 *
 * @see \Drupal\Core\Entity\EntityAccessControlHandler
 * @see hook_ENTITY_TYPE_create_access()
 * @see hook_entity_access()
 * @see hook_query_TAG_alter()
 *
 * @ingroup entity_api
 */
function hook_ENTITY_TYPE_access(\Drupal\Core\Entity\EntityInterface $entity, $operation, \Drupal\Core\Session\AccountInterface $account): \Drupal\Core\Access\AccessResultInterface {
  // No opinion.
  return AccessResult::neutral();
}

/**
 * Alter the bundles for entity types.
 *
 * @param array $bundles
 *   An array of bundles, keyed first by entity type, then by bundle name.
 *
 * @see Drupal\Core\Entity\EntityTypeBundleInfo::getBundleInfo()
 * @see hook_entity_bundle_info()
 */
function hook_entity_bundle_info_alter(&$bundles) {
  $bundles['user']['user']['label'] = t('Full account');
  // Override the bundle class for the "article" node type in a custom module.
  $bundles['node']['article']['class'] = 'Drupal\my_module\Entity\Article';
}

/**
 * Perform alterations before a form is rendered.
 *
 * One popular use of this hook is to add form elements to the node form. When
 * altering a node form, the node entity can be retrieved by invoking
 * $form_state->getFormObject()->getEntity().
 *
 * Implementations are responsible for adding cache contexts/tags/max-age as
 * needed. See https://www.drupal.org/docs/8/api/cache-api/cache-api.
 *
 * In addition to hook_form_alter(), which is called for all forms, there are
 * two more specific form hooks available. The first,
 * hook_form_BASE_FORM_ID_alter(), allows targeting of a form/forms via a base
 * form (if one exists). The second, hook_form_FORM_ID_alter(), can be used to
 * target a specific form directly.
 *
 * The call order is as follows: all existing form alter functions are called
 * for module A, then all for module B, etc., followed by all for any base
 * theme(s), and finally for the theme itself. The module order is determined
 * by system weight, then by module name.
 *
 * Within each module, form alter hooks are called in the following order:
 * first, hook_form_alter(); second, hook_form_BASE_FORM_ID_alter(); third,
 * hook_form_FORM_ID_alter(). So, for each module, the more general hooks are
 * called first followed by the more specific.
 *
 * @param array $form
 *   Nested array of form elements that comprise the form.
 * @param \Drupal\Core\Form\FormStateInterface $form_state
 *   The current state of the form. The arguments that
 *   \Drupal::formBuilder()->getForm() was originally called with are available
 *   in the array $form_state->getBuildInfo()['args'].
 * @param string $form_id
 *   A string that is the unique ID of the form, set by
 *   Drupal\Core\Form\FormInterface::getFormId().
 *
 * @see hook_form_BASE_FORM_ID_alter()
 * @see hook_form_FORM_ID_alter()
 *
 * @ingroup form_api
 */
function hook_form_alter(&$form, \Drupal\Core\Form\FormStateInterface $form_state, $form_id): void {
  if (isset($form['type']) && $form['type']['#value'] . '_node_settings' == $form_id) {
    $upload_enabled_types = \Drupal::config('my_module.settings')->get('upload_enabled_types');
    $form['workflow']['upload_' . $form['type']['#value']] = [
      '#type' => 'radios',
      '#title' => t('Attachments'),
      '#default_value' => in_array($form['type']['#value'], $upload_enabled_types) ? 1 : 0,
      '#options' => [t('Disabled'), t('Enabled')],
    ];
    // Add a custom submit handler to save the array of types back to the config
    // file.
    $form['actions']['submit']['#submit'][] = 'my_module_upload_enabled_types_submit';
  }
}

/**
 * Provide a form-specific alteration instead of the global hook_form_alter().
 *
 * Implementations are responsible for adding cache contexts/tags/max-age as
 * needed. See https://www.drupal.org/docs/8/api/cache-api/cache-api.
 *
 * Modules can implement hook_form_FORM_ID_alter() to modify a specific form,
 * rather than implementing hook_form_alter() and checking the form ID, or
 * using long switch statements to alter multiple forms.
 *
 * The call order is as follows: all existing form alter functions are called
 * for module A, then all for module B, etc., followed by all for any base
 * theme(s), and finally for the theme itself. The module order is determined
 * by system weight, then by module name.
 *
 * Within each module, form alter hooks are called in the following order:
 * first, hook_form_alter(); second, hook_form_BASE_FORM_ID_alter(); third,
 * hook_form_FORM_ID_alter(). So, for each module, the more general hooks are
 * called first followed by the more specific.
 *
 * @param array $form
 *   Nested array of form elements that comprise the form.
 * @param \Drupal\Core\Form\FormStateInterface $form_state
 *   The current state of the form. The arguments that
 *   \Drupal::formBuilder()->getForm() was originally called with are available
 *   in the array $form_state->getBuildInfo()['args'].
 * @param string $form_id
 *   String representing the name of the form itself. Typically this is the
 *   name of the function that generated the form.
 *
 * @see hook_form_alter()
 * @see hook_form_BASE_FORM_ID_alter()
 * @see \Drupal\Core\Form\FormBuilderInterface::prepareForm()
 *
 * @ingroup form_api
 */
function hook_form_FORM_ID_alter(&$form, \Drupal\Core\Form\FormStateInterface $form_state, $form_id): void {
  // Modification for the form with the given form ID goes here. For example, if
  // FORM_ID is "user_register_form" this code would run only on the user
  // registration form.

  // Add a checkbox to registration form about agreeing to terms of use.
  $form['terms_of_use'] = [
    '#type' => 'checkbox',
    '#title' => t("I agree with the website's terms and conditions."),
    '#required' => TRUE,
  ];
}

/**
 * Old hook kept for the deprecation test.
 *
 * @deprecated in drupal:10.1.0 and is removed from drupal:11.0.0. Use
 *   hook_something_else() instead.
 *
 * @see https://www.drupal.org/node/0000000
 */
function hook_legacy_thing(array &$stuff) {
  $stuff = [];
}

/**
 * Not a hook; must be ignored.
 */
function helper_function() {
}
