// ===== Shared =====
function bindThemeBtn(id) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', function () {
    toggleTheme();
    btn.textContent = themeIcon();
  });
}

// ===== Login =====
function renderLogin(errorMsg) {
  document.getElementById('app').innerHTML =
    '<div class="login"><h1>Reader</h1>' +
    '<form class="login-form" id="login-form">' +
      '<input type="email" id="email" placeholder="Email" autocomplete="email">' +
      '<input type="password" id="password" placeholder="Password" autocomplete="current-password">' +
      '<button type="submit">Sign In</button>' +
      (errorMsg ? '<div class="error-msg">' + escapeHtml(errorMsg) + '</div>' : '') +
    '</form></div>';

  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    if (!email || !password) return;
    login(email, password, function (err) {
      if (err) renderLogin(err);
      else renderLibrary();
    });
  });
}

// ===== Library =====
function renderLibrary() {
  state.libPage = 0;
  state.view = 'library';
  document.getElementById('app').innerHTML =
    '<div class="lib">' +
      '<div class="lib-header">' +
        '<h1>My Library</h1>' +
        '<button class="icon-btn" id="font-down-btn">A-</button>' +
        '<button class="icon-btn" id="refresh-btn">\u21BB</button>' +
        '<button class="icon-btn" id="font-up-btn">A+</button>' +
        '<button class="icon-btn" id="theme-btn">' + themeIcon() + '</button>' +
        '<button class="icon-btn" id="logout-btn">Logout</button>' +
      '</div>' +
      '<div class="lib-search">' +
        '<input type="search" id="search-input" placeholder="Search title or author&#8230;"' +
          (state.searchQuery ? ' value="' + escapeHtml(state.searchQuery) + '"' : '') + '>' +
      '</div>' +
      '<div class="lib-loading" id="lib-content">Loading&#8230;</div>' +
    '</div>';

  bindThemeBtn('theme-btn');

  var searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      state.searchQuery = this.value;
      renderLibraryPage(0);
    });
  }

  document.getElementById('font-down-btn').addEventListener('click', function () {
    changeLibFontSize(-10);
  });
  document.getElementById('font-up-btn').addEventListener('click', function () {
    changeLibFontSize(10);
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    clearAuth();
    renderLogin();
  });

  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', function () {
    state.books = [];
    renderLibrary();
  });

  if (state.books.length > 0) {
    state.books.sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    renderLibraryPage(0);
  } else {
    fetchBooks(function (err, books) {
      if (err) {
        document.getElementById('lib-content').innerHTML = '<div class="error-msg">' + escapeHtml(err) + '</div>';
        return;
      }
      if (books.length === 0) {
        document.getElementById('lib-content').innerHTML = '<div class="lib-empty">No books yet.</div>';
        return;
      }
      renderLibraryPage(0);
    });
  }
}

function getFilteredBooks() {
  var q = state.searchQuery.trim().toLowerCase();
  if (!q) return state.books;
  var out = [];
  for (var i = 0; i < state.books.length; i++) {
    var b = state.books[i];
    if ((b.title && b.title.toLowerCase().indexOf(q) !== -1) ||
        (b.author && b.author.toLowerCase().indexOf(q) !== -1)) {
      out.push(b);
    }
  }
  return out;
}

function renderLibraryPage(page) {
  var books = getFilteredBooks();
  var totalPages = Math.ceil(books.length / PAGE_SIZE);
  if (totalPages === 0) {
    document.getElementById('lib-content').innerHTML =
      '<div class="lib-empty">No matching books.</div>';
    return;
  }
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;
  state.libPage = page;

  var start = page * PAGE_SIZE;
  var end = Math.min(start + PAGE_SIZE, books.length);

  var html = '<div class="lib-list">';
  for (var i = start; i < end; i++) {
    var b = books[i];
    var pct = b.readingProgress ? Math.round(b.readingProgress) + '%' : '';
      html +=
        '<div class="book-row" data-id="' + escapeHtml(b.id) + '">' +
          '<div style="flex:1;min-width:0">' +
            '<div class="book-title">' + escapeHtml(b.title) + '</div>' +
            (b.author ? '<div class="book-author">' + escapeHtml(b.author) + '</div>' : '') +
          '</div>' +
          (pct ? '<div class="book-progress">' + pct + '</div>' : '') +
        '</div>';
  }
  html += '</div>';

  if (totalPages > 1) {
    html += '<div class="lib-pager">' +
      '<button class="icon-btn icon-btn-big" id="prev-page"' + (page === 0 ? ' disabled' : '') + '>\u2190</button>' +
      '<span class="pager-info">' + (page + 1) + ' / ' + totalPages + '</span>' +
      '<button class="icon-btn icon-btn-big" id="next-page"' + (page === totalPages - 1 ? ' disabled' : '') + '>\u2192</button>' +
    '</div>';
  }

  document.getElementById('lib-content').innerHTML = html;

  var rows = document.querySelectorAll('.book-row');
  for (var j = 0; j < rows.length; j++) {
    rows[j].addEventListener('click', function () {
      renderViewer(this.getAttribute('data-id'));
    });
  }

  var prevBtn = document.getElementById('prev-page');
  if (prevBtn) prevBtn.addEventListener('click', function () { renderLibraryPage(state.libPage - 1); });
  var nextBtn = document.getElementById('next-page');
  if (nextBtn) nextBtn.addEventListener('click', function () { renderLibraryPage(state.libPage + 1); });
}

// ===== TOC Modal =====
var TOC_PAGE_SIZE = 10;

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

function showTocModal() {
  if (document.getElementById('toc-overlay')) return;
  state.tocPage = 0;

  var overlay = document.createElement('div');
  overlay.id = 'toc-overlay';
  overlay.className = 'toc-overlay';

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

  renderTocPage(0);
}

function renderTocPage(page) {
  var flat = flattenToc(state.toc, 0, []);
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

  if (totalPages > 1) {
    footer.innerHTML =
      '<button class="icon-btn icon-btn-big" id="toc-prev"' + (page === 0 ? ' disabled' : '') + '>\u2190</button>' +
      '<span class="pager-info">' + (page + 1) + ' / ' + totalPages + '</span>' +
      '<button class="icon-btn icon-btn-big" id="toc-next"' + (page === totalPages - 1 ? ' disabled' : '') + '>\u2192</button>';

    var prevBtn = document.getElementById('toc-prev');
    if (prevBtn) prevBtn.addEventListener('click', function () { renderTocPage(state.tocPage - 1); });
    var nextBtn = document.getElementById('toc-next');
    if (nextBtn) nextBtn.addEventListener('click', function () { renderTocPage(state.tocPage + 1); });
  } else {
    footer.innerHTML = '';
  }

  var items = body.querySelectorAll('.toc-item');
  for (var j = 0; j < items.length; j++) {
    items[j].addEventListener('click', function () {
      var href = this.getAttribute('data-href');
      if (state.currentRendition && href) state.currentRendition.display(href);
      hideTocModal();
    });
  }
}

function hideTocModal() {
  var overlay = document.getElementById('toc-overlay');
  if (overlay) overlay.parentNode.removeChild(overlay);
}

// ===== Viewer =====
function renderViewer(bookId) {
  state.view = 'viewer';
  var book = null;
  for (var i = 0; i < state.books.length; i++) {
    if (state.books[i].id === bookId) { book = state.books[i]; break; }
  }
  if (!book) { renderLibrary(); return; }

  document.getElementById('app').innerHTML =
    '<div class="viewer">' +
      '<div class="viewer-header">' +
        '<button class="icon-btn" id="back-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></button>' +
        '<div class="viewer-title">' + escapeHtml(book.title) + '</div>' +
        '<button class="icon-btn" id="theme-btn">' + themeIcon() + '</button>' +
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

  bindThemeBtn('theme-btn');

  document.getElementById('toc-btn').addEventListener('click', showTocModal);

  document.getElementById('back-btn').addEventListener('click', function () {
    hideTocModal();
    if (state.progressTimer) { clearTimeout(state.progressTimer); state.progressTimer = null; }
    if (state.currentRendition) { state.currentRendition.destroy(); state.currentRendition = null; }
    state.currentBookObj = null;
    state.toc = [];
    renderLibrary();
  });

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
    var rendition = bookObj.renderTo(area, { width: '100%', height: '100%', gap: 48 });
    state.currentRendition = rendition;
    state.currentBookObj = bookObj;
    state.toc = [];

    bookObj.loaded.navigation.then(function (nav) {
      state.toc = nav.toc;
    });

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    rendition.themes.default({
      'html, body': {
        'background-color': isDark ? '#1a1a1a' : '#ffffff',
        'color': isDark ? '#f0f0f0' : '#000000',
      }
    });
    rendition.themes.fontSize(state.viewerFontSize + '%');
    rendition.themes.override('line-height', String(state.viewerLineHeight));

    rendition.display(book.lastCfi || undefined).then(function () {
      var el = document.getElementById('progress-text');
      if (el && book.readingProgress) el.textContent = Math.round(book.readingProgress) + '%';
    });

    rendition.on('relocated', function (location) {
      if (!location || !location.start) return;
      var cfi = location.start.cfi;
      var pct = (bookObj.locations && bookObj.locations.length > 0)
        ? bookObj.locations.percentageFromCfi(cfi)
        : (book.readingProgress || 0) / 100;
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
