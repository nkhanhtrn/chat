var R = window.R = window.R || {};

R.fetchBooks = function (callback) {
  var url = R.config.FIRESTORE_URL + '/users/' + R.state.uid + '/books?pageSize=500';
  var x = R.xhr('GET', url, { Authorization: 'Bearer ' + R.state.token }, function (err, data) {
    if (err) return callback(err);
    var books = [];
    if (data && data.documents) {
      for (var i = 0; i < data.documents.length; i++) {
        var doc = data.documents[i];
        var name = doc.name || '';
        var bookId = name.split('/').pop();
        var f = doc.fields || {};
        if (R.unwrap(f.deletedAt)) continue;
        books.push({
          id: bookId,
          title: R.unwrap(f.title) || 'Untitled',
          author: R.unwrap(f.author) || '',
          coverUrl: R.unwrap(f.coverUrl) || '',
          lastCfi: R.unwrap(f.lastCfi) || '',
          readingProgress: R.unwrap(f.readingProgress) || 0,
          fileType: R.unwrap(f.fileType) || 'epub',
        });
      }
    }
    books.sort(function (a, b) {
      return (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
    });
    R.state.books = books;
    callback(null, books);
  });
  x.send();
};

R.downloadBook = function (bookId, callback) {
  var path = 'users/' + R.state.uid + '/books/' + bookId + '/book.epub';
  var encodedPath = encodeURIComponent(path);
  var url = R.config.STORAGE_ORIGIN + '/' + encodedPath + '?alt=media';
  var x = R.xhrBlob('GET', url, { Authorization: 'Bearer ' + R.state.token }, function (err, data) {
    if (err) return callback(err);
    callback(null, data);
  });
  x.send();
};
