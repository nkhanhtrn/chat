var R = window.R = window.R || {};

if (R.state.token) {
  R.renderLibrary();
} else {
  R.renderLogin();
}
