# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.1] — 2026-06-13

### Fixed

- **Active tab is no longer sent back.** The tab the user is looking at when clicking the extension icon is now always skipped, even if it belongs to a tab group. The fix uses the `tab` argument passed directly by `chrome.action.onClicked` (reliable in MV3 service workers) rather than a secondary `chrome.tabs.query` call that could return a stale result. Closes [#1](https://github.com/Marvellous-Codeworks/back-grouped-tabs/issues/1).
- **Already-loaded tabs are no longer sent back.** The extension now only processes grouped tabs that are actually stuck — either natively discarded by Chrome (`tab.discarded === true`) or rendered as a blank `chrome://newtab/` or `about:blank` page (the typical symptom of the Chrome session-restore bug this extension targets). Tabs that are already correctly loaded are left untouched.

---

## [1.0] — 2026-06-08

### Added

- Initial release.
- Single-click `goBack()` on every tab belonging to a Chrome Tab Group.
- Skips ungrouped tabs entirely.
- Temporarily activates each tab to force Chrome to restore its history before calling `goBack()`, then restores the previously active tab and the collapsed/expanded state of every group.
- Amber `...` badge while running; green count badge (or red if zero) on completion, cleared after 3 seconds.
