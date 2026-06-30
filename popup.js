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
    chrome.storage.local.set({ lists: currentLists });
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
      const text = list.words.filter(w => w.trim()).join('\n');
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
      chrome.storage.local.set({ lists: currentLists });
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
        const val = text.textContent.trim();
        const ri = parseInt(row.dataset.wordIdx);
        if (!val) {
          if (list.words.length > 1) list.words.splice(ri, 1);
          saveWordList();
          renderWords();
          return;
        }
        if (val !== list.words[ri]) {
          const oldKey = list.words[ri].toLowerCase();
          list.words[ri] = val;
          if (matchInside[oldKey] !== undefined) {
            matchInside[val.toLowerCase()] = matchInside[oldKey];
            delete matchInside[oldKey];
          }
          list.matchInside = matchInside;
          saveWordList();
          renderWords();
        }
      });

      text.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const val = text.textContent.trim();
          const ri = parseInt(row.dataset.wordIdx);
          const baseIdx = Math.min(ri, list.words.length - 1);
          if (val) {
            const oldKey = list.words[baseIdx].toLowerCase();
            list.words[baseIdx] = val;
            if (matchInside[oldKey] !== undefined) {
              matchInside[val.toLowerCase()] = matchInside[oldKey];
              delete matchInside[oldKey];
            }
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

      text.addEventListener('paste', e => {
        e.preventDefault();
        const textData = (e.clipboardData || window.clipboardData).getData('text/plain');
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        sel.deleteFromDocument();
        sel.getRangeAt(0).insertNode(document.createTextNode(textData));
        sel.collapseToEnd();
      });

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
    chrome.storage.local.set({ lists: currentLists });
    renderLists(currentLists);
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
      loadedWords = e.target.result.split('\n').map(w => w.trim()).filter(w => w);
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
      updateFileUI(dupCount, skipCount);
      updateUI();
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

  function updateFileUI(dupCount, skipCount) {
    if (loadedWords.length) {
      fuFilename.textContent = loadedFileName;
      const parts = [`Загружено ${loadedWords.length} слов`];
      if (dupCount) parts.push(`удалено ${dupCount} дубликатов`);
      if (skipCount) parts.push(`${skipCount} пропущено (есть в других списках)`);
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
    const sw = PALETTE.find(p => p.id === selectedId);
    if (!sw || confirmBtn.disabled) return;
    const typeLabel = selectedType === 'text' ? 'текст' : 'маркер';
    const name = customName || (isBuiltin ? 'Русский мат' : `${sw.name} ${typeLabel}`);
    const newId = (customName || isBuiltin) ? `${sw.id}-${selectedType}-${Date.now()}` : `${sw.id}-${selectedType}`;
    const newList = {
      id: newId,
      name,
      color: sw.color,
      type: isBuiltin ? 'builtin' : 'custom',
      style: selectedType,
      enabled: true,
      words: isBuiltin ? [] : loadedWords
    };

    currentLists.push(newList);
    chrome.storage.local.set({ lists: currentLists });
    renderLists(currentLists);
  });

  const scrollArea = document.createElement('div');
  scrollArea.style.cssText = 'flex: 1; min-height: 0; overflow-y: auto;';
  scrollArea.append(palette, typeRow, builtinRow, fileUploadSection);

  view.innerHTML = '';
  view.append(header, scrollArea, confirmBtn);

  back.addEventListener('click', () => renderLists(currentLists));
  switchView('addView');
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
      const lines = e.target.result.split('\n').map(s => s.trim()).filter(s => s);
      const existing = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
      const merged = [...new Set([...existing, ...lines])];
      textarea.value = merged.join('\n');
      chrome.storage.local.set({ disabledSites: merged });
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

  chrome.storage.local.get('disabledSites').then(data => {
    textarea.value = (data.disabledSites || []).join('\n');
  });

  let saveTimer = null;
  textarea.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const sites = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
      chrome.storage.local.set({ disabledSites: sites });
    }, 300);
  });

  editor.append(textarea);

  back.addEventListener('click', () => {
    clearTimeout(saveTimer);
    const sites = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
    chrome.storage.local.set({ disabledSites: sites }).then(() => {
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

  addRow('Версия', '2.0.2');
  addRow('Автор', 'Vova-iz-Tambova', 'https://github.com/Vova-iz-Tambova');
  const desc = document.createElement('div');
  desc.style.cssText = 'margin-top:10px;font-size:12px;line-height:1.6;color:#444;';

  desc.innerHTML = `
    <p style="margin-bottom:8px">Расширение выделяет нецензурную лексику на веб-страницах. Можно создавать собственные списки слов, выбирать цвета и стиль подсветки (цвет текста или маркер).</p>
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
  chrome.storage.local.get('lists').then(data => {
    if (data.lists) renderLists(data.lists);
  });

  document.getElementById('settingsBtn').addEventListener('click', openSitesEditor);
  document.getElementById('infoBtn').addEventListener('click', openExtensionInfo);
  document.getElementById('addListBtn').addEventListener('click', openAddView);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('lists' in changes && !editingList && !isSitesEditorOpen && document.getElementById('addView').style.display !== '' && document.getElementById('infoView').style.display !== '') {
      renderLists(changes.lists.newValue);
    }
  });
});
