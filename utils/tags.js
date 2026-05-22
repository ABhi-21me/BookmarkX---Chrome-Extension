const TagUtils = {
  async getAllMeta() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const meta = {};
        for (const [key, val] of Object.entries(items || {})) {
          if (key.startsWith("bx_meta_")) {
            meta[key.replace("bx_meta_", "")] = val;
          }
        }
        resolve(meta);
      });
    });
  },

  async getMeta(id) {
    return new Promise((resolve) => {
      chrome.storage.local.get(`bx_meta_${id}`, (items) => {
        resolve((items && items[`bx_meta_${id}`]) || {});
      });
    });
  },

  async setTags(id, tags) {
    const cleanTags = this.cleanTags(tags);
    const meta = await this.getMeta(id);
    const oldTags = meta.tags || [];
    meta.tags = cleanTags;
    await chrome.storage.local.set({ [`bx_meta_${id}`]: meta });
    await this.updateTagRegistry(oldTags, cleanTags);
  },

  async updateMeta(id, update) {
    const meta = await this.getMeta(id);
    await chrome.storage.local.set({ [`bx_meta_${id}`]: { ...meta, ...update } });
  },

  async deleteMeta(id) {
    const meta = await this.getMeta(id);
    if (meta.tags) {
      await this.updateTagRegistry(meta.tags, []);
    }
    await chrome.storage.local.remove(`bx_meta_${id}`);
  },

  async getTagRegistry() {
    return new Promise((resolve) => {
      chrome.storage.local.get("bx_tags", (items) => resolve((items && items.bx_tags) || {}));
    });
  },

  async updateTagRegistry(removedTags, addedTags) {
    const registry = await this.getTagRegistry();
    const colors = ["#00ff88", "#4ecdc4", "#ff6b6b", "#ffd93d", "#a78bfa", "#fb923c"];
    const removed = this.cleanTags(removedTags);
    const added = this.cleanTags(addedTags);

    for (const tag of removed) {
      if (registry[tag] && !added.includes(tag)) {
        registry[tag].count = Math.max(0, (registry[tag].count || 1) - 1);
        if (registry[tag].count === 0) {
          delete registry[tag];
        }
      }
    }

    for (const tag of added) {
      if (!removed.includes(tag)) {
        if (!registry[tag]) {
          registry[tag] = { color: colors[Object.keys(registry).length % colors.length], count: 1 };
        } else {
          registry[tag].count = (registry[tag].count || 0) + 1;
        }
      }
    }

    await chrome.storage.local.set({ bx_tags: registry });
  },

  cleanTags(tags) {
    return Array.from(new Set((tags || [])
      .map((tag) => String(tag).trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-"))
      .filter(Boolean)));
  }
};
