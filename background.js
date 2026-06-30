importScripts('patterns.js');

const DEFAULT_LISTS = [
  { id: 'profanity', name: 'Русский мат', color: '#ff0', textColor: '#000', type: 'builtin', style: 'marker', enabled: true }
];

let recreateTimer = null;

function recreateMenus(lists) {
  if (recreateTimer) clearTimeout(recreateTimer);
  recreateTimer = setTimeout(() => {
    recreateTimer = null;
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'addWord',
        title: 'Подсветить слово',
        contexts: ['selection']
      }, () => { void chrome.runtime.lastError; });
      for (const list of lists) {
        if (list.type === 'custom' || list.type === 'file') {
          chrome.contextMenus.create({
            id: list.id,
            parentId: 'addWord',
            title: '+ ' + list.name,
            contexts: ['selection']
          }, () => { void chrome.runtime.lastError; });
        }
      }
    });
  }, 50);
}

function init() {
  chrome.storage.local.get(['lists', 'disabledSites']).then(data => {
    if (!data.disabledSites) {
      chrome.storage.local.set({ disabledSites: ['*.avito.ru'] });
    }
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
}

chrome.runtime.onInstalled.addListener(() => init());
chrome.runtime.onStartup.addListener(() => init());

function removeDiacritics(str) {
  return str.replace(/[\u0300-\u036f]/g, '');
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'updateTitles') {
    const word = message.word;
    if (!word) return;
    chrome.storage.local.get('lists').then(data => {
      const lists = data.lists || [];
      const wordLists = lists.filter(l => l.type === 'custom' || l.type === 'file');
      const lower = word.toLowerCase();

      let matchesBuiltin = false;
      try {
        regex.lastIndex = 0;
        const clean = removeDiacritics(word);
        matchesBuiltin = regex.test(' ' + clean + ' .,!?');
      } catch (e) { /* regex unavailable */ }

      if (matchesBuiltin) {
        for (const list of wordLists) {
          chrome.contextMenus.remove(list.id, () => { if (chrome.runtime.lastError) { /* ignore */ } });
        }
        chrome.contextMenus.create({
          id: 'profanity',
          parentId: 'addWord',
          title: '= Русский мат',
          contexts: ['selection']
        }, () => { if (chrome.runtime.lastError) { /* ignore */ } });
      } else {
        chrome.contextMenus.remove('profanity', () => { if (chrome.runtime.lastError) { /* ignore */ } });
        const inCount = wordLists.filter(l => l.words && l.words.some(w => w.toLowerCase() === lower)).length;
        for (const list of wordLists) {
          const inThis = list.words && list.words.some(w => w.toLowerCase() === lower);
          const prefix = inThis ? '−' : inCount === 1 ? '>' : '+';
          chrome.contextMenus.update(list.id, {
            title: `${prefix} ${list.name}`
          }, () => {
            if (chrome.runtime.lastError) {
              chrome.contextMenus.create({
                id: list.id,
                parentId: 'addWord',
                title: `${prefix} ${list.name}`,
                contexts: ['selection']
              });
            }
          });
        }
      }
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.parentMenuItemId !== 'addWord') return;
  if (info.menuItemId === 'profanity') return;
  const word = info.selectionText.trim();
  if (!word) return;

  chrome.storage.local.get('lists').then(data => {
    const lists = data.lists || [];
    const target = lists.find(l => l.id === info.menuItemId);
    if (!target || (target.type !== 'custom' && target.type !== 'file')) return;

    const lower = word.toLowerCase();
    const inTarget = target.words && target.words.some(w => w.toLowerCase() === lower);

    if (inTarget) {
      const idx = target.words.findIndex(w => w.toLowerCase() === lower);
      target.words.splice(idx, 1);
    } else {
      const inOther = lists.some(l => (l.type === 'custom' || l.type === 'file') && l.id !== target.id && l.words && l.words.some(w => w.toLowerCase() === lower));
      if (inOther) {
        for (const list of lists) {
          if (list.type !== 'custom' && list.type !== 'file') continue;
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
