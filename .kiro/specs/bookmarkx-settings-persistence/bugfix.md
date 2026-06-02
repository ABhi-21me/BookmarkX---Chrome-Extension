# Bugfix Requirements Document

## Introduction

This document addresses multiple bugs in the BookmarkX Chrome extension related to settings persistence, state management, and error handling. The primary issues are: (1) wallpaper not persisting across new tab sessions, (2) accent color not applying or persisting correctly, and (3) several code quality issues affecting reliability and maintainability. These bugs stem from inconsistent storage key usage, missing validation, and improper error handling throughout the codebase.

## Bug Analysis

### Current Behavior (Defect)

**1. Wallpaper Persistence Issues**

1.1 WHEN a user sets a custom image wallpaper via the appearance panel THEN the system stores the image in `state.settings.bgVal` but BackgroundUtils.init() reads from separate storage keys `bx_bg_type` and `bx_bg_val` which may not be synchronized with `bx_v2_settings`

1.2 WHEN a user sets a custom video wallpaper THEN the system stores the video in IndexedDB but the bgType is stored in `state.settings.bgType` while BackgroundUtils.init() reads from `bx_bg_type` storage key which may contain stale or missing data

1.3 WHEN a user opens a new tab after setting a wallpaper THEN the system loads background settings from storage keys `bx_bg_type`, `bx_bg_val` which are not updated when settings are saved via `bx_v2_settings`, causing the wallpaper to revert to default

**2. Accent Color Issues**

2.1 WHEN a user sets an accent color via the appearance panel THEN the system passes the color to `applyAccent()` which attempts to parse hex values using `slice()` without validating the format, causing NaN results for invalid inputs

2.2 WHEN `applyAccent()` receives a malformed hex color (missing #, wrong length, non-hex characters) THEN the system sets invalid CSS values like `rgba(NaN,NaN,NaN,0.1)` causing visual rendering issues

2.3 WHEN accent color is stored in `state.settings.accent` within `bx_v2_settings` THEN the system may not persist correctly because ThemeUtils.init() reads from separate keys `bx_theme` and `bx_accent` instead of the unified settings object

**3. Storage Synchronization Issues**

3.1 WHEN settings are modified through the reactive state proxy THEN the system saves to `bx_v2_settings` but BackgroundUtils and ThemeUtils read from legacy separate keys (`bx_bg_type`, `bx_bg_val`, `bx_theme`, `bx_accent`), causing desynchronization

3.2 WHEN loadSettings() loads `bx_v2_settings` THEN the system does not also sync those values to the legacy storage keys, leaving them stale

**4. IndexedDB Error Handling**

4.1 WHEN VideoDB operations (saveVideo, loadVideo) fail due to quota exceeded or corruption THEN the system rejects silently without user feedback or fallback behavior

4.2 WHEN IndexedDB is unavailable or blocked THEN the system throws an unhandled error that crashes the background initialization

**5. State Proxy Issues**

5.1 WHEN accessing nested objects in `state.settings` THEN the system creates a new Proxy on every access via the getter, causing memory overhead and breaking reference equality comparisons

5.2 WHEN comparing state objects or using them as dependencies THEN the system returns different Proxy instances for the same underlying data, causing unnecessary re-renders and subscription triggers

**6. Clock Widget Timing Issues**

6.1 WHEN the ClockWidget initializes on DOMContentLoaded THEN the system uses a 50ms setTimeout to wait for the store, creating a race condition that may fail if store initialization takes longer

6.2 WHEN the store is not yet initialized when ClockWidget applies settings THEN the system falls back to empty settings object, potentially missing initial configuration

**7. Deprecated Favicon URL Format**

7.1 WHEN rendering bookmark cards with favicons THEN the system uses `https://www.google.com/s2/favicons` which is deprecated and may be unavailable, causing broken images

**8. Missing Null Checks**

8.1 WHEN a bookmark has an undefined or null URL property THEN the system calls `encodeURIComponent(b.url)` on undefined, resulting in "undefined" in the favicon URL

8.2 WHEN a bookmark URL is undefined THEN the system's `getDomain()` function may throw or return unexpected results

### Expected Behavior (Correct)

**1. Wallpaper Persistence Fixes**

2.1 WHEN a user sets a custom image or video wallpaper THEN the system SHALL store the background type and value in both `state.settings` AND update the legacy storage keys for backward compatibility

2.2 WHEN a user opens a new tab after setting a wallpaper THEN the system SHALL load the background settings from the unified `bx_v2_settings` object and apply them correctly

2.3 WHEN BackgroundUtils.init() runs THEN the system SHALL prioritize settings from `bx_v2_settings` over legacy keys, with fallback to legacy keys for migration

**2. Accent Color Fixes**

2.4 WHEN a user sets an accent color THEN the system SHALL validate the hex format before applying it, rejecting invalid formats gracefully

2.5 WHEN `applyAccent()` receives a valid hex color THEN the system SHALL correctly parse the RGB values and set valid CSS custom properties

2.6 WHEN `applyAccent()` receives an invalid hex color THEN the system SHALL log a warning and either use a fallback color or remove the accent properties

2.7 WHEN accent color is stored THEN the system SHALL save it to `state.settings.accent` within `bx_v2_settings` and ThemeUtils.init() SHALL read from the unified settings

**3. Storage Synchronization Fixes**

2.8 WHEN settings are saved via `saveSettings()` THEN the system SHALL also update the legacy storage keys (`bx_bg_type`, `bx_bg_val`, `bx_theme`, `bx_accent`) for backward compatibility

2.9 WHEN loadSettings() loads `bx_v2_settings` THEN the system SHALL sync the loaded values to legacy storage keys to ensure consistency

**4. IndexedDB Error Handling Fixes**

2.10 WHEN VideoDB operations fail THEN the system SHALL catch the error, log it appropriately, and show a user-friendly toast notification

2.11 WHEN IndexedDB is unavailable THEN the system SHALL fall back gracefully, disabling video wallpaper functionality without crashing

**5. State Proxy Fixes**

2.12 WHEN accessing nested objects in state THEN the system SHALL return cached Proxy instances rather than creating new ones on each access

2.13 WHEN comparing state objects THEN the system SHALL maintain reference equality for unchanged data

**6. Clock Widget Timing Fixes**

2.14 WHEN ClockWidget initializes THEN the system SHALL wait for the store to be ready using a proper promise or event-based mechanism instead of setTimeout

2.15 WHEN the store is ready THEN the system SHALL apply settings immediately without race conditions

**7. Favicon URL Fixes**

2.16 WHEN rendering bookmark favicons THEN the system SHALL use the Chrome extension favicon API (`chrome-extension://[id]/_favicon/`) as the primary source

2.17 WHEN the Chrome favicon API fails THEN the system SHALL fall back to a default favicon image

**8. Null Check Fixes**

2.18 WHEN processing bookmark URLs THEN the system SHALL check for null/undefined before calling string methods or encoding

2.19 WHEN a bookmark URL is undefined THEN the system SHALL skip favicon loading and use a placeholder or default icon

### Unchanged Behavior (Regression Prevention)

**1. Existing Functionality**

3.1 WHEN a user has existing settings stored in legacy keys without `bx_v2_settings` THEN the system SHALL CONTINUE TO migrate and use those settings correctly

3.2 WHEN a user upgrades from an older version THEN the system SHALL CONTINUE TO preserve all existing wallpapers, themes, and accent colors

3.3 WHEN the extension is disabled via the extension toggle THEN the system SHALL CONTINUE TO redirect to the default Chrome new tab page

**2. Visual and Interaction**

3.4 WHEN a user changes any setting in the appearance panel THEN the system SHALL CONTINUE TO apply changes immediately with visual feedback

3.5 WHEN a user toggles the clock widget visibility THEN the system SHALL CONTINUE TO show/hide the clock with the correct icon state

3.6 WHEN a user searches bookmarks using the search overlay THEN the system SHALL CONTINUE TO filter and display matching results in real-time

**3. Data Integrity**

3.7 WHEN a user exports bookmarks and settings THEN the system SHALL CONTINUE TO generate a valid JSON backup file with all data

3.8 WHEN a user imports a backup file THEN the system SHALL CONTINUE TO restore bookmarks and settings correctly

3.9 WHEN a user creates a new bookmark through the modal THEN the system SHALL CONTINUE TO save it to Chrome bookmarks API and refresh the display
