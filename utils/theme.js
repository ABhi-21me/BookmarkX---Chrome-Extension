const ThemeUtils = {
  async init() {
    return new Promise(resolve => {
      chrome.storage.local.get(['bx_theme', 'bx_accent'], items => {
        this.applyTheme(items.bx_theme || 'terminal');
        this.applyAccent(items.bx_accent || null);
        resolve();
      });
    });
  },

  applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
  },

  applyAccent(color) {
    if (!color) {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-hover');
      document.documentElement.style.removeProperty('--accent-bg');
      document.documentElement.style.removeProperty('--accent-glow');
      return;
    }
    document.documentElement.style.setProperty('--accent', color);
    
    // Auto-calculate glow and bg if possible
    const r = parseInt(color.slice(1, 3), 16) || 0;
    const g = parseInt(color.slice(3, 5), 16) || 0;
    const b = parseInt(color.slice(5, 7), 16) || 0;
    
    document.documentElement.style.setProperty('--accent-hover', color);
    document.documentElement.style.setProperty('--accent-bg', `rgba(${r},${g},${b},0.1)`);
    document.documentElement.style.setProperty('--accent-glow', `0 0 24px rgba(${r},${g},${b},0.35)`);
  }
};
