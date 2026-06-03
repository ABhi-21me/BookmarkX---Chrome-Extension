# Implementation Plan

## Overview

Fix 8 categories of bugs in the BookmarkX Chrome extension: wallpaper persistence, accent color validation, storage synchronization, IndexedDB error handling, state proxy caching, clock widget timing, deprecated favicon URL, and missing null checks.

## Task Dependency Graph

```
T1 --> T2 --> T3 --> T4 --> T5 --> T6 --> T7 --> T8
```

## Tasks

- [x] 1. Fix wallpaper persistence - update saveSettings() and BackgroundUtils.init()
  - Update saveSettings() in newtab.js to also write bx_bg_type, bx_bg_val, bx_bg_darkness, bx_bg_blur legacy keys
  - Update BackgroundUtils.init() in background.js to read from bx_v2_settings first, fall back to legacy keys
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Fix accent color validation in theme.js
  - Add isValidHex() function with regex /^#[0-9A-Fa-f]{6}$/
  - Update applyAccent() to validate before parsing, log warning and return early for invalid input
  - Update ThemeUtils.init() to read from bx_v2_settings.accent first, fall back to bx_accent
  - _Requirements: 2.4, 2.5, 2.6, 2.7_

- [x] 3. Fix storage synchronization - sync all legacy keys on save and load
  - Update saveSettings() to also write bx_theme and bx_accent legacy keys
  - Update loadSettings() to sync loaded bx_v2_settings values back to legacy keys
  - Update settings.js theme change handler to sync bx_theme legacy key
  - _Requirements: 2.8, 2.9_

- [ ] 4. Fix IndexedDB error handling in background.js
  - Add safeVideoOperation() wrapper with try-catch, console.error, and window.showToast
  - Update VideoDB.init() to check IndexedDB availability before opening
  - Wrap all VideoDB call sites with error handling
  - _Requirements: 2.10, 2.11_

- [~] 5. Fix state proxy caching in store.js
  - Add this.proxyCache = new WeakMap() to Store constructor
  - Update Proxy handler get trap to check cache before creating new Proxy
  - Store new Proxy instances in cache keyed by target object
  - _Requirements: 2.12, 2.13_

- [~] 6. Fix clock widget timing in clock.js and newtab.js
  - Dispatch 'bookmarkx:storeReady' custom event in newtab.js after loadSettings() completes
  - Replace setTimeout(50) in clock.js with event listener for 'bookmarkx:storeReady'
  - Add waitForStore() helper that resolves immediately if store already ready
  - _Requirements: 2.14, 2.15_

- [~] 7. Fix deprecated favicon URL in newtab.js
  - Replace Google S2 favicon URL with chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=...&size=32
  - Add onerror fallback to default favicon icon
  - _Requirements: 2.16, 2.17_

- [~] 8. Add null checks for bookmark URLs in newtab.js
  - Add if (!url) return '' guard at start of getDomain()
  - Update renderCard() to check b.url exists before rendering favicon
  - Add null check before encodeURIComponent(b.url) calls
  - _Requirements: 2.18, 2.19_

## Notes

- All fixes must preserve backward compatibility with legacy storage keys for existing users
- saveSettings() changes in tasks 1 and 3 overlap - implement together to avoid duplication
- The favicon fix in task 7 and null check in task 8 both touch renderCard() - coordinate
