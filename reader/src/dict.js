// ===== Dictionary =====
var DICT_CACHE_KEY = '__dictionary__';
var _dictWords = null;
var _dictDefs = null;
var _dictLoading = false;
var _dictWaiters = [];

function _dictUrl() {
  return IS_DEV ? '/reader/data/dict.txt' : './dict.txt';
}

function _parseDict(text) {
  var lines = text.split('\n');
  _dictWords = [];
  _dictDefs = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    var sep = line.indexOf('|');
    if (sep === -1) continue;
    _dictWords.push(line.slice(0, sep));
    _dictDefs.push(line.slice(sep + 1));
  }
}

function _downloadDict(cb) {
  var x = new XMLHttpRequest();
  x.open('GET', _dictUrl(), true);
  x.onreadystatechange = function () {
    if (x.readyState !== 4) return;
    if (x.status >= 200 && x.status < 300 && x.responseText) {
      var text = x.responseText;
      cacheSet(DICT_CACHE_KEY, text, function () {
        _parseDict(text);
        cb(null);
      });
    } else {
      cb('HTTP ' + x.status);
    }
  };
  x.send();
}

function ensureDictionary(cb) {
  if (_dictWords) return cb(null);
  cacheGet(DICT_CACHE_KEY, function (err, cached) {
    if (cached) {
      _parseDict(cached);
      return cb(null);
    }
    cb('dict-not-downloaded');
  });
}

function downloadDictionary(cb) {
  if (_dictWords) return cb(null);
  if (_dictLoading) { _dictWaiters.push(cb); return; }
  _dictLoading = true;
  _downloadDict(function (err) {
    _dictLoading = false;
    cb(err);
    while (_dictWaiters.length) _dictWaiters.shift()(err);
  });
}

function getDictStatus(cb) {
  if (_dictWords) return cb('ready', _dictWords.length);
  cacheGet(DICT_CACHE_KEY, function (err, cached) {
    if (cached) return cb('cached', null);
    cb('not-downloaded', null);
  });
}

function clearDictionary(cb) {
  _dictWords = null;
  _dictDefs = null;
  cacheSet(DICT_CACHE_KEY, null, cb);
}

function _binarySearchWords(arr, target) {
  var lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1;
    var cmp = arr[mid] < target ? -1 : arr[mid] > target ? 1 : 0;
    if (cmp === 0) return mid;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

function dictLookup(word, cb) {
  var w = String(word || '').toLowerCase().trim();
  if (!w) return cb(null, null);
  ensureDictionary(function (err) {
    if (err) return cb(err);
    var idx = _binarySearchWords(_dictWords, w);
    if (idx === -1) return cb(null, null);
    cb(null, { word: _dictWords[idx], def: _dictDefs[idx] });
  });
}

function _resetDict() {
  _dictWords = null;
  _dictDefs = null;
  _dictLoading = false;
  _dictWaiters = [];
}
