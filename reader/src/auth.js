var R = window.R = window.R || {};

R.saveAuth = function (data) {
  R.state.token = data.idToken;
  R.state.uid = data.localId;
  R.state.refreshToken = data.refreshToken;
  localStorage.setItem('token', data.idToken);
  localStorage.setItem('uid', data.localId);
  localStorage.setItem('refreshToken', data.refreshToken);
};

R.clearAuth = function () {
  R.state.token = null;
  R.state.uid = null;
  R.state.refreshToken = null;
  localStorage.removeItem('token');
  localStorage.removeItem('uid');
  localStorage.removeItem('refreshToken');
};

R.login = function (email, password, callback) {
  var x = R.xhr('POST', R.config.AUTH_URL, { 'Content-Type': 'application/json' }, function (err, data) {
    if (err) return callback(err);
    R.saveAuth(data);
    callback(null);
  });
  x.send(JSON.stringify({ email: email, password: password, returnSecureToken: true }));
};
