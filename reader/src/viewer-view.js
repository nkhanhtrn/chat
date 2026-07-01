var R = window.R = window.R || {};

R.renderViewer = function (bookId) {
  var book = null;
  for (var i = 0; i < R.state.books.length; i++) {
    if (R.state.books[i].id === bookId) { book = R.state.books[i]; break; }
  }
  if (!book) {
    R.renderLibrary();
    return;
  }

  var app = document.getElementById('app');
  app.innerHTML =
    '<div class="viewer">' +
      '<div class="viewer-header">' +
        '<button class="icon-btn" id="back-btn">\u2190</button>' +
        '<div class="viewer-title">' + R.escapeHtml(book.title) + '</div>' +
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
    if (R.state.currentRendition) { R.state.currentRendition.destroy(); R.state.currentRendition = null; }
    window.location.hash = '';
  });

  document.getElementById('prev-btn').addEventListener('click', function () {
    if (R.state.currentRendition) R.state.currentRendition.prev();
  });
  document.getElementById('next-btn').addEventListener('click', function () {
    if (R.state.currentRendition) R.state.currentRendition.next();
  });

  R.downloadBook(bookId, function (err, arrayBuffer) {
    if (err) {
      document.getElementById('viewer-area').innerHTML = '<div class="viewer-error"><div>' + R.escapeHtml(err) + '</div></div>';
      return;
    }

    var area = document.getElementById('viewer-area');
    area.innerHTML = '';
    var bookObj = ePub(arrayBuffer);
    var rendition = bookObj.renderTo(area, { width: '100%', height: '100%' });
    R.state.currentRendition = rendition;

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
      R.updateProgressText(book);
    });

    rendition.on('relocated', function (location) {
      if (location && location.start) {
        var pct = bookObj.locations.percentageFromCfi(location.start.cfi);
        document.getElementById('progress-text').textContent = Math.round(pct * 100) + '%';
      }
    });
  });
};

R.updateProgressText = function (book) {
  var el = document.getElementById('progress-text');
  if (el && book.readingProgress) {
    el.textContent = Math.round(book.readingProgress * 100) + '%';
  }
};
