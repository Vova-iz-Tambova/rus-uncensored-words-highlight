const DEFAULT_LISTS = [
  { id: 'profanity', name: 'Русский мат', color: '#ff0', textColor: '#000', type: 'builtin', style: 'marker', enabled: true }
];

function recreateMenus(lists) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'addWord',
      title: 'Подсветить слово',
      contexts: ['selection']
    });
    for (const list of lists) {
      if (list.type === 'custom' || list.type === 'file' || list.type === 'builtin') {
        chrome.contextMenus.create({
          id: list.id,
          parentId: 'addWord',
          title: list.name,
          contexts: ['selection']
        });
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason !== 'install') return;
  chrome.storage.local.get('lists').then(data => {
    if (!data.lists) {
      chrome.storage.local.set({ lists: DEFAULT_LISTS });
      recreateMenus(DEFAULT_LISTS);
    } else {
      const merged = DEFAULT_LISTS.map(def => {
        const old = data.lists.find(l => l.id === def.id);
        if (!old) return def;
        return {
          ...def,
          words: old.words || def.words,
          matchInside: old.matchInside !== undefined ? old.matchInside : def.matchInside,
          enabled: old.enabled !== undefined ? old.enabled : def.enabled
        };
      });
      for (const old of data.lists) {
        if (!merged.some(m => m.id === old.id)) {
          merged.push(old);
        }
      }
      chrome.storage.local.set({ lists: merged });
      recreateMenus(merged);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'updateTitles') {
    const word = message.word;
    if (!word) return;
    chrome.storage.local.get('lists').then(data => {
      const lists = data.lists || [];
      const lower = word.toLowerCase();
      const wordLists = lists.filter(l => l.type === 'custom' || l.type === 'file' || l.type === 'builtin');
      const inAny = wordLists.some(l => l.words && l.words.some(w => w.toLowerCase() === lower));

      for (const list of wordLists) {
        const inThis = list.words && list.words.some(w => w.toLowerCase() === lower);
        const prefix = inThis ? '−' : inAny ? '>' : '+';
        chrome.contextMenus.update(list.id, {
          title: `${prefix} ${list.name}`
        }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
      }
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.parentMenuItemId !== 'addWord') return;
  const word = info.selectionText.trim();
  if (!word) return;

  chrome.storage.local.get('lists').then(data => {
    const lists = data.lists || [];
    const target = lists.find(l => l.id === info.menuItemId);
    if (!target || (target.type !== 'custom' && target.type !== 'file' && target.type !== 'builtin')) return;

    const lower = word.toLowerCase();
    const inTarget = target.words && target.words.some(w => w.toLowerCase() === lower);

    if (inTarget) {
      const idx = target.words.findIndex(w => w.toLowerCase() === lower);
      target.words.splice(idx, 1);
    } else {
      const inOther = lists.some(l => (l.type === 'custom' || l.type === 'file' || l.type === 'builtin') && l.id !== target.id && l.words && l.words.some(w => w.toLowerCase() === lower));
      if (inOther) {
        for (const list of lists) {
          if (list.type !== 'custom' && list.type !== 'file' && list.type !== 'builtin') continue;
          if (!list.words) continue;
          const idx = list.words.findIndex(w => w.toLowerCase() === lower);
          if (idx !== -1) list.words.splice(idx, 1);
        }
      }
      target.words.push(word);
    }

    chrome.storage.local.set({ lists });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.lists) {
    recreateMenus(changes.lists.newValue);
  }
});
