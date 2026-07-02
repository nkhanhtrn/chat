// ===== Dictionary =====
var DICT_CACHE_KEY = '__dictionary__';
var _dictWords = null;
var _dictIpa = null;
var _dictDefs = null;
var _dictLoading = false;
var _dictWaiters = [];

function _dictUrl() {
  return IS_DEV ? '/reader/data/eng-eng.txt' : './data/eng-eng.txt';
}

function _parseDict(text) {
  var lines = text.split('\n');
  _dictWords = [];
  _dictIpa = [];
  _dictDefs = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    var p1 = line.indexOf('|');
    if (p1 === -1) continue;
    var p2 = line.indexOf('|', p1 + 1);
    if (p2 === -1) {
      _dictWords.push(line.slice(0, p1));
      _dictIpa.push('');
      _dictDefs.push(line.slice(p1 + 1));
    } else {
      _dictWords.push(line.slice(0, p1));
      _dictIpa.push(line.slice(p1 + 1, p2));
      _dictDefs.push(line.slice(p2 + 1));
    }
  }
}

function _downloadDict(cb) {
  var x = new XMLHttpRequest();
  x.open('GET', _dictUrl(), true);
  x.onreadystatechange = function () {
    if (x.readyState !== 4) return;
    if ((x.status >= 200 && x.status < 300 || x.status === 304) && x.responseText) {
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
  _dictIpa = null;
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

// ===== Suffix Stripping (Stemming) =====
function _stripSuffix(w) {
  var stems = [];
  var s;

  if (w.length > 6 && w.slice(-4) === 'ally') {
    stems.push(w.slice(0, -4));
    stems.push(w.slice(0, -2));
  }
  if (w.length > 4 && w.slice(-2) === 'ly') {
    stems.push(w.slice(0, -2));
    if (w.length > 5 && w.slice(-3) === 'ily')
      stems.push(w.slice(0, -3) + 'y');
  }
  if (w.length > 5 && w.slice(-3) === 'ing') {
    s = w.slice(0, -3);
    stems.push(s);
    stems.push(s + 'e');
    if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2))
      stems.push(s.slice(0, -1));
  }
  if (w.length > 4 && w.slice(-2) === 'ed') {
    s = w.slice(0, -2);
    stems.push(s);
    stems.push(s + 'e');
    if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2))
      stems.push(s.slice(0, -1));
  }
  if (w.length > 5 && w.slice(-3) === 'est') {
    s = w.slice(0, -3);
    stems.push(s);
    if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2))
      stems.push(s.slice(0, -1));
  }
  if (w.length > 4 && w.slice(-2) === 'er') {
    s = w.slice(0, -2);
    stems.push(s);
    stems.push(s + 'e');
    if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2))
      stems.push(s.slice(0, -1));
    if (w.length > 5 && w.slice(-3) === 'ier')
      stems.push(w.slice(0, -3) + 'y');
  }
  if (w.length > 5 && w.slice(-4) === 'ical') {
    stems.push(w.slice(0, -2));
    stems.push(w.slice(0, -4));
  }
  if (w.length > 4 && w.slice(-2) === 'ic') {
    stems.push(w.slice(0, -2));
  }
  if (w.length > 4 && w.slice(-3) === 'ies') {
    stems.push(w.slice(0, -3) + 'y');
  }
  if (w.length > 4 && w.slice(-2) === 'es') {
    stems.push(w.slice(0, -2));
  }
  if (w.length > 3 && w.slice(-1) === 's' && w.slice(-2) !== 'ss') {
    stems.push(w.slice(0, -1));
  }
  if (w.length > 5 && w.slice(-3) === 'ity') {
    stems.push(w.slice(0, -3));
  }
  if (w.length > 5 && w.slice(-3) === 'ion') {
    stems.push(w.slice(0, -3));
    stems.push(w.slice(0, -3) + 'e');
  }
  if (w.length > 6 && w.slice(-4) === 'ness') {
    s = w.slice(0, -4);
    stems.push(s);
    if (s.length > 2 && s.charCodeAt(s.length - 1) === 105)
      stems.push(s.slice(0, -1) + 'y');
  }
  if (w.length > 6 && w.slice(-4) === 'ment') {
    stems.push(w.slice(0, -4));
  }
  if (w.length > 5 && w.slice(-3) === 'ful') {
    stems.push(w.slice(0, -3));
  }
  if (w.length > 6 && w.slice(-4) === 'less') {
    stems.push(w.slice(0, -4));
  }
  if (w.length > 5 && w.slice(-3) === 'ous') {
    stems.push(w.slice(0, -3));
  }
  if (w.length > 5 && w.slice(-3) === 'ism') {
    stems.push(w.slice(0, -3));
  }
  if (w.length > 5 && w.slice(-3) === 'ist') {
    stems.push(w.slice(0, -3));
  }
  return stems;
}

function generateStems(word) {
  var seen = {};
  var results = [];

  function recurse(w, depth) {
    if (depth > 3 || w.length < 3) return;
    var stems = _stripSuffix(w);
    for (var i = 0; i < stems.length; i++) {
      var s = stems[i];
      if (s.length >= 3 && !seen[s]) {
        seen[s] = true;
        results.push(s);
        recurse(s, depth + 1);
      }
    }
  }

  recurse(word, 0);
  return results;
}

// ===== Levenshtein Distance (with early exit) =====
function _levenshtein(a, b, maxDist) {
  var la = a.length, lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;

  var prev = [];
  var curr = [];
  for (var j = 0; j <= lb; j++) prev[j] = j;

  for (var i = 1; i <= la; i++) {
    curr[0] = i;
    var rowMin = i;
    for (var j = 1; j <= lb; j++) {
      var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      var del = prev[j] + 1;
      var ins = curr[j - 1] + 1;
      var sub = prev[j - 1] + cost;
      curr[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[lb];
}

// ===== Fuzzy Lookup =====
function _fuzzyLookup(word, maxDist) {
  if (!_dictWords || _dictWords.length === 0) return -1;
  if (word.length < 3) return -1;

  var dist = word.length <= 4 ? 1 : maxDist;

  var fc = word.charCodeAt(0);

  var lo = 0, hi = _dictWords.length;
  while (lo < hi) {
    var mid = (lo + hi) >> 1;
    if (_dictWords[mid].charCodeAt(0) < fc) lo = mid + 1;
    else hi = mid;
  }
  var start = lo;

  lo = start; hi = _dictWords.length;
  while (lo < hi) {
    var mid = (lo + hi) >> 1;
    if (_dictWords[mid].charCodeAt(0) <= fc) lo = mid + 1;
    else hi = mid;
  }
  var end = lo;

  var bestIdx = -1;
  var bestDist = dist + 1;
  var wlen = word.length;

  for (var i = start; i < end; i++) {
    var dw = _dictWords[i];
    if (Math.abs(dw.length - wlen) > dist) continue;
    var d = _levenshtein(word, dw, dist);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      if (d <= 1) break;
    }
  }
  return bestIdx;
}

// ===== Lookup =====
function _makeEntry(idx) {
  return { word: _dictWords[idx], ipa: _dictIpa[idx], def: _dictDefs[idx] };
}

function dictLookup(word, cb) {
  var w = String(word || '').toLowerCase().trim();
  if (!w) return cb(null, null);
  ensureDictionary(function (err) {
    if (err) return cb(err);

    var idx = _binarySearchWords(_dictWords, w);
    if (idx !== -1) return cb(null, _makeEntry(idx));

    var stems = generateStems(w);
    for (var i = 0; i < stems.length; i++) {
      idx = _binarySearchWords(_dictWords, stems[i]);
      if (idx !== -1) return cb(null, _makeEntry(idx));
    }

    idx = _fuzzyLookup(w, 2);
    if (idx !== -1) return cb(null, _makeEntry(idx));

    for (var i = 0; i < stems.length && i < 5; i++) {
      idx = _fuzzyLookup(stems[i], 2);
      if (idx !== -1) return cb(null, _makeEntry(idx));
    }

    cb(null, null);
  });
}

function _resetDict() {
  _dictWords = null;
  _dictIpa = null;
  _dictDefs = null;
  _dictLoading = false;
  _dictWaiters = [];
}
