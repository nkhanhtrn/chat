document.addEventListener('keydown', function (e) {
  var el = document.getElementById('key-debug');
  if (el) el.textContent = 'keyCode=' + e.keyCode + ' key=' + e.key;
});

if (state.token) renderLibrary();
else renderLogin();
