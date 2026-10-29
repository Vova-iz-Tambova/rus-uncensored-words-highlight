importScripts('patterns.js');

function _bgStorageSet(data, callback) {
  chrome.storage.local.set(data, () => {
    void chrome.runtime.lastError;
    chrome.storage.sync.set(data, () => {
      // sync может упасть (квота 8КБ и т.п.) — это не критично, local уже записан
      void chrome.runtime.lastError;
      if (callback) callback();
    });
  });
}

function _bgStorageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      if (Object.keys(result).length > 0) {
        resolve(result);
      } else {
        chrome.storage.sync.get(keys, resolve);
      }
    });
  });
}

const DEFAULT_LISTS = [
  { id: 'profanity', name: 'Русский мат', color: '#ff0', textColor: '#000', type: 'builtin', style: 'marker', enabled: true }
];

let recreateTimer = null;
let lastMenuSignature = null;
let menusBuilding = false;
let rebuildQueued = false;

function buildMenusNow(lists) {
  menusBuilding = true;
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
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
    menusBuilding = false;
    if (rebuildQueued) {
      rebuildQueued = false;
      recreateMenus(lists, true);
    }
  });
}

function recreateMenus(lists, force) {
  // Пересоздаём меню только когда реально изменился состав кастомных списков.
  // Это убирает гонку removeAll/create при каждом добавлении слова,
  // из-за которой пункты меню временно пропадали.
  const signature = (lists || [])
    .filter(l => l.type === 'custom' || l.type === 'file')
    .map(l => l.id + ':' + l.name)
    .sort()
    .join('|');
  if (!force && signature === lastMenuSignature) return;
  lastMenuSignature = signature;
  if (menusBuilding) { rebuildQueued = true; return; }
  if (recreateTimer) clearTimeout(recreateTimer);
  recreateTimer = setTimeout(() => {
    recreateTimer = null;
    buildMenusNow(lists);
  }, 50);
}

function init() {
  _bgStorageGet(['lists', 'disabledSites']).then(data => {
    if (!data.disabledSites) {
      _bgStorageSet({ disabledSites: ['*.avito.ru'] });
    }
    if (!data.lists) {
      _bgStorageSet({ lists: DEFAULT_LISTS });
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
      _bgStorageSet({ lists: merged });
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
    _bgStorageGet('lists').then(data => {
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
              }, () => { void chrome.runtime.lastError; });
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

  _bgStorageGet('lists').then(data => {
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

    _bgStorageSet({ lists }, () => {
      // Сразу уведомляем таб, чтобы слово подсветилось без ожидания storage-событий
      if (tab && tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { action: 'listsUpdated' }, () => { void chrome.runtime.lastError; });
      }
      // Обновляем префиксы пунктов меню (−, >, +) для текущего слова
      _bgStorageGet('lists').then(d => recreateMenus(d.lists, false));
    });
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'local' || area === 'sync') && changes.lists) {
    // local — основной источник (sync может не записаться из-за квоты)
    if (area === 'local') {
      recreateMenus(changes.lists.newValue);
    } else {
      // sync-событие: актуально для данных, пришедших с другого устройства
      _bgStorageGet('lists').then(d => recreateMenus(d.lists));
    }
  }
});
