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

let state = {
  bookmarks: [],
  folders: [],
  tags: [],
  meta: {},
  isUIVisible: true,
  editingId: null,
  settings: {
    theme: 'terminal',
    accent: '#00ff88',
    font: 'dm-sans',
    bgType: 'solid',
    bgVal: '#080808',
    bgDarkness: 60,
    bgBlur: 0,
    cardStyle: 'glass',
    gridCols: 4,
    showFavicons: true,
    showUrl: true,
    showTags: true,
    showClockWidget: true
  }
};

// Chrome root folder IDs to hide from sidebar
const CHROME_ROOT_IDS = new Set(['0', '1', '2', '3']);
const CHROME_ROOT_TITLES = new Set(['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks', 'Managed bookmarks']);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await ThemeUtils.init();
  await BackgroundUtils.init('bg-layer', 'bg-overlay');
  await loadSettings();
  await loadData();
  bindEvents();
  applyAllSettings();
  renderAll();
}

// ─── STORAGE ──────────────────────────────────────────────────────────────

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['bx_v2_settings', 'bx_ui_visible'], items => {
      if (items.bx_v2_settings) {
        state.settings = { ...state.settings, ...items.bx_v2_settings };
      }
      if (items.bx_ui_visible !== undefined) state.isUIVisible = items.bx_ui_visible;
      resolve();
    });
  });
}

function saveSettings() {
  chrome.storage.local.set({
    bx_v2_settings: state.settings,
    bx_ui_visible: state.isUIVisible
  });
}

// ─── DATA LOADING ─────────────────────────────────────────────────────────

async function loadData() {
  const tree = await BookmarkUtils.getTree();
  const flat = BookmarkUtils.flattenTree(tree);
  state.bookmarks = flat.bookmarks;

  // Filter out Chrome's default root folders from sidebar — show only real user folders
  state.folders = flat.folders.filter(f => {
    if (CHROME_ROOT_IDS.has(f.id)) return false;
    if (CHROME_ROOT_TITLES.has(f.title)) return false;
    return true;
  });

  state.meta = await TagUtils.getAllMeta();

  // Extract tags
  const tagCounts = {};
  for (let id in state.meta) {
    (state.meta[id].tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  }
  state.tags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
}

// ─── EVENT BINDING ────────────────────────────────────────────────────────

function bindEvents() {
  const dockSettings = document.getElementById('dockSettings');

  document.addEventListener('keydown', e => {
    // Ignore when typing in inputs/textareas unless escaping
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
    saveSettings();
    applyAllSettings();
  });

  // Show/Hide UI toggle (Side Dock persistent toggle)
  document.getElementById('uiToggle').addEventListener('click', () => {
    state.isUIVisible = !state.isUIVisible;
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

  // Persistent Side Dock: Search Overlay Toggle
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
    // Reset bookmark cards filter
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

    const escapeHTML = str => (str || '').replace(/[&<>'"]/g, 
      tag => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        }[tag]));

    const matches = state.bookmarks.filter(b => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
    
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

  // Appearance Tabs
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      const section = document.querySelector(`.panel-section[data-psection="${tab.dataset.ptab}"]`);
      if (section) section.classList.add('active');
    });
  });

  // Theme
  document.getElementById('themeGrid').addEventListener('click', e => {
    const swatch = e.target.closest('.theme-swatch');
    if (swatch) {
      state.settings.theme = swatch.dataset.theme;
      ThemeUtils.applyTheme(state.settings.theme);
      syncAppearanceUI();
      saveSettings();
    }
  });

  document.getElementById('accentRow').addEventListener('click', e => {
    const circle = e.target.closest('.accent-circle');
    if (circle) {
      state.settings.accent = circle.dataset.color;
      ThemeUtils.applyAccent(state.settings.accent);
      syncAppearanceUI();
      saveSettings();
    }
  });

  document.querySelectorAll('[data-font]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.font = btn.dataset.font;
      ThemeUtils.applyFont(state.settings.font);
      syncAppearanceUI();
      saveSettings();
    });
  });

  // Background
  document.querySelectorAll('[data-bg]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.bgType = btn.dataset.bg;
      if (state.settings.bgType === 'solid') state.settings.bgVal = '#080808';
      BackgroundUtils.apply(state.settings.bgType, state.settings.bgVal);
      syncAppearanceUI();
      saveSettings();
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
        saveSettings();
      };
      reader.readAsDataURL(file);
    }
  });

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
          state.settings.bgVal = ''; // handled via IDB now
          BackgroundUtils.apply('video', '');
          saveSettings();
          const nameEl = document.getElementById('videoWallpaperName');
          if (nameEl) nameEl.textContent = file.name;
          showToast('Video saved successfully!');
        }).catch(err => {
          console.error(err);
          showToast('Failed to save video.', true);
        });
      }
    });
  }

  document.getElementById('darknessSlider').addEventListener('input', e => {
    state.settings.bgDarkness = parseInt(e.target.value);
    document.getElementById('darknessVal').textContent = `${state.settings.bgDarkness}%`;
    BackgroundUtils.applyOverlay(state.settings.bgDarkness, state.settings.bgBlur);
    saveSettings();
  });

  document.getElementById('blurSlider').addEventListener('input', e => {
    state.settings.bgBlur = parseInt(e.target.value);
    document.getElementById('blurVal').textContent = `${state.settings.bgBlur}px`;
    BackgroundUtils.applyOverlay(state.settings.bgDarkness, state.settings.bgBlur);
    saveSettings();
  });

  // Layout
  document.querySelectorAll('[data-cardstyle]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.cardStyle = btn.dataset.cardstyle;
      document.body.setAttribute('data-cardstyle', state.settings.cardStyle || 'glass');
      saveSettings();
    });
  });

  document.getElementById('columnsSlider').addEventListener('input', e => {
    state.settings.gridCols = parseInt(e.target.value);
    document.documentElement.style.setProperty('--grid-cols', state.settings.gridCols);
    document.getElementById('columnsVal').textContent = `${state.settings.gridCols} columns`;
    saveSettings();
  });

  ['clockToggle', 'faviconToggle', 'urlToggle', 'tagsVisToggle'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', e => {
        const toggle = e.currentTarget;
        toggle.classList.toggle('active');
        const isOn = toggle.classList.contains('active');
        if (id === 'faviconToggle') state.settings.showFavicons = isOn;
        if (id === 'urlToggle') state.settings.showUrl = isOn;
        if (id === 'tagsVisToggle') state.settings.showTags = isOn;
        if (id === 'clockToggle') {
          state.settings.showClockWidget = isOn;
          applyAllSettings();
        }
        if (id !== 'clockToggle') renderBoard();
        saveSettings();
      });
    }
  });

  // Data Tab Event Listeners
  const exportBtn = document.getElementById('exportBookmarksBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = {
        bookmarks: state.bookmarks,
        settings: state.settings,
        meta: state.meta
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
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          if (data && data.bookmarks) {
            state.bookmarks = data.bookmarks;
            if (data.settings) state.settings = { ...state.settings, ...data.settings };
            saveBookmarks();
            saveSettings();
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
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeModal);

  // Save bookmark from modal
  document.getElementById('saveModalBtn').addEventListener('click', saveBookmarkFromModal);

  // Tag input in modal — press Enter to add tag
  document.getElementById('bm-tag-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim().replace(/^#/, '');
      if (val) {
        addTagToModal(val);
        e.target.value = '';
      }
    }
  });
}

// ─── APPLY FUNCTIONS ──────────────────────────────────────────────────────

function applyAllSettings() {
  ThemeUtils.applyTheme(state.settings.theme);
  ThemeUtils.applyAccent(state.settings.accent);
  ThemeUtils.applyFont(state.settings.font);
  BackgroundUtils.apply(state.settings.bgType, state.settings.bgVal);
  BackgroundUtils.applyOverlay(state.settings.bgDarkness, state.settings.bgBlur);
  document.body.setAttribute('data-cardstyle', state.settings.cardStyle);
  document.documentElement.style.setProperty('--grid-cols', state.settings.gridCols);
  applyUIVisibility();
  
  // Clock Visibility
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

  if (state.isUIVisible) {
    if (bookmarkGrid) {
      bookmarkGrid.style.opacity = '1';
      bookmarkGrid.style.pointerEvents = '';
      bookmarkGrid.style.display = '';
    }
    // We don't mess with emptyState display here unless it's needed, but let's let renderBookmarks handle it.
    // However, if we hid it, we must ensure it's not permanently 'none'.
    // The renderBookmarks() function correctly adds/removes 'hidden' class.
    // We just need to make sure we don't override its inline display too heavily, so we clear it.
    if (emptyState) {
      emptyState.style.opacity = '1';
      emptyState.style.pointerEvents = '';
      emptyState.style.display = '';
    }

    if (uiToggle) uiToggle.classList.add('active');
    if (iconEye) iconEye.classList.remove('hidden');
    if (iconEyeOff) iconEyeOff.classList.add('hidden');
  } else {
    if (bookmarkGrid) bookmarkGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';

    if (uiToggle) uiToggle.classList.remove('active');
    if (iconEye) iconEye.classList.add('hidden');
    if (iconEyeOff) iconEyeOff.classList.remove('hidden');
  }
}



function syncAppearanceUI() {
  // Theme swatches
  document.querySelectorAll('.theme-swatch').forEach(el =>
    el.classList.toggle('active', el.dataset.theme === state.settings.theme));
  document.querySelectorAll('.accent-circle').forEach(el =>
    el.classList.toggle('active', el.dataset.color === state.settings.accent));
  document.querySelectorAll('[data-font]').forEach(el =>
    el.classList.toggle('active', el.dataset.font === state.settings.font));

  // Background
  document.querySelectorAll('[data-bg]').forEach(el =>
    el.classList.toggle('active', el.dataset.bg === state.settings.bgType));
  document.getElementById('imageUpload').classList.toggle('hidden', state.settings.bgType !== 'image');
  document.getElementById('videoUpload').classList.toggle('hidden', state.settings.bgType !== 'video');
  document.getElementById('darknessSlider').value = state.settings.bgDarkness;
  document.getElementById('darknessVal').textContent = `${state.settings.bgDarkness}%`;
  document.getElementById('blurSlider').value = state.settings.bgBlur;
  document.getElementById('blurVal').textContent = `${state.settings.bgBlur}px`;

  // Layout
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
  const tagToggle = document.getElementById('tagsVisToggle');
  if (tagToggle) tagToggle.classList.toggle('active', state.settings.showTags !== false);
}

// ─── RENDER ───────────────────────────────────────────────────────────────

function renderAll() {
  renderBoard();
}

function renderBoard() {
  const grid = document.getElementById('bookmarkGrid');
  const empty = document.getElementById('emptyState');

  const bms = state.bookmarks;

  if (bms.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  grid.innerHTML = bms.map(b => renderCard(b)).join('');
}

function renderCard(b) {
  const domain = getDomain(b.url);
  const m = state.meta[b.id] || {};

  const tagsHtml = (state.settings.showTags && m.tags && m.tags.length)
    ? `<div class="card-tags">${m.tags.slice(0, 3).map(t => `<span class="card-tag">#${escapeHTML(t)}</span>`).join('')}</div>`
    : '';

  const favHtml = state.settings.showFavicons
    ? `<img src="https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}" class="card-favicon" onerror="this.style.display='none'">`
    : '';

  return `
    <a href="${escapeAttr(b.url)}" class="bm-card" data-bid="${b.id}">
      <div class="card-header">
        ${favHtml}
        <div class="card-title">${escapeHTML(b.title || domain)}</div>
      </div>
      ${state.settings.showUrl ? `<div class="card-domain">${escapeHTML(domain)}</div>` : ''}
      ${tagsHtml}
    </a>
  `;
}

// ─── MODAL (Add / Edit Bookmark) ──────────────────────────────────────────

let _modalTags = [];

function openModal(bookmarkId) {
  state.editingId = bookmarkId || null;
  _modalTags = [];
  document.getElementById('bm-url').value = '';
  document.getElementById('bm-title').value = '';
  document.getElementById('bm-tag-input').value = '';
  document.getElementById('bm-selected-tags').innerHTML = '';
  document.getElementById('modalHeading').textContent = bookmarkId ? 'Edit Bookmark' : 'Add Bookmark';

  // Populate folders
  const folderSelect = document.getElementById('bm-folder');
  folderSelect.innerHTML = '';
  state.folders.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.title;
    if (f.id === state.activeFolder) opt.selected = true;
    folderSelect.appendChild(opt);
  });
  // Default: first available folder (bookmarks bar)
  if (!folderSelect.value && state.folders.length > 0) {
    folderSelect.value = state.folders[0].id;
  }

  // If editing, prefill
  if (bookmarkId) {
    const bm = state.bookmarks.find(b => b.id === bookmarkId);
    if (bm) {
      document.getElementById('bm-url').value = bm.url;
      document.getElementById('bm-title').value = bm.title;
      folderSelect.value = bm.parentId;
    }
    const m = state.meta[bookmarkId] || {};
    _modalTags = [...(m.tags || [])];
    renderModalTags();
  }

  document.getElementById('bookmarkModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('bm-url').focus(), 50);
}

function closeModal() {
  document.getElementById('bookmarkModal').classList.add('hidden');
  state.editingId = null;
  _modalTags = [];
}

function addTagToModal(tag) {
  if (!_modalTags.includes(tag)) {
    _modalTags.push(tag);
    renderModalTags();
  }
}

function renderModalTags() {
  const container = document.getElementById('bm-selected-tags');
  container.innerHTML = _modalTags.map(t =>
    `<span class="selected-tag">#${escapeHTML(t)}<button class="remove-tag" data-tag="${escapeAttr(t)}">×</button></span>`
  ).join('');
  container.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      _modalTags = _modalTags.filter(t => t !== btn.dataset.tag);
      renderModalTags();
    });
  });
}

async function saveBookmarkFromModal() {
  const url = document.getElementById('bm-url').value.trim();
  const title = document.getElementById('bm-title').value.trim();
  const folderId = document.getElementById('bm-folder').value;

  if (!url) {
    document.getElementById('bm-url').focus();
    return;
  }

  try {
    let bookmarkId = state.editingId;

    if (bookmarkId) {
      // Editing existing
      await BookmarkUtils.update(bookmarkId, { title, url });
    } else {
      // Creating new
      const created = await BookmarkUtils.create({ parentId: folderId, title: title || url, url });
      bookmarkId = created.id;
    }

    // Save tags via TagUtils.setTags (the correct API)
    if (_modalTags.length > 0 || bookmarkId) {
      await TagUtils.setTags(bookmarkId, _modalTags);
    }

    closeModal();
    await loadData();
    renderAll();
    showToast(state.editingId ? 'Bookmark updated!' : 'Bookmark saved!');
  } catch (err) {
    showToast('Error saving bookmark.');
    console.error(err);
  }
}

// ─── TOAST ────────────────────────────────────────────────────────────────

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ─── UTILITIES ────────────────────────────────────────────────────────────

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; }
}
function escapeHTML(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(str) {
  return escapeHTML(str).replace(/"/g, '&quot;');
}
