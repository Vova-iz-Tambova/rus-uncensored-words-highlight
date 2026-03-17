(function () {
  "use strict";

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

  // Функция для проверки, есть ли у элемента или его родителей стиль Highlight
  function hasHighlightStyle(element) {
    if (!element) return false;

    // Проверяем текущий элемент на наличие классов Highlight
    if (element.classList) {
      if (element.classList.contains('Highlight') ||
        element.classList.contains('ht624ab15e-874e-4c59-8f53-3093b7dece4e') ||
        element.hasAttribute('highlight') ||
        element.hasAttribute('htmatch')) {
        return true;
      }
    }

    // Проверяем тег em с классами Highlight
    if (element.tagName === 'EM' && element.classList &&
      (element.classList.contains('Highlight') || element.hasAttribute('highlight'))) {
      return true;
    }

    return false;
  }

  function shouldSkipNode(node) {
    if (!node || !node.parentNode) return true;

    // Пропускаем узлы внутри INPUT/TEXTAREA
    let el = node.parentNode;
    while (el && el !== document.body) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return true;

      // Если нашли элемент с Highlight стилем, пропускаем этот узел
      if (hasHighlightStyle(el)) return true;

      el = el.parentNode;
    }

    return false;
  }

  function highlightNode(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    if (!node.textContent || !node.parentNode) return;

    // Проверяем, не находится ли узел внутри Highlight элемента
    if (shouldSkipNode(node)) return;

    // Проверяем родительский элемент на Highlight стили
    if (hasHighlightStyle(node.parentNode)) return;

    // Проверяем, не обработан ли уже этот узел
    if (node.parentNode.hasAttribute('data-highlighted')) return;

    const text = node.textContent;
    if (/^[0-9a-fA-F]{32}$/.test(text.trim())) return;
    if (text.includes('://') || text.includes('/video/')) return;

    // Проверяем, не содержит ли текст уже наши подсвеченные слова
    if (text.includes('<span class="hl-yellow"')) return;

    regex.lastIndex = 0;
    if (!regex.test(text)) return;

    regex.lastIndex = 0;
    const parent = node.parentNode;

    // Дополнительная проверка родителя
    if (hasHighlightStyle(parent)) return;

    const highlightedText = text.replace(regex, (match) => {
      return `<span class="hl-yellow" data-highlighted="true">${match}</span>`;
    });

    const temp = document.createElement('div');
    temp.innerHTML = highlightedText;

    while (temp.firstChild) {
      parent.insertBefore(temp.firstChild, node);
    }
    parent.removeChild(node);
  }

  function processTargetElements() {
    const elements = document.querySelectorAll('span, h6, div, p, a, li, td, th, em, strong, b, i');
    elements.forEach(element => {
      // Пропускаем элементы с Highlight стилями
      if (hasHighlightStyle(element)) return;

      // Пропускаем элементы внутри форм
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.closest('input, textarea, [contenteditable]')) return;

      // Пропускаем элементы, которые уже содержат наши подсветки
      if (element.querySelector('.hl-yellow')) return;

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          // Пропускаем текст внутри Highlight элементов
          let parent = node.parentNode;
          while (parent && parent !== element) {
            if (hasHighlightStyle(parent)) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }, false);

      let textNode;
      while (textNode = walker.nextNode()) {
        if (textNode.isConnected && !hasHighlightStyle(textNode.parentNode)) {
          highlightNode(textNode);
        }
      }
    });
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Пропускаем элементы с Highlight стилями
          if (hasHighlightStyle(node)) return;

          // Пропускаем элементы внутри форм
          if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.closest('input, textarea, [contenteditable]')) return;

          if (node.tagName === 'SPAN' || node.tagName === 'H6' || node.tagName === 'DIV' ||
            node.tagName === 'P' || node.tagName === 'A' || node.tagName === 'LI' ||
            node.tagName === 'EM' || node.tagName === 'STRONG') {

            // Проверяем, не содержит ли элемент уже наши подсветки
            if (node.querySelector('.hl-yellow')) return;

            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
              acceptNode: function (textNode) {
                let parent = textNode.parentNode;
                while (parent && parent !== node) {
                  if (hasHighlightStyle(parent)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  parent = parent.parentNode;
                }
                return NodeFilter.FILTER_ACCEPT;
              }
            }, false);

            let textNode;
            while (textNode = walker.nextNode()) {
              if (textNode.isConnected && !hasHighlightStyle(textNode.parentNode)) {
                highlightNode(textNode);
              }
            }
          }
        }
      });
    });
  });

  // Запускаем с небольшой задержкой после загрузки страницы
  setTimeout(() => {
    processTargetElements();
  }, 1000);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Увеличил интервал до 5 секунд для уменьшения нагрузки
  setInterval(processTargetElements, 5000);
})();
