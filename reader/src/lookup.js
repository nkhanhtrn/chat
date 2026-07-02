// ===== Word Lookup (double-tap) =====
function extractWord(text, offset) {
  if (!text || offset < 0 || offset > text.length) return '';
  var before = text.substring(0, offset);
  var after = text.substring(offset);
  var startMatch = before.match(/[A-Za-z']+$/);
  var start = startMatch ? offset - startMatch[0].length : offset;
  var endMatch = after.match(/^[A-Za-z']+/);
  var end = endMatch ? offset + endMatch[0].length : offset;
  return text.substring(start, end);
}

function getWordAtPoint(doc, x, y) {
  var range = null;
  if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(x, y);
  } else if (doc.caretPositionFromPoint) {
    var caret = doc.caretPositionFromPoint(x, y);
    if (caret) {
      range = doc.createRange();
      range.setStart(caret.offsetNode, caret.offset);
      range.collapse(true);
    }
  }
  if (!range || !range.startContainer) return null;
  var node = range.startContainer;
  if (!node || node.nodeType !== 3) return null;
  var word = extractWord(node.nodeValue, range.startOffset);
  return word || null;
}

function showWordPopup(word) {
  hideWordPopup();
  var overlay = document.createElement('div');
  overlay.id = 'word-popup-overlay';
  overlay.className = 'word-popup-overlay';

  var popup = document.createElement('div');
  popup.className = 'word-popup';
  popup.innerHTML =
    '<div class="word-popup-word">' + escapeHtml(word) + '</div>' +
    '<div class="word-popup-ipa" id="word-popup-ipa"></div>' +
    '<div class="word-popup-def" id="word-popup-def">Looking up\u2026</div>';

  overlay.appendChild(popup);
  overlay.addEventListener('click', hideWordPopup);
  document.body.appendChild(overlay);

  dictLookup(word, function (err, entry) {
    var defEl = document.getElementById('word-popup-def');
    var ipaEl = document.getElementById('word-popup-ipa');
    if (!defEl) return;
    if (err) {
      if (err === 'dict-not-downloaded') {
        defEl.textContent = 'Dictionary not downloaded. Open Settings to download.';
      } else {
        defEl.textContent = 'Error: ' + err;
      }
    } else if (!entry) {
      defEl.textContent = 'No definition found.';
    } else {
      var wordEl = document.querySelector('.word-popup-word');
      if (wordEl) wordEl.textContent = entry.word;
      if (ipaEl && entry.ipa) ipaEl.textContent = '/' + entry.ipa + '/';
      defEl.textContent = entry.def;
    }
  });
}

function hideWordPopup() {
  var overlay = document.getElementById('word-popup-overlay');
  if (overlay) overlay.parentNode.removeChild(overlay);
}

function attachWordLookup(rendition) {
  if (!rendition || !rendition.hooks || !rendition.hooks.content) return;
  rendition.hooks.content.register(function (arg) {
    var doc = null;
    if (arg && arg.document) doc = arg.document;
    else if (arg && arg.contents && arg.contents.document) doc = arg.contents.document;
    if (!doc) return;

    var lastTap = 0;
    var lastX = 0;
    var lastY = 0;

    doc.addEventListener('click', function (e) {
      var now = Date.now();
      var x = e.clientX;
      var y = e.clientY;

      if (now - lastTap < 350 && Math.abs(x - lastX) < 40 && Math.abs(y - lastY) < 40) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        lastTap = 0;
        var word = getWordAtPoint(doc, x, y);
        if (word) showWordPopup(word);
      } else {
        lastTap = now;
        lastX = x;
        lastY = y;
      }
    }, false);
  });
}
