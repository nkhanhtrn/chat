// ===== Auth =====
function saveAuth(data) {
  state.token = data.idToken;
  state.uid = data.localId;
  state.refreshToken = data.refreshToken;
  state.tokenExpiry = Date.now() + (parseInt(data.expiresIn, 10) * 1000);
  localStorage.setItem('token', data.idToken);
  localStorage.setItem('uid', data.localId);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('tokenExpiry', String(state.tokenExpiry));
}

function clearAuth() {
  state.token = null;
  state.uid = null;
  state.refreshToken = null;
  state.tokenExpiry = 0;
  localStorage.removeItem('token');
  localStorage.removeItem('uid');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('tokenExpiry');
}

function login(email, password, cb) {
  var x = request('POST', AUTH_URL, { 'Content-Type': 'application/json' }, function (err, data) {
    if (err) return cb(err);
    saveAuth(data);
    cb(null);
  });
  x.send(JSON.stringify({ email: email, password: password, returnSecureToken: true }));
}

function doRefresh(cb) {
  var body = 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(state.refreshToken);
  var x = request('POST', REFRESH_URL, { 'Content-Type': 'application/x-www-form-urlencoded' }, function (err, data) {
    if (err) return cb(err);
    state.token = data.id_token;
    state.refreshToken = data.refresh_token;
    state.tokenExpiry = Date.now() + (parseInt(data.expires_in, 10) * 1000);
    localStorage.setItem('token', data.id_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('tokenExpiry', String(state.tokenExpiry));
    cb(null);
  });
  x.send(body);
}

function ensureToken(cb) {
  if (!state.token) return cb('Not authenticated');
  var fiveMin = 5 * 60 * 1000;
  if (state.tokenExpiry && Date.now() < state.tokenExpiry - fiveMin) return cb(null);
  if (!state.refreshToken) return cb('Session expired');
  doRefresh(cb);
}

// ===== Books =====
function fetchBooks(cb) {
  ensureToken(function (authErr) {
    if (authErr) return cb(authErr);
    var url = FIRESTORE_URL + ':runQuery';
    var body = JSON.stringify({
      parent: FIRESTORE_PARENT + '/users/' + state.uid,
      structuredQuery: {
        from: [{ collectionId: 'books' }],
        select: {
          fields: [
            { fieldPath: 'title' },
            { fieldPath: 'author' },
            { fieldPath: 'readingProgress' },
          ],
        },
        where: {
          fieldFilter: {
            field: { fieldPath: 'fileType' },
            op: 'EQUAL',
            value: { stringValue: 'epub' },
          },
        },
      },
    });
    var x = request('POST', url, {
      Authorization: 'Bearer ' + state.token,
      'Content-Type': 'application/json',
    }, function (err, data) {
      if (err) return cb(err);
      var books = [];
      if (data && data.length) {
        for (var i = 0; i < data.length; i++) {
          if (!data[i].document) continue;
          var doc = data[i].document;
          var f = doc.fields || {};
          books.push({
            id: (doc.name || '').split('/').pop(),
            title: unwrap(f.title) || 'Untitled',
            author: unwrap(f.author) || '',
            readingProgress: unwrap(f.readingProgress) || 0,
            lastCfi: '',
          });
        }
      }
      books.sort(function (a, b) {
        return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
      });
      state.books = books;
      cb(null, books);
    });
    x.send(body);
  });
}

function downloadBook(bookId, cb) {
  ensureToken(function (authErr) {
    if (authErr) return cb(authErr);
    var path = 'users/' + state.uid + '/books/' + bookId + '/book.epub';
    var url = STORAGE_ORIGIN + '/' + encodeURIComponent(path) + '?alt=media';
    var x = request('GET', url, { Authorization: 'Bearer ' + state.token }, cb, true);
    x.send();
  });
}

function saveProgress(bookId, cfi, progress, cb) {
  ensureToken(function (authErr) {
    if (authErr) return cb(authErr);
    var url = FIRESTORE_URL + '/users/' + state.uid + '/books/' + bookId +
      '?updateMask.fieldPaths=lastCfi&updateMask.fieldPaths=readingProgress';
    var body = JSON.stringify({
      fields: {
        lastCfi: { stringValue: cfi },
        readingProgress: { integerValue: String(Math.round(progress * 100)) },
      },
    });
    var x = request('PATCH', url, {
      Authorization: 'Bearer ' + state.token,
      'Content-Type': 'application/json',
    }, cb);
    x.send(body);
  });
}
