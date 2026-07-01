var R = window.R = window.R || {};

R.config = {
  API_KEY: 'AIzaSyD7xhfxskPmmGjDlX8il68e91yQgwnSoe8',
  PROJECT: 'nkhanhtrn-chat',
};
R.config.AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + R.config.API_KEY;
R.config.FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/' + R.config.PROJECT + '/databases/(default)/documents';
R.config.IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
R.config.STORAGE_ORIGIN = R.config.IS_DEV
  ? '/fs-proxy/v0/b/nkhanhtrn-chat.firebasestorage.app/o'
  : 'https://firebasestorage.googleapis.com/v0/b/nkhanhtrn-chat.firebasestorage.app/o';
