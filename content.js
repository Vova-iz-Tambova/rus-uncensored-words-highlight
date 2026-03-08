(function () {
  "use strict";

  // Стили
  if (!document.getElementById("highlight-style")) {
    const style = document.createElement("style");
    style.id = "highlight-style";
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

  // ========================
  // ЗАЩИТА ОТ РЕКУРСИИ + ФИЛЬТР ДЛЯ ID/ССЫЛОК
  // ========================
  function highlightNode(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    if (!node.textContent || !node.parentNode) return;
    if (node.parentNode.hasAttribute("data-highlighted")) return;

    // 🔧 МИНИМАЛЬНАЯ ЗАЩИТА: пропускаем узлы внутри INPUT/TEXTAREA
    let el = node.parentNode;
    while (el && el !== document.body) {
      if (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable
      )
        return;
      el = el.parentNode;
    }

    const text = node.textContent;
    if (/^[0-9a-fA-F]{32}$/.test(text.trim())) return;
    if (text.includes("://") || text.includes("/video/")) return;
    if (!regex.test(text)) return;

    const parent = node.parentNode;
    const highlightedText = text.replace(regex, (match) => {
      return `<span class="hl-yellow" data-highlighted="true">${match}</span>`;
    });

    const temp = document.createElement("div");
    temp.innerHTML = highlightedText;

    while (temp.firstChild) {
      parent.insertBefore(temp.firstChild, node);
    }
    parent.removeChild(node);
  }

  // ========================
  // ОБРАБОТКА НУЖНЫХ ТЕГОВ
  // ========================
  function processTargetElements() {
    const elements = document.querySelectorAll("span, h6, div");
    elements.forEach((element) => {
      // 🔧 Пропускаем элементы внутри форм
      if (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.closest("input, textarea, [contenteditable]")
      )
        return;

      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (
          textNode.isConnected &&
          !textNode.parentNode.hasAttribute("data-highlighted")
        ) {
          highlightNode(textNode);
        }
      }
    });
  }

  // ========================
  // OBSERVER ДЛЯ ДИНАМИЧЕСКОГО КОНТЕНТА
  // ========================
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 🔧 Пропускаем элементы внутри форм
          if (
            node.tagName === "INPUT" ||
            node.tagName === "TEXTAREA" ||
            node.closest("input, textarea, [contenteditable]")
          )
            return;

          if (
            node.tagName === "SPAN" ||
            node.tagName === "H6" ||
            node.tagName === "DIV"
          ) {
            const walker = document.createTreeWalker(
              node,
              NodeFilter.SHOW_TEXT,
              null,
              false,
            );
            let textNode;
            while ((textNode = walker.nextNode())) {
              if (
                textNode.isConnected &&
                !textNode.parentNode.hasAttribute("data-highlighted")
              ) {
                highlightNode(textNode);
              }
            }
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // ========================
  // ПЕРИОДИЧЕСКАЯ ПРОВЕРКА (каждые 2 секунды)
  // ========================
  setInterval(processTargetElements, 2000);
})();
