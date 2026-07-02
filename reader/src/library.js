// ===== Shared =====
function bindSettingsBtn(id) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', showSettingsModal);
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
      else navigate('/library');
    });
  });
}

// ===== Library =====
var _libShell = null;

function renderLibrary() {
  state.libPage = 0;
  state.view = 'library';
  var app = document.getElementById('app');

  if (_libShell) {
    if (_libShell.parentNode !== app) {
      app.innerHTML = '';
      app.appendChild(_libShell);
    }
    var content = document.getElementById('lib-content');
    if (content) content.innerHTML = '<div class="lib-loading">Loading&#8230;</div>';
    var si = document.getElementById('search-input');
    if (si) si.value = state.searchQuery;
  } else {
    app.innerHTML =
    '<div class="lib">' +
      '<div class="lib-header">' +
        '<h1>My Library</h1>' +
        '<button class="icon-btn" id="font-down-btn">A-</button>' +
        '<button class="icon-btn" id="refresh-btn">\u21BB</button>' +
        '<button class="icon-btn" id="font-up-btn">A+</button>' +
        '<button class="icon-btn" id="settings-btn">' + GEAR_ICON + '</button>' +
        '<a href="#" class="logout-link" id="logout-btn">Logout</a>' +
      '</div>' +
      '<div class="lib-search">' +
        '<input type="search" id="search-input" placeholder="Search title or author&#8230;"' +
          (state.searchQuery ? ' value="' + escapeHtml(state.searchQuery) + '"' : '') + '>' +
      '</div>' +
      '<div class="lib-loading" id="lib-content">Loading&#8230;</div>' +
    '</div>';

    bindSettingsBtn('settings-btn');

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

    document.getElementById('logout-btn').addEventListener('click', function (e) {
      e.preventDefault();
      clearAuth();
      _libShell = null;
      renderLogin();
    });

    var refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      state.books = [];
      navigate('/library');
    });

    _libShell = document.querySelector('.lib');
  }

  if (state.books.length > 0) {
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

function normalizeSearch(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFilteredBooks() {
  var q = normalizeSearch(state.searchQuery);
  if (!q) return state.books;
  var out = [];
  for (var i = 0; i < state.books.length; i++) {
    var b = state.books[i];
    var tn = b._tn || (b._tn = normalizeSearch(b.title));
    var an = b._an || (b._an = normalizeSearch(b.author));
    if (tn.indexOf(q) !== -1 || an.indexOf(q) !== -1) out.push(b);
  }
  return out;
}

function renderLibraryPage(page) {
  var content = document.getElementById('lib-content');
  var books = getFilteredBooks();
  var totalPages = Math.ceil(books.length / PAGE_SIZE);
  if (totalPages === 0) {
    content.innerHTML =
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
          '<div class="book-info">' +
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

  content.innerHTML = html;

  if (content && !content._delegated) {
    content._delegated = true;
    content.addEventListener('click', function (e) {
      var row = e.target;
      while (row && row !== content) {
        if (row.className === 'book-row') {
          navigate('/book/' + row.getAttribute('data-id'));
          return;
        }
        row = row.parentNode;
      }
      var pager = e.target;
      if (pager && pager.id === 'prev-page') renderLibraryPage(state.libPage - 1);
      else if (pager && pager.id === 'next-page') renderLibraryPage(state.libPage + 1);
    });
  }
}
