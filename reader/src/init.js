// ===== Router =====
function navigate(path) {
  var hash = '#' + path;
  if (window.location.hash === hash) router();
  else window.location.hash = hash;
}

function parseHash() {
  var h = window.location.hash.replace(/^#/, '');
  if (!h || h === '/') return { route: 'root' };
  if (h === '/library') return { route: 'library' };
  if (h.indexOf('/book/') === 0) return { route: 'book', id: h.slice(6) };
  return { route: 'unknown' };
}

function router() {
  var parsed = parseHash();
  if (!state.token) { renderLogin(); return; }
  if (parsed.route === 'book' && parsed.id) {
    renderViewer(parsed.id);
  } else {
    renderLibrary();
  }
}

window.addEventListener('hashchange', router);

// ===== Keydown =====
document.addEventListener('keydown', function (e) {
  if (e.target && e.target.tagName === 'INPUT') {
    if (e.keyCode === 27 && overlayVisible('settings-overlay')) hideSettingsModal();
    return;
  }
  if (e.keyCode === 27) {
    if (overlayVisible('word-popup-overlay')) hideWordPopup();
    else if (overlayVisible('settings-overlay')) hideSettingsModal();
    else if (overlayVisible('toc-overlay')) hideTocModal();
    return;
  }
  if (overlayVisible('settings-overlay')) return;
  var isForwardKey = e.keyCode === 33 || e.keyCode === 37 || e.key === 'ArrowLeft';
  var isBackwardKey = e.keyCode === 34 || e.keyCode === 39 || e.key === 'ArrowRight';
  if (!isForwardKey && !isBackwardKey) return;
  e.preventDefault();
  var forward = state.navSwap ? isForwardKey : isBackwardKey;
  if (overlayVisible('toc-overlay')) {
    renderTocPage(state.tocPage + (forward ? 1 : -1));
  } else if (state.view === 'viewer') {
    if (state.currentRendition) {
      if (forward) state.currentRendition.next();
      else state.currentRendition.prev();
    }
  } else {
    renderLibraryPage(state.libPage + (forward ? 1 : -1));
  }
});

// ===== Boot =====
if (state.token) navigate('/library');
else renderLogin();
