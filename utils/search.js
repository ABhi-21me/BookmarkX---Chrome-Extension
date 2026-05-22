const SearchUtils = {
  fuse: null,

  init(bookmarks, meta) {
    const data = bookmarks.map((bookmark) => ({
      ...bookmark,
      domain: (() => {
        try {
          return new URL(bookmark.url).hostname;
        } catch {
          return "";
        }
      })(),
      tags: ((meta && meta[bookmark.id] && meta[bookmark.id].tags) || []).join(" ")
    }));

    this.fuse = new Fuse(data, {
      keys: ["title", "url", "domain", "tags"],
      threshold: 0.3,
      includeScore: true,
      useExtendedSearch: false
    });
  },

  search(bookmarks, query, meta) {
    if (!query) {
      return bookmarks;
    }
    this.init(bookmarks, meta);
    return this.fuse.search(query).map((result) => result.item);
  }
};
