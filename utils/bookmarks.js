const BookmarkUtils = {
  async getTree() {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((tree) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(tree);
      });
    });
  },

  async getCurrentTabBookmarkDraft() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (chrome.runtime.lastError || !tab || !tab.url || tab.url.startsWith("chrome://")) {
          resolve(null);
          return;
        }
        resolve({ title: tab.title || tab.url, url: tab.url });
      });
    });
  },

  flattenTree(tree) {
    const bookmarks = [];
    const folders = [];

    function walk(nodes, depth) {
      for (const node of nodes) {
        if (node.url) {
          bookmarks.push(node);
        } else {
          folders.push({ ...node, depth });
          if (node.children) {
            walk(node.children, depth + 1);
          }
        }
      }
    }

    walk(tree, 0);
    return { bookmarks, folders };
  },

  descendantsByFolder(tree) {
    const map = {};

    function walk(node) {
      if (!node.url) {
        const ids = [];
        for (const child of node.children || []) {
          if (child.url) {
            ids.push(child.id);
          } else {
            ids.push(...walk(child));
          }
        }
        map[node.id] = ids;
        return ids;
      }
      return [node.id];
    }

    for (const root of tree) {
      walk(root);
    }

    return map;
  },

  async create(bookmark) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(bookmark, (node) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(node);
      });
    });
  },

  async update(id, update) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.update(id, update, (node) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(node);
      });
    });
  },

  async move(id, destination) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(id, destination, (node) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(node);
      });
    });
  },

  async remove(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
  }
};
