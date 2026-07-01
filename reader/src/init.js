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
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.keyCode === 33 || e.key === 'ArrowLeft') {
    e.preventDefault();
    if (document.getElementById('toc-overlay')) { renderTocPage(state.tocPage + 1); }
    else if (state.view === 'viewer') { if (state.currentRendition) state.currentRendition.next(); }
    else { renderLibraryPage(state.libPage + 1); }
  } else if (e.keyCode === 34 || e.key === 'ArrowRight') {
    e.preventDefault();
    if (document.getElementById('toc-overlay')) { renderTocPage(state.tocPage - 1); }
    else if (state.view === 'viewer') { if (state.currentRendition) state.currentRendition.prev(); }
    else { renderLibraryPage(state.libPage - 1); }
  }
});

// ===== Boot =====
if (state.token) navigate('/library');
else renderLogin();
