var R = window.R = window.R || {};

R.renderLogin = function (errorMsg) {
  var app = document.getElementById('app');
  app.innerHTML =
    '<div class="login">' +
      '<h1>Reader</h1>' +
      '<form class="login-form" id="login-form">' +
        '<input type="email" id="email" placeholder="Email" autocomplete="email">' +
        '<input type="password" id="password" placeholder="Password" autocomplete="current-password">' +
        '<button type="submit">Sign In</button>' +
        (errorMsg ? '<div class="error-msg">' + R.escapeHtml(errorMsg) + '</div>' : '') +
      '</form>' +
    '</div>';

  var form = document.getElementById('login-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    if (!email || !password) return;
    R.login(email, password, function (err) {
      if (err) {
        R.renderLogin(err);
      } else {
        R.route();
      }
    });
  });
};
