var R = window.R = window.R || {};

R.state = {
  token: localStorage.getItem('token'),
  uid: localStorage.getItem('uid'),
  refreshToken: localStorage.getItem('refreshToken'),
  books: [],
  currentRendition: null,
};
