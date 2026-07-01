document.addEventListener('keydown', function (e) {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.keyCode === 33 || e.key === 'ArrowLeft') {
    e.preventDefault();
    if (document.getElementById('toc-overlay')) { renderTocPage(state.tocPage - 1); }
    else if (state.view === 'viewer') { if (state.currentRendition) state.currentRendition.prev(); }
    else { renderLibraryPage(state.libPage - 1); }
  } else if (e.keyCode === 34 || e.key === 'ArrowRight') {
    e.preventDefault();
    if (document.getElementById('toc-overlay')) { renderTocPage(state.tocPage + 1); }
    else if (state.view === 'viewer') { if (state.currentRendition) state.currentRendition.next(); }
    else { renderLibraryPage(state.libPage + 1); }
  }
});

if (state.token) renderLibrary();
else renderLogin();
