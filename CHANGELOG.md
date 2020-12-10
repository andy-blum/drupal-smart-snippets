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

## [0.3.2]
### Changed
- Updated scraper to load snippets from 9.1.0, 8.9.11. No changes to hooks
at this time.