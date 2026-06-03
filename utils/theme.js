const ThemeUtils = {
  async init() {
    return new Promise(resolve => {
      chrome.storage.local.get(['bx_v2_settings', 'bx_theme', 'bx_accent'], items => {
        const s = items.bx_v2_settings || {};
        // Prefer unified settings, fall back to legacy keys
        const theme = s.theme || items.bx_theme || 'terminal';
        const accent = s.accent || items.bx_accent || null;
        this.applyTheme(theme);
        this.applyAccent(accent);
        resolve();
      });
    });
  },

  applyTheme(theme) {
    document.body.setAttribute('data-theme', theme || 'terminal');
  },

  applyFont(font) {
    if (font) {
      document.body.setAttribute('data-font', font);
    }
  },

  isValidHex(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color);
  },

  applyAccent(color) {
    if (!color) {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-hover');
      document.documentElement.style.removeProperty('--accent-bg');
      document.documentElement.style.removeProperty('--accent-glow');
      return;
    }

    // Validate hex color format: must be #RRGGBB
    if (!this.isValidHex(color)) {
      console.warn('[BookmarkX] Invalid accent color format:', color, '— expected #RRGGBB');
      return;
    }

    document.documentElement.style.setProperty('--accent', color);
    
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    document.documentElement.style.setProperty('--accent-hover', color);
    document.documentElement.style.setProperty('--accent-bg', `rgba(${r},${g},${b},0.1)`);
    document.documentElement.style.setProperty('--accent-glow', `0 0 24px rgba(${r},${g},${b},0.35)`);
  }
};
