// ===== Settings Modal =====
var DICT_LIST = [
  { id: 'eng', label: 'En-En' },
  { id: 'fre', label: 'Fr-En' },
];
var DL_ICON = '\u2B07';
var RM_ICON = '\u2715';

function showSettingsModal() {
  if (document.getElementById('settings-overlay')) return;

  var dictRowsHtml = '';
  for (var d = 0; d < DICT_LIST.length; d++) {
    dictRowsHtml +=
      '<div class="dict-row">' +
        '<span class="dict-row-name">' + DICT_LIST[d].label + '</span>' +
        '<span class="dict-row-status" id="dict-status-' + DICT_LIST[d].id + '">Checking&#8230;</span>' +
        '<span id="dict-actions-' + DICT_LIST[d].id + '"></span>' +
      '</div>';
  }

  var overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.className = 'settings-overlay';

  var modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.innerHTML =
    '<div class="settings-header">' +
      '<h2>Settings</h2>' +
      '<button class="icon-btn" id="settings-close">\u2715</button>' +
    '</div>' +
    '<div class="settings-body">' +
      '<div class="settings-section">' +
        '<div class="settings-label">Theme</div>' +
        '<div class="seg" id="theme-seg">' +
          '<button class="seg-btn" data-val="light">\u2600 Light</button>' +
          '<button class="seg-btn" data-val="dark">\u263E Dark</button>' +
        '</div>' +
      '</div>' +
      '<div class="settings-section">' +
        '<div class="settings-label">Page Buttons</div>' +
        '<div class="seg" id="nav-seg">' +
          '<button class="seg-btn" data-val="swap">PgUp = Forward</button>' +
          '<button class="seg-btn" data-val="normal">PgDn = Forward</button>' +
        '</div>' +
      '</div>' +
      '<div class="settings-section">' +
        '<div class="settings-label">Lookup Dictionary</div>' +
        '<div class="seg" id="dict-seg">' +
          '<button class="seg-btn" data-val="eng">En-En</button>' +
          '<button class="seg-btn" data-val="fre">Fr-En</button>' +
        '</div>' +
      '</div>' +
      '<div class="settings-section">' +
        '<div class="settings-label">Dictionaries</div>' +
        dictRowsHtml +
      '</div>' +
      '<div class="settings-section">' +
        '<div class="settings-label">Look Up a Word</div>' +
        '<div class="dict-lookup-row">' +
          '<input type="text" id="dict-input" placeholder="Enter a word" autocomplete="off">' +
          '<button class="icon-btn" id="dict-lookup-btn">Go</button>' +
        '</div>' +
        '<div class="dict-result" id="dict-result"></div>' +
      '</div>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hideSettingsModal();
  });
  document.getElementById('settings-close').addEventListener('click', hideSettingsModal);

  _updateThemeSeg();
  _updateNavSeg();
  _updateDictSeg();

  var themeSeg = document.getElementById('theme-seg');
  themeSeg.addEventListener('click', function (e) {
    if (e.target.className.indexOf('seg-btn') === -1) return;
    var val = e.target.getAttribute('data-val');
    var dark = val === 'dark';
    if (dark !== isDark()) {
      toggleTheme();
      _updateThemeSeg();
    }
  });

  var navSeg = document.getElementById('nav-seg');
  navSeg.addEventListener('click', function (e) {
    if (e.target.className.indexOf('seg-btn') === -1) return;
    var val = e.target.getAttribute('data-val');
    state.navSwap = val === 'swap';
    localStorage.setItem('navSwap', state.navSwap ? 'true' : 'false');
    _updateNavSeg();
  });

  var dictSeg = document.getElementById('dict-seg');
  dictSeg.addEventListener('click', function (e) {
    if (e.target.className.indexOf('seg-btn') === -1) return;
    var val = e.target.getAttribute('data-val');
    state.activeDict = val;
    localStorage.setItem('activeDict', val);
    _updateDictSeg();
  });

  renderAllDicts();

  var dictInput = document.getElementById('dict-input');
  document.getElementById('dict-lookup-btn').addEventListener('click', function () {
    _handleDictLookup(dictInput.value);
  });
  dictInput.addEventListener('keydown', function (e) {
    if (e.keyCode === 13) { e.preventDefault(); _handleDictLookup(dictInput.value); }
  });

}

function hideSettingsModal() {
  var overlay = document.getElementById('settings-overlay');
  if (overlay) overlay.parentNode.removeChild(overlay);
}

function _updateThemeSeg() {
  var seg = document.getElementById('theme-seg');
  if (!seg) return;
  var dark = isDark();
  var btns = seg.children;
  for (var i = 0; i < btns.length; i++) {
    var isDarkBtn = btns[i].getAttribute('data-val') === 'dark';
    btns[i].className = 'seg-btn' + (isDarkBtn === dark ? ' active' : '');
  }
}

function _updateNavSeg() {
  var seg = document.getElementById('nav-seg');
  if (!seg) return;
  var btns = seg.children;
  for (var i = 0; i < btns.length; i++) {
    var isSwap = btns[i].getAttribute('data-val') === 'swap';
    btns[i].className = 'seg-btn' + (isSwap === state.navSwap ? ' active' : '');
  }
}

function _updateDictSeg() {
  var seg = document.getElementById('dict-seg');
  if (!seg) return;
  var btns = seg.children;
  for (var i = 0; i < btns.length; i++) {
    var isActive = btns[i].getAttribute('data-val') === state.activeDict;
    btns[i].className = 'seg-btn' + (isActive ? ' active' : '');
  }
}

function renderAllDicts() {
  for (var i = 0; i < DICT_LIST.length; i++) {
    _renderDictRow(DICT_LIST[i]);
  }
}

function _renderDictRow(dict) {
  var statusEl = document.getElementById('dict-status-' + dict.id);
  var actionsEl = document.getElementById('dict-actions-' + dict.id);
  if (!statusEl || !actionsEl) return;

  getDictStatus(dict.id, function (status, count) {
    if (status === 'ready') {
      statusEl.textContent = count + ' words';
      actionsEl.innerHTML = '<button class="icon-btn" id="dict-remove-' + dict.id + '" title="Remove">' + RM_ICON + '</button>';
      var btn = document.getElementById('dict-remove-' + dict.id);
      if (btn) btn.addEventListener('click', function () { _handleDictRemove(dict.id); });
    } else if (status === 'cached') {
      statusEl.textContent = (count || 0).toLocaleString() + ' words';
      actionsEl.innerHTML = '<button class="icon-btn" id="dict-remove-' + dict.id + '" title="Remove">' + RM_ICON + '</button>';
      var btn = document.getElementById('dict-remove-' + dict.id);
      if (btn) btn.addEventListener('click', function () { _handleDictRemove(dict.id); });
    } else {
      statusEl.textContent = 'Not downloaded';
      actionsEl.innerHTML = '<button class="icon-btn" id="dict-download-' + dict.id + '" title="Download">' + DL_ICON + '</button>';
      var btn = document.getElementById('dict-download-' + dict.id);
      if (btn) btn.addEventListener('click', function () { _handleDictDownload(dict.id); });
    }
  });
}

function _handleDictDownload(dictId) {
  console.log('[dict] download clicked:', dictId);
  var statusEl = document.getElementById('dict-status-' + dictId);
  var actionsEl = document.getElementById('dict-actions-' + dictId);
  if (statusEl) statusEl.textContent = 'Downloading\u2026';
  if (actionsEl) actionsEl.innerHTML = '';
  downloadDictionary(dictId, function (err) {
    if (statusEl && err) statusEl.textContent = 'Download failed: ' + err;
    var dict = null;
    for (var i = 0; i < DICT_LIST.length; i++) { if (DICT_LIST[i].id === dictId) dict = DICT_LIST[i]; }
    if (dict) _renderDictRow(dict);
  });
}

function _handleDictRemove(dictId) {
  var statusEl = document.getElementById('dict-status-' + dictId);
  clearDictionary(dictId, function () {
    if (statusEl) statusEl.textContent = 'Removed';
    var dict = null;
    for (var i = 0; i < DICT_LIST.length; i++) { if (DICT_LIST[i].id === dictId) dict = DICT_LIST[i]; }
    if (dict) _renderDictRow(dict);
    var result = document.getElementById('dict-result');
    if (result) result.innerHTML = '';
  });
}

function _handleDictLookup(word) {
  var resultEl = document.getElementById('dict-result');
  if (!resultEl) return;
  var w = String(word || '').trim();
  if (!w) { resultEl.innerHTML = ''; return; }

  resultEl.innerHTML = '<div class="dict-loading">Looking up\u2026</div>';
  dictLookup(w, function (err, entry) {
    if (err) {
      if (err === 'dict-not-downloaded') {
        resultEl.innerHTML = '<div class="dict-not-found">Dictionary not downloaded.</div>';
    } else if (status === 'cached') {
      statusEl.textContent = 'Downloaded';
        resultEl.innerHTML = '<div class="dict-not-found">Error: ' + escapeHtml(err) + '</div>';
      }
      return;
    }
    if (!entry) {
      resultEl.innerHTML = '<div class="dict-not-found">No definition for "' + escapeHtml(w) + '".</div>';
      return;
    }
    resultEl.innerHTML =
      '<div class="dict-word">' + escapeHtml(entry.word) + '</div>' +
      (entry.ipa ? '<div class="dict-ipa">/' + escapeHtml(entry.ipa) + '/</div>' : '') +
      '<div class="dict-def">' + escapeHtml(entry.def) + '</div>';
  });
}
