/* ============================================================================
   TX HISTORY writer  --  assets/js/tx-history.js
   ----------------------------------------------------------------------------
   Har transaction (deposit / bet / win / agent commission / bonus ...) ko ek
   hi jagah likhta hai:

     USERS/<uid>/TRANSECTION-HISTORY/<id> = {
        TYPE, AMOUNT, STATUS, TIME, NOTE, [extra...]
     }

   TYPE   : 'Deposit' | 'Bet' | 'Win' | 'Agent commission' | 'Bonus' |
            'Withdraw' | 'Withdraw rejected' | ...
   STATUS : 'Pending' | 'Success' | 'Failed'
   AMOUNT : positive number (₹)

   Page (transaction-history) isi node se list render karta hai.
   ========================================================================== */
(function () {
  'use strict';
  if (window.RSTx) return;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' '
      + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function newId() { return 'T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* add({ TYPE, AMOUNT, STATUS, NOTE }) -> promise (fail-safe) */
  function add(entry) {
    var u = uid();
    if (!u || !entry || !entry.TYPE) return Promise.resolve(null);
    var id = entry.ID || newId();
    var body = {
      TYPE: String(entry.TYPE),
      AMOUNT: Math.round((Number(entry.AMOUNT) || 0) * 100) / 100,
      STATUS: String(entry.STATUS || 'Success'),
      TIME: entry.TIME || stamp(),
      NOTE: String(entry.NOTE || '')
    };
    /* extra fields (orderId, issue, txId) bhi rakho (agar diye ho) */
    ['ORDER-ID', 'ISSUE', 'TX-ID', 'METHOD'].forEach(function (k) {
      if (entry[k] != null) body[k] = entry[k];
    });
    return fetch(FB + '/USERS/' + encodeURIComponent(u) + '/TRANSECTION-HISTORY/' + encodeURIComponent(id) + '.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.ok ? body : null; }).catch(function () { return null; });
  }

  window.RSTx = { add: add, uid: uid, stamp: stamp };
})();
