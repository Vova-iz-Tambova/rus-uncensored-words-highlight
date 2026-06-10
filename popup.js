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
}

function showMain() {
  showHeader();
  switchView('lists');
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

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'editor-upload-btn';
  uploadBtn.title = 'Загрузить файл';
  uploadBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="white">' +
    '<path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>' +
    '</svg>';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  fileInput.accept = list.type === 'pattern' ? '.js' : '.txt,.js';

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      if (list.type === 'pattern' || f.name.endsWith('.js')) {
        list.type = 'pattern';
        list.patternSource = e.target.result;
        list.file = f.name;
        list.style = 'marker';
        list.color = list.color || '#7b1fa2';
        list.textColor = '#fff';
        delete list.words;
      } else {
        const lines = e.target.result.split('\n').map(w => w.trim()).filter(w => w);
        list.words = lines;
        list.file = f.name;
      }
      chrome.storage.local.set({ lists: currentLists });
      openEditor(list);
    };
    reader.readAsText(f);
  });
  uploadBtn.addEventListener('click', () => fileInput.click());
  document.body.appendChild(fileInput);

  const centerWrap = document.createElement('div');
  centerWrap.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;gap:6px';
  centerWrap.append(dot, title);

  header.append(back, centerWrap, uploadBtn);
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
    updateUI();
  });

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
      words: []
    };
    currentLists.push(newList);
    chrome.storage.local.set({ lists: currentLists });
    renderLists(currentLists);
  });

  view.innerHTML = '';
  view.append(header, palette, typeRow, builtinRow, confirmBtn);

  back.addEventListener('click', () => renderLists(currentLists));
  switchView('addView');
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

  const infoSpacer = document.createElement('div');
  infoSpacer.style.cssText = 'width:24px;height:24px;flex-shrink:0';

  header.append(back, title, infoSpacer);

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

  addRow('Версия', '2.0.0');
  addRow('Автор', 'Vova-iz-Tambova', 'https://github.com/Vova-iz-Tambova');
  addRow('Репозиторий', null, 'https://github.com/Vova-iz-Tambova/rus-uncensored-words-highlight');
  addRow('Лицензия', 'MIT');

  const desc = document.createElement('p');
  desc.style.cssText = 'margin-top:10px;font-size:12px;line-height:1.5;color:#444;padding:8px 0;';
  desc.textContent = 'Расширение выделяет нецензурную лексику на веб-страницах. Можно создавать собственные списки слов, выбирать цвета и стиль подсветки (цвет текста или маркер). Списки синхронизируются между вкладками.';

  content.appendChild(desc);
  infoView.append(header, content);

  back.addEventListener('click', () => renderLists(currentLists));
  switchView('infoView');
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('lists').then(data => {
    if (data.lists) renderLists(data.lists);
  });

  document.getElementById('addBtn').addEventListener('click', openAddView);
  document.getElementById('infoBtn').addEventListener('click', openExtensionInfo);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('lists' in changes && !editingList && document.getElementById('addView').style.display !== '' && document.getElementById('infoView').style.display !== '') {
      renderLists(changes.lists.newValue);
    }
  });
});
