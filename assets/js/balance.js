(function () {
  'use strict';

  if (window.RSBalance) return;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var POLL_MS = 1000;

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  function nodeUrl(userId) {
    return FB + '/USERS/' + encodeURIComponent(userId) + '/BALANCE/MAIN-BALANCE.json';
  }

  function normalize(v) {
    if (v === null || v === undefined || v === '' ||
        v === 'null' || v === 'undefined') return 0;
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  /* formatted like the UI: "₹1,234.50" */
  function format(v) {
    var n = normalize(v);
    return '\u20B9' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function get(cb) {
    var u = uid();
    if (!u) { cb(null); return; }
    fetch(nodeUrl(u), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { cb(normalize(v)); })
      .catch(function () { cb(null); });
  }

  function set(value, cb) {
    var u = uid();
    if (!u) { if (cb) cb(false); return; }
    var n = Math.round(normalize(value) * 100) / 100;
    fetch(nodeUrl(u), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n)
    }).then(function (r) { if (cb) cb(r.ok); })
      .catch(function () { if (cb) cb(false); });
  }

  /* polling registry: every subscriber gets cb(value) on change */
  var subs = [];
  var lastValue = null;
  var timer = null;

  function tick() {
    get(function (v) {
      if (v === null) return;
      if (v !== lastValue) {
        lastValue = v;
        for (var i = 0; i < subs.length; i++) {
          try { subs[i](v); } catch (e) {}
        }
      }
    });
  }

  function watch(cb) {
    subs.push(cb);
    if (subs.length === 1) { tick(); timer = setInterval(tick, POLL_MS); }
    else { get(function (v) { if (v !== null) cb(v); }); }
    return function () { var i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); };
  }

  window.RSBalance = {
    uid: uid,
    normalize: normalize,
    format: format,
    get: get,
    set: set,
    watch: watch
  };
})();
