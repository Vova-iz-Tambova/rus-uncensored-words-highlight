(function() {
    'use strict';

    // ========================
    // ИНЖЕКТИМ СТИЛИ
    // ========================
    if (!document.getElementById('highlight-style')) {
        const style = document.createElement('style');
        style.id = 'highlight-style';
        style.textContent = `
            .hl-mui-test {
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
    // ФИЛЬТРЫ
    // ========================
    function shouldSkipText(text) {
        if (!text.trim()) return true;
        if (text.length < 3) return true;
        if (text.includes('://')) return true;
        if (text.includes('/video/')) return true;
        if (text.includes('/channel/')) return true;
        if (/^[0-9a-fA-F]{32}$/.test(text.trim())) return true;
        return false;
    }

    // ========================
    // ПОДСВЕТКА ВСЕХ СОВПАДЕНИЙ В СПАНЕ
    // ========================
    function highlightAllMatches(span) {
        if (!span.parentNode) return;
        if (span.classList.contains('hl-mui-test')) return;

        const text = span.textContent;
        if (shouldSkipText(text)) return;

        // Находим ВСЕ совпадения
        regex.lastIndex = 0;
        const matches = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length
            });
        }

        if (matches.length === 0) return;

        // Создаём фрагмент со всеми выделениями
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        matches.forEach((m) => {
            // Текст до мата
            if (m.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, m.index)));
            }

            // Сам мат
            const highlight = document.createElement('span');
            highlight.className = 'hl-mui-test';
            highlight.textContent = text.substring(m.index, m.index + m.length);
            fragment.appendChild(highlight);

            lastIndex = m.index + m.length;
        });

        // Оставшийся текст после последнего мата
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        // Заменяем только если есть что заменять
        if (fragment.childNodes.length > 1 && span.parentNode) {
            span.parentNode.replaceChild(fragment, span);
        }
    }

    // ========================
    // ПРОВЕРКА ВСЕХ СПАНОВ
    // ========================
    function checkAllSpans() {
        const spans = document.querySelectorAll('span:not(.hl-mui-test)');

        spans.forEach(span => {
            if (span.classList.contains('hl-mui-test')) return;

            const group = [span];
            let prev = span.previousSibling;
            let next = span.nextSibling;

            while (prev && prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'SPAN' && !prev.classList.contains('hl-mui-test')) {
                group.unshift(prev);
                prev = prev.previousSibling;
            }

            while (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === 'SPAN' && !next.classList.contains('hl-mui-test')) {
                group.push(next);
                next = next.nextSibling;
            }

            if (group.length === 1) {
                highlightAllMatches(span);
                return;
            }

            const fullText = group.map(s => s.textContent).join('');
            if (shouldSkipText(fullText)) return;

            // Находим ВСЕ совпадения в объединённом тексте
            regex.lastIndex = 0;
            const matches = [];
            let match;
            while ((match = regex.exec(fullText)) !== null) {
                matches.push({
                    index: match.index,
                    length: match[0].length
                });
            }

            if (matches.length === 0) return;

            // Подсвечиваем каждый спан
            let currentPos = 0;
            group.forEach((s) => {
                const spanStart = currentPos;
                const spanEnd = currentPos + s.textContent.length;

                // Проверяем, есть ли маты в этом спане
                const spanMatches = matches.filter(m => 
                    m.index < spanEnd && (m.index + m.length) > spanStart
                );

                if (spanMatches.length > 0) {
                    // Создаём фрагмент для этого спана
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;
                    const spanText = s.textContent;

                    spanMatches.forEach((m) => {
                        const localStart = Math.max(0, m.index - spanStart);
                        const localEnd = Math.min(spanText.length, m.index + m.length - spanStart);

                        if (localStart > lastIndex) {
                            fragment.appendChild(document.createTextNode(spanText.substring(lastIndex, localStart)));
                        }

                        const highlight = document.createElement('span');
                        highlight.className = 'hl-mui-test';
                        highlight.textContent = spanText.substring(localStart, localEnd);
                        fragment.appendChild(highlight);

                        lastIndex = localEnd;
                    });

                    if (lastIndex < spanText.length) {
                        fragment.appendChild(document.createTextNode(spanText.substring(lastIndex)));
                    }

                    if (fragment.childNodes.length > 1 && s.parentNode) {
                        s.parentNode.replaceChild(fragment, s);
                    }
                }

                currentPos = spanEnd;
            });
        });
    }

    // ========================
    // ЗАПУСК
    // ========================
    setTimeout(() => {
        checkAllSpans();
    }, 500);

    setInterval(() => {
        checkAllSpans();
    }, 2000);

    const observer = new MutationObserver(() => {
        checkAllSpans();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();