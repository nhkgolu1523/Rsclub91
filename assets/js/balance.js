/* ==========================================================================
   Rsclub91 - balance widget helper  (assets/js/balance.js)
   --------------------------------------------------------------------------
   Ye sirf RSBalCore (assets/js/balance-core.js) ka patla wrapper hai.
   Paisa yahan kabhi nahi likha jata - saara credit/debit ETag-CAS +
   idempotent txId wale core se hota hai.

   API (purane pages ke liye wahi naam):
     RSBalance.watch(cb)    - balance badle to cb(value) (turant current value)
     RSBalance.get(cb)      - server se fresh value
     RSBalance.format(v)    - "₹1,234.50"
     RSBalance.value()      - abhi ka balance
     RSBalance.refresh()    - manual re-read
   ========================================================================== */
(function () {
  'use strict';

  if (window.RSBalance) return;

  function core() { return window.RSBalCore || null; }

  function normalize(v) {
    var c = core();
    if (c) return c.normalize(v);
    if (v === null || v === undefined || v === '' || v === 'null') return 0;
    var n = Number(v);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function format(v) {
    return '\u20B9' + normalize(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function uid() {
    var c = core();
    if (c) return c.uid();
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  /* fallback: core load na hua ho to sirf PADHNA (koi write nahi) */
  function readMirror(cb) {
    var u = uid();
    if (!u || typeof fetch !== 'function') { if (cb) cb(null); return; }
    fetch('https://rsclub91-62526-default-rtdb.firebaseio.com/USERS/' +
      encodeURIComponent(u) + '/BALANCE/MAIN-BALANCE.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { if (cb) cb(v === null || v === undefined ? null : normalize(v)); })
      .catch(function () { if (cb) cb(null); });
  }

  window.RSBalance = {
    uid: uid,
    normalize: normalize,
    format: format,

    value: function () {
      var c = core();
      return c ? c.value() : 0;
    },

    ready: function () {
      var c = core();
      return !!(c && c.ready());
    },

    /* fresh value from the server (refresh icon / page load) */
    get: function (cb) {
      var c = core();
      if (!c) { readMirror(cb); return; }
      c.refresh(function () {
        if (cb) cb(c.ready() ? c.value() : null);
      });
    },

    refresh: function () {
      var c = core();
      if (c) c.refresh();
    },

    /* subscribe: value change par cb(value). Purane pages yahi use karte hain. */
    watch: function (cb) {
      var c = core();
      if (c) return c.on(cb);
      /* fallback (read-only poll) - core load na hone par bhi UI sahi rahe */
      var stop = false;
      var tick = function () { readMirror(function (v) { if (!stop && v !== null) cb(v); }); };
      tick();
      var t = setInterval(tick, 3000);
      return function () { stop = true; clearInterval(t); };
    },

    /* purane code ke liye: absolute value set (CAS delta ke roop me) */
    set: function (v, cb) {
      var c = core();
      if (!c) { if (cb) cb(false); return; }
      var d = normalize(v) - c.value();
      c.apply('SET:' + uid() + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 6), d);
      if (cb) cb(true);
    }
  };
})();