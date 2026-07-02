// ===== Config =====
var API_KEY = 'AIzaSyD7xhfxskPmmGjDlX8il68e91yQgwnSoe8';
var FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/nkhanhtrn-chat/databases/(default)/documents';
var FIRESTORE_PARENT = 'projects/nkhanhtrn-chat/databases/(default)/documents';
var AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY;
var REFRESH_URL = 'https://securetoken.googleapis.com/v1/token?key=' + API_KEY;
var PAGE_SIZE = 8;
var IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
var STORAGE_ORIGIN = IS_DEV
  ? '/fs-proxy/v0/b/nkhanhtrn-chat.firebasestorage.app/o'
  : 'https://firebasestorage.googleapis.com/v0/b/nkhanhtrn-chat.firebasestorage.app/o';

// ===== State =====
function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

function toggleTheme() {
  var next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  if (state.currentRendition) {
    var dark = next === 'dark';
    state.currentRendition.themes.default({
      'html, body': {
        'background-color': dark ? '#1a1a1a' : '#ffffff',
        'color': dark ? '#f0f0f0' : '#000000',
      }
    });
  }
}

function themeIcon() { return isDark() ? '\u2600' : '\u263E'; }

function changeLibFontSize(delta) {
  var next = state.libFontSize + delta;
  if (next < 60) next = 60;
  if (next > 200) next = 200;
  state.libFontSize = next;
  localStorage.setItem('libFontSize', String(next));
  applyRootFontSize();
}

function changeViewerFontSize(delta) {
  var next = state.viewerFontSize + delta;
  if (next < 60) next = 60;
  if (next > 300) next = 300;
  state.viewerFontSize = next;
  localStorage.setItem('viewerFontSize', String(next));
  if (state.currentRendition) state.currentRendition.themes.fontSize(next + '%');
}

function changeViewerLineHeight(delta) {
  var next = Math.round((state.viewerLineHeight + delta) * 10) / 10;
  if (next < 1.0) next = 1.0;
  if (next > 3.0) next = 3.0;
  state.viewerLineHeight = next;
  localStorage.setItem('viewerLineHeight', String(next));
  if (state.currentRendition) state.currentRendition.themes.override('line-height', String(next));
}

function applyRootFontSize() {
  document.documentElement.style.fontSize = (18 * state.libFontSize / 100) + 'px';
}

var state = {
  token: localStorage.getItem('token'),
  uid: localStorage.getItem('uid'),
  refreshToken: localStorage.getItem('refreshToken'),
  tokenExpiry: parseInt(localStorage.getItem('tokenExpiry') || '0', 10),
  books: [],
  libPage: 0,
  searchQuery: '',
  currentRendition: null,
  currentBookObj: null,
  toc: [],
  tocPage: 0,
  progressTimer: null,
  view: 'login',
  fontSize: parseInt(localStorage.getItem('fontSize') || '100', 10),
  libFontSize: parseInt(localStorage.getItem('libFontSize') || localStorage.getItem('fontSize') || '100', 10),
  viewerFontSize: parseInt(localStorage.getItem('viewerFontSize') || localStorage.getItem('fontSize') || '100', 10),
  viewerLineHeight: parseFloat(localStorage.getItem('viewerLineHeight') || '1.5'),
  navSwap: localStorage.getItem('navSwap') !== 'false',
  activeDict: localStorage.getItem('activeDict') || 'eng',
};

// ===== Utils =====
function request(method, url, headers, callback, blob) {
  var x = new XMLHttpRequest();
  x.open(method, url, true);
  if (blob) x.responseType = 'arraybuffer';
  if (headers) {
    for (var k in headers) {
      if (headers.hasOwnProperty(k)) x.setRequestHeader(k, headers[k]);
    }
  }
  x.onreadystatechange = function () {
    if (x.readyState !== 4) return;
    if (x.status >= 200 && x.status < 300) {
      if (blob) {
        callback(null, x.response);
      } else {
        callback(null, x.responseText ? JSON.parse(x.responseText) : null);
      }
    } else {
      if (blob) return callback('HTTP ' + x.status);
      var msg = x.responseText ? (JSON.parse(x.responseText).error || {}).message : x.statusText;
      callback(msg || ('HTTP ' + x.status));
    }
  };
  return x;
}

var GEAR_ICON = '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unwrap(val) {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue && val.arrayValue.values) return val.arrayValue.values.map(unwrap);
  if (val.mapValue && val.mapValue.fields) {
    var obj = {};
    for (var k in val.mapValue.fields) {
      if (val.mapValue.fields.hasOwnProperty(k)) obj[k] = unwrap(val.mapValue.fields[k]);
    }
    return obj;
  }
  return null;
}

// ===== IndexedDB Cache =====
var _db = null;
function openCache(cb) {
  if (_db) { cb(null, _db); return; }
  if (!window.indexedDB) { cb('no-idb'); return; }
  var req = indexedDB.open('reader-cache', 1);
  req.onupgradeneeded = function () {
    req.result.createObjectStore('books');
  };
  req.onsuccess = function () { _db = req.result; cb(null, _db); };
  req.onerror = function () { cb('idb-open-error'); };
}

function cacheGet(key, cb) {
  openCache(function (err, db) {
    if (err) return cb(null, null);
    try {
      var tx = db.transaction('books', 'readonly');
      var r = tx.objectStore('books').get(key);
      r.onsuccess = function () { cb(null, r.result || null); };
      r.onerror = function () { cb(null, null); };
    } catch (e) { cb(null, null); }
  });
}

function cacheSet(key, val, cb) {
  openCache(function (err, db) {
    if (err) { cb(err); return; }
    try {
      var tx = db.transaction('books', 'readwrite');
      tx.objectStore('books').put(val, key);
      tx.oncomplete = function () { cb(null); };
      tx.onerror = function (e) { cb('tx-error: ' + (e.target.error && e.target.error.name || 'unknown')); };
    } catch (e) { cb(e.message); }
  });
}
