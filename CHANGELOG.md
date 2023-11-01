# Change Log

All notable changes to the "drupal-smart-snippets" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.1]
- Initial release
- Added hooks
- Does not work due to faulty manifest

## [0.0.2]
- No changes

## [0.0.3]
- Fix snippets file & manifest to create base functionality

## [0.1.0]
- Update ReadMe & Manifest for marketplace changes
- Update hooks snippets to adhere to Drupal code standards

## [0.1.1]
- Change readme image paths to absolute urls

## [0.2.0]
### Added
- Miniumum core versions in hook description
- Deprecation warnings in hook description
- Inline deprecation comments in hook body
- Documentation & images for above additions

### Changed
- Altered all hooks to account for additions
- Reordered hook snippets based on scraper script

## [0.3.0]
### Changed
- scraper pulls from 9.0.7 (prev 9.0.6)
- scraper now checks hookName variable for secondary hooks ("HOOK", "ENTITY_TYPE",
etc) instead of the function usage to prevent matching on arguments with multiple
capitalized letters (e.g. "OEmbed", "ViewsUI")
- scraper has better regex matching for secondary hooks, leading to...
- hook_update_N now has second tab-stop for "N"
- hook_plugin_filter_TYPE__CONSUMER_alter differentiates between second tab-stop
"TYPE" and third tab-stop "CONSUMER"

## [0.3.1]
### Changed
- hook docblocks now include parenthesis after hook name
(`implements hook_preprocess().` vs `implements hook_preprocess.`)
- hook descriptions now include hookname and deprecation warning at the very
beginning, hopefully making it easier to know which hook snippet you're about to
use and if it's been deprecated

## [0.4.0]
### Changed
- Updated scraper to load snippets from 9.1.0, 8.9.11. No changes to hooks
at this time.

## [0.5.0]
### Added
- Added new snippets
  - hook_entity_form_mode_alter
  - hook_block_alter
  - hook_field_widget_single_element_form_alter
  - hook_field_widget_single_element_WIDGET_TYPE_form_alter
  - hook_field_widget_complete_form_alter
  - hook_field_widget_complete_WIDGET_TYPE_form_alter
### Changed
- Snippets load from 9.2.0 & 8.9.16

## [1.0.0]
### Added
- Added 9.3.0 hooks
  - hook_ckeditor5_plugin_info_alter
  - hook_ckeditor4to5upgrade_plugin_info_alter
### Changed
- Updated D9 source (9.2.0 t0 9.3.0)
### Removed
- Removed support for Drupal 8 (EOL)
- Removed D8-deprecated hooks
  - hook_path_insert
  - hook_path_update
  - hook_path_delete
  - hook_rest_type_uri_alter
  - hook_rest_relation_uri_alter
  - hook_simpletest_alter
  - hook_test_group_started
  - hook_test_group_finished
  - hook_test_finished

## [1.0.1]
### Changed
- Updated README to reflect changes in 1.0.0

## [1.0.2]
### Added
- Add MIT license

## [1.1.0]
### Changed
- Update scraper from 9.3.0 to 9.4.0

## [1.2.0]
### Added
- Added Form/Render Element snippets
- Added tags for marketplace visibility

### Changed
- Update node version
- Refactor script into smaller files
- Hooks snippets now sorted alphabetically

## [1.2.1]
### Changed
- Fixed broken '#required' boolean values

## [1.2.2]
- No changes, error in deployment process

## [1.3.0]
### Added
- Added Services snippets

### Changed
- Changelog up to date

## [1.4.0]
### Changed
- Updated core source versions to 10.1.0 and 9.5.9

## [2.0.0]
### Changed
- Deprecated ajax element ([change record](https://www.drupal.org/node/3068104))
### Removed
- Removed support for Drupal 9 ([psa-2023-11-01](https://www.drupal.org/psa-2023-11-01))
  - Removed deprecated hooks
    - hook_aggregator_fetcher_info_alter ([change record](https://www.drupal.org/node/3304999))
    - hook_aggregator_parser_info_alter ([change record](https://www.drupal.org/node/3304999))
    - hook_aggregator_processor_info_alter ([change record](https://www.drupal.org/node/3304999))
    - hook_ckeditor_css_alter ([change record](https://www.drupal.org/node/3304481))
    - hook_ckeditor_plugin_info_alter ([change record](https://www.drupal.org/node/3304481))
    - hook_field_widget_form_alter ([change record](https://www.drupal.org/node/3180429))
    - hook_field_widget_multivalue_form_alter ([change record](https://www.drupal.org/node/3180429))
    - hook_field_widget_multivalue_WIDGET_TYPE_form_alter ([change record](https://www.drupal.org/node/3180429))
    - hook_field_widget_WIDGET_TYPE_form_alter ([change record](https://www.drupal.org/node/3180429))
    - hook_hal_relation_uri_alter ([change record](https://www.drupal.org/node/3266403))
    - hook_hal_type_uri_alter ([change record](https://www.drupal.org/node/3266403))
    - hook_quickedit_editor_alter ([change record](https://www.drupal.org/node/3252839))
    - hook_quickedit_render_field ([change record](https://www.drupal.org/node/3252839))
    - hook_rdf_namespaces ([change record](https://www.drupal.org/node/3304899))
  - Removed deprecated services
    - access_check.entity_bundles ([change record](https://www.drupal.org/node/3155569))
    - app.root ([change record](https://www.drupal.org/node/3080612))
    - config.storage.staging ([change record](https://www.drupal.org/node/2574957))
    - feed.bridge.reader ([change record](https://www.drupal.org/node/3258656))
    - feed.reader.atomentry ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.atomfeed ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.contententry ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.dublincoreentry ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.dublincorefeed ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.podcastentry ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.podcastfeed ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.slashentry ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.threadentry ([change record](https://www.drupal.org/node/2979042))
    - feed.reader.wellformedwebentry ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.atomrendererfeed ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.contentrendererentry ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.dublincorerendererentry ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.dublincorerendererfeed ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.itunesentry ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.itunesfeed ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.itunesrendererentry ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.itunesrendererfeed ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.slashrendererentry ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.threadingrendererentry ([change record](https://www.drupal.org/node/2979042))
    - feed.writer.wellformedwebrendererentry ([change record](https://www.drupal.org/node/2979042))
    - site.path ([change record](https://www.drupal.org/node/3080612))
