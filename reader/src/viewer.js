// ===== TOC Modal =====
var TOC_PAGE_SIZE = 10;
var _tocModal = null;

function flattenToc(items, depth, out) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    out.push({ href: item.href, label: item.label || '(untitled)', depth: depth });
    if (item.subitems && item.subitems.length > 0) {
      flattenToc(item.subitems, depth + 1, out);
    }
  }
  return out;
}

function _buildTocModal() {
  var old = document.getElementById('toc-overlay');
  if (old) old.parentNode.removeChild(old);

  var overlay = document.createElement('div');
  overlay.id = 'toc-overlay';
  overlay.className = 'toc-overlay';
  overlay.style.display = 'none';

  var modal = document.createElement('div');
  modal.className = 'toc-modal';
  modal.innerHTML =
    '<div class="toc-header">' +
      '<h2>Contents</h2>' +
      '<button class="icon-btn" id="toc-close">\u2715</button>' +
    '</div>' +
    '<div class="toc-body" id="toc-body"></div>' +
    '<div class="toc-footer" id="toc-footer"></div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hideTocModal();
  });
  document.getElementById('toc-close').addEventListener('click', hideTocModal);

  _tocModal = overlay;
}

function showTocModal() {
  if (!_tocModal || !_tocModal.parentNode) _buildTocModal();
  state.tocPage = 0;
  _tocModal.style.display = '';
  renderTocPage(0);
}

function renderTocPage(page) {
  var flat = state.tocFlat;
  if (!flat) state.tocFlat = flat = flattenToc(state.toc, 0, []);
  var totalPages = Math.ceil(flat.length / TOC_PAGE_SIZE);

  var body = document.getElementById('toc-body');
  var footer = document.getElementById('toc-footer');
  if (!body || !footer) return;

  if (totalPages === 0) {
    body.innerHTML = '<div class="toc-empty">No contents available.</div>';
    footer.innerHTML = '';
    return;
  }

  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;
  state.tocPage = page;

  var start = page * TOC_PAGE_SIZE;
  var end = Math.min(start + TOC_PAGE_SIZE, flat.length);

  var html = '';
  for (var i = start; i < end; i++) {
    var item = flat[i];
    var pad = 'padding-left:' + (1 + item.depth * 1.5) + 'rem';
    html += '<div class="toc-item" data-href="' + escapeHtml(item.href) + '" style="' + pad + '">' +
      escapeHtml(item.label) + '</div>';
  }
  body.innerHTML = html;

  if (!body._delegated) {
    body._delegated = true;
    body.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== body) {
        if (el.className === 'toc-item') {
          var href = el.getAttribute('data-href');
          if (state.currentRendition && href) state.currentRendition.display(href);
          hideTocModal();
          return;
        }
        el = el.parentNode;
      }
    });
  }

  if (totalPages > 1) {
    footer.innerHTML =
      '<button class="icon-btn icon-btn-big" id="toc-prev"' + (page === 0 ? ' disabled' : '') + '>\u2190</button>' +
      '<span class="pager-info">' + (page + 1) + ' / ' + totalPages + '</span>' +
      '<button class="icon-btn icon-btn-big" id="toc-next"' + (page === totalPages - 1 ? ' disabled' : '') + '>\u2192</button>';

    if (!footer._delegated) {
      footer._delegated = true;
      footer.addEventListener('click', function (e) {
        if (e.target.id === 'toc-prev') renderTocPage(state.tocPage - 1);
        else if (e.target.id === 'toc-next') renderTocPage(state.tocPage + 1);
      });
    }
  } else {
    footer.innerHTML = '';
  }
}

function hideTocModal() {
  if (_tocModal) _tocModal.style.display = 'none';
}

// ===== Progress =====
function estimateProgress(bookObj, location, fallback) {
  if (!location || !location.start) return fallback;
  if (bookObj.locations && bookObj.locations.length > 0) {
    return bookObj.locations.percentageFromCfi(location.start.cfi);
  }
  if (typeof location.start.index === 'number' && bookObj.spine && bookObj.spine.length > 0) {
    return (location.start.index + 1) / bookObj.spine.length;
  }
  return fallback;
}

// ===== Viewer =====
function renderViewer(bookId) {
  state.view = 'viewer';
  var book = null;
  for (var i = 0; i < state.books.length; i++) {
    if (state.books[i].id === bookId) { book = state.books[i]; break; }
  }
  if (!book) { navigate('/library'); return; }

  document.getElementById('app').innerHTML =
    '<div class="viewer">' +
      '<div class="viewer-header">' +
        '<button class="icon-btn" id="back-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></button>' +
        '<div class="viewer-title">' + escapeHtml(book.title) + '</div>' +
        '<button class="icon-btn" id="settings-btn">' + GEAR_ICON + '</button>' +
        '<button class="icon-btn" id="toc-btn">\u2630</button>' +
      '</div>' +
      '<div class="viewer-area" id="viewer-area">' +
        '<div class="lib-loading">Opening&#8230;</div>' +
      '</div>' +
      '<div class="viewer-footer">' +
        '<button class="icon-btn" id="prev-btn">\u2190</button>' +
        '<div class="footer-center">' +
          '<button class="icon-btn" id="font-down-btn">A-</button>' +
          '<button class="icon-btn" id="font-up-btn">A+</button>' +
          '<span id="progress-text">0%</span>' +
          '<button class="icon-btn" id="line-down-btn">\u2261-</button>' +
          '<button class="icon-btn" id="line-up-btn">\u2261+</button>' +
        '</div>' +
        '<button class="icon-btn" id="next-btn">\u2192</button>' +
      '</div>' +
    '</div>';

  bindSettingsBtn('settings-btn');

  document.getElementById('back-btn').addEventListener('click', function () {
    hideTocModal();
    if (state.progressTimer) { clearTimeout(state.progressTimer); state.progressTimer = null; }
    var r = state.currentRendition;
    state.currentRendition = null;
    state.currentBookObj = null;
    state.toc = [];
    state.tocFlat = null;
    var titleEl = document.querySelector('.viewer-title');
    if (titleEl) titleEl.textContent = 'Closing\u2026';
    setTimeout(function () {
      if (r) { try { r.destroy(); } catch (e) {} }
      navigate('/library');
    }, 0);
  });

  document.getElementById('toc-btn').addEventListener('click', showTocModal);

  document.getElementById('prev-btn').addEventListener('click', function () {
    if (state.currentRendition) state.currentRendition.prev();
  });
  document.getElementById('next-btn').addEventListener('click', function () {
    if (state.currentRendition) state.currentRendition.next();
  });
  document.getElementById('font-down-btn').addEventListener('click', function () {
    changeViewerFontSize(-10);
  });
  document.getElementById('font-up-btn').addEventListener('click', function () {
    changeViewerFontSize(10);
  });
  document.getElementById('line-down-btn').addEventListener('click', function () {
    changeViewerLineHeight(-0.1);
  });
  document.getElementById('line-up-btn').addEventListener('click', function () {
    changeViewerLineHeight(0.1);
  });

  downloadBook(bookId, function (err, arrayBuffer) {
    var area = document.getElementById('viewer-area');
    if (err) { area.innerHTML = '<div class="viewer-error"><div>' + escapeHtml(err) + '</div></div>'; return; }

    area.innerHTML = '';
    var bookObj = ePub(arrayBuffer);
    arrayBuffer = null;
    var rendition = bookObj.renderTo(area, { width: '100%', height: '100%', gap: 48 });
    state.currentRendition = rendition;
    state.currentBookObj = bookObj;
    state.toc = [];
    attachWordLookup(rendition);

    bookObj.loaded.navigation.then(function (nav) {
      if (state.currentBookObj !== bookObj) return;
      state.toc = nav.toc;
      state.tocFlat = flattenToc(nav.toc, 0, []);
    });

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    rendition.themes.default({
      'html, body': {
        'background-color': isDark ? '#1a1a1a' : '#ffffff',
        'color': isDark ? '#f0f0f0' : '#000000',
      },
      'p, div, span, li, ol, ul, dd, dt, dl, blockquote, td, th, tr, caption, figcaption, h1, h2, h3, h4, h5, h6, cite, q': {
        'color': isDark ? '#f0f0f0' : '#000000',
      },
      'a, a:link, a:visited': {
        'color': 'inherit',
      }
    });
    rendition.themes.fontSize(state.viewerFontSize + '%');
    rendition.themes.override('line-height', String(state.viewerLineHeight));

    rendition.display(book.lastCfi || undefined).then(function () {
      if (state.currentRendition !== rendition) return;
      var el = document.getElementById('progress-text');
      if (el && book.readingProgress) el.textContent = Math.round(book.readingProgress) + '%';
    });

    rendition.on('relocated', function (location) {
      if (state.currentRendition !== rendition) return;
      if (!location || !location.start) return;
      var cfi = location.start.cfi;
      var pct = estimateProgress(bookObj, location, (book.readingProgress || 0) / 100);
      var pctRounded = Math.round(pct * 100);
      var el = document.getElementById('progress-text');
      if (el) el.textContent = pctRounded + '%';
      if (state.progressTimer) clearTimeout(state.progressTimer);
      state.progressTimer = setTimeout(function () {
        saveProgress(bookId, cfi, pct, function (err) {
          if (err) console.warn('Progress sync failed:', err);
          else {
            book.updatedAt = Date.now();
            book.readingProgress = Math.round(pct * 100);
            book.lastCfi = cfi;
          }
        });
      }, 2000);
    });
  });
}
