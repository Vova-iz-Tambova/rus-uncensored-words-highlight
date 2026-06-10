(function () {
  'use strict';

  if (!document.getElementById('highlight-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-style';
    style.textContent = '.hl-w { white-space: nowrap !important; }';
    document.head.appendChild(style);
  }

  let activeLists = [];
  let customRegexCache = {};

  function removeDiacritics(str) {
    return str.replace(/[\u0300-\u036f]/g, '');
  }

  function mapIndex(originalText, cleanIndex) {
    let originalIdx = 0, cleanIdx = 0;
    const len = originalText.length;
    while (originalIdx < len && cleanIdx < cleanIndex) {
      if (/[\u0300-\u036f]/.test(originalText[originalIdx])) {
        originalIdx++; continue;
      }
      originalIdx++; cleanIdx++;
    }
    return originalIdx;
  }

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
      if (el.hasAttribute && el.hasAttribute('data-hl-wrapper')) return true;
      el = el.parentNode;
    }
    return false;
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
    const parts = [];
    if (partial.length) parts.push(partial.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
    if (exact.length) parts.push('\\b(' + exact.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b');
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
        const builtinRe = list.words && list.words.length ? compileCustomWordsRegex(list.words, list.matchInside) : null;
        customRegexCache[list.id] = { pattern: regex, custom: builtinRe };
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
    if (list.type === 'builtin') {
      const clean = removeDiacritics(text);
      const padded = ' ' + clean + ' .,!?';
      const matches = [];
      let re2 = re.pattern;
      re2.lastIndex = 0;
      let m;
      while ((m = re2.exec(padded)) !== null) {
        const s = m.index - 1;
        if (s >= 0 && s < clean.length) {
          const e = Math.min(s + m[0].length, clean.length);
          matches.push({ start: mapIndex(text, s), end: mapIndex(text, e) });
        }
      }
      if (re.custom) {
        re.custom.lastIndex = 0;
        while ((m = re.custom.exec(text)) !== null) {
          matches.push({ start: m.index, end: m.index + m[0].length });
        }
      }
      return matches;
    }
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
    if (text.includes('://') || text.includes('/video/')) return;

    const allMatches = [];
    for (const list of activeLists) {
      for (const m of getListMatches(text, list)) {
        allMatches.push({ start: m.start, end: m.end, list });
      }
    }
    if (allMatches.length === 0) return;

    allMatches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.list.type === 'custom' && b.list.type !== 'custom') return -1;
      if (a.list.type !== 'custom' && b.list.type === 'custom') return 1;
      return 0;
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
    wrapper.innerHTML = result;
    node.parentNode.replaceChild(wrapper, node);
  }

  function processNodeTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        if (isOurHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        if (isForeignHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        const tag = node.parentNode.tagName;
        if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'SVG') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    let textNode;
    while ((textNode = walker.nextNode())) {
      if (textNode.isConnected) highlightNode(textNode);
    }
  }

  function processTargetElements() {
    processNodeTree(document.body);
  }

  function clearHighlights() {
    document.querySelectorAll('[data-hl-wrapper]').forEach(w => w.replaceWith(w.textContent));
  }

  let observer = null;
  let intervalId = null;

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
    });
    observer.observe(document.body, { childList: true, subtree: true });
    processTargetElements();
    intervalId = setInterval(processTargetElements, 300);
  }

  function stopWatching() {
    clearHighlights();
    if (observer) { observer.disconnect(); observer = null; }
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  function refreshHighlights() {
    clearHighlights();
    processTargetElements();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'addWord') {
      chrome.storage.local.get('lists').then(data => {
        const lists = data.lists || [];
        const list = lists.find(l => l.id === message.listId);
        if (list && list.type === 'custom') {
          const word = message.word.trim();
          if (word && !list.words.includes(word)) {
            list.words.push(word);
            chrome.storage.local.set({ lists }).then(() => {
              buildActiveLists(lists);
              refreshHighlights();
            });
          }
        }
      });
    }
  });

  chrome.storage.local.get('lists').then(data => {
    if (data.lists) {
      buildActiveLists(data.lists);
      startWatching();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('lists' in changes) {
      buildActiveLists(changes.lists.newValue);
      refreshHighlights();
    }
  });

  let titleTimer = null;
  document.addEventListener('mouseup', () => {
    const word = window.getSelection().toString().trim();
    if (!word) return;
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'updateTitles', word });
    }, 200);
  });
})();
