/* BookmarkX — Settings Page */

const PAGE_META = {
  appearance: { title: 'Appearance', desc: 'Customize how BookmarkX looks and feels' },
  data:       { title: 'Data & Backup', desc: 'Export, import, or reset your BookmarkX data' },
  about:      { title: 'About', desc: 'Version info and feature list' },
};

const THEMES = [
  { id: 'terminal',  label: 'Terminal',  bg: '#080808', surface: '#1a1a1a', accent: '#00ff88' },
  { id: 'midnight',  label: 'Midnight',  bg: '#0d1117', surface: '#21262d', accent: '#58a6ff' },
  { id: 'aurora',    label: 'Aurora',    bg: '#0f0c29', surface: '#251f55', accent: '#c084fc' },
  { id: 'sunset',    label: 'Sunset',    bg: '#0f0a00', surface: '#2a1c00', accent: '#fb923c' },
  { id: 'ice',       label: 'Ice',       bg: '#f0f4f8', surface: '#e8f0f7', accent: '#0ea5e9' },
  { id: 'rose',      label: 'Rose',      bg: '#0d0608', surface: '#241218', accent: '#f43f5e' },
  { id: 'ash',       label: 'Ash',       bg: '#18181b', surface: '#3f3f46', accent: '#e4e4e7' },
  { id: 'ocean',     label: 'Ocean',     bg: '#020617', surface: '#1e293b', accent: '#38bdf8' },
  { id: 'forest',    label: 'Forest',    bg: '#052e16', surface: '#065f46', accent: '#34d399' },
  { id: 'cyberpunk', label: 'Cyberpunk', bg: '#09090b', surface: '#27272a', accent: '#d946ef' },
  { id: 'dracula',   label: 'Dracula',   bg: '#282a36', surface: '#6272a4', accent: '#bd93f9' },
];

function buildThemeGrid(currentTheme) {
  const grid = document.getElementById('themeGrid');
  grid.innerHTML = '';

  THEMES.forEach(t => {
    const swatch = document.createElement('div');
    swatch.className = 'theme-swatch' + (t.id === currentTheme ? ' active' : '');
    swatch.dataset.theme = t.id;
    swatch.innerHTML = `
      <div class="swatch-preview" style="background:${t.bg}">
        <div class="swatch-bar" style="background:${t.accent}"></div>
        <div class="swatch-dot" style="background:${t.accent}"></div>
        <div class="swatch-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="10" height="10">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
      <div class="swatch-label">${t.label}</div>`;

    swatch.addEventListener('click', () => {
      document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      document.getElementById('selTheme').value = t.id;
      document.getElementById('selTheme').dispatchEvent(new Event('change'));
    });

    grid.appendChild(swatch);
  });
}

function showStatus(msg) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  text.textContent = msg;
  pill.style.opacity = '1';
  clearTimeout(pill._timeout);
  pill._timeout = setTimeout(() => { pill.style.opacity = '0.6'; }, 2500);
}

document.addEventListener('DOMContentLoaded', async () => {
  await ThemeUtils.init();
  await BackgroundUtils.init('bg-layer', 'bg-overlay');

  /* ── Navigation ─────────────────────────────────────────────────────── */
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`sec-${tab}`).classList.add('active');

      const meta = PAGE_META[tab] || {};
      document.getElementById('pageTitle').textContent = meta.title || btn.textContent.trim();
      document.getElementById('pageDesc').textContent = meta.desc || '';
    });
  });

  /* ── Load saved settings ────────────────────────────────────────────── */
  chrome.storage.local.get(['bx_v2_settings'], items => {
    const settings = items.bx_v2_settings || {};
    const savedTheme = settings.theme || 'terminal';

    document.getElementById('selTheme').value = savedTheme;
    buildThemeGrid(savedTheme);

    /* Theme via dropdown */
    document.getElementById('selTheme').addEventListener('change', e => {
      const theme = e.target.value;
      settings.theme = theme;

      ThemeUtils.applyTheme(theme);
      chrome.storage.local.set({ bx_v2_settings: settings, bx_theme: theme });

      // sync grid selection
      document.querySelectorAll('.theme-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.theme === theme);
      });

      showStatus('Theme saved');
    });
  });

  /* ── Export ─────────────────────────────────────────────────────────── */
  document.getElementById('btnExport').addEventListener('click', () => {
    chrome.storage.local.get(null, items => {
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarkx_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Backup exported');
    });
  });

  /* ── Import ─────────────────────────────────────────────────────────── */
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.storage.local.set(data, () => {
          showStatus('Import successful — please refresh');
          setTimeout(() => window.location.reload(), 1500);
        });
      } catch {
        showStatus('Error: invalid JSON file');
      }
    };
    reader.readAsText(file);
  });

  /* ── Reset ──────────────────────────────────────────────────────────── */
  document.getElementById('btnReset').addEventListener('click', () => {
    if (confirm('Reset all BookmarkX data? This cannot be undone.\n\nYour Chrome bookmarks will NOT be deleted.')) {
      chrome.storage.local.clear(() => {
        showStatus('Data reset — reloading…');
        setTimeout(() => window.location.reload(), 1000);
      });
    }
  });
});

function escapeHTML(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
