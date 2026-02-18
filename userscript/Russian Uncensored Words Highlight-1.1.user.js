// ==UserScript==
// @name         Russian Uncensored Words Highlight
// @name:ru      Подсветка нецензурных слов
// @description  Highlight uncensored Russian bad words without censorship
// @description:ru Выделяет нецензурные слова жёлтым маркером без цензуры
// @namespace    https://github.com/Vova-iz-Tambova
// @version      1.1
// @author       Vova-iz-Tambova
// @homepageURL  https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight
// @supportURL   https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight/issues
// @license      MIT
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ========================
    // ПАТТЕРНЫ ДЛЯ ПОДСВЕТКИ
    // ========================
    const PATTERN_ZALUPA = '[зЗ3][аАaA@][лЛ][уУyY][пП][аАaA@уУyYоО0oO]';
    const PATTERN_PIDOR = '[пП][иИ][дД][оО0oOаАaA@]?[рРpP]';
    const PATTERN_PIZD = '[пП][иИ]?[зЗ3][дД]';
    const PATTERN_MANDA = '(?<![оО])[мМ][аАaA@][нНhH][дД][аАaA@]';
    const PATTERN_HUI = '[хХxX\u274C\u00D7][уУyY][лЛйЙёЁяЯиИеЕeEаАa@]';
    const PATTERN_BLYA = '(?<![уУрРаА])[бБ6пП][лЛ][яЯ](?![жЖсСшШкК])';
    const PATTERN_EBA = '(?<![дДтТлЛрРсСcCвВнНчЧRr])[еЕёЁeE][бБ6b][аАaA@лЛиИоО0oOуУyYеЕёЁ]';

    // Объединённая регулярка
    const regex = new RegExp(
        `(${[
            PATTERN_ZALUPA,
            PATTERN_PIDOR,
            PATTERN_PIZD,
            PATTERN_MANDA,
            PATTERN_HUI,
            PATTERN_BLYA,
            PATTERN_EBA
        ].join('|')})`,
        'g'
    );

    // Стили
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

    // ========================
    // ЗАЩИТА ОТ РЕКУРСИИ + ФИЛЬТР ДЛЯ ID/ССЫЛОК
    // ========================
    function highlightNode(node) {
        if (node.nodeType !== Node.TEXT_NODE) return;
        if (!node.textContent || !node.parentNode) return;
        if (node.parentNode.hasAttribute('data-highlighted')) return;

        const text = node.textContent.trim();

        // Фильтр для 32-значных хешей
        if (/^[0-9a-fA-F]{32}$/.test(text)) return;

        // Фильтр для ссылок и путей
        if (text.includes('://') || text.includes('/video/')) return;

        if (!regex.test(text)) return;

        const parent = node.parentNode;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            const span = document.createElement('span');
            span.className = 'hl-yellow';
            span.setAttribute('data-highlighted', 'true');
            span.textContent = match[0];
            fragment.appendChild(span);
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        parent.replaceChild(fragment, node);
    }

    // ========================
    // ОБРАБОТКА НУЖНЫХ ТЕГОВ
    // ========================
    function processTargetElements() {
        const elements = document.querySelectorAll('span, h6, div');

        elements.forEach(element => {
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
            let textNode;
            while (textNode = walker.nextNode()) {
                if (textNode.isConnected && !textNode.parentNode.hasAttribute('data-highlighted')) {
                    highlightNode(textNode);
                }
            }
        });
    }

    // ========================
    // OBSERVER ДЛЯ ДИНАМИЧЕСКОГО КОНТЕНТА
    // ========================
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'SPAN' || node.tagName === 'H6' || node.tagName === 'DIV') {
                        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
                        let textNode;
                        while (textNode = walker.nextNode()) {
                            if (textNode.isConnected && !textNode.parentNode.hasAttribute('data-highlighted')) {
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
        subtree: true
    });

    // ========================
    // ПЕРИОДИЧЕСКАЯ ПРОВЕРКА (каждые 2 секунды)
    // ========================
    setInterval(processTargetElements, 2000);
})();