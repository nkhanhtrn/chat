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
  document.getElementById('app').innerHTML =
    '<div class="lib">' +
      '<div class="lib-header">' +
        '<h1>My Library</h1>' +
        '<button class="icon-btn" id="logout-btn">Logout</button>' +
      '</div>' +
      '<div class="lib-loading" id="lib-content">Loading&#8230;</div>' +
    '</div>';

  document.getElementById('logout-btn').addEventListener('click', function () {
    clearAuth();
    renderLogin();
  });

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

function renderLibraryPage(page) {
  var books = state.books;
  var totalPages = Math.ceil(books.length / PAGE_SIZE);
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;
  state.libPage = page;

  var start = page * PAGE_SIZE;
  var end = Math.min(start + PAGE_SIZE, books.length);

  var html = '<div class="lib-list">';
  for (var i = start; i < end; i++) {
    var b = books[i];
    var cover = b.coverUrl ? '<img src="' + escapeHtml(b.coverUrl) + '" alt="">' : '\u{1F4DA}';
    var pct = b.readingProgress ? Math.round(b.readingProgress * 100) + '%' : '';
    html +=
      '<div class="book-row" data-id="' + escapeHtml(b.id) + '">' +
        '<div class="cover-sm">' + cover + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div class="book-title">' + escapeHtml(b.title) + '</div>' +
          (b.author ? '<div class="book-author">' + escapeHtml(b.author) + '</div>' : '') +
          (pct ? '<div class="book-progress">' + pct + '</div>' : '') +
        '</div>' +
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

// ===== Viewer =====
function renderViewer(bookId) {
  var book = null;
  for (var i = 0; i < state.books.length; i++) {
    if (state.books[i].id === bookId) { book = state.books[i]; break; }
  }
  if (!book) { renderLibrary(); return; }

  document.getElementById('app').innerHTML =
    '<div class="viewer">' +
      '<div class="viewer-header">' +
        '<button class="icon-btn" id="back-btn">\u2190</button>' +
        '<div class="viewer-title">' + escapeHtml(book.title) + '</div>' +
      '</div>' +
      '<div class="viewer-area" id="viewer-area">' +
        '<div class="lib-loading">Opening&#8230;</div>' +
      '</div>' +
      '<div class="viewer-footer">' +
        '<button class="icon-btn" id="prev-btn">\u2190</button>' +
        '<span id="progress-text">0%</span>' +
        '<button class="icon-btn" id="next-btn">\u2192</button>' +
      '</div>' +
    '</div>';

  document.getElementById('back-btn').addEventListener('click', function () {
    if (state.currentRendition) { state.currentRendition.destroy(); state.currentRendition = null; }
    renderLibrary();
  });

  document.getElementById('prev-btn').addEventListener('click', function () {
    if (state.currentRendition) state.currentRendition.prev();
  });
  document.getElementById('next-btn').addEventListener('click', function () {
    if (state.currentRendition) state.currentRendition.next();
  });

  downloadBook(bookId, function (err, arrayBuffer) {
    var area = document.getElementById('viewer-area');
    if (err) { area.innerHTML = '<div class="viewer-error"><div>' + escapeHtml(err) + '</div></div>'; return; }

    area.innerHTML = '';
    var bookObj = ePub(arrayBuffer);
    var rendition = bookObj.renderTo(area, { width: '100%', height: '100%' });
    state.currentRendition = rendition;

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    rendition.themes.default({
      'html, body': {
        'background-color': isDark ? '#1a1a1a' : '#ffffff',
        'color': isDark ? '#e0e0e0' : '#202020',
      }
    });

    rendition.display(book.lastCfi || undefined).then(function () {
      var el = document.getElementById('progress-text');
      if (el && book.readingProgress) el.textContent = Math.round(book.readingProgress * 100) + '%';
    });

    rendition.on('relocated', function (location) {
      if (location && location.start) {
        var pct = bookObj.locations.percentageFromCfi(location.start.cfi);
        document.getElementById('progress-text').textContent = Math.round(pct * 100) + '%';
      }
    });
  });
}
