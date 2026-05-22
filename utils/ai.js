const AIUtils = {
  apiKey: null,

  async getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get('bx_claude_key', (items) => {
        this.apiKey = (items && items.bx_claude_key) || null;
        resolve(this.apiKey);
      });
    });
  },

  async suggestTags(title, url) {
    if (!this.apiKey) throw new Error('No API key set');
    const prompt = `Given this bookmark:\nTitle: ${title}\nURL: ${url}\n\nSuggest 3-5 relevant lowercase tags (single words or hyphenated). Reply ONLY with a JSON array of strings, e.g. ["tag1","tag2"].`;
    const body = JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    const text = data.content && data.content[0] && data.content[0].text;
    const match = text && text.match(/\[.*?\]/s);
    return match ? JSON.parse(match[0]) : [];
  },

  suggestLocalTags(title = '', url = '') {
    const text = `${title} ${url}`.toLowerCase();
    const rules = [
      { pattern: /github|gitlab|bitbucket|npm|pypi|crates\.io/, tags: ['dev', 'code'] },
      { pattern: /youtube|vimeo|twitch|video|watch/, tags: ['video'] },
      { pattern: /spotify|soundcloud|music|podcast|listen/, tags: ['audio'] },
      { pattern: /figma|dribbble|behance|design|ux|ui/, tags: ['design'] },
      { pattern: /medium|substack|blog|article|post|newsletter/, tags: ['reading'] },
      { pattern: /twitter|x\.com|reddit|hacker.news|news/, tags: ['social'] },
      { pattern: /docs|documentation|wiki|readme|guide|tutorial/, tags: ['docs'] },
      { pattern: /notion|trello|asana|jira|linear|todo|task/, tags: ['productivity'] },
      { pattern: /amazon|ebay|etsy|shop|store|buy|product/, tags: ['shopping'] },
      { pattern: /course|learn|tutorial|udemy|coursera|pluralsight/, tags: ['learning'] },
      { pattern: /tool|utility|app|software|extension/, tags: ['tool'] },
      { pattern: /research|paper|arxiv|science|study/, tags: ['research'] },
      { pattern: /recipe|food|cook|restaurant|meal/, tags: ['food'] },
      { pattern: /travel|hotel|flight|booking/, tags: ['travel'] },
      { pattern: /finance|invest|stock|crypto|bank/, tags: ['finance'] },
      { pattern: /ai|machine.learning|llm|openai|anthropic|gpt|gemini/, tags: ['ai'] },
      { pattern: /health|fitness|workout|exercise|medical/, tags: ['health'] },
    ];
    const found = new Set();
    for (const rule of rules) {
      if (rule.pattern.test(text)) {
        for (const tag of rule.tags) found.add(tag);
      }
    }
    return Array.from(found).slice(0, 4);
  }
};
