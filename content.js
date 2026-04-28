(function () {
  'use strict';

  if (!document.getElementById('highlight-style')) {
    const style = document.createElement('style');
    style.id = 'highlight-style';
    style.textContent = `
            .hl-yellow {
                background-color: #ff0 !important;
                color: #000 !important;
                padding: 0 !important;
                margin: 0 !important;
                display: inline !important;
                line-height: inherit !important;
            }
        `;
    document.head.appendChild(style);
  }

  function removeDiacritics(str) {
    return str.replace(/[\u0300-\u036f]/g, '');
  }

  // Проверяет, есть ли чужая подсветка (НЕ наша)
  function isForeignHighlight(element) {
    if (!element) return false;

    let el = element;
    while (el && el !== document.body) {
      // Чужая подсветка — это класс Highlight или атрибут highlight, НО не наш hl-yellow
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

  // Проверяет, есть ли наша подсветка
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

    // Если текст уже внутри НАШЕЙ подсветки — пропускаем
    if (isOurHighlight(node.parentNode)) return;

    // Если текст внутри ЧУЖОЙ подсветки — пропускаем
    if (isForeignHighlight(node.parentNode)) return;

    // Пропускаем INPUT/TEXTAREA
    let el = node.parentNode;
    while (el && el !== document.body) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      el = el.parentNode;
    }

    const originalText = node.textContent;
    if (/^[0-9a-fA-F]{32}$/.test(originalText.trim())) return;
    if (originalText.includes('://') || originalText.includes('/video/')) return;
    if (originalText.includes('<span class="hl-yellow"')) return;

    // Удаляем ударения из текста
    const textWithoutDiacritics = removeDiacritics(originalText);
    const textForSearch = ' ' + textWithoutDiacritics + ' .,!?';
    const offset = 1;

    regex.lastIndex = 0;
    if (!regex.test(textForSearch)) return;

    regex.lastIndex = 0;
    const parentNode = node.parentNode;

    // Функция для преобразования индекса из строки без ударений в строку с ударениями
    function mapIndex(cleanIndex) {
      let originalIdx = 0;
      let cleanIdx = 0;
      const len = originalText.length;

      while (originalIdx < len && cleanIdx < cleanIndex) {
        // Если текущий символ — диакритика, он не считается в clean строке
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
          end: endOriginal,
          matchedText: match[0]
        });
      }
    }

    if (matches.length === 0) return;

    let result = '';
    let lastIdx = 0;

    for (const match of matches) {
      result += originalText.substring(lastIdx, match.start);
      const originalMatchedText = originalText.substring(match.start, match.end);
      result += `<span class="hl-yellow">${originalMatchedText}</span>`;
      lastIdx = match.end;
    }
    result += originalText.substring(lastIdx);

    const temp = document.createElement('div');
    temp.innerHTML = result;

    while (temp.firstChild) {
      parentNode.insertBefore(temp.firstChild, node);
    }
    parentNode.removeChild(node);
  }

  function processTargetElements() {
    // Находим все текстовые узлы на странице
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // Пропускаем пустые узлы
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        // Пропускаем узлы внутри наших подсветок
        if (isOurHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        // Пропускаем узлы внутри чужих подсветок
        if (isForeignHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
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

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Проверяем, не добавлен ли уже элемент с нашей подсветкой
          if (node.querySelector && node.querySelector('.hl-yellow')) return;

          setTimeout(() => {
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
              acceptNode: function (textNode) {
                if (!textNode.textContent.trim()) return NodeFilter.FILTER_REJECT;
                if (isOurHighlight(textNode.parentNode)) return NodeFilter.FILTER_REJECT;
                if (isForeignHighlight(textNode.parentNode)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              }
            }, false);

            let textNode;
            while (textNode = walker.nextNode()) {
              if (textNode.isConnected) {
                highlightNode(textNode);
              }
            }
          }, 100);
        }
      });
    });
  });

  setTimeout(() => {
    processTargetElements();
  }, 100);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  setInterval(processTargetElements, 300);
})();