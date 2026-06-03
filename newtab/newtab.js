// --- EXTENSION ON/OFF CHECK ---
chrome.storage.local.get(['extensionEnabled'], (result) => {
  if (result.extensionEnabled === false) {
    chrome.tabs.getCurrent((tab) => {
      if (tab && tab.id) {
        chrome.tabs.update(tab.id, { url: "chrome://new-tab-page/" });
      } else {
        window.location.replace("chrome://new-tab-page/");
      }
    });
  }
});

// Local alias for convenience, points to the reactive proxy
let state = window.appStore.state;

// Friendly display names for Chrome's built-in root folders
const FOLDER_NICE_NAMES = {
  '1': 'Bookmarks Bar',
  '2': 'Other Bookmarks',
};

// Folder IDs to completely hide (absolute root + Mobile bookmarks)
const CHROME_HIDDEN_IDS = new Set(['0', '3']);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  // Signal that the store is ready with persisted settings applied
  window._bxStoreReady = true;
  window.dispatchEvent(new CustomEvent('bookmarkx:storeReady'));
  
  applyAllSettings(); // Renders Theme, viewMode, clock, UI toggle state
  await BackgroundUtils.init('bg-layer', 'bg-overlay');
  await loadData();
  renderAll(); // Renders Bookmarks
  bindEvents();
  setupSubscriptions();
}

function setupSubscriptions() {
  window.appStore.subscribe('isUIVisible', () => {
    applyUIVisibility();
  });
  
  window.appStore.subscribe('*', (change) => {
    if (!change) return;
    
    // Auto-save all state changes to Chrome Storage
    saveSettings();

    // Determine what to update based on the property changed
    const p = change.property;

    // Apply fast CSS updates
    if (['theme', 'accent', 'bgType', 'bgVal', 'bgDarkness', 'bgBlur', 'cardStyle', 'gridCols', 'showClockWidget'].includes(p)) {
      applyAllSettings();
    }
    
    // Update clock widget classes
    if (p.startsWith('clock') || p === 'dateFormat' || p === 'showClockWidget') {
      if (window.clockWidget) {
        window.clockWidget.applySettings();
        window.clockWidget.updateTime();
      }
    }
    
    // Only re-render DOM for bookmarks if these change
    if (['showFavicons', 'showUrl', 'viewMode', 'bookmarks'].includes(p)) {
      renderBoard();
    }
  });
}

// â”€â”€â”€ STORAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['bx_v2_settings', 'bx_ui_visible', 'bx_viewMode'], items => {
      if (items.bx_v2_settings) {
        Object.assign(state.settings, items.bx_v2_settings);
      }
      // If bgType is 'solid' (old default), upgrade to 'mesh'
      if (state.settings.bgType === 'solid') {
        state.settings.bgType = 'mesh';
      }
      if (items.bx_ui_visible !== undefined) state.isUIVisible = items.bx_ui_visible;
      if (items.bx_viewMode !== undefined) state.viewMode = items.bx_viewMode;
      // Sync legacy keys so BackgroundUtils.init() reads correct values
      chrome.storage.local.set({
        bx_bg_type: state.settings.bgType,
        bx_bg_val: state.settings.bgVal,
        bx_bg_darkness: state.settings.bgDarkness,
        bx_bg_blur: state.settings.bgBlur,
        bx_theme: state.settings.theme,
        bx_accent: state.settings.accent
      });
      resolve();
    });
  });
}

function saveSettings() {
  const s = state.settings;
  chrome.storage.local.set({
    bx_v2_settings: s,
    bx_ui_visible: state.isUIVisible,
    bx_viewMode: state.viewMode,
    // Legacy keys kept in sync for BackgroundUtils.init() and ThemeUtils.init()
    bx_bg_type: s.bgType,
    bx_bg_val: s.bgVal,
    bx_bg_darkness: s.bgDarkness,
    bx_bg_blur: s.bgBlur,
    bx_theme: s.theme,
    bx_accent: s.accent
  });
}

// â”€â”€â”€ DATA LOADING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function loadData() {
  const tree = await BookmarkUtils.getTree();
  const flat = BookmarkUtils.flattenTree(tree);
  state.bookmarks = flat.bookmarks;

  // Include all folders except absolute root (0) and Mobile bookmarks (3)
  state.allFolders = flat.folders.filter(f => !CHROME_HIDDEN_IDS.has(f.id));
}

// â”€â”€â”€ EVENT BINDING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function bindEvents() {
  const dockSettings = document.getElementById('dockSettings');

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        if (!document.getElementById('bookmarkModal').classList.contains('hidden')) {
          closeModal();
        } else if (!document.getElementById('searchOverlay').classList.contains('hidden')) {
          closeSearchOverlay();
        }
      }
      return;
    }

    if (e.key === 'Escape') {
      if (!document.getElementById('bookmarkModal').classList.contains('hidden')) {
        closeModal();
      } else if (!document.getElementById('appearancePanel').classList.contains('hidden')) {
        document.getElementById('appearancePanel').classList.add('hidden');
        if (dockSettings) dockSettings.classList.remove('active');
      } else if (!document.getElementById('searchOverlay').classList.contains('hidden')) {
        closeSearchOverlay();
      }
    } else if (e.key === '/') {
      e.preventDefault();
      document.getElementById('dockSearch').click();
    } else if (e.key === ' ') {
      e.preventDefault();
      document.getElementById('uiToggle').click();
    }
  });

  // Settings button (Topbar compatibility)
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('settings/settings.html'));
      }
    });
  }

  // Topbar Add Bookmark compatibility
  const addBookmarkBtn = document.getElementById('addBookmarkBtn');
  if (addBookmarkBtn) {
    addBookmarkBtn.addEventListener('click', () => openModal());
  }

  // Persistent Side Dock: Add Bookmark
  document.getElementById('dockAddBookmark').addEventListener('click', () => openModal());

  // Persistent Side Dock: Clock Widget Toggle
  document.getElementById('dockClockToggle').addEventListener('click', () => {
    state.settings.showClockWidget = !state.settings.showClockWidget;

    applyAllSettings();
  });

  // Show/Hide UI toggle
  document.getElementById('uiToggle').addEventListener('click', () => {
    state.isUIVisible = !state.isUIVisible;
    // Also call directly in case the reactive subscription misfires
    applyUIVisibility();
    saveSettings();
  });

  // Persistent Side Dock: Open Chrome Downloads
  const dockDownloads = document.getElementById('dockDownloads');
  if (dockDownloads) {
    dockDownloads.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://downloads/' });
      dockDownloads.classList.add('active');
      setTimeout(() => dockDownloads.classList.remove('active'), 500);
    });
  }

  // Persistent Side Dock: Search Overlay
  document.getElementById('dockSearch').addEventListener('click', () => {
    const searchOverlay = document.getElementById('searchOverlay');
    const dockSearchInput = document.getElementById('dockSearchInput');
    searchOverlay.classList.remove('hidden');
    dockSearchInput.focus();
    document.getElementById('dockSearch').classList.add('active');
  });

  function closeSearchOverlay() {
    const searchOverlay = document.getElementById('searchOverlay');
    searchOverlay.classList.add('hidden');
    document.getElementById('dockSearch').classList.remove('active');
    document.getElementById('dockSearchInput').value = '';
    document.querySelectorAll('.bm-card').forEach(card => card.style.display = '');
    document.getElementById('searchResultsCount').textContent = '';
  }

  document.getElementById('closeSearchBtn').addEventListener('click', closeSearchOverlay);

  // Search input live filter inside overlay
  document.getElementById('dockSearchInput').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById('searchResultsList');
    const countEl = document.getElementById('searchResultsCount');

    if (!q) {
      resultsContainer.innerHTML = '';
      countEl.textContent = '';
      return;
    }

    const matches = state.bookmarks.filter(b =>
      b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );

    if (matches.length > 0) {
      countEl.textContent = `Found ${matches.length} matches`;
      resultsContainer.innerHTML = matches.map(b => `
        <a href="${b.url}" class="search-result-item" target="_self">
          <img class="search-result-favicon" src="${b.favicon || (b.url ? `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(b.url)}&size=32` : '')}" alt="" onerror="this.src='../assets/default-favicon.png'">
          <div class="search-result-info">
            <div class="search-result-title">${escapeHTML(b.title)}</div>
            <div class="search-result-url">${escapeHTML(b.url)}</div>
          </div>
        </a>
      `).join('');
    } else {
      countEl.textContent = '';
      resultsContainer.innerHTML = `<div class="search-result-empty">No bookmarks found for "${escapeHTML(q)}"</div>`;
    }
  });

  // Appearance Panel open/close (Topbar compatibility)
  const appearanceBtn = document.getElementById('appearanceBtn');
  if (appearanceBtn) {
    appearanceBtn.addEventListener('click', () => {
      document.getElementById('appearancePanel').classList.remove('hidden');
      syncAppearanceUI();
      if (dockSettings) dockSettings.classList.add('active');
    });
  }

  // Persistent Side Dock Settings Gear
  if (dockSettings) {
    dockSettings.addEventListener('click', () => {
      const panel = document.getElementById('appearancePanel');
      if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        syncAppearanceUI();
        dockSettings.classList.add('active');
      } else {
        panel.classList.add('hidden');
        dockSettings.classList.remove('active');
      }
    });
  }

  document.getElementById('closePanelBtn').addEventListener('click', () => {
    document.getElementById('appearancePanel').classList.add('hidden');
    if (dockSettings) dockSettings.classList.remove('active');
  });
  document.getElementById('panelBackdrop').addEventListener('click', () => {
    document.getElementById('appearancePanel').classList.add('hidden');
    if (dockSettings) dockSettings.classList.remove('active');
  });

  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      saveSettings();
      showToast('Settings saved!');
    });
  }

  // Appearance Panel nav (full-window sidebar)
  document.querySelectorAll('.panel-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.panel-nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const section = document.querySelector(`.panel-section[data-psection="${item.dataset.ptab}"]`);
      if (section) section.classList.add('active');
    });
  });

  // Keep old panel-tab handler for any remaining tab elements
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      const section = document.querySelector(`.panel-section[data-psection="${tab.dataset.ptab}"]`);
      if (section) section.classList.add('active');
    });
  });

  // Theme — Listen on ALL theme swatches across all category grids
  document.querySelectorAll('.theme-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      state.settings.theme = swatch.dataset.theme;
      ThemeUtils.applyTheme(state.settings.theme);
      // Pulse animation on selection (one pass only)
      swatch.classList.remove('just-selected');
      void swatch.offsetWidth; // reflow to restart animation
      swatch.classList.add('just-selected');
      swatch.addEventListener('animationend', () => swatch.classList.remove('just-selected'), { once: true });
      syncAppearanceUI();
    });
  });

  const accentRow = document.getElementById('accentRow');
  if (accentRow) {
    accentRow.addEventListener('click', e => {
      const circle = e.target.closest('.accent-circle');
      if (circle) {
        state.settings.accent = circle.dataset.color;
        ThemeUtils.applyAccent(state.settings.accent);
        syncAppearanceUI();
      }
    });
  }

  document.querySelectorAll('[data-font]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.font = btn.dataset.font;
      ThemeUtils.applyFont(state.settings.font);
      syncAppearanceUI();

    });
  });

  // Background
  document.querySelectorAll('[data-bg]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.bgType = btn.dataset.bg;
      BackgroundUtils.apply(state.settings.bgType, state.settings.bgVal, state.settings.meshColors);
      syncAppearanceUI();
    });
  });

  const wpInput = document.getElementById('wallpaperInput');
  wpInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        state.settings.bgVal = reader.result;
        state.settings.bgType = 'image';
        BackgroundUtils.apply('image', state.settings.bgVal);
        _showImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  });

  // Image dropzone drag-and-drop
  const imageDropZone = document.getElementById('imageDropZone');
  if (imageDropZone) {
    imageDropZone.addEventListener('dragover', e => { e.preventDefault(); imageDropZone.classList.add('drag-active'); });
    imageDropZone.addEventListener('dragleave', () => imageDropZone.classList.remove('drag-active'));
    imageDropZone.addEventListener('drop', e => {
      e.preventDefault();
      imageDropZone.classList.remove('drag-active');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          state.settings.bgVal = reader.result;
          state.settings.bgType = 'image';
          BackgroundUtils.apply('image', state.settings.bgVal);
          _showImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Remove wallpaper
  const removeWallpaperBtn = document.getElementById('removeWallpaperBtn');
  if (removeWallpaperBtn) {
    removeWallpaperBtn.addEventListener('click', () => {
      state.settings.bgVal = '';
      state.settings.bgType = 'mesh';
      BackgroundUtils.apply('mesh', '', state.settings.meshColors);
      _hideImagePreview();
      document.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('active', b.dataset.bg === 'mesh'));
      syncAppearanceUI();
    });
  }

  const removeImagePreview = document.getElementById('removeImagePreview');
  if (removeImagePreview) {
    removeImagePreview.addEventListener('click', e => {
      e.stopPropagation();
      if (removeWallpaperBtn) removeWallpaperBtn.click();
    });
  }

  function _showImagePreview(src) {
    const wrap = document.getElementById('imagePreviewWrap');
    const hint = document.getElementById('imageDropHint');
    const thumb = document.getElementById('imagePreviewThumb');
    const removeBtn = document.getElementById('removeWallpaperBtn');
    if (wrap) { wrap.classList.remove('hidden'); thumb.src = src; }
    if (hint) hint.classList.add('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
  }

  function _hideImagePreview() {
    const wrap = document.getElementById('imagePreviewWrap');
    const hint = document.getElementById('imageDropHint');
    const removeBtn = document.getElementById('removeWallpaperBtn');
    if (wrap) { wrap.classList.add('hidden'); document.getElementById('imagePreviewThumb').src = ''; }
    if (hint) hint.classList.remove('hidden');
    if (removeBtn) removeBtn.classList.add('hidden');
  }

  // Restore image preview if wallpaper is already set
  if (state.settings.bgType === 'image' && state.settings.bgVal) {
    _showImagePreview(state.settings.bgVal);
  }

  const vidInput = document.getElementById('videoWallpaperInput');
  if (vidInput) {
    vidInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 20 * 1024 * 1024) {
          showToast('Video is large, it may take a moment to load.');
        }
        VideoDB.saveVideo(file).then(() => {
          state.settings.bgType = 'video';
          state.settings.bgVal = '';
          BackgroundUtils.apply('video', '');
          _showVideoPreview(file);
          showToast('Video wallpaper saved!');
        }).catch(err => {
          console.error(err);
          showToast('Failed to save video. Try a smaller file.', true);
        });
      }
    });
  }

  // Video dropzone drag-and-drop
  const videoDropZone = document.getElementById('videoDropZone');
  if (videoDropZone) {
    videoDropZone.addEventListener('dragover', e => { e.preventDefault(); videoDropZone.classList.add('drag-active'); });
    videoDropZone.addEventListener('dragleave', () => videoDropZone.classList.remove('drag-active'));
    videoDropZone.addEventListener('drop', e => {
      e.preventDefault();
      videoDropZone.classList.remove('drag-active');
      const file = e.dataTransfer.files[0];
      if (file && (file.type === 'video/mp4' || file.type === 'video/webm')) {
        if (vidInput) { vidInput.files = e.dataTransfer.files; vidInput.dispatchEvent(new Event('change')); }
      }
    });
  }

  // Remove video preview
  const removeVideoPreview = document.getElementById('removeVideoPreview');
  if (removeVideoPreview) {
    removeVideoPreview.addEventListener('click', e => {
      e.stopPropagation();
      state.settings.bgType = 'mesh';
      state.settings.bgVal = '';
      BackgroundUtils.apply('mesh', '', state.settings.meshColors);
      _hideVideoPreview();
      document.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('active', b.dataset.bg === 'mesh'));
    });
  }

  // Video loop / mute toggles
  const videoLoopToggle = document.getElementById('videoLoopToggle');
  const videoMuteToggle = document.getElementById('videoMuteToggle');
  const bgVideoEl = document.getElementById('bg-video');

  if (videoLoopToggle) {
    videoLoopToggle.addEventListener('click', () => {
      videoLoopToggle.classList.toggle('active');
      if (bgVideoEl) bgVideoEl.loop = videoLoopToggle.classList.contains('active');
      state.settings.videoLoop = videoLoopToggle.classList.contains('active');
    });
  }
  if (videoMuteToggle) {
    videoMuteToggle.addEventListener('click', () => {
      videoMuteToggle.classList.toggle('active');
      if (bgVideoEl) bgVideoEl.muted = videoMuteToggle.classList.contains('active');
      state.settings.videoMute = videoMuteToggle.classList.contains('active');
    });
  }

  function _showVideoPreview(file) {
    const wrap = document.getElementById('videoPreviewWrap');
    const hint = document.getElementById('videoDropHint');
    const nameEl = document.getElementById('videoFileName');
    const durEl = document.getElementById('videoDuration');
    const opts = document.getElementById('videoOptions');
    if (wrap) wrap.classList.remove('hidden');
    if (hint) hint.classList.add('hidden');
    if (nameEl) nameEl.textContent = file.name;
    if (opts) opts.style.display = '';
    if (durEl && file) {
      const tmpVid = document.createElement('video');
      tmpVid.src = URL.createObjectURL(file);
      tmpVid.addEventListener('loadedmetadata', () => {
        const d = Math.round(tmpVid.duration);
        durEl.textContent = `${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`;
        URL.revokeObjectURL(tmpVid.src);
      });
    }
  }

  function _hideVideoPreview() {
    const wrap = document.getElementById('videoPreviewWrap');
    const hint = document.getElementById('videoDropHint');
    const opts = document.getElementById('videoOptions');
    if (wrap) wrap.classList.add('hidden');
    if (hint) hint.classList.remove('hidden');
    if (opts) opts.style.display = 'none';
  }

  // Restore video preview state if video was previously set
  if (state.settings.bgType === 'video') {
    safeVideoOperation(() => VideoDB.loadVideo()).then(blob => {
      if (blob) _showVideoPreview(blob);
    });
  }

  document.getElementById('darknessSlider').addEventListener('input', e => {
    state.settings.bgDarkness = parseInt(e.target.value);
    document.getElementById('darknessVal').textContent = `${state.settings.bgDarkness}%`;
    BackgroundUtils.applyOverlay(state.settings.bgDarkness, state.settings.bgBlur);

  });

  document.getElementById('blurSlider').addEventListener('input', e => {
    state.settings.bgBlur = parseInt(e.target.value);
    document.getElementById('blurVal').textContent = `${state.settings.bgBlur}px`;
    BackgroundUtils.applyOverlay(state.settings.bgDarkness, state.settings.bgBlur);

  });

  // Layout — Card Style (fix active state)
  document.querySelectorAll('[data-cardstyle]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.cardStyle = btn.dataset.cardstyle;
      document.body.setAttribute('data-cardstyle', state.settings.cardStyle || 'glass');
      // Explicitly sync active class on all cardstyle buttons
      document.querySelectorAll('[data-cardstyle]').forEach(b =>
        b.classList.toggle('active', b.dataset.cardstyle === state.settings.cardStyle));
    });
  });

  // View Mode
  document.querySelectorAll('[data-viewmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.viewMode = btn.dataset.viewmode;
      document.body.setAttribute('data-viewmode', state.viewMode);
      document.querySelectorAll('[data-viewmode]').forEach(b => b.classList.toggle('active', b.dataset.viewmode === state.viewMode));
      localStorage.setItem('bx_viewMode', state.viewMode);
      renderBoard();
    });
  });

  document.getElementById('columnsSlider').addEventListener('input', e => {
    state.settings.gridCols = parseInt(e.target.value);
    document.documentElement.style.setProperty('--grid-cols', state.settings.gridCols);
    document.getElementById('columnsVal').textContent = `${state.settings.gridCols} columns`;

  });

  ['clockToggle', 'faviconToggle', 'urlToggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', e => {
        const toggle = e.currentTarget;
        toggle.classList.toggle('active');
        const isOn = toggle.classList.contains('active');
        if (id === 'faviconToggle') state.settings.showFavicons = isOn;
        if (id === 'urlToggle') state.settings.showUrl = isOn;
        if (id === 'clockToggle') state.settings.showClockWidget = isOn;
      });
    }
  });

  // Clock Settings
  const clockSettingsMap = [
    { id: 'clockPosSelect', key: 'clockPos' },
    { id: 'clockLayoutSelect', key: 'clockLayout' },
    { id: 'clockStyleSelect', key: 'clockStyle' },
    { id: 'clockAnimSelect', key: 'clockAnim' },
    { id: 'dateFormatSelect', key: 'dateFormat' }
  ];
  
  clockSettingsMap.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', e => {
        state.settings[key] = e.target.value;
      });
    }
  });

  ['clock24hrToggle', 'clockSecondsToggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', e => {
        const toggle = e.currentTarget;
        toggle.classList.toggle('active');
        const isOn = toggle.classList.contains('active');
        if (id === 'clock24hrToggle') state.settings.clock24hr = isOn;
        if (id === 'clockSecondsToggle') state.settings.clockShowSeconds = isOn;
      });
    }
  });

  // Data Tab
  const exportBtn = document.getElementById('exportBookmarksBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = {
        bookmarks: state.bookmarks,
        settings: state.settings
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarkx-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded successfully!');
    });
  }

  const importInput = document.getElementById('importBookmarksInput');
  if (importInput) {
    importInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data && data.bookmarks) {
            state.bookmarks = data.bookmarks;
            if (data.settings) state.settings = { ...state.settings, ...data.settings };

            applyAllSettings();
            renderAll();
            showToast('Bookmarks imported successfully!');
          } else {
            showToast('Invalid backup file format.', true);
          }
        } catch (err) {
          showToast('Failed to parse backup file.', true);
        }
      };
      reader.readAsText(file);
    });
  }

  const downloadsBtn = document.getElementById('openDownloadsBtn');
  if (downloadsBtn) {
    downloadsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://downloads/' });
    });
  }

  // Modal close buttons
  const closeModalBtn = document.getElementById('closeModalBtn');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeModal);

  // Save bookmark from modal
  document.getElementById('saveModalBtn').addEventListener('click', saveBookmarkFromModal);

  // Folder select â€” show/hide "new folder name" input
  document.getElementById('bm-folder').addEventListener('change', e => {
    const newFolderRow = document.getElementById('new-folder-row');
    if (e.target.value === '__new__') {
      newFolderRow.classList.remove('hidden');
      document.getElementById('bm-new-folder-name').focus();
    } else {
      newFolderRow.classList.add('hidden');
    }
  });

  // Press Enter in new-folder-name to proceed to save
  document.getElementById('bm-new-folder-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBookmarkFromModal();
    }
  });

  // ── Right-click Context Menu ──
  const ctxMenu = document.getElementById('bm-context-menu');
  let ctxTargetId = null;

  document.getElementById('bookmarkGrid').addEventListener('contextmenu', e => {
    const card = e.target.closest('.bm-card');
    if (!card) return;
    e.preventDefault();
    ctxTargetId = card.dataset.bid;
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 100);
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.remove('hidden');
  });

  document.addEventListener('click', () => ctxMenu.classList.add('hidden'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ctxMenu.classList.add('hidden'); });

  document.getElementById('ctxEdit').addEventListener('click', () => {
    ctxMenu.classList.add('hidden');
    if (ctxTargetId) openModal(ctxTargetId);
  });

  document.getElementById('ctxDelete').addEventListener('click', async () => {
    ctxMenu.classList.add('hidden');
    if (!ctxTargetId) return;
    try {
      await BookmarkUtils.remove(ctxTargetId);
      await loadData();
      renderAll();
      showToast('Bookmark deleted.');
    } catch (err) {
      showToast('Could not delete bookmark.');
      console.error(err);
    }
  });

  // ── Drag & Drop to reorder ──
  let dragSrcId = null;

  document.getElementById('bookmarkGrid').addEventListener('dragstart', e => {
    const card = e.target.closest('.bm-card');
    if (!card) return;
    dragSrcId = card.dataset.bid;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  document.getElementById('bookmarkGrid').addEventListener('dragend', e => {
    const card = e.target.closest('.bm-card');
    if (card) card.classList.remove('dragging');
    document.querySelectorAll('.bm-card.drag-over').forEach(c => c.classList.remove('drag-over'));
  });

  document.getElementById('bookmarkGrid').addEventListener('dragover', e => {
    e.preventDefault();
    const card = e.target.closest('.bm-card');
    if (!card || card.dataset.bid === dragSrcId) return;
    document.querySelectorAll('.bm-card.drag-over').forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });

  document.getElementById('bookmarkGrid').addEventListener('drop', async e => {
    e.preventDefault();
    const card = e.target.closest('.bm-card');
    if (!card || !dragSrcId || card.dataset.bid === dragSrcId) return;
    card.classList.remove('drag-over');

    const destId = card.dataset.bid;
    const dest = state.bookmarks.find(b => b.id === destId);
    if (!dest) return;

    try {
      // Move dragged bookmark to same folder as destination, positioned before it
      await BookmarkUtils.move(dragSrcId, { parentId: dest.parentId });
      await loadData();
      renderAll();
    } catch (err) {
      console.error('Drag move failed:', err);
    }
    dragSrcId = null;
  });
}

// â”€â”€â”€ APPLY FUNCTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function applyAllSettings() {
  ThemeUtils.applyTheme(state.settings.theme);
  // Force CSS variable refresh on the panel content too
  const panelContent = document.getElementById('appearancePanel');
  if (panelContent) {
    panelContent.style.setProperty('--force-repaint', Date.now());
  }
  ThemeUtils.applyAccent(state.settings.accent);
  BackgroundUtils.apply(state.settings.bgType, state.settings.bgVal, state.settings.meshColors);
  BackgroundUtils.applyOverlay(state.settings.bgDarkness, state.settings.bgBlur);
  document.body.setAttribute('data-cardstyle', state.settings.cardStyle);
  document.documentElement.style.setProperty('--grid-cols', state.settings.gridCols);

  // Restore view mode
  const savedViewMode = localStorage.getItem('bx_viewMode');
  if (savedViewMode) state.viewMode = savedViewMode;
  document.body.setAttribute('data-viewmode', state.viewMode || 'grid');

  applyUIVisibility();

  // Clock visibility
  const clockWidget = document.getElementById('clockWidget');
  const dockClockToggle = document.getElementById('dockClockToggle');
  const iconClock = dockClockToggle ? dockClockToggle.querySelector('.icon-clock') : null;
  const iconClockOff = dockClockToggle ? dockClockToggle.querySelector('.icon-clock-off') : null;

  if (state.settings.showClockWidget) {
    if (clockWidget) clockWidget.classList.remove('hidden');
    if (iconClock) iconClock.classList.remove('hidden');
    if (iconClockOff) iconClockOff.classList.add('hidden');
    if (dockClockToggle) dockClockToggle.classList.add('active');
  } else {
    if (clockWidget) clockWidget.classList.add('hidden');
    if (iconClock) iconClock.classList.add('hidden');
    if (iconClockOff) iconClockOff.classList.remove('hidden');
    if (dockClockToggle) dockClockToggle.classList.remove('active');
  }
}

function applyUIVisibility() {
  const bookmarkGrid = document.getElementById('bookmarkGrid');
  const emptyState = document.getElementById('emptyState');
  const uiToggle = document.getElementById('uiToggle');
  const iconEye = uiToggle ? uiToggle.querySelector('.icon-eye') : null;
  const iconEyeOff = uiToggle ? uiToggle.querySelector('.icon-eye-off') : null;

  document.body.classList.toggle('bookmarks-hidden', !state.isUIVisible);

  if (state.isUIVisible) {
    if (bookmarkGrid) {
      bookmarkGrid.style.opacity = '1';
      bookmarkGrid.style.pointerEvents = '';
      bookmarkGrid.style.display = '';
    }
    if (emptyState) {
      emptyState.style.opacity = '1';
      emptyState.style.pointerEvents = '';
      emptyState.style.display = '';
    }
    if (uiToggle) uiToggle.classList.add('active');
    if (iconEye) iconEye.classList.remove('hidden');
    if (iconEyeOff) iconEyeOff.classList.add('hidden');
    
    // Fix: Immediately rerender to ensure layout isn't stuck empty
    setTimeout(() => renderBoard(), 0);
  } else {
    if (bookmarkGrid) bookmarkGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (uiToggle) uiToggle.classList.remove('active');
    if (iconEye) iconEye.classList.add('hidden');
    if (iconEyeOff) iconEyeOff.classList.remove('hidden');
  }
}

function syncAppearanceUI() {
  // Sync sidebar nav active state to current visible section
  const activeSection = document.querySelector('.panel-section.active');
  if (activeSection) {
    const activeTab = activeSection.dataset.psection;
    document.querySelectorAll('.panel-nav-item').forEach(i =>
      i.classList.toggle('active', i.dataset.ptab === activeTab));
  }

  document.querySelectorAll('.theme-swatch').forEach(el =>
    el.classList.toggle('active', el.dataset.theme === state.settings.theme));
  document.querySelectorAll('.accent-circle').forEach(el =>
    el.classList.toggle('active', el.dataset.color === state.settings.accent));

  document.querySelectorAll('[data-bg]').forEach(el =>
    el.classList.toggle('active', el.dataset.bg === state.settings.bgType));
  document.getElementById('imageUpload').classList.toggle('hidden', state.settings.bgType !== 'image');
  document.getElementById('videoUpload').classList.toggle('hidden', state.settings.bgType !== 'video');
  const solidColorPicker = document.getElementById('solidColorPicker');
  if (solidColorPicker) {
    // Always show accent color picker
    solidColorPicker.classList.remove('hidden');
  }
  const meshUpload = document.getElementById('meshUpload');
  if (meshUpload) {
    meshUpload.classList.toggle('hidden', state.settings.bgType !== 'mesh');
    if (state.settings.meshColors) {
      document.getElementById('meshColor1').value = state.settings.meshColors[0] || '#ffb875';
      document.getElementById('meshColor2').value = state.settings.meshColors[1] || '#00e5ff';
      document.getElementById('meshColor3').value = state.settings.meshColors[2] || '#ffd4d9';
    }
  }
  document.getElementById('darknessSlider').value = state.settings.bgDarkness;
  document.getElementById('darknessVal').textContent = `${state.settings.bgDarkness}%`;
  document.getElementById('blurSlider').value = state.settings.bgBlur;
  document.getElementById('blurVal').textContent = `${state.settings.bgBlur}px`;

  document.querySelectorAll('[data-viewmode]').forEach(el =>
    el.classList.toggle('active', el.dataset.viewmode === (state.viewMode || 'grid')));

  document.querySelectorAll('[data-cardstyle]').forEach(el =>
    el.classList.toggle('active', el.dataset.cardstyle === state.settings.cardStyle));
  document.getElementById('columnsSlider').value = state.settings.gridCols;
  document.getElementById('columnsVal').textContent = `${state.settings.gridCols} columns`;

  const clockToggle = document.getElementById('clockToggle');
  if (clockToggle) clockToggle.classList.toggle('active', state.settings.showClockWidget !== false);
  const favToggle = document.getElementById('faviconToggle');
  if (favToggle) favToggle.classList.toggle('active', state.settings.showFavicons !== false);
  const uToggle = document.getElementById('urlToggle');
  if (uToggle) uToggle.classList.toggle('active', state.settings.showUrl !== false);

  // Sync Clock Settings
  const clockSettingsMap = [
    { id: 'clockPosSelect', key: 'clockPos' },
    { id: 'clockLayoutSelect', key: 'clockLayout' },
    { id: 'clockStyleSelect', key: 'clockStyle' },
    { id: 'clockAnimSelect', key: 'clockAnim' },
    { id: 'dateFormatSelect', key: 'dateFormat' }
  ];
  clockSettingsMap.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el && state.settings[key]) {
      el.value = state.settings[key];
    }
  });

  const c24hr = document.getElementById('clock24hrToggle');
  if (c24hr) c24hr.classList.toggle('active', state.settings.clock24hr === true);
  const cSecs = document.getElementById('clockSecondsToggle');
  if (cSecs) cSecs.classList.toggle('active', state.settings.clockShowSeconds === true);

  // Update theme preview name (may not exist if banner was removed)
  const themePreviewName = document.getElementById('themePreviewName');
  if (themePreviewName) {
    const activeSwatch = document.querySelector(`.theme-swatch[data-theme="${state.settings.theme}"]`);
    themePreviewName.textContent = activeSwatch
      ? (activeSwatch.querySelector('.theme-swatch-label')?.textContent || state.settings.theme)
      : state.settings.theme;
  }

  // Sync accent circles if present
  document.querySelectorAll('.accent-circle').forEach(el =>
    el.classList.toggle('active', el.dataset.color === state.settings.accent));
}

// â”€â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function renderAll() {
  renderBoard();
}

function getFolderName(folderId) {
  if (FOLDER_NICE_NAMES[folderId]) return FOLDER_NICE_NAMES[folderId];
  const folder = state.allFolders.find(f => f.id === folderId);
  return folder ? folder.title : 'Uncategorized';
}

function renderBoard() {
  const grid = document.getElementById('bookmarkGrid');
  const empty = document.getElementById('emptyState');
  const bms = state.bookmarks;

  if (bms.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  // Group bookmarks by parentId (folder)
  const groups = new Map();
  bms.forEach(b => {
    const fid = b.parentId || '__none__';
    if (!groups.has(fid)) groups.set(fid, []);
    groups.get(fid).push(b);
  });

  if (groups.size === 0) return;

  const mode = state.viewMode || 'grid';

  if (mode === 'grid' || mode === 'compact') {
    // Flat list of all bookmarks
    grid.className = mode === 'compact' ? 'compact-grid' : 'grid-view';
    grid.innerHTML = bms.map(b => renderCard(b)).join('');
  } else if (mode === 'category' || mode === 'workspace') {
    // Grouped by folder
    grid.className = 'folder-groups-view';
    const html = [];
    for (const [fid, bookmarks] of groups) {
      const folderName = getFolderName(fid);
      html.push(`
        <div class="folder-group ${mode === 'workspace' ? 'workspace-mode' : ''}">
          <div class="folder-group-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="folder-group-name">${escapeHTML(folderName)}</span>
            <span class="folder-group-count">${bookmarks.length}</span>
          </div>
          <div class="folder-group-grid">
            ${bookmarks.map(b => renderCard(b)).join('')}
          </div>
        </div>
      `);
    }
    grid.innerHTML = html.join('');
  }
}

function renderCard(b) {
  const url = b.url || '';
  const domain = getDomain(url);

  const favHtml = (state.settings.showFavicons && url)
    ? `<img src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}" class="card-favicon" onerror="this.style.display='none'">`
    : '';

  return `
    <a href="${url ? escapeAttr(url) : '#'}" class="bm-card" data-bid="${b.id}" draggable="true">
      <div class="card-header">
        ${favHtml}
        <div class="card-title">${escapeHTML(b.title || domain || 'Untitled')}</div>
      </div>
      ${state.settings.showUrl && domain ? `<div class="card-domain">${escapeHTML(domain)}</div>` : ''}
    </a>
  `;
}

// â”€â”€â”€ MODAL (Add / Edit Bookmark) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function populateFolderDropdown(selectedId) {
  const folderSelect = document.getElementById('bm-folder');
  folderSelect.innerHTML = '';

  // âž• Create New Folder option
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = 'âž•  Create New Folder...';
  folderSelect.appendChild(newOpt);

  // Visual separator
  const sep = document.createElement('option');
  sep.disabled = true;
  sep.textContent = 'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€';
  folderSelect.appendChild(sep);

  // All available folders
  state.allFolders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    const niceName = FOLDER_NICE_NAMES[f.id] || f.title;
    // Indent nested folders: depth 1 = root-level (no indent), depth 2+ = indented
    const indent = '\u00a0\u00a0\u00a0\u00a0'.repeat(Math.max(0, (f.depth || 0) - 1));
    opt.textContent = indent + niceName;
    folderSelect.appendChild(opt);
  });

  // Select the right folder
  if (selectedId && folderSelect.querySelector(`option[value="${selectedId}"]`)) {
    folderSelect.value = selectedId;
  } else {
    // Default to Bookmarks Bar (id=1) if present, otherwise first real folder
    const bmBar = folderSelect.querySelector('option[value="1"]');
    if (bmBar) {
      folderSelect.value = '1';
    } else if (state.allFolders.length > 0) {
      folderSelect.value = state.allFolders[0].id;
    }
  }

  // Hide the new-folder input row
  document.getElementById('new-folder-row').classList.add('hidden');
}

function openModal(bookmarkId) {
  state.editingId = bookmarkId || null;

  document.getElementById('bm-url').value = '';
  document.getElementById('bm-title').value = '';
  document.getElementById('bm-new-folder-name').value = '';
  document.getElementById('modalHeading').textContent = bookmarkId ? 'Edit Bookmark' : 'Add Bookmark';

  if (bookmarkId) {
    const bm = state.bookmarks.find(b => b.id === bookmarkId);
    if (bm) {
      document.getElementById('bm-url').value = bm.url;
      document.getElementById('bm-title').value = bm.title;
      populateFolderDropdown(bm.parentId);
    } else {
      populateFolderDropdown(null);
    }
  } else {
    populateFolderDropdown(null);
  }

  document.getElementById('bookmarkModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('bm-url').focus(), 50);
}

function closeModal() {
  document.getElementById('bookmarkModal').classList.add('hidden');
  document.getElementById('new-folder-row').classList.add('hidden');
  state.editingId = null;
}

async function saveBookmarkFromModal() {
  const url = document.getElementById('bm-url').value.trim();
  const title = document.getElementById('bm-title').value.trim();
  let folderId = document.getElementById('bm-folder').value;
  const newFolderName = document.getElementById('bm-new-folder-name').value.trim();
  const wasEditing = !!state.editingId;

  if (!url) {
    document.getElementById('bm-url').focus();
    return;
  }

  try {
    // If "Create New Folder" was chosen, create the folder first
    if (folderId === '__new__') {
      if (!newFolderName) {
        document.getElementById('bm-new-folder-name').focus();
        showToast('Please enter a folder name first.');
        return;
      }
      // Create the new folder under Bookmarks Bar by default
      const newFolder = await BookmarkUtils.create({ parentId: '1', title: newFolderName });
      folderId = newFolder.id;
    }

    let bookmarkId = state.editingId;

    if (bookmarkId) {
      // Update existing bookmark
      await BookmarkUtils.update(bookmarkId, { title: title || url, url });
      // Move to new folder if the parent changed
      const bm = state.bookmarks.find(b => b.id === bookmarkId);
      if (bm && bm.parentId !== folderId) {
        await BookmarkUtils.move(bookmarkId, { parentId: folderId });
      }
    } else {
      // Create new bookmark
      const created = await BookmarkUtils.create({ parentId: folderId, title: title || url, url });
      bookmarkId = created.id;
    }

    closeModal();
    await loadData();
    renderAll();
    showToast(wasEditing ? 'Bookmark updated!' : 'Bookmark saved!');
  } catch (err) {
    showToast('Error saving bookmark.');
    console.error(err);
  }
}

// â”€â”€â”€ TOAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2800);
}

// â”€â”€â”€ UTILITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
function escapeHTML(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return escapeHTML(str).replace(/"/g, '&quot;');
}

