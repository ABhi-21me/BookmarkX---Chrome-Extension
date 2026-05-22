document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('powerToggle');
  const statusText = document.getElementById('statusText');

  // Load state
  chrome.storage.local.get(['extensionEnabled'], (result) => {
    // Default to true if undefined
    const isEnabled = result.extensionEnabled !== false;
    toggle.checked = isEnabled;
    statusText.textContent = isEnabled ? 'ON' : 'OFF';
    statusText.style.color = isEnabled ? 'var(--text)' : 'var(--text-muted)';
  });

  // Save state
  toggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ extensionEnabled: isEnabled });
    statusText.textContent = isEnabled ? 'ON' : 'OFF';
    statusText.style.color = isEnabled ? 'var(--text)' : 'var(--text-muted)';
  });
});
