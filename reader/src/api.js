// ===== Auth =====
function saveAuth(data) {
  state.token = data.idToken;
  state.uid = data.localId;
  localStorage.setItem('token', data.idToken);
  localStorage.setItem('uid', data.localId);
}

function clearAuth() {
  state.token = null;
  state.uid = null;
  localStorage.removeItem('token');
  localStorage.removeItem('uid');
}

function login(email, password, cb) {
  var x = request('POST', AUTH_URL, { 'Content-Type': 'application/json' }, function (err, data) {
    if (err) return cb(err);
    saveAuth(data);
    cb(null);
  });
  x.send(JSON.stringify({ email: email, password: password, returnSecureToken: true }));
}

// ===== Books =====
function fetchBooks(cb) {
  var allBooks = [];

  function fetchPage(token) {
    var url = FIRESTORE_URL + '/users/' + state.uid + '/books?pageSize=500';
    if (token) url += '&pageToken=' + encodeURIComponent(token);
    var x = request('GET', url, { Authorization: 'Bearer ' + state.token }, function (err, data) {
      if (err) return cb(err);
      if (data && data.documents) {
        for (var i = 0; i < data.documents.length; i++) {
          var doc = data.documents[i];
          var f = doc.fields || {};
          if (unwrap(f.deletedAt)) continue;
          var ft = unwrap(f.fileType) || 'epub';
          if (ft !== 'epub') continue;
          allBooks.push({
            id: (doc.name || '').split('/').pop(),
            title: unwrap(f.title) || 'Untitled',
            author: unwrap(f.author) || '',
            coverUrl: unwrap(f.coverUrl) || '',
            lastCfi: unwrap(f.lastCfi) || '',
            readingProgress: unwrap(f.readingProgress) || 0,
            fileType: ft,
          });
        }
      }
      if (data && data.nextPageToken) fetchPage(data.nextPageToken);
      else {
        allBooks.sort(function (a, b) {
          return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
        });
        state.books = allBooks;
        cb(null, allBooks);
      }
    });
    x.send();
  }

  fetchPage(null);
}

function downloadBook(bookId, cb) {
  var path = 'users/' + state.uid + '/books/' + bookId + '/book.epub';
  var url = STORAGE_ORIGIN + '/' + encodeURIComponent(path) + '?alt=media';
  var x = request('GET', url, { Authorization: 'Bearer ' + state.token }, cb, true);
  x.send();
}
