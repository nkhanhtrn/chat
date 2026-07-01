var R = window.R = window.R || {};

R.renderLibrary = function () {
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
    R.clearAuth();
    R.renderLogin();
  });

  R.fetchBooks(function (err, books) {
    if (err) {
      document.getElementById('lib-content').innerHTML = '<div class="error-msg">' + R.escapeHtml(err) + '</div>';
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
        ? '<img src="' + R.escapeHtml(b.coverUrl) + '" alt="">'
        : '\u{1F4DA}';
      var pct = b.readingProgress ? Math.round(b.readingProgress * 100) + '%' : '';
      html +=
        '<div class="book-row" data-id="' + R.escapeHtml(b.id) + '">' +
          '<div class="cover-sm">' + cover + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="book-title">' + R.escapeHtml(b.title) + '</div>' +
            (b.author ? '<div class="book-author">' + R.escapeHtml(b.author) + '</div>' : '') +
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
        R.renderViewer(id);
      });
    }
  });
};
