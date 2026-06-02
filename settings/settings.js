document.addEventListener('DOMContentLoaded', async () => {
  await ThemeUtils.init();
  await BackgroundUtils.init('bg-layer', 'bg-overlay');
  
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      
      btn.classList.add('active');
      const targetId = `sec-${btn.dataset.tab}`;
      document.getElementById(targetId).classList.add('active');
      document.getElementById('pageTitle').textContent = btn.textContent;
    });
  });

  // Load state
  chrome.storage.local.get(['bx_v2_settings'], async items => {
    const settings = items.bx_v2_settings || {};
    document.getElementById('selTheme').value = settings.theme || 'terminal';
    
    // Bind Theme
    document.getElementById('selTheme').addEventListener('change', e => {
      settings.theme = e.target.value;
      ThemeUtils.applyTheme(settings.theme);
      chrome.storage.local.set({ 
        bx_v2_settings: settings,
        bx_theme: settings.theme  // Keep legacy key in sync
      });
    });
  });

  // Export
  document.getElementById('btnExport').addEventListener('click', () => {
    chrome.storage.local.get(null, items => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items));
      const anchor = document.createElement('a');
      anchor.setAttribute("href", dataStr);
      anchor.setAttribute("download", "bookmarkx_backup.json");
      anchor.click();
    });
  });

  // Import
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('fileImport').click();
  });
  document.getElementById('fileImport').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target.result);
          chrome.storage.local.set(data, () => alert('Import successful. Please refresh the new tab.'));
        } catch (err) {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    }
  });

  // Reset
  document.getElementById('btnReset').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all extension data? This cannot be undone.')) {
      chrome.storage.local.clear(() => {
        alert('Extension data reset. Please refresh.');
        window.location.reload();
      });
    }
  });
});

function escapeHTML(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
