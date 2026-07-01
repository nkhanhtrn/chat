var R = window.R = window.R || {};

R.route = function () {
  if (!R.state.token) {
    R.renderLogin();
    return;
  }

  var hash = window.location.hash;
  var match = hash.match(/^#book\/(.+)$/);

  if (match) {
    R.renderViewer(match[1]);
  } else {
    R.renderLibrary();
  }
};
