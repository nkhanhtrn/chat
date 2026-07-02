// ===== Dictionary Registry =====
var DICTS = {
  'eng': {
    cacheKey: '__dict_eng__',
    url: IS_DEV ? '/reader/data/eng-eng.txt' : './data/eng-eng.txt',
    words: null, ipa: null, defs: null, norm: null,
    cachedCount: null,
    loading: false, waiters: []
  },
  'fre': {
    cacheKey: '__dict_fre__',
    url: IS_DEV ? '/reader/data/fre-eng.txt' : './data/fre-eng.txt',
    words: null, ipa: null, defs: null, norm: null,
    cachedCount: null,
    loading: false, waiters: []
  }
};

var DICT_IDS = ['eng', 'fre'];

function _parseDict(text, dictId) {
  var d = DICTS[dictId || 'eng'];
  d.words = []; d.ipa = []; d.defs = [];
  var isFre = dictId === 'fre';
  if (isFre) d.norm = [];
  var len = text.length, lineStart = 0;
  while (lineStart <= len) {
    var nl = text.indexOf('\n', lineStart);
    if (nl === -1) nl = len;
    if (nl > lineStart) {
      var p1 = text.indexOf('|', lineStart);
      if (p1 !== -1 && p1 < nl) {
        var p2 = text.indexOf('|', p1 + 1);
        if (p2 !== -1 && p2 >= nl) p2 = -1;
        var word = text.slice(lineStart, p1);
        d.words.push(word);
        if (p2 === -1) { d.ipa.push(''); d.defs.push(text.slice(p1 + 1, nl)); }
        else { d.ipa.push(text.slice(p1 + 1, p2)); d.defs.push(text.slice(p2 + 1, nl)); }
        if (isFre) d.norm.push(_removeAccents(word));
      }
    }
    lineStart = nl + 1;
  }
}

function ensureDictionary(dictId, cb) {
  if (typeof dictId === 'function') { cb = dictId; dictId = 'eng'; }
  var d = DICTS[dictId];
  if (!d) return cb('unknown-dict');
  if (d.words) return cb(null);
  cacheGet(d.cacheKey, function (err, cached) {
    if (cached) { _parseDict(cached, dictId); return cb(null); }
    if (dictId === 'eng') {
      cacheGet('__dictionary__', function (err2, old) {
        if (old) {
          cacheSet(d.cacheKey, old, function () {
            cacheSet('__dictionary__', null, function () {
              _parseDict(old, dictId);
              cb(null);
            });
          });
        } else {
          cb('dict-not-downloaded');
        }
      });
    } else {
      cb('dict-not-downloaded');
    }
  });
}

function downloadDictionary(dictId, cb) {
  if (typeof dictId === 'function') { cb = dictId; dictId = 'eng'; }
  var d = DICTS[dictId];
  if (!d) return cb('unknown-dict');
  if (d.words) return cb(null);
  if (d.loading) { d.waiters.push(cb); return; }
  d.loading = true;
  var x = new XMLHttpRequest();
  x.open('GET', d.url, true);
  x.onreadystatechange = function () {
    if (x.readyState !== 4) return;
    var status = x.status;
    var ok = (status >= 200 && status < 300 || status === 304) && x.responseText;
    var text = ok ? x.responseText : null;
    x.onreadystatechange = null;
    x = null;
    if (text) {
      cacheSet(d.cacheKey, text, function (cacheErr) {
        _parseDict(text, dictId);
        text = null;
        d.loading = false;
        cb(cacheErr);
        while (d.waiters.length) d.waiters.shift()(cacheErr);
      });
    } else {
      d.loading = false;
      var err = 'HTTP ' + status;
      cb(err);
      while (d.waiters.length) d.waiters.shift()(err);
    }
  };
  x.send();
}

function _countWords(text) {
  var n = 0;
  for (var i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function getDictStatus(dictId, cb) {
  if (typeof dictId === 'function') { cb = dictId; dictId = 'eng'; }
  var d = DICTS[dictId];
  if (!d) return cb('unknown', null);
  if (d.words) return cb('ready', d.words.length);
  if (d.cachedCount !== null) return cb('cached', d.cachedCount);
  cacheGet(d.cacheKey, function (err, cached) {
    if (cached) { d.cachedCount = _countWords(cached); return cb('cached', d.cachedCount); }
    if (dictId === 'eng') {
      cacheGet('__dictionary__', function (e2, old) {
        if (old) { d.cachedCount = _countWords(old); return cb('cached', d.cachedCount); }
        cb('not-downloaded', null);
      });
    } else {
      cb('not-downloaded', null);
    }
  });
}

function clearDictionary(dictId, cb) {
  if (typeof dictId === 'function') { cb = dictId; dictId = 'eng'; }
  var d = DICTS[dictId];
  if (!d) return cb();
  d.words = null; d.ipa = null; d.defs = null; d.norm = null; d.cachedCount = null;
  cacheSet(d.cacheKey, null, cb);
}

// ===== Binary Search =====
function _binarySearchWords(arr, target) {
  var lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    var mid = (lo + hi) >> 1;
    var cmp = arr[mid] < target ? -1 : arr[mid] > target ? 1 : 0;
    if (cmp === 0) return mid;
    if (cmp < 0) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

// ===== English Suffix Stripping (Stemming) =====
function _stripSuffix(w) {
  var stems = [], s;
  if (w.length > 6 && w.slice(-4) === 'ally') { stems.push(w.slice(0, -4)); stems.push(w.slice(0, -2)); }
  if (w.length > 4 && w.slice(-2) === 'ly') { stems.push(w.slice(0, -2)); if (w.length > 5 && w.slice(-3) === 'ily') stems.push(w.slice(0, -3) + 'y'); }
  if (w.length > 5 && w.slice(-3) === 'ing') { s = w.slice(0, -3); stems.push(s); stems.push(s + 'e'); if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2)) stems.push(s.slice(0, -1)); }
  if (w.length > 4 && w.slice(-2) === 'ed') { s = w.slice(0, -2); stems.push(s); stems.push(s + 'e'); if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2)) stems.push(s.slice(0, -1)); }
  if (w.length > 5 && w.slice(-3) === 'est') { s = w.slice(0, -3); stems.push(s); if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2)) stems.push(s.slice(0, -1)); }
  if (w.length > 4 && w.slice(-2) === 'er') { s = w.slice(0, -2); stems.push(s); stems.push(s + 'e'); if (s.length >= 2 && s.charCodeAt(s.length - 1) === s.charCodeAt(s.length - 2)) stems.push(s.slice(0, -1)); if (w.length > 5 && w.slice(-3) === 'ier') stems.push(w.slice(0, -3) + 'y'); }
  if (w.length > 5 && w.slice(-4) === 'ical') { stems.push(w.slice(0, -2)); stems.push(w.slice(0, -4)); }
  if (w.length > 4 && w.slice(-2) === 'ic') stems.push(w.slice(0, -2));
  if (w.length > 4 && w.slice(-3) === 'ies') stems.push(w.slice(0, -3) + 'y');
  if (w.length > 4 && w.slice(-2) === 'es') stems.push(w.slice(0, -2));
  if (w.length > 3 && w.slice(-1) === 's' && w.slice(-2) !== 'ss') stems.push(w.slice(0, -1));
  if (w.length > 5 && w.slice(-3) === 'ity') stems.push(w.slice(0, -3));
  if (w.length > 5 && w.slice(-3) === 'ion') { stems.push(w.slice(0, -3)); stems.push(w.slice(0, -3) + 'e'); }
  if (w.length > 6 && w.slice(-4) === 'ness') { s = w.slice(0, -4); stems.push(s); if (s.length > 2 && s.charCodeAt(s.length - 1) === 105) stems.push(s.slice(0, -1) + 'y'); }
  if (w.length > 6 && w.slice(-4) === 'ment') stems.push(w.slice(0, -4));
  if (w.length > 5 && w.slice(-3) === 'ful') stems.push(w.slice(0, -3));
  if (w.length > 6 && w.slice(-4) === 'less') stems.push(w.slice(0, -4));
  if (w.length > 5 && w.slice(-3) === 'ous') stems.push(w.slice(0, -3));
  if (w.length > 5 && w.slice(-3) === 'ism') stems.push(w.slice(0, -3));
  if (w.length > 5 && w.slice(-3) === 'ist') stems.push(w.slice(0, -3));
  return stems;
}

function generateStems(word) {
  var seen = {}, results = [];
  function recurse(w, depth) {
    if (depth > 3 || w.length < 3) return;
    var stems = _stripSuffix(w);
    for (var i = 0; i < stems.length; i++) {
      var s = stems[i];
      if (s.length >= 3 && !seen[s]) { seen[s] = true; results.push(s); recurse(s, depth + 1); }
    }
  }
  recurse(word, 0);
  return results;
}

// ===== Levenshtein (with early exit) =====
function _levenshtein(a, b, maxDist) {
  var la = a.length, lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  var prev = [], curr = [];
  for (var j = 0; j <= lb; j++) prev[j] = j;
  for (var i = 1; i <= la; i++) {
    curr[0] = i; var rowMin = i;
    for (var j = 1; j <= lb; j++) {
      var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      var del = prev[j] + 1, ins = curr[j - 1] + 1, sub = prev[j - 1] + cost;
      curr[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[lb];
}

// ===== Fuzzy Lookup =====
function _fuzzyLookup(dictId, word, maxDist) {
  var d = DICTS[dictId];
  if (!d || !d.words || d.words.length === 0) return -1;
  if (word.length < 3) return -1;
  var dist = word.length <= 4 ? 1 : maxDist;
  var fc = word.charCodeAt(0);
  var lo = 0, hi = d.words.length;
  while (lo < hi) { var mid = (lo + hi) >> 1; if (d.words[mid].charCodeAt(0) < fc) lo = mid + 1; else hi = mid; }
  var start = lo;
  lo = start; hi = d.words.length;
  while (lo < hi) { var mid = (lo + hi) >> 1; if (d.words[mid].charCodeAt(0) <= fc) lo = mid + 1; else hi = mid; }
  var end = lo;
  var bestIdx = -1, bestDist = dist + 1, wlen = word.length;
  for (var i = start; i < end; i++) {
    var dw = d.words[i];
    if (Math.abs(dw.length - wlen) > dist) continue;
    var dd = _levenshtein(word, dw, dist);
    if (dd < bestDist) { bestDist = dd; bestIdx = i; if (dd <= 1) break; }
  }
  return bestIdx;
}

// ===== French Lookup Helpers =====
function _stripElision(w) {
  var m = w.match(/^(l|d|j|qu|n|m|s|t|c)'/i);
  return m ? w.slice(m[0].length) : w;
}

var _freAccentRe = /[\u00E9\u00E8\u00EA\u00EB\u00E0\u00E2\u00F9\u00FB\u00E7\u00F4\u00EE\u00EF\u00FC\u0153\u00E6]/g;
var _freAccentMap = { '\u00E9': 'e', '\u00E8': 'e', '\u00EA': 'e', '\u00EB': 'e', '\u00E0': 'a', '\u00E2': 'a', '\u00F9': 'u', '\u00FB': 'u', '\u00E7': 'c', '\u00F4': 'o', '\u00EE': 'i', '\u00EF': 'i', '\u00FC': 'u', '\u0153': 'oe', '\u00E6': 'ae' };
function _removeAccents(w) {
  return w.replace(_freAccentRe, function (c) { return _freAccentMap[c] || c; });
}

function _fuzzyAccentLookup(dictId, word, maxDist) {
  var d = DICTS[dictId];
  if (!d || !d.norm || d.norm.length === 0) return -1;
  var norm = _removeAccents(word);
  if (norm === word) return -1;
  var fc = norm.charCodeAt(0);
  var lo = 0, hi = d.norm.length;
  while (lo < hi) { var mid = (lo + hi) >> 1; if (d.norm[mid].charCodeAt(0) < fc) lo = mid + 1; else hi = mid; }
  var start = lo;
  lo = start; hi = d.norm.length;
  while (lo < hi) { var mid = (lo + hi) >> 1; if (d.norm[mid].charCodeAt(0) <= fc) lo = mid + 1; else hi = mid; }
  var end = lo;
  var bestIdx = -1, bestDist = maxDist + 1;
  for (var i = start; i < end; i++) {
    if (Math.abs(d.norm[i].length - norm.length) > maxDist) continue;
    var dd = _levenshtein(norm, d.norm[i], maxDist);
    if (dd < bestDist) { bestDist = dd; bestIdx = i; if (dd === 0) break; }
  }
  return bestIdx;
}

// ===== Entry Factory =====
function _makeEntry(dictId, idx) {
  var d = DICTS[dictId];
  return { word: d.words[idx], ipa: d.ipa[idx], def: d.defs[idx] };
}

// ===== Active Dictionary Lookup =====
function dictLookup(word, cb) {
  var w = String(word || '').toLowerCase().trim();
  if (!w) return cb(null, null);
  w = _stripElision(w);
  _tryDictLookup(state.activeDict || 'eng', w, cb);
}

function _tryDictLookup(dictId, word, cb) {
  var d = DICTS[dictId];
  if (!d) return cb(null, null);
  ensureDictionary(dictId, function (err) {
    if (err) return cb(null, null);

    var idx = _binarySearchWords(d.words, word);
    if (idx !== -1) return cb(null, _makeEntry(dictId, idx));

    if (dictId === 'eng') {
      var stems = generateStems(word);
      for (var i = 0; i < stems.length; i++) {
        idx = _binarySearchWords(d.words, stems[i]);
        if (idx !== -1) return cb(null, _makeEntry(dictId, idx));
      }
      idx = _fuzzyLookup(dictId, word, 2);
      if (idx !== -1) return cb(null, _makeEntry(dictId, idx));
      for (var i = 0; i < stems.length && i < 5; i++) {
        idx = _fuzzyLookup(dictId, stems[i], 2);
        if (idx !== -1) return cb(null, _makeEntry(dictId, idx));
      }
    } else if (dictId === 'fre') {
      idx = _fuzzyAccentLookup(dictId, word, 0);
      if (idx !== -1) return cb(null, _makeEntry(dictId, idx));
      idx = _fuzzyLookup(dictId, word, 2);
      if (idx !== -1) return cb(null, _makeEntry(dictId, idx));
      var norm = _removeAccents(word);
      if (norm !== word) {
        idx = _fuzzyLookup(dictId, norm, 1);
        if (idx !== -1) return cb(null, _makeEntry(dictId, idx));
      }
    }
    cb(null, null);
  });
}

function _resetDict() {
  for (var i = 0; i < DICT_IDS.length; i++) {
    var d = DICTS[DICT_IDS[i]];
    d.words = null; d.ipa = null; d.defs = null; d.norm = null; d.cachedCount = null;
    d.loading = false; d.waiters = [];
  }
}
