(function () {
  'use strict';

  // Флаг «мёртвого» контекста: после перезагрузки/обновления расширения
  // старый content script остаётся на странице, но chrome.* API больше не работает
  let dead = false;

  function isContextAlive() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Однократная деактивация: снять подсветку, отключить observer/интервал,
  // чтобы старый скрипт больше не трогал страницу и не бросал ошибок
  function handleInvalidContext() {
    if (dead) return;
    dead = true;
    try {
      stopWatching();
      const style = document.getElementById('highlight-style');
      if (style && style.isConnected) style.remove();
    } catch (e) { /* контекст мёртв — тишина */ }
  }

  function _storageSet(data, callback) {
    if (dead || !isContextAlive()) { handleInvalidContext(); return; }
    try {
      chrome.storage.local.set(data, () => {
        void chrome.runtime.lastError;
        chrome.storage.sync.set(data, () => {
          // sync может не записаться (квота) — local уже сохранён, это нормально
          void chrome.runtime.lastError;
          if (callback) callback();
        });
      });
    } catch (e) {
      handleInvalidContext();
    }
  }

  function _storageGet(keys) {
    return new Promise((resolve) => {
      if (dead || !isContextAlive()) { handleInvalidContext(); resolve({}); return; }
      try {
        chrome.storage.local.get(keys, (result) => {
          if (Object.keys(result).length > 0) {
            resolve(result);
          } else {
            chrome.storage.sync.get(keys, resolve);
          }
        });
      } catch (e) {
        handleInvalidContext();
        resolve({});
      }
    });
  }

  const styleHost = document.head || document.documentElement;
  if (styleHost && !document.getElementById('highlight-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-style';
    style.textContent = '.hl-w { white-space: nowrap !important; padding: 0 !important; margin: 0 !important; }';
    styleHost.appendChild(style);
  }

  let activeLists = [];
  let customRegexCache = {};
  const trackedWrappers = new Set();

  function isForeignHighlight(element) {
    if (!element) return false;
    let el = element;
    while (el && el !== document.body) {
      if (el.classList) {
        if ((el.classList.contains('Highlight') || el.hasAttribute('highlight')) &&
          !el.classList.contains('hl-yellow')) {
          return true;
        }
      }
      if (el.tagName === 'EM' && el.hasAttribute('highlight') && !el.classList.contains('hl-yellow')) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function isOurHighlight(element) {
    if (!element) return false;
    let el = element;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('hl-ext')) return true;
      el = el.parentNode;
    }
    return false;
  }

  function hasActiveCustomLists() {
    return activeLists.some(l => l.type === 'custom' || l.type === 'file');
  }

  function isSiteDisabled(disabledSites) {
    if (!disabledSites || disabledSites.length === 0) return false;
    const hostname = window.location.hostname.toLowerCase();
    return disabledSites.some(pattern => {
      pattern = pattern.toLowerCase().trim();
      if (!pattern) return false;
      const regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      try {
        return new RegExp(regexStr).test(hostname);
      } catch (e) {
        return false;
      }
    });
  }

  function compileCustomWordsRegex(words, matchInside) {
    const filtered = words.map(w => w.trim()).filter(w => w);
    if (filtered.length === 0) return null;
    const partial = [];
    const exact = [];
    for (const w of filtered) {
      const key = w.toLowerCase();
      if (matchInside && matchInside[key] === false) {
        exact.push(w);
      } else {
        partial.push(w);
      }
    }
    function esc(w) {
      return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const parts = [];
    if (partial.length) parts.push(partial.map(esc).join('|'));
    if (exact.length) parts.push('(?<![\\p{L}])(' + exact.map(esc).join('|') + ')(?![\\p{L}])');
    if (parts.length === 0) return null;
    return new RegExp(parts.join('|'), 'giu');
  }

  function compilePatternSource(source) {
    try {
      const fn = new Function(source + '\nreturn regex;');
      const result = fn();
      if (result instanceof RegExp) return result;
    } catch (e) {}
    return null;
  }

  function buildActiveLists(lists) {
    activeLists = [];
    customRegexCache = {};
    for (const list of lists) {
      if (list.enabled === false) continue;
      if (list.type === 'custom' || list.type === 'file') {
        customRegexCache[list.id] = compileCustomWordsRegex(list.words, list.matchInside);
        activeLists.push(list);
      } else if (list.type === 'pattern') {
        customRegexCache[list.id] = compilePatternSource(list.patternSource);
        activeLists.push(list);
      } else if (list.type === 'builtin') {
        if (list.words && list.words.length) {
          customRegexCache[list.id] = compileCustomWordsRegex(list.words, list.matchInside);
        } else {
          customRegexCache[list.id] = regex;
        }
        activeLists.push(list);
      }
    }
    activeLists.sort((a, b) => {
      const prio = { pattern: 0, custom: 1, file: 1, builtin: 2 };
      return (prio[a.type] || 9) - (prio[b.type] || 9);
    });
  }

  function getListMatches(text, list) {
    const re = customRegexCache[list.id];
    if (!re) return [];
    re.lastIndex = 0;
    const matches = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
    }
    return matches;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightNode(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    if (!node.textContent || !node.parentNode) return;

    let el = node.parentNode;
    while (el && el !== document.body) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      el = el.parentNode;
    }

    const text = node.textContent;
    if (/^[0-9a-fA-F]{32}$/.test(text.trim())) return;

    const allMatches = [];
    for (const list of activeLists) {
      for (const m of getListMatches(text, list)) {
        allMatches.push({ start: m.start, end: m.end, list });
      }
    }
    if (allMatches.length === 0) return;

    allMatches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const aPrio = (a.list.type === 'custom' || a.list.type === 'file') ? 0 : (a.list.type === 'builtin' ? 1 : 2);
      const bPrio = (b.list.type === 'custom' || b.list.type === 'file') ? 0 : (b.list.type === 'builtin' ? 1 : 2);
      return aPrio - bPrio;
    });

    const claimed = new Array(text.length).fill(null);
    for (const m of allMatches) {
      for (let i = m.start; i < Math.min(m.end, text.length); i++) {
        if (claimed[i] === null) claimed[i] = m.list;
      }
    }

    let result = '';
    let i = 0;
    while (i < text.length) {
      const list = claimed[i];
      let j = i;
      while (j < text.length && claimed[j] === list) j++;
      const chunk = escapeHtml(text.substring(i, j));
      if (list) {
        if (list.style === 'text') {
          result += `<span style="color:${list.color}">${chunk}</span>`;
        } else {
          result += `<span class="hl-w" style="background-color:${list.color};color:${list.textColor || '#000'}">${chunk}</span>`;
        }
      } else {
        result += chunk;
      }
      i = j;
    }

    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-hl-wrapper', '');
    wrapper.classList.add('hl-ext');
    wrapper.innerHTML = result;
    node.parentNode.replaceChild(wrapper, node);
    trackedWrappers.add(wrapper);
  }

  function unwrapWrapper(w) {
    const text = w.textContent;
    const t = document.createTextNode(text);
    w.replaceWith(t);
    trackedWrappers.delete(w);
    return t;
  }

  function getBlockAncestor(node) {
    const blocks = new Set(['P','DIV','H1','H2','H3','H4','H5','H6','LI','TD','TH','SECTION','ARTICLE','HEADER','FOOTER','MAIN','ASIDE','NAV','BLOCKQUOTE','DD','DT','FIGCAPTION','FIGURE','BODY']);
    let el = node.parentNode;
    while (el && el !== document.body) {
      if (blocks.has(el.tagName)) return el;
      el = el.parentNode;
    }
    return document.body;
  }

  function processTextGroup(nodes) {
    if (nodes.length === 0) return;
    if (nodes.length === 1) { highlightNode(nodes[0]); return; }

    let combined = '';
    const map = [];
    for (const n of nodes) {
      for (let ci = 0; ci < n.textContent.length; ci++) map.push(n);
      combined += n.textContent;
    }
    if (!combined.trim()) return;

    const allMatches = [];
    for (const list of activeLists) {
      for (const m of getListMatches(combined, list)) {
        allMatches.push({ start: m.start, end: m.end, list });
      }
    }
    if (allMatches.length === 0) return;

    allMatches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const aPrio = (a.list.type === 'custom' || a.list.type === 'file') ? 0 : (a.list.type === 'builtin' ? 1 : 2);
      const bPrio = (b.list.type === 'custom' || b.list.type === 'file') ? 0 : (b.list.type === 'builtin' ? 1 : 2);
      return aPrio - bPrio;
    });

    const claimed = new Array(combined.length).fill(null);
    for (const m of allMatches) {
      for (let i = m.start; i < Math.min(m.end, combined.length); i++) {
        if (claimed[i] === null) claimed[i] = m.list;
      }
    }

    const nodeParts = new Map();
    for (const n of nodes) nodeParts.set(n, '');

    let i = 0;
    while (i < combined.length) {
      const cList = claimed[i];
      let j = i;
      while (j < combined.length && claimed[j] === cList) j++;
      const chunk = combined.substring(i, j);

      if (cList) {
        for (let p = i; p < j;) {
          const node = map[p];
          const start = p;
          while (p < j && map[p] === node) p++;
          const seg = combined.substring(start, p);
          let segHtml;
          if (cList.style === 'text') {
            segHtml = `<span style="color:${cList.color}">${escapeHtml(seg)}</span>`;
          } else {
            segHtml = `<span class="hl-w" style="background-color:${cList.color};color:${cList.textColor || '#000'}">${escapeHtml(seg)}</span>`;
          }
          nodeParts.set(node, nodeParts.get(node) + segHtml);
        }
      } else {
        // Distribute plain text per node
        for (let p = i; p < j;) {
          const node = map[p];
          const start = p;
          while (p < j && map[p] === node) p++;
          nodeParts.set(node, nodeParts.get(node) + escapeHtml(combined.substring(start, p)));
        }
      }
      i = j;
    }

    for (const n of nodes) {
      const html = nodeParts.get(n);
      if (!html) continue;
      if (!html.includes('<span')) continue;
      const wrapper = document.createElement('span');
      wrapper.setAttribute('data-hl-wrapper', '');
      wrapper.classList.add('hl-ext');
      wrapper.innerHTML = html;
      n.parentNode.replaceChild(wrapper, n);
      trackedWrappers.add(wrapper);
    }
  }

  function processNodeTree(root) {
    if (root.nodeType === Node.TEXT_NODE) root = root.parentNode;
    if (!root) return;

    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (isOurHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        if (isForeignHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        const tag = node.parentNode.tagName;
        if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'SVG') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    let tn;
    while ((tn = walker.nextNode())) {
      if (tn.isConnected) textNodes.push(tn);
    }

    const groups = [];
    let cur = [];
    let lastBlock = null;
    for (const n of textNodes) {
      const block = getBlockAncestor(n);
      if (block !== lastBlock && cur.length) { groups.push(cur); cur = []; }
      cur.push(n);
      lastBlock = block;
    }
    if (cur.length) groups.push(cur);

    for (const group of groups) { try { processTextGroup(group); } catch (e) { console.warn('highlight error', e); } }
  }

  function processTargetElements() {
    processNodeTree(document.body);
  }

  function clearHighlights() {
    for (const w of [...trackedWrappers]) {
      if (w.isConnected) unwrapWrapper(w);
    }
    trackedWrappers.clear();
  }

  let observer = null;
  let intervalId = null;
  let dirty = false;

  function startWatching() {
    if (observer) return;
    observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            setTimeout(() => processNodeTree(node), 10);
          }
        }
      }
      dirty = true;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    processTargetElements();
    intervalId = setInterval(() => {
      if (dirty) { dirty = false; processTargetElements(); }
    }, 3000);
  }

  function stopWatching() {
    clearHighlights();
    if (observer) { observer.disconnect(); observer = null; }
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  function refreshHighlights() {
    // Полная переподсветка: снимаем старые обёртки, чтобы
    // заново обработать и уже завёрнутые фрагменты текста
    clearHighlights();
    processTargetElements();
  }

  function applyListsFromStorage() {
    return _storageGet(['lists', 'disabledSites']).then(data => {
      if (isSiteDisabled(data.disabledSites)) {
        stopWatching();
        return;
      }
      if (data.lists) {
        buildActiveLists(data.lists);
        if (!observer) {
          startWatching();
        } else {
          refreshHighlights();
        }
      } else {
        stopWatching();
      }
    }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (dead || !isContextAlive()) { handleInvalidContext(); return; }
    if (message.action === 'addWord') {
      _storageGet('lists').then(data => {
        const lists = data.lists || [];
        const list = lists.find(l => l.id === message.listId);
        if (list && (list.type === 'custom' || list.type === 'file')) {
          const word = (message.word || '').trim();
          if (word) {
            if (!list.words) list.words = [];
            const lower = word.toLowerCase();
            if (!list.words.some(w => w.toLowerCase() === lower)) {
              list.words.push(word);
              _storageSet({ lists }, () => {
                buildActiveLists(lists);
                refreshHighlights();
              });
            }
          }
        }
      }).catch(() => {});
    } else if (message.action === 'listsUpdated') {
      // Background изменил списки (например, через контекстное меню) —
      // обновляемся немедленно, не дожидаясь storage-событий
      applyListsFromStorage();
    }
  });

  _storageGet(['lists', 'disabledSites']).then(data => {
    if (isSiteDisabled(data.disabledSites)) return;
    if (data.lists) {
      buildActiveLists(data.lists);
      startWatching();
    }
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (dead || !isContextAlive()) { handleInvalidContext(); return; }
    // Слушаем и local, и sync: запись в sync может молча падать
    // (лимит 8КБ на элемент), а local — основной источник данных
    if (area !== 'local' && area !== 'sync') return;
    if ('lists' in changes) {
      const oldVal = JSON.stringify(changes.lists.oldValue || []);
      const newVal = JSON.stringify(changes.lists.newValue || []);
      if (oldVal === newVal) return;
      applyListsFromStorage();
    } else if ('disabledSites' in changes) {
      applyListsFromStorage();
    }
  });

  let titleTimer = null;
  document.addEventListener('mouseup', () => {
    if (dead) return;
    const word = window.getSelection().toString().trim();
    if (!word) return;
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => {
      if (dead || !isContextAlive()) { handleInvalidContext(); return; }
      try {
        chrome.runtime.sendMessage({ action: 'updateTitles', word }).catch(() => {});
      } catch (e) {
        handleInvalidContext();
      }
    }, 200);
  });
})();
