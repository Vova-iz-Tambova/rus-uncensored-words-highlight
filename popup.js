const PALETTE = [
  { id: 'yellow',   name: 'Жёлтый',      color: '#fdd835' },
  { id: 'red',      name: 'Красный',     color: '#c62828' },
  { id: 'orange',   name: 'Оранжевый',   color: '#e65100' },
  { id: 'green',    name: 'Зелёный',     color: '#2e7d32' },
  { id: 'blue',     name: 'Голубой',     color: '#1565c0' },
  { id: 'violet',   name: 'Фиолетовый',  color: '#7b1fa2' },
  { id: 'pink',     name: 'Розовый',     color: '#c2185b' },
  { id: 'brown',    name: 'Коричневый',  color: '#6d4c41' },
  { id: 'grey',     name: 'Серый',       color: '#424242' },
];

let currentLists = [];
let editingList = null;
let isSitesEditorOpen = false;

function storageSet(data, callback) {
  chrome.storage.local.set(data, () => {
    void chrome.runtime.lastError;
    chrome.storage.sync.set(data, () => {
      // sync может упасть (квота 8КБ на элемент) — local уже записан
      void chrome.runtime.lastError;
      if (callback) callback();
    });
  });
}

function storageGet(keys) {
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

function findWordInLists(word, excludeId) {
  const lower = word.toLowerCase();
  for (const list of currentLists) {
    if (list.id === excludeId) continue;
    if (list.type !== 'custom' && list.type !== 'file') continue;
    if (list.words && list.words.some(w => w.toLowerCase() === lower)) {
      return list;
    }
  }
  return null;
}

// Префикс "=" перед словом означает «подсвечивать только полное слово»
function parseWordPrefix(raw) {
  const t = String(raw).trim();
  if (t.startsWith('=') && t.length > 1) {
    const clean = t.slice(1).trim();
    if (clean) return { word: clean, exact: true };
  }
  return { word: t, exact: false };
}

function hideHeader() {
  document.getElementById('mainHeader').style.display = 'none';
}

function showHeader() {
  document.getElementById('mainHeader').style.display = '';
}

function switchView(showId) {
  const ids = ['lists', 'editor', 'addView', 'infoView'];
  for (const id of ids) {
    const el = document.getElementById(id);
    el.style.display = id === showId ? '' : 'none';
  }
  const footer = document.getElementById('listsFooter');
  if (footer) footer.style.display = showId === 'lists' ? '' : 'none';
}

function showMain() {
  showHeader();
  switchView('lists');
  isSitesEditorOpen = false;
}

function renderLists(lists) {
  currentLists = lists;
  const container = document.getElementById('lists');
  container.innerHTML = '';
  showMain();

  for (const list of lists) {
    container.appendChild(createListRow(list));
  }
}

function createListRow(list) {
  const row = document.createElement('div');
  row.className = 'list-card';
  if (list.enabled === false) row.classList.add('disabled');

  const indicator = document.createElement('span');
  if (list.style === 'text') {
    indicator.className = 'color-text';
    indicator.textContent = 'A';
    indicator.style.color = list.color;
  } else {
    indicator.className = 'color-dot';
    indicator.style.background = list.color;
  }

  const name = document.createElement('span');
  name.className = 'list-name';

  const nameText = document.createTextNode(list.name);
  name.appendChild(nameText);

  if (list.type === 'builtin') {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:10px;color:#999;margin-left:4px;font-weight:400;';
    badge.textContent = '(встроенный)';
    name.appendChild(badge);
  }

  name.addEventListener('click', () => openEditor(list));

  const count = document.createElement('span');
  count.style.cssText = 'font-size:10px;color:#aaa;margin-right:6px;flex-shrink:0;';
  if (list.type === 'pattern') {
    count.textContent = '1 паттерн';
  } else if (list.words && list.words.length) {
    count.textContent = `${list.words.length} слов`;
  }

  const toggle = document.createElement('label');
  toggle.className = 'switch-sm';
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = list.enabled !== false;
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'slider';
  toggle.append(toggleInput, toggleSlider);

  row.append(indicator, name, count, toggle);

  toggleInput.addEventListener('change', () => {
    list.enabled = toggleInput.checked;
    row.classList.toggle('disabled', !list.enabled);
    storageSet({ lists: currentLists });
  });

  return row;
}

function openEditor(list) {
  editingList = list;
  hideHeader();
  document.getElementById('addView').style.display = 'none';
  const editor = document.getElementById('editor');
  editor.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'editor-header';

  const back = document.createElement('button');
  back.className = 'back-btn';
  back.textContent = '«';
  back.title = 'Назад';

  const dot = document.createElement('span');
  if (list.style === 'text') {
    dot.className = 'color-text';
    dot.textContent = 'A';
    dot.style.color = list.color;
  } else {
    dot.className = 'color-dot';
    dot.style.background = list.color;
  }

  const title = document.createElement('span');
  title.style.fontWeight = '600';
  title.style.fontSize = '14px';
  title.textContent = list.name;

  const saveBtn = document.createElement('button');
  saveBtn.className = 'editor-upload-btn';
  saveBtn.title = 'Сохранить в файл';
  saveBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="white">' +
    '<path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>' +
    '</svg>';

  if (list.type !== 'custom' && list.type !== 'file') {
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.35';
    saveBtn.style.cursor = 'default';
    saveBtn.title = 'Сохранение недоступно для этого списка';
  } else {
    const hasWords = list.words && list.words.some(w => w.trim());
    if (!hasWords) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.35';
      saveBtn.style.cursor = 'default';
      saveBtn.title = 'Нет слов для сохранения';
    }
    saveBtn.addEventListener('click', () => {
      const matchInside = list.matchInside || {};
      const text = list.words
        .map(w => {
          const t = w.trim();
          if (!t) return '';
          return matchInside[t.toLowerCase()] === false ? '=' + t : t;
        })
        .filter(Boolean)
        .join('\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = list.name + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  const centerWrap = document.createElement('div');
  centerWrap.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;gap:6px';
  centerWrap.append(dot, title);

  header.append(back, centerWrap, saveBtn);
  editor.appendChild(header);

  if (list.type === 'pattern') {
    const fileRow = document.createElement('div');
    fileRow.className = 'filename-row';
    fileRow.innerHTML = `Файл: <code>${list.file || 'patterns.js'}</code>`;
    editor.appendChild(fileRow);
  } else if (list.type === 'builtin') {
    const note = document.createElement('div');
    note.className = 'filename-row';
    note.textContent = 'Встроенные паттерны (21 шт.)';
    editor.appendChild(note);
  } else {
    const wordList = document.createElement('div');
    wordList.className = 'word-list';

    const matchInside = list.matchInside || {};

    function saveWordList() {
      storageSet({ lists: currentLists });
      updateSaveBtn();
    }

    function updateSaveBtn() {
      const hasWords = list.words && list.words.some(w => w.trim());
      if (hasWords) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '';
        saveBtn.style.cursor = '';
        saveBtn.title = 'Сохранить в файл';
      } else {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.35';
        saveBtn.style.cursor = 'default';
        saveBtn.title = 'Нет слов для сохранения';
      }
    }

    // Обработчик вставки текста в редакторе
    wordList.addEventListener('paste', (e) => {
      const target = e.target;
      if (!target.classList.contains('word-text')) return;
      
      e.preventDefault();
      
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (!text) return;
      
      // Разбиваем текст на слова по переносам строк и запятым.
      // Префикс "=" помечает слово как «только полное слово»
      const newWords = [];
      for (const token of text.split(/[\r\n,]+/)) {
        const p = parseWordPrefix(token);
        if (!p.word) continue;
        if (p.exact) {
          matchInside[p.word.toLowerCase()] = false;
          list.matchInside = matchInside;
        }
        newWords.push(p.word);
      }
      
      if (newWords.length === 0) return;
      
      // Находим индекс текущего слова
      const row = target.closest('.word-row');
      if (!row) return;
      const idx = parseInt(row.dataset.wordIdx);
      
      // Заменяем текущее слово на массив новых слов
      list.words.splice(idx, 1, ...newWords);
      
      // Сохраняем
      saveWordList();
      renderWords();
      
      // Фокусируемся на последнем вставленном слове
      const spans = wordList.querySelectorAll('.word-text');
      const focusIdx = Math.min(idx + newWords.length, spans.length - 1);
      if (spans[focusIdx]) {
        spans[focusIdx].focus();
        const range = document.createRange();
        range.selectNodeContents(spans[focusIdx]);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    function createWordRow(wordText, idx) {
      const row = document.createElement('div');
      row.className = 'word-row';
      row.dataset.wordIdx = idx;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      const key = wordText.toLowerCase();
      cb.checked = matchInside[key] === false;
      cb.title = 'Только полное слово';
      cb.addEventListener('change', () => {
        const ri = parseInt(row.dataset.wordIdx);
        const kw = (list.words[ri] || '').toLowerCase();
        if (cb.checked) matchInside[kw] = false;
        else delete matchInside[kw];
        list.matchInside = matchInside;
        saveWordList();
      });

      const text = document.createElement('span');
      text.className = 'word-text';
      text.contentEditable = true;
      text.spellcheck = false;
      text.textContent = wordText;
      const otherLists = currentLists.filter(l =>
        l.id !== list.id && (l.type === 'custom' || l.type === 'file') &&
        l.words && l.words.some(w => w.toLowerCase() === wordText.toLowerCase())
      );
      if (otherLists.length) text.classList.add('blocked');

      text.addEventListener('blur', () => {
        const ri = parseInt(row.dataset.wordIdx);
        const p = parseWordPrefix(text.textContent);
        const val = p.word;
        if (!val) {
          if (list.words.length > 1) list.words.splice(ri, 1);
          saveWordList();
          renderWords();
          return;
        }
        let changed = false;
        if (val !== list.words[ri]) {
          const oldKey = list.words[ri].toLowerCase();
          list.words[ri] = val;
          if (matchInside[oldKey] !== undefined) {
            matchInside[val.toLowerCase()] = matchInside[oldKey];
            delete matchInside[oldKey];
          }
          changed = true;
        }
        const key = val.toLowerCase();
        if (p.exact && matchInside[key] !== false) {
          matchInside[key] = false;
          changed = true;
        }
        if (changed) {
          list.matchInside = matchInside;
          saveWordList();
          renderWords();
        } else {
          // Слово не изменилось — просто убираем префикс "=" с экрана
          text.textContent = val;
        }
      });

      text.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const p = parseWordPrefix(text.textContent);
          const val = p.word;
          const ri = parseInt(row.dataset.wordIdx);
          const baseIdx = Math.min(ri, list.words.length - 1);
          if (val) {
            const oldKey = list.words[baseIdx].toLowerCase();
            list.words[baseIdx] = val;
            if (matchInside[oldKey] !== undefined) {
              matchInside[val.toLowerCase()] = matchInside[oldKey];
              delete matchInside[oldKey];
            }
            if (p.exact) matchInside[val.toLowerCase()] = false;
            list.matchInside = matchInside;
          }
          list.words.splice(baseIdx + 1, 0, '');
          saveWordList();
          renderWords();
          const spans = wordList.querySelectorAll('.word-text');
          for (const s of spans) {
            if (!s.textContent.trim()) { s.focus(); break; }
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          text.textContent = list.words[parseInt(row.dataset.wordIdx)] || '';
          text.blur();
        }
      });

      // Удаляем старый обработчик paste, если был
      text.removeEventListener('paste', () => {});
      // Вставка теперь обрабатывается на уровне wordList

      row.append(cb, text);
      for (const other of otherLists) {
        const link = document.createElement('span');
        link.className = 'blocked-link';
        link.textContent = other.name;
        link.addEventListener('click', () => openEditor(other));
        row.append(link);
      }
      return row;
    }

    function renderWords() {
      wordList.innerHTML = '';
      const words = list.words || [];
      if (words.length === 0) words.push('');
      for (let i = 0; i < words.length; i++) {
        wordList.appendChild(createWordRow(words[i], i));
      }
    }

    renderWords();
    editor.appendChild(wordList);
  }

  const deleteRow = document.createElement('div');
  deleteRow.className = 'delete-row';

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = 'Удалить список';
  delBtn.addEventListener('click', () => {
    delBtn.classList.add('is-hidden');
    confirmRow.classList.add('is-visible');
  });

  const confirmRow = document.createElement('div');
  confirmRow.className = 'delete-confirm';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'delete-cancel';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.addEventListener('click', () => {
    confirmRow.classList.remove('is-visible');
    delBtn.classList.remove('is-hidden');
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'delete-do';
  confirmBtn.textContent = 'Удалить';
  confirmBtn.addEventListener('click', () => {
    const idx = currentLists.indexOf(list);
    if (idx !== -1) currentLists.splice(idx, 1);
    storageSet({ lists: currentLists }, () => {
      renderLists(currentLists);
    });
  });

  confirmRow.append(cancelBtn, confirmBtn);
  deleteRow.append(delBtn, confirmRow);
  editor.appendChild(deleteRow);

  back.addEventListener('click', () => {
    renderLists(currentLists);
  });
  switchView('editor');
}

function openAddView() {
  editingList = null;
  hideHeader();
  const view = document.getElementById('addView');

  let selectedId = null;
  let selectedType = 'text';
  let customName = '';

  const header = document.createElement('div');
  header.className = 'editor-header';

  const back = document.createElement('button');
  back.className = 'back-btn';
  back.textContent = '«';
  back.title = 'Назад';

  const centerLabel = document.createElement('div');
  centerLabel.style.cssText = 'flex:1;text-align:center;font-size:14px;font-weight:600;color:#888';
  centerLabel.textContent = 'Выберите цвет и тип';

  const editBtn = document.createElement('button');
  editBtn.className = 'edit-name-btn';
  editBtn.textContent = '✎';
  editBtn.title = 'Изменить название';
  editBtn.addEventListener('click', () => {
    if (header.querySelector('input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = 'flex:1;text-align:center;font-size:14px;font-weight:600;border:none;border-bottom:1.5px solid #007aff;outline:none;background:transparent;color:#222;padding:0;min-width:0;';
    const text = centerLabel.textContent;
    if (text !== 'Выберите цвет и тип' && text !== 'Уже существует') {
      input.value = text;
    }
    centerLabel.style.display = 'none';
    header.insertBefore(input, editBtn);
    input.focus();
    input.select();
    function finish() {
      const val = input.value.trim();
      if (val) customName = val;
      input.remove();
      centerLabel.style.display = '';
      updateUI();
    }
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = ''; finish(); }
    });
  });

  header.append(back, centerLabel, editBtn);

  const palette = document.createElement('div');
  palette.className = 'palette';

  for (const sw of PALETTE) {
    const item = document.createElement('div');
    item.className = 'palette-item';

    const dot = document.createElement('span');
    dot.className = 'palette-swatch';
    dot.style.background = sw.color;
    dot.dataset.id = sw.id;

    const label = document.createElement('span');
    label.className = 'palette-label';
    label.textContent = sw.name;

    item.addEventListener('click', () => {
      palette.querySelectorAll('.palette-swatch').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedId = sw.id;
      updateUI();
    });

    item.append(dot, label);
    palette.appendChild(item);
  }

  const typeRow = document.createElement('div');
  typeRow.className = 'type-row';

  const textBtn = document.createElement('button');
  textBtn.className = 'type-btn active';
  textBtn.textContent = 'текст';
  const markerBtn = document.createElement('button');
  markerBtn.className = 'type-btn';
  markerBtn.textContent = 'маркер';

  function setType(t) {
    selectedType = t;
    textBtn.classList.toggle('active', t === 'text');
    markerBtn.classList.toggle('active', t === 'marker');
    updateUI();
  }

  textBtn.addEventListener('click', () => setType('text'));
  markerBtn.addEventListener('click', () => setType('marker'));

  typeRow.append(textBtn, markerBtn);

  let isBuiltin = false;

  const builtinRow = document.createElement('div');
  builtinRow.className = 'builtin-row';
  const builtinLabel = document.createElement('span');
  builtinLabel.textContent = 'Русский мат';
  const builtinToggle = document.createElement('label');
  builtinToggle.className = 'switch-sm';
  const builtinInput = document.createElement('input');
  builtinInput.type = 'checkbox';
  const builtinSlider = document.createElement('span');
  builtinSlider.className = 'slider';
  builtinToggle.append(builtinInput, builtinSlider);
  builtinRow.append(builtinLabel, builtinToggle);
  builtinInput.addEventListener('change', () => {
    isBuiltin = builtinInput.checked;
    if (isBuiltin) {
      clearFileUpload();
      fuBtn.disabled = true;
      fuBtn.style.opacity = '0.35';
    } else {
      fuBtn.disabled = false;
      fuBtn.style.opacity = '';
    }
    updateUI();
  });

  let loadedWords = [];
  let loadedExact = {};
  let loadedFileName = '';

  const fileUploadSection = document.createElement('div');
  fileUploadSection.className = 'file-upload-section';

  const fuTitleRow = document.createElement('div');
  fuTitleRow.className = 'fu-title-row';

  const fuTitle = document.createElement('span');
  fuTitle.className = 'fu-title';
  fuTitle.textContent = 'Загрузить список из текстового файла';

  const folderSvg =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="white">' +
    '<path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>' +
    '</svg>';
  const trashSvg =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="white">' +
    '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>' +
    '</svg>';

  const fuBtn = document.createElement('button');
  fuBtn.className = 'editor-upload-btn';
  fuBtn.title = 'Выбрать файл';
  fuBtn.innerHTML = folderSvg;

  fuTitleRow.append(fuTitle, fuBtn);

  const fuRow = document.createElement('div');
  fuRow.className = 'fu-row';

  const fuFilename = document.createElement('span');
  fuFilename.className = 'fu-filename';

  const fuInfo = document.createElement('div');
  fuInfo.className = 'fu-info';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt';
  fileInput.style.display = 'none';

  function clearFileUpload() {
    loadedWords = [];
    loadedExact = {};
    loadedFileName = '';
    fileInput.value = '';
    fuBtn.innerHTML = folderSvg;
    fuBtn.title = 'Выбрать файл';
    fuBtn.style.background = '#1976d2';
    builtinInput.disabled = false;
    builtinSlider.style.opacity = '';
    builtinLabel.style.opacity = '';
    updateFileUI();
    updateUI();
  }

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        loadedExact = {};
        loadedWords = e.target.result
          .split(/\r?\n|\r/)
          .map(w => {
            const p = parseWordPrefix(w);
            if (p.exact) loadedExact[p.word.toLowerCase()] = false;
            return p.word;
          })
          .filter(w => w);
        const seen = new Set();
        const deduped = [];
        for (const w of loadedWords) {
          const lower = w.toLowerCase();
          if (!seen.has(lower)) { seen.add(lower); deduped.push(w); }
        }
        const dupCount = loadedWords.length - deduped.length;
        loadedWords = deduped;

        const skipped = [];
        const afterCross = [];
        for (const w of loadedWords) {
          const other = findWordInLists(w, null);
          if (other) skipped.push(w);
          else afterCross.push(w);
        }
        const skipCount = skipped.length;
        loadedWords = afterCross;

        loadedFileName = f.name;
        fuBtn.innerHTML = trashSvg;
        fuBtn.title = 'Удалить файл';
        fuBtn.style.background = '#c62828';
        builtinInput.checked = false;
        isBuiltin = false;
        builtinInput.disabled = true;
        builtinSlider.style.opacity = '0.35';
        builtinLabel.style.opacity = '0.35';
        const exactCount = loadedWords.filter(w => loadedExact[w.toLowerCase()] === false).length;
        updateFileUI(dupCount, skipCount, exactCount);
        updateUI();
      } catch (err) {
        alert('Ошибка при чтении файла: ' + err.message);
      }
    };
    reader.onerror = () => {
      alert('Ошибка при чтении файла: ' + (reader.error?.code || 'неизвестная ошибка'));
    };
    reader.readAsText(f);
  });

  fuBtn.addEventListener('click', () => {
    if (loadedWords.length) {
      clearFileUpload();
    } else {
      fileInput.value = '';
      fileInput.click();
    }
  });
  document.body.appendChild(fileInput);

  function updateFileUI(dupCount, skipCount, exactCount) {
    if (loadedWords.length) {
      fuFilename.textContent = loadedFileName;
      const parts = [`Загружено ${loadedWords.length} слов`];
      if (dupCount) parts.push(`удалено ${dupCount} дубликатов`);
      if (skipCount) parts.push(`${skipCount} пропущено (есть в других списках)`);
      if (exactCount) parts.push(`${exactCount} только полное слово (=)`);
      fuInfo.textContent = parts.join(', ');
      fuInfo.style.color = (dupCount || skipCount) ? '#e65100' : '#666';
      fuRow.style.display = '';
    } else {
      fuFilename.textContent = '';
      fuInfo.textContent = '';
      fuInfo.style.color = '#666';
      fuRow.style.display = 'none';
    }
  }

  updateFileUI();

  fuRow.append(fuFilename);
  fileUploadSection.append(fuTitleRow, fuRow, fuInfo);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-btn';
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Добавить';

  function updateUI() {
    const sw = PALETTE.find(p => p.id === selectedId);

    if (!sw) {
      centerLabel.textContent = 'Выберите цвет и тип';
      centerLabel.style.color = '#888';
      confirmBtn.disabled = true;
      return;
    }

    const typeLabel = selectedType === 'text' ? 'текст' : 'маркер';
    const autoName = isBuiltin ? 'Русский мат' : `${sw.name} ${typeLabel}`;
    const displayName = customName || autoName;
    const exists = isBuiltin ? currentLists.some(l => l.type === 'builtin') : currentLists.some(l => l.name === displayName);

    if (exists) {
      centerLabel.textContent = 'Уже существует';
      centerLabel.style.color = '#c62828';
    } else {
      centerLabel.textContent = displayName;
      centerLabel.style.color = '#222';
    }
    confirmBtn.disabled = exists;
  }

  confirmBtn.addEventListener('click', () => {
    try {
      const sw = PALETTE.find(p => p.id === selectedId);
      if (!sw || confirmBtn.disabled) return;
      const typeLabel = selectedType === 'text' ? 'текст' : 'маркер';
      const name = customName || (isBuiltin ? 'Русский мат' : `${sw.name} ${typeLabel}`);
      const newId = (customName || isBuiltin) ? `${sw.id}-${selectedType}-${Date.now()}` : `${sw.id}-${selectedType}`;
      const matchInside = {};
      if (!isBuiltin) {
        for (const w of loadedWords) {
          if (loadedExact[w.toLowerCase()] === false) matchInside[w.toLowerCase()] = false;
        }
      }
      const newList = {
        id: newId,
        name,
        color: sw.color,
        type: isBuiltin ? 'builtin' : 'custom',
        style: selectedType,
        enabled: true,
        words: isBuiltin ? [] : loadedWords
      };
      if (Object.keys(matchInside).length) newList.matchInside = matchInside;

      currentLists.push(newList);
      storageSet({ lists: currentLists }, () => {
        renderLists(currentLists);
      });
    } catch (e) {
      console.error('[popup] error adding list:', e);
    }
  });

  const scrollArea = document.createElement('div');
  scrollArea.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto;';
  scrollArea.append(palette, typeRow, builtinRow, fileUploadSection);

  view.innerHTML = '';
  view.append(header, scrollArea, confirmBtn);

  back.addEventListener('click', () => renderLists(currentLists));
  switchView('addView');
}

// ===== Генерация userscript для Tampermonkey =====

// Движок подсветки для userscript. Функция НЕ используется напрямую —
// её исходник (toString()) встраивается в генерируемый .user.js.
// Внутри запрещены template literals, chrome.* и ссылки на внешние области видимости.
function __userscriptEngine(HL_DATA) {
  if (window.__rusUncensoredHL) return;
  window.__rusUncensoredHL = true;

  function isSiteDisabled(disabledSites) {
    if (!disabledSites || disabledSites.length === 0) return false;
    var hostname = window.location.hostname.toLowerCase();
    return disabledSites.some(function (pattern) {
      pattern = String(pattern).toLowerCase().trim();
      if (!pattern) return false;
      var regexStr = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      try {
        return new RegExp(regexStr).test(hostname);
      } catch (e) {
        return false;
      }
    });
  }

  if (isSiteDisabled(HL_DATA.disabledSites)) return;

  var styleHost = document.head || document.documentElement;
  if (styleHost && !document.getElementById('hl-userscript-style')) {
    var st = document.createElement('style');
    st.id = 'hl-userscript-style';
    st.textContent = '.hl-w { white-space: nowrap !important; padding: 0 !important; margin: 0 !important; }';
    styleHost.appendChild(st);
  }

  var activeLists = [];
  var customRegexCache = {};
  var trackedWrappers = new Set();

  function isForeignHighlight(element) {
    if (!element) return false;
    var el = element;
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
    var el = element;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('hl-ext')) return true;
      el = el.parentNode;
    }
    return false;
  }

  function compileCustomWordsRegex(words, matchInside) {
    var filtered = (words || []).map(function (w) { return String(w).trim(); }).filter(function (w) { return w; });
    if (filtered.length === 0) return null;
    var partial = [];
    var exact = [];
    for (var i = 0; i < filtered.length; i++) {
      var w = filtered[i];
      var key = w.toLowerCase();
      if (matchInside && matchInside[key] === false) {
        exact.push(w);
      } else {
        partial.push(w);
      }
    }
    function esc(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    var parts = [];
    if (partial.length) parts.push(partial.map(esc).join('|'));
    if (exact.length) parts.push('(?<![\\p{L}])(' + exact.map(esc).join('|') + ')(?![\\p{L}])');
    if (parts.length === 0) return null;
    return new RegExp(parts.join('|'), 'giu');
  }

  function compilePatternSource(source) {
    try {
      var fn = new Function(source + '\nreturn regex;');
      var result = fn();
      if (result instanceof RegExp) return result;
    } catch (e) {}
    return null;
  }

  function buildActiveLists() {
    activeLists = [];
    customRegexCache = {};
    var prio = { pattern: 0, custom: 1, file: 1, builtin: 2 };
    for (var i = 0; i < HL_DATA.lists.length; i++) {
      var list = HL_DATA.lists[i];
      if (list.type === 'custom' || list.type === 'file') {
        customRegexCache[list.id] = compileCustomWordsRegex(list.words, list.matchInside);
        activeLists.push(list);
      } else if (list.type === 'pattern') {
        customRegexCache[list.id] = compilePatternSource(list.patternSource);
        activeLists.push(list);
      } else if (list.type === 'builtin') {
        if (list.words && list.words.length) {
          customRegexCache[list.id] = compileCustomWordsRegex(list.words, list.matchInside);
        } else if (HL_DATA.builtinPatternSource) {
          try {
            customRegexCache[list.id] = new RegExp(HL_DATA.builtinPatternSource, 'g');
          } catch (e) {
            customRegexCache[list.id] = null;
          }
        } else {
          customRegexCache[list.id] = null;
        }
        activeLists.push(list);
      }
    }
    activeLists.sort(function (a, b) {
      return (prio[a.type] || 9) - (prio[b.type] || 9);
    });
  }

  function getListMatches(text, list) {
    var re = customRegexCache[list.id];
    if (!re) return [];
    re.lastIndex = 0;
    var matches = [];
    var m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
    }
    return matches;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }

  function listPriority(list) {
    return (list.type === 'custom' || list.type === 'file') ? 0 : (list.type === 'builtin' ? 1 : 2);
  }

  function buildHtml(text, list) {
    if (list.style === 'text') {
      return '<span style="color:' + list.color + '">' + escapeHtml(text) + '</span>';
    }
    return '<span class="hl-w" style="background-color:' + list.color + ';color:' + (list.textColor || '#000') + '">' + escapeHtml(text) + '</span>';
  }

  function highlightNode(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    if (!node.textContent || !node.parentNode) return;

    var el = node.parentNode;
    while (el && el !== document.body) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      el = el.parentNode;
    }

    var text = node.textContent;
    if (/^[0-9a-fA-F]{32}$/.test(text.trim())) return;

    var allMatches = [];
    for (var i = 0; i < activeLists.length; i++) {
      var lm = getListMatches(text, activeLists[i]);
      for (var k = 0; k < lm.length; k++) {
        allMatches.push({ start: lm[k].start, end: lm[k].end, list: activeLists[i] });
      }
    }
    if (allMatches.length === 0) return;

    allMatches.sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      return listPriority(a.list) - listPriority(b.list);
    });

    var claimed = new Array(text.length).fill(null);
    for (var j = 0; j < allMatches.length; j++) {
      var mm = allMatches[j];
      for (var p = mm.start; p < Math.min(mm.end, text.length); p++) {
        if (claimed[p] === null) claimed[p] = mm.list;
      }
    }

    var result = '';
    var idx = 0;
    while (idx < text.length) {
      var list = claimed[idx];
      var end = idx;
      while (end < text.length && claimed[end] === list) end++;
      var chunk = text.substring(idx, end);
      result += list ? buildHtml(chunk, list) : escapeHtml(chunk);
      idx = end;
    }

    var wrapper = document.createElement('span');
    wrapper.setAttribute('data-hl-wrapper', '');
    wrapper.classList.add('hl-ext');
    wrapper.innerHTML = result;
    node.parentNode.replaceChild(wrapper, node);
    trackedWrappers.add(wrapper);
  }

  function unwrapWrapper(w) {
    var text = w.textContent;
    var t = document.createTextNode(text);
    w.replaceWith(t);
    trackedWrappers.delete(w);
    return t;
  }

  function getBlockAncestor(node) {
    var blocks = ['P','DIV','H1','H2','H3','H4','H5','H6','LI','TD','TH','SECTION','ARTICLE','HEADER','FOOTER','MAIN','ASIDE','NAV','BLOCKQUOTE','DD','DT','FIGCAPTION','FIGURE','BODY'];
    var set = {};
    for (var i = 0; i < blocks.length; i++) set[blocks[i]] = true;
    var el = node.parentNode;
    while (el && el !== document.body) {
      if (set[el.tagName]) return el;
      el = el.parentNode;
    }
    return document.body;
  }

  function processTextGroup(nodes) {
    if (nodes.length === 0) return;
    if (nodes.length === 1) { highlightNode(nodes[0]); return; }

    var combined = '';
    var map = [];
    for (var i = 0; i < nodes.length; i++) {
      var len = nodes[i].textContent.length;
      for (var ci = 0; ci < len; ci++) map.push(nodes[i]);
      combined += nodes[i].textContent;
    }
    if (!combined.trim()) return;

    var allMatches = [];
    for (var a = 0; a < activeLists.length; a++) {
      var lm = getListMatches(combined, activeLists[a]);
      for (var k = 0; k < lm.length; k++) {
        allMatches.push({ start: lm[k].start, end: lm[k].end, list: activeLists[a] });
      }
    }
    if (allMatches.length === 0) return;

    allMatches.sort(function (x, y) {
      if (x.start !== y.start) return x.start - y.start;
      return listPriority(x.list) - listPriority(y.list);
    });

    var claimed = new Array(combined.length).fill(null);
    for (var j = 0; j < allMatches.length; j++) {
      var mm = allMatches[j];
      for (var p = mm.start; p < Math.min(mm.end, combined.length); p++) {
        if (claimed[p] === null) claimed[p] = mm.list;
      }
    }

    var nodeParts = new Map();
    for (var n = 0; n < nodes.length; n++) nodeParts.set(nodes[n], '');

    var idx = 0;
    while (idx < combined.length) {
      var cList = claimed[idx];
      var end = idx;
      while (end < combined.length && claimed[end] === cList) end++;

      for (var q = idx; q < end;) {
        var node = map[q];
        var start = q;
        while (q < end && map[q] === node) q++;
        var seg = combined.substring(start, q);
        var segHtml = cList ? buildHtml(seg, cList) : escapeHtml(seg);
        nodeParts.set(node, nodeParts.get(node) + segHtml);
      }
      idx = end;
    }

    for (var b = 0; b < nodes.length; b++) {
      var html = nodeParts.get(nodes[b]);
      if (!html || !html.includes('<span')) continue;
      var wrapper = document.createElement('span');
      wrapper.setAttribute('data-hl-wrapper', '');
      wrapper.classList.add('hl-ext');
      wrapper.innerHTML = html;
      nodes[b].parentNode.replaceChild(wrapper, nodes[b]);
      trackedWrappers.add(wrapper);
    }
  }

  function processNodeTree(root) {
    if (root.nodeType === Node.TEXT_NODE) root = root.parentNode;
    if (!root) return;

    var textNodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (isOurHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        if (isForeignHighlight(node.parentNode)) return NodeFilter.FILTER_REJECT;
        var tag = node.parentNode.tagName;
        if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'SVG') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    var tn;
    while ((tn = walker.nextNode())) {
      if (tn.isConnected) textNodes.push(tn);
    }

    var groups = [];
    var cur = [];
    var lastBlock = null;
    for (var i = 0; i < textNodes.length; i++) {
      var block = getBlockAncestor(textNodes[i]);
      if (block !== lastBlock && cur.length) { groups.push(cur); cur = []; }
      cur.push(textNodes[i]);
      lastBlock = block;
    }
    if (cur.length) groups.push(cur);

    for (var g = 0; g < groups.length; g++) {
      try { processTextGroup(groups[g]); } catch (e) { console.warn('highlight error', e); }
    }
  }

  buildActiveLists();

  var dirty = false;
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var k = 0; k < added.length; k++) {
        if (added[k].nodeType === Node.ELEMENT_NODE) {
          setTimeout(function (node) { return function () { processNodeTree(node); }; }(added[k]), 10);
        }
      }
    }
    dirty = true;
  });
  observer.observe(document.body, { childList: true, subtree: true });
  processNodeTree(document.body);
  setInterval(function () {
    if (dirty) { dirty = false; processNodeTree(document.body); }
  }, 3000);
}

function generateUserscript(lists, disabledSites) {
  let version = '1.0.0';
  try {
    version = chrome.runtime.getManifest().version;
  } catch (e) {}

  const active = (lists || [])
    .filter(l => l.enabled !== false)
    .map(l => {
      const out = {
        id: l.id,
        name: l.name,
        color: l.color,
        textColor: l.textColor,
        style: l.style,
        type: l.type
      };
      if ((l.type === 'custom' || l.type === 'file') ||
          (l.type === 'builtin' && l.words && l.words.length)) {
        out.words = (l.words || []).slice();
        if (l.matchInside) out.matchInside = { ...l.matchInside };
      }
      if (l.type === 'pattern' && l.patternSource) out.patternSource = l.patternSource;
      return out;
    });

  const data = {
    generated: new Date().toISOString().slice(0, 10),
    disabledSites: disabledSites || [],
    builtinPatternSource: (typeof regex !== 'undefined' && regex instanceof RegExp) ? regex.source : null,
    lists: active
  };

  // '<' экранируем на случай встраивания userscript в HTML-страницу
  const dataJson = JSON.stringify(data).replace(/</g, '\\u003c');

  const engineSrc = __userscriptEngine.toString();

  const header = [
    '// ==UserScript==',
    '// @name         Подсветка нецензурных слов',
    '// @namespace    https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight',
    '// @version      ' + version,
    '// @description  Автономная подсветка нецензурной лексики с вашими списками. Сгенерировано расширением ' + data.generated + '.',
    '// @author       Vova-iz-Tambova',
    '// @homepage     https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight',
    '// @match        *://*/*',
    '// @match        file:///*',
    '// @grant        none',
    '// @run-at       document-end',
    '// ==/UserScript=='
  ].join('\n');

  return header + '\n\n' +
    '(function () {\n' +
    "  'use strict';\n" +
    '  var HL_DATA = ' + dataJson + ';\n' +
    '  (' + engineSrc + ')(HL_DATA);\n' +
    '})();\n';
}

function downloadUserscript(text) {
  const blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rus-uncensored-words.user.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function openSitesEditor() {
  isSitesEditorOpen = true;
  hideHeader();
  document.getElementById('addView').style.display = 'none';
  document.getElementById('infoView').style.display = 'none';
  const editor = document.getElementById('editor');
  editor.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'editor-header';

  const back = document.createElement('button');
  back.className = 'back-btn';
  back.textContent = '«';
  back.title = 'Назад';

  const title = document.createElement('span');
  title.style.cssText = 'flex:1;text-align:center;font-weight:600;font-size:14px';
  title.textContent = 'Игнорируемые сайты';

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'editor-upload-btn';
  uploadBtn.title = 'Загрузить из файла';
  uploadBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="white">' +
    '<path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>' +
    '</svg>';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  fileInput.accept = '.txt';

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split(/\r?\n|\r/).map(s => s.trim()).filter(s => s);
      const existing = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
      const merged = [...new Set([...existing, ...lines])];
      textarea.value = merged.join('\n');
      storageSet({ disabledSites: merged });
    };
    reader.readAsText(f);
  });
  uploadBtn.addEventListener('click', () => fileInput.click());
  document.body.appendChild(fileInput);

  header.append(back, title, uploadBtn);
  editor.appendChild(header);

  const textarea = document.createElement('textarea');
  textarea.className = 'list-textarea';
  textarea.placeholder = 'avito.ru\n*.youtube.com\nexample.org';
  textarea.style.flex = '1';

  storageGet('disabledSites').then(data => {
    textarea.value = (data.disabledSites || []).join('\n');
  });

  let saveTimer = null;
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const sites = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
      storageSet({ disabledSites: sites });
    }, 300);
  });

  editor.append(textarea);

  // ===== Выгрузка userscript для Tampermonkey =====
  const usSection = document.createElement('div');
  usSection.className = 'us-section';

  const usTitle = document.createElement('div');
  usTitle.className = 'us-title';
  usTitle.textContent = 'Userscript для Tampermonkey';

  const usBtn = document.createElement('button');
  usBtn.className = 'us-btn';
  usBtn.textContent = 'Выгрузить userscript (*.user.js)';
  usBtn.title = 'Сохранить userscript со всеми активными списками';
  usBtn.addEventListener('click', () => {
    const sites = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    storageGet('lists').then(data => {
      downloadUserscript(generateUserscript(data.lists || [], sites));
    });
  });

  const usHint = document.createElement('div');
  usHint.className = 'us-hint';
  usHint.textContent = 'Файл содержит все активные списки (слова, цвета, стили), встроенные паттерны и игнорируемые сайты. Откройте файл в Tampermonkey для установки.';

  usSection.append(usTitle, usHint, usBtn);
  editor.appendChild(usSection);

  back.addEventListener('click', () => {
    clearTimeout(saveTimer);
    const sites = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
    storageSet({ disabledSites: sites }, () => {
      renderLists(currentLists);
    });
  });

  switchView('editor');
}

function openExtensionInfo() {
  hideHeader();
  document.getElementById('addView').style.display = 'none';
  const infoView = document.getElementById('infoView');
  infoView.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'info-header';

  const back = document.createElement('button');
  back.className = 'back-btn';
  back.textContent = '«';
  back.title = 'Назад';

  const title = document.createElement('span');
  title.style.cssText = 'flex:1;text-align:center;font-weight:600;font-size:14px';
  title.textContent = 'О расширении';

  const webBtn = document.createElement('button');
  webBtn.className = 'header-info-btn';
  webBtn.title = 'Репозиторий';
  webBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
  webBtn.addEventListener('click', () => window.open('https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight'));

  header.append(back, title, webBtn);

  const content = document.createElement('div');
  content.className = 'info-content';

  function addRow(label, value, href) {
    const row = document.createElement('div');
    row.className = 'info-row';
    const lbl = document.createElement('span');
    lbl.className = 'info-label';
    lbl.textContent = label;
    const val = document.createElement('span');
    val.className = 'info-value';
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = value || href;
      a.target = '_blank';
      a.style.color = '#1976d2';
      a.style.textDecoration = 'none';
      a.addEventListener('mouseenter', () => a.style.textDecoration = 'underline');
      a.addEventListener('mouseleave', () => a.style.textDecoration = 'none');
      val.appendChild(a);
    } else {
      val.textContent = value;
    }
    row.append(lbl, val);
    content.appendChild(row);
  }

  addRow('Версия', '2.2.3');
  addRow('Автор', 'Vova-iz-Tambova', 'https://github.com/Vova-iz-Tambova');
  const desc = document.createElement('div');
  desc.style.cssText = 'margin-top:10px;font-size:12px;line-height:1.6;color:#444;';

  desc.innerHTML = `
    <p style="margin-bottom:8px">Расширение выделяет нецензурную лексику на веб-страницах. Можно создавать собственные списки слов, выбирать цвета и стиль подсветки (цвет текста или маркер). При загрузке из файла, вставке или вводе префикс <code>=</code> перед словом включает режим «подсвечивать только полное слово» (при сохранении списка в файл префикс добавляется к таким словам автоматически).</p>
    <p style="margin:0 0 0 0"><b>Списки:</b></p>
    <p style="margin:0;font-size:12px">
      <span style="font-size:15px">☑</span> подсвечивать только точное совпадение
    </p>
    <p style="margin:0;font-size:12px">
      <span style="font-size:15px">☐</span> подсвечивать любое совпадение
    </p>
    <p style="margin:0;font-size:12px">
      <span style="display:inline-block;border:1px solid #bbb;border-radius:3px;padding:0 3px;font-size:11px;line-height:1.6"><svg viewBox="0 0 24 24" width="11" height="11" fill="#666" style="display:block"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg></span> загрузить слова из текстового файла
    </p>
    <p style="margin:4px 0 8px"><b>Контекстное меню:</b> выделите слово на странице и нажмите правую кнопку мыши — появится пункт «Подсветить слово».</p>
    <p style="margin-bottom:0;font-size:12px;line-height:2">
      <span style="display:inline-block;border:1px solid #bbb;border-radius:3px;padding:0 5px;font-size:11px;line-height:1.6">+</span> добавить в список<br>
      <span style="display:inline-block;border:1px solid #bbb;border-radius:3px;padding:0 5px;font-size:11px;line-height:1.6">−</span> удалить из списка<br>
      <span style="display:inline-block;border:1px solid #bbb;border-radius:3px;padding:0 5px;font-size:11px;line-height:1.6">&gt;</span> перенести в список<br>
      <span style="display:inline-block;border:1px solid #bbb;border-radius:3px;padding:0 5px;font-size:11px;line-height:1.6">=</span> только информация, встроенная подсветка<br>
    </p>
  `;

  content.appendChild(desc);
  infoView.append(header, content);

  back.addEventListener('click', () => renderLists(currentLists));
  switchView('infoView');
}

document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('error', (e) => {
    alert('Ошибка: ' + (e.error?.message || e.message));
  });

  storageGet('lists').then(data => {
    if (data.lists) renderLists(data.lists);
  });

  document.getElementById('settingsBtn').addEventListener('click', openSitesEditor);
  document.getElementById('infoBtn').addEventListener('click', openExtensionInfo);
  document.getElementById('addListBtn').addEventListener('click', openAddView);

  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area !== 'local' && area !== 'sync')) return;
    if ('lists' in changes && !editingList && !isSitesEditorOpen && document.getElementById('addView').style.display !== '' && document.getElementById('infoView').style.display !== '') {
      renderLists(changes.lists.newValue);
    }
  });
});