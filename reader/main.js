(function () {
  'use strict';

  // ===== Config =====
  var API_KEY = 'AIzaSyD7xhfxskPmmGjDlX8il68e91yQgwnSoe8';
  var PROJECT = 'nkhanhtrn-chat';
  var AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY;
  var FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
  var IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  var STORAGE_ORIGIN = IS_DEV
    ? '/fs-proxy/v0/b/nkhanhtrn-chat.firebasestorage.app/o'
    : 'https://firebasestorage.googleapis.com/v0/b/nkhanhtrn-chat.firebasestorage.app/o';

  // ===== State =====
  var state = {
    token: localStorage.getItem('token'),
    uid: localStorage.getItem('uid'),
    refreshToken: localStorage.getItem('refreshToken'),
    books: [],
    currentRendition: null
  };

  // ===== Utils =====
  function xhr(method, url, headers, callback) {
    var x = new XMLHttpRequest();
    x.open(method, url, true);
    if (headers) {
      for (var k in headers) {
        if (headers.hasOwnProperty(k)) x.setRequestHeader(k, headers[k]);
      }
    }
    x.onreadystatechange = function () {
      if (x.readyState === 4) {
        if (x.status >= 200 && x.status < 300) {
          callback(null, x.responseText ? JSON.parse(x.responseText) : null, x);
        } else {
          var msg = (x.responseText) ? (JSON.parse(x.responseText).error || {}).message : x.statusText;
          callback(msg || ('HTTP ' + x.status));
        }
      }
    };
    return x;
  }

  function xhrBlob(method, url, headers, callback) {
    var x = new XMLHttpRequest();
    x.open(method, url, true);
    x.responseType = 'arraybuffer';
    if (headers) {
      for (var k in headers) {
        if (headers.hasOwnProperty(k)) x.setRequestHeader(k, headers[k]);
      }
    }
    x.onreadystatechange = function () {
      if (x.readyState === 4) {
        if (x.status >= 200 && x.status < 300) {
          callback(null, x.response);
        } else {
          callback('Download failed: HTTP ' + x.status);
        }
      }
    };
    return x;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ===== Firestore value unwrap =====
  function unwrap(val) {
    if (!val) return null;
    if (val.stringValue !== undefined) return val.stringValue;
    if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
    if (val.doubleValue !== undefined) return val.doubleValue;
    if (val.booleanValue !== undefined) return val.booleanValue;
    if (val.nullValue !== undefined) return null;
    if (val.timestampValue !== undefined) return val.timestampValue;
    if (val.arrayValue && val.arrayValue.values) return val.arrayValue.values.map(unwrap);
    if (val.mapValue && val.mapValue.fields) {
      var obj = {};
      for (var k in val.mapValue.fields) {
        if (val.mapValue.fields.hasOwnProperty(k)) obj[k] = unwrap(val.mapValue.fields[k]);
      }
      return obj;
    }
    return null;
  }

  // ===== Auth =====
  function saveAuth(data) {
    state.token = data.idToken;
    state.uid = data.localId;
    state.refreshToken = data.refreshToken;
    localStorage.setItem('token', data.idToken);
    localStorage.setItem('uid', data.localId);
    localStorage.setItem('refreshToken', data.refreshToken);
  }

  function clearAuth() {
    state.token = null;
    state.uid = null;
    state.refreshToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('uid');
    localStorage.removeItem('refreshToken');
  }

  function login(email, password, callback) {
    var x = xhr('POST', AUTH_URL, { 'Content-Type': 'application/json' }, function (err, data) {
      if (err) return callback(err);
      saveAuth(data);
      callback(null);
    });
    x.send(JSON.stringify({ email: email, password: password, returnSecureToken: true }));
  }

  // ===== Books =====
  function fetchBooks(callback) {
    var url = FIRESTORE_URL + '/users/' + state.uid + '/books?pageSize=500';
    var x = xhr('GET', url, { Authorization: 'Bearer ' + state.token }, function (err, data) {
      if (err) return callback(err);
      var books = [];
      if (data && data.documents) {
        for (var i = 0; i < data.documents.length; i++) {
          var doc = data.documents[i];
          var name = doc.name || '';
          var bookId = name.split('/').pop();
          var f = doc.fields || {};
          // Skip deleted
          if (unwrap(f.deletedAt)) continue;
          books.push({
            id: bookId,
            title: unwrap(f.title) || 'Untitled',
            author: unwrap(f.author) || '',
            coverUrl: unwrap(f.coverUrl) || '',
            lastCfi: unwrap(f.lastCfi) || '',
            readingProgress: unwrap(f.readingProgress) || 0,
            fileType: unwrap(f.fileType) || 'epub'
          });
        }
      }
      books.sort(function (a, b) {
        return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
      });
      state.books = books;
      callback(null, books);
    });
    x.send();
  }

  function downloadBook(bookId, callback) {
    var path = 'users/' + state.uid + '/books/' + bookId + '/book.epub';
    var encodedPath = encodeURIComponent(path);
    var url = STORAGE_ORIGIN + '/' + encodedPath + '?alt=media';
    var x = xhrBlob('GET', url, { Authorization: 'Bearer ' + state.token }, function (err, data) {
      if (err) return callback(err);
      callback(null, data);
    });
    x.send();
  }

  // ===== Rendering: Login =====
  function renderLogin(errorMsg) {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="login">' +
        '<h1>Reader</h1>' +
        '<form class="login-form" id="login-form">' +
          '<input type="email" id="email" placeholder="Email" autocomplete="email">' +
          '<input type="password" id="password" placeholder="Password" autocomplete="current-password">' +
          '<button type="submit">Sign In</button>' +
          (errorMsg ? '<div class="error-msg">' + escapeHtml(errorMsg) + '</div>' : '') +
        '</form>' +
      '</div>';

    var form = document.getElementById('login-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      if (!email || !password) return;
      login(email, password, function (err) {
        if (err) {
          renderLogin(err);
        } else {
          route();
        }
      });
    });
  }

  // ===== Rendering: Library =====
  function renderLibrary() {
    var app = document.getElementById('app');
    app.innerHTML =
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

      var html = '<div class="lib-list">';
      for (var i = 0; i < books.length; i++) {
        var b = books[i];
        var cover = b.coverUrl
          ? '<img src="' + escapeHtml(b.coverUrl) + '" alt="">'
          : '\u{1F4DA}';
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

      document.getElementById('lib-content').innerHTML = html;

      var rows = document.querySelectorAll('.book-row');
      for (var j = 0; j < rows.length; j++) {
        rows[j].addEventListener('click', function () {
          var id = this.getAttribute('data-id');
          window.location.hash = '#book/' + id;
        });
      }
    });
  }

  // ===== Rendering: Viewer =====
  function renderViewer(bookId) {
    var book = null;
    for (var i = 0; i < state.books.length; i++) {
      if (state.books[i].id === bookId) { book = state.books[i]; break; }
    }
    if (!book) {
      window.location.hash = '';
      return;
    }

    var app = document.getElementById('app');
    app.innerHTML =
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
      window.location.hash = '';
    });

    document.getElementById('prev-btn').addEventListener('click', function () {
      if (state.currentRendition) state.currentRendition.prev();
    });
    document.getElementById('next-btn').addEventListener('click', function () {
      if (state.currentRendition) state.currentRendition.next();
    });

    downloadBook(bookId, function (err, arrayBuffer) {
      if (err) {
        document.getElementById('viewer-area').innerHTML = '<div class="viewer-error"><div>' + escapeHtml(err) + '</div></div>';
        return;
      }

      var area = document.getElementById('viewer-area');
      area.innerHTML = '';
      var bookObj = ePub(arrayBuffer);
      var rendition = bookObj.renderTo(area, { width: '100%', height: '100%' });
      state.currentRendition = rendition;

      var theme = document.documentElement.getAttribute('data-theme');
      var isDark = theme === 'dark';
      rendition.themes.default({
        'html, body': {
          'background-color': isDark ? '#1a1a1a' : '#ffffff',
          'color': isDark ? '#e0e0e0' : '#202020',
        }
      });

      var startCfi = book.lastCfi || undefined;
      rendition.display(startCfi).then(function () {
        updateProgressText(book);
      });

      rendition.on('relocated', function (location) {
        if (location && location.start) {
          var pct = bookObj.locations.percentageFromCfi(location.start.cfi);
          document.getElementById('progress-text').textContent = Math.round(pct * 100) + '%';
        }
      });
    });
  }

  function updateProgressText(book) {
    var el = document.getElementById('progress-text');
    if (el && book.readingProgress) {
      el.textContent = Math.round(book.readingProgress * 100) + '%';
    }
  }

  // ===== Router =====
  function route() {
    if (!state.token) {
      renderLogin();
      return;
    }

    var hash = window.location.hash;
    var match = hash.match(/^#book\/(.+)$/);

    if (match) {
      renderViewer(match[1]);
    } else {
      renderLibrary();
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
