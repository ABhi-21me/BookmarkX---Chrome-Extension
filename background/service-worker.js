chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#ff4444" });
});

chrome.bookmarks.onRemoved.addListener((id) => {
  const key = `bx_meta_${id}`;
  chrome.storage.local.get([key, "bx_tags"], (items) => {
    const meta = items[key] || {};
    const registry = items.bx_tags || {};
    for (const tag of meta.tags || []) {
      if (registry[tag]) {
        registry[tag].count = Math.max(0, (registry[tag].count || 1) - 1);
        if (registry[tag].count === 0) {
          delete registry[tag];
        }
      }
    }
    chrome.storage.local.set({ bx_tags: registry }, () => chrome.storage.local.remove(key));
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "SET_BROKEN_COUNT") {
    const count = Number(msg.count || 0);
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    sendResponse({ ok: true });
    return false;
  }

  if (msg && msg.type === "CHECK_LINKS") {
    sendResponse({ status: "open-popup" });
    return false;
  }

  return false;
});
