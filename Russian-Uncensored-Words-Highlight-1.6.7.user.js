// ==UserScript==
// @name         Подсветка нецензурных слов
// @namespace    https://github.com/Vova-iz-Tambova
// @version      1.6.7
// @description  Выделяет матерные слова без цензуры жёлтым маркером
// @author       Vova-iz-Tambova
// @homepageURL  https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight
// @supportURL   https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight/issues
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const PATTERN_BLYAD = '(?<![аАмМюЮ]|[дДрР][уУ]|[дДсСтТ][еЕоО]|[гГкКоОщЩ][оОрРеЕ][еЕрРоО]|[иИ][сС][тТ][рР][еЕ]|[уУ][пП][оО][тТ][рР][еЕ])[бБьЬ6ⳝ][лЛ][@яЯ][дД]?(?![еЕлЛмМпПтТшШюЮяЯ])';
  const PATTERN_BLYAT = '(?<![уУ]|[рРдД][оО]|[кК][оО][рР]|[аАоО][сС]{1,2}[лЛ][аА]|[иИпП][оОсС][тТ][рР][еЕ])[бБ6ⳝ][лЛ][яЯ][тТ]';
  const PATTERN_DOLBO = '[дД][аАaA@оО0oO][лЛ][бБ6ⳝ][аАaA@оО0oO](?![яЯдД])[еЕёЁ][бБ6пП]';
  const PATTERN_EB = '(?<![вВгГдДкКлЛнНпПрРсСтТцЦчЧшШщЩ])[еЕёЁ][бБⳝпП](?![аАеЕиИлЛнНоОрРсСтТ])';
  const PATTERN_EBA = '(?<![бБвВгГдДжЖкКлЛмМнНпПрРсСтТцЦчЧшШщЩЗзЗcCdDrRmM]|[вВ][оО])[еЕeEёЁëε][бБьЬ6δⳝb][аАaA@αАеЕёЁиИμлЛнН0оОoOуУyYыЫ][рРвВеЕйЙнНрРуУyжЖлЛӆбБкКоОтТчЧшШщЩ]?(?![ҙ]|[сС][оО])';
  const PATTERN_EBLO = '(?<![бБвВдДгГлЛнНпПрРсСтТчЧшШщЩ])[еЕёЁиИэЭ][бБ6ⳝпП][лЛ][аАaA@оО0oO][нН]?(?![йЙкК])';
  const PATTERN_HUI = '(?<![уУ]|[гГлЛ][оО]|(^|\\s|[вВ])[лЛтТ][иИ])[хХxX×][уУyY¥][ёЁиИлЛ](?![аАуУыЫ]|[иИ][гГоОьЬяЯ]|[иИ][тТшШ][ьЬеЕ])';
  const PATTERN_HUY = '(?<![кК]|[лЛсСтТ][иИуУоО]|[сС][тТ][рР][аА])[хХxX×ⲭχ][уУyY¥ⲩγ][еЕ3йЙÑύюЮяЯ]';
  const PATTERN_HUYN = '[хХxX×][уУyY¥][йЙÑ][нН]';
  const PATTERN_IBI = '(?<![бБвВГгдДкКлЛмМнНпПсСрРтТшШчЧхХцЦфФ])[иИμ][бБⳝ][еЕиИμуУ](?![рРсСцЦ])';
  const PATTERN_IPA = '(?<![вВдДгГзЗиИкКлЛнмМНпПрРсСтТцЦжЖхХчЧшШщЩ])[иИеЕ][пП][аАеЕёЁиИ](?![рРмМчЧфФ]|[нН][чЧ]|[тТ][иИ]|[тТсС][ьЬкК][еЕоО][вВпП])';
  const PATTERN_MAND = '(?<![кК][аАсСоО]|[аАиИлЛрРтТ])[мМ][аАaA@][нН][ьЬ]?[дД](?![аАиИ][лЛрРтТ]|[жЖрР][аАиИоОыЫ]|[еЕоО][бБлЛ])';
  const PATTERN_PIDOR = '(?<![аАиИ4])[пП][иИэЭ]?[дД][оО0oOаА@еЕэЭ]?[рРpPrR\\s](?![дД]|[аА][нН]|[иИ](\\s|[.,!?]))';
  const PATTERN_PEST = '[пП][еЕ][сС][дДтТ](?![кКоОрР]|[иИеЕуУ][кКлЛнНцЦ]|[уУ][юЮ][тТ])';
  const PATTERN_PISD = '(?<![мМоОЯя]|[кКрР][аА])[пП][иИ]?[сС][дДтТ](?![вВ]|[еЕ][йЙрР]|[оО][лЛнНрР]|[рР][аА][нН]|[оО][лЛ][еЕ][тТ])';
  const PATTERN_PITАR = '(?<![оО])[пП][иИ][тТ][аА@оО]?[рР](?![иИ])';
  const PATTERN_PITER = '(?<![еЕоОюЮ(])[пП][иИ][тТ][еЕ]?[рР](?![бБиИоОсСуУ)]|[аАеЕ":;](\\s|[.,!?])|\\s|[.,!?])';
  const PATTERN_PIZD = '(?<![эЭ]|[тТ][иИ])[пП5π][еЕиИыЫ]?[зЗ3жЖ]{1,2}[ьЬ]?[дДтТ](?![еЕ][сС])';
  const PATTERN_PIZH = '[пП][иИ][жЖ](?![\u0020аАмМоО])';
  const PATTERN_PLYA = '(?<![аАеЕиИоОмМуУыЫ])[пП][лЛ][@яЯ](?![жЖсСшШюЮ])';
  const PATTERN_ZALUPA = '[зЗ3][аАaA@][лЛ][уУyY][пП]';

  const regex = new RegExp(
      `(${[
          PATTERN_BLYAD,
          PATTERN_BLYAT,
          PATTERN_DOLBO,
          PATTERN_EB,
          PATTERN_EBA,
          PATTERN_EBLO,
          PATTERN_HUI,
          PATTERN_HUY,
          PATTERN_HUYN,
          PATTERN_IBI,
          PATTERN_IPA,
          PATTERN_MAND,
          PATTERN_PIDOR,
          PATTERN_PEST,
          PATTERN_PISD,
          PATTERN_PITАR,
          PATTERN_PITER,
          PATTERN_PIZD,
          PATTERN_PIZH,
          PATTERN_PLYA,
          PATTERN_ZALUPA
      ].join('|')})`,
      'g'
  );

  if (!document.getElementById('highlight-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-style';
    style.textContent = `
            .hl-yellow {
                background-color: #ff0 !important;
                color: #000 !important;
                white-space: nowrap !important;
            }
        `;
    document.head.appendChild(style);
  }

  function removeDiacritics(str) {
    return str.replace(/[\u0300-\u036f]/g, '');
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
      if (el.classList && el.classList.contains('hl-yellow')) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function highlightNode(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    if (!node.textContent || !node.parentNode) return;

    let el = node.parentNode;
    while (el && el !== document.body) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      el = el.parentNode;
    }

    const originalText = node.textContent;
    if (/^[0-9a-fA-F]{32}$/.test(originalText.trim())) return;
    if (originalText.includes('://') || originalText.includes('/video/')) return;
    if (originalText.includes('<span class="hl-yellow"')) return;

    const textWithoutDiacritics = removeDiacritics(originalText);
    const textForSearch = ' ' + textWithoutDiacritics + ' .,!?';
    const offset = 1;

    regex.lastIndex = 0;
    if (!regex.test(textForSearch)) return;

    regex.lastIndex = 0;
    const parentNode = node.parentNode;

    function mapIndex(cleanIndex) {
      let originalIdx = 0;
      let cleanIdx = 0;
      const len = originalText.length;

      while (originalIdx < len && cleanIdx < cleanIndex) {
        if (/[\u0300-\u036f]/.test(originalText[originalIdx])) {
          originalIdx++;
          continue;
        }
        originalIdx++;
        cleanIdx++;
      }
      return originalIdx;
    }

    const matches = [];
    let match;
    while ((match = regex.exec(textForSearch)) !== null) {
      const startClean = match.index - offset;
      if (startClean >= 0 && startClean < textWithoutDiacritics.length) {
        const endClean = Math.min(startClean + match[0].length, textWithoutDiacritics.length);

        const startOriginal = mapIndex(startClean);
        const endOriginal = mapIndex(endClean);

        matches.push({
          start: startOriginal,
          end: endOriginal
        });
      }
    }

    if (matches.length === 0) return;

    let result = '';
    let lastIdx = 0;

    for (const match of matches) {
      result += originalText.substring(lastIdx, match.start);
      result += `<span class="hl-yellow">${originalText.substring(match.start, match.end)}</span>`;
      lastIdx = match.end;
    }
    result += originalText.substring(lastIdx);

    const wrapper = document.createElement('span');
    wrapper.innerHTML = result;
    parentNode.replaceChild(wrapper, node);
  }

  function processNodeTree(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        if (isOurHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        if (isForeignHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        const tag = node.parentNode.tagName;
        if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'SVG') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    let textNode;
    while (textNode = walker.nextNode()) {
      if (textNode.isConnected) {
        highlightNode(textNode);
      }
    }
  }

  function processTargetElements() {
    processNodeTree(document.body);
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          setTimeout(() => processNodeTree(node), 10);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  setTimeout(processTargetElements, 0);
  setInterval(processTargetElements, 300);
})();
