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
        'color': dark ? '#f0f0f0' : '#1a1a1a',
      }
    });
  }
}

function themeIcon() { return isDark() ? '\u2600' : '\u263E'; }

function changeFontSize(delta) {
  var next = state.fontSize + delta;
  if (next < 60) next = 60;
  if (next > 200) next = 200;
  state.fontSize = next;
  localStorage.setItem('fontSize', String(next));
  if (state.currentRendition) state.currentRendition.themes.fontSize(next + '%');
}

function applyRootFontSize() {
  document.documentElement.style.fontSize = (18 * state.fontSize / 100) + 'px';
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
  progressTimer: null,
  fontSize: parseInt(localStorage.getItem('fontSize') || '100', 10),
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
