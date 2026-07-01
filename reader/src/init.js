['keydown', 'keyup', 'keypress', 'wheel', 'click', 'mousedown', 'touchstart', 'touchend'].forEach(function (type) {
  document.addEventListener(type, function (e) {
    var el = document.getElementById('key-debug');
    if (!el) return;
    var info = type + ': ';
    if (e.keyCode) info += 'kc=' + e.keyCode + ' ';
    if (e.key) info += 'key=' + e.key + ' ';
    if (e.deltaY) info += 'dy=' + e.deltaY + ' ';
    if (e.button !== undefined) info += 'btn=' + e.button + ' ';
    el.textContent = info;
  }, true);
});

if (state.token) renderLibrary();
else renderLogin();
