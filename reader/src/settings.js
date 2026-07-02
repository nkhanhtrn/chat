// ===== Settings Modal =====
function showSettingsModal() {
  if (document.getElementById('settings-overlay')) return;

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
        '<div class="settings-label">Eng-Eng Dictionary</div>' +
        '<div class="dict-status-line">' +
          '<div class="dict-status-text" id="dict-status">Checking&#8230;</div>' +
          '<div id="dict-actions"></div>' +
        '</div>' +
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

  renderDictStatus();

  var dictInput = document.getElementById('dict-input');
  document.getElementById('dict-lookup-btn').addEventListener('click', function () {
    _handleDictLookup(dictInput.value);
  });
  dictInput.addEventListener('keydown', function (e) {
    if (e.keyCode === 13) { e.preventDefault(); _handleDictLookup(dictInput.value); }
  });

  dictInput.focus();
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

function renderDictStatus() {
  var statusEl = document.getElementById('dict-status');
  var actionsEl = document.getElementById('dict-actions');
  if (!statusEl || !actionsEl) return;

  getDictStatus(function (status, count) {
    if (status === 'ready' || status === 'cached') {
      statusEl.textContent = (count || '20,000') + ' words ready';
      actionsEl.innerHTML = '<button class="icon-btn" id="dict-remove-btn">Remove</button>';
      document.getElementById('dict-remove-btn').addEventListener('click', _handleDictRemove);
    } else {
      statusEl.textContent = 'Downloading\u2026';
      actionsEl.innerHTML = '';
      _handleDictDownload();
    }
  });
}

function _handleDictDownload() {
  var statusEl = document.getElementById('dict-status');
  var actionsEl = document.getElementById('dict-actions');
  if (statusEl) statusEl.textContent = 'Downloading\u2026';
  if (actionsEl) actionsEl.innerHTML = '';
  downloadDictionary(function (err) {
    if (err) {
      if (statusEl) statusEl.textContent = 'Download failed: ' + err;
      renderDictStatus();
      return;
    }
    renderDictStatus();
  });
}

function _handleDictRemove() {
  var statusEl = document.getElementById('dict-status');
  clearDictionary(function () {
    if (statusEl) statusEl.textContent = 'Removed';
    renderDictStatus();
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
      } else {
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
