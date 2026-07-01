var R = window.R = window.R || {};

R.xhr = function (method, url, headers, callback) {
  var x = new XMLHttpRequest();
  x.open(method, url, true);
  if (headers) {
    for (var k in headers) {
      if (headers.hasOwnProperty(k)) x.setRequestHeader(k, headers[k]);
    }
  }
  x.onreadystatechange = function () {
    if (x.readyState === 4) {
      if (x.status >= 200 && x.status < 300) {
        callback(null, x.responseText ? JSON.parse(x.responseText) : null, x);
      } else {
        var msg = (x.responseText) ? (JSON.parse(x.responseText).error || {}).message : x.statusText;
        callback(msg || ('HTTP ' + x.status));
      }
    }
  };
  return x;
};

R.xhrBlob = function (method, url, headers, callback) {
  var x = new XMLHttpRequest();
  x.open(method, url, true);
  x.responseType = 'arraybuffer';
  if (headers) {
    for (var k in headers) {
      if (headers.hasOwnProperty(k)) x.setRequestHeader(k, headers[k]);
    }
  }
  x.onreadystatechange = function () {
    if (x.readyState === 4) {
      if (x.status >= 200 && x.status < 300) {
        callback(null, x.response);
      } else {
        callback('Download failed: HTTP ' + x.status);
      }
    }
  };
  return x;
};

R.escapeHtml = function (s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

R.unwrap = function (val) {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue && val.arrayValue.values) return val.arrayValue.values.map(R.unwrap);
  if (val.mapValue && val.mapValue.fields) {
    var obj = {};
    for (var k in val.mapValue.fields) {
      if (val.mapValue.fields.hasOwnProperty(k)) obj[k] = R.unwrap(val.mapValue.fields[k]);
    }
    return obj;
  }
  return null;
};
