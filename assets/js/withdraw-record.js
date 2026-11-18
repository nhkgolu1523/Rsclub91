/* ============================================================================
   WITHDRAW RECORD  --  assets/js/withdraw-record.js
   ----------------------------------------------------------------------------
   Withdrawal request ka server-side record + balance debit (Firebase REST).

   Jab user withdrawal kare:
     USERS/<uid>/WITHDRAWL-HISTORY/<id> = {
        AMOUNT, METHOD, ACCOUNT, ACCOUNT-NAME, STATUS:'Pending', TIME, ID
     }
     USERS/<uid>/TRANSECTION-HISTORY/<id> = {
        TYPE:'Withdraw', AMOUNT, STATUS:'Pending', TIME, NOTE
     }
     USERS/<uid>/BALANCE/MAIN-BALANCE  -= AMOUNT   (CAS: ETag + if-match)

   STATUS:  'Pending'  (naya)   -> Success karne ke liye value 'Success' set karo
            'Success'  (admin approves)
            'Rejected' (admin reject -> balance wapas)

   window.RSWithdraw.record({ amount, method, account, accountName }) -> Promise
   ========================================================================== */
(function () {
  'use strict';
  if (window.RSWithdraw) return;

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
  function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function newId() { return 'W' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }

  /* balance se amount minus (CAS, lost-update safe) */
  async function debitBalance(u, amount) {
    var balPath = FB + '/USERS/' + encodeURIComponent(u) + '/BALANCE.json';
    var txId = 'WD:' + newId();
    for (var attempt = 0; attempt < 6; attempt++) {
      var r = await fetch(balPath, { headers: { 'X-Firebase-ETag': 'true', 'cache-control': 'no-store' } });
      if (!r.ok) return { ok: false, reason: 'read-failed', txId: txId };
      var etag = r.headers.get('ETag');
      var txt = await r.text();
      var cur = null;
      try { cur = txt && txt !== 'null' ? JSON.parse(txt) : null; } catch (e) { cur = null; }
      var bal = (cur && typeof cur === 'object') ? cur : {};
      var A = (bal.A && typeof bal.A === 'object') ? bal.A : {};
      if (A[txId]) return { ok: true, already: true, txId: txId };
      var have = r2(bal['MAIN-BALANCE']);
      if (have < amount) return { ok: false, reason: 'insufficient', balance: have, txId: txId };
      var S = (Number(bal.S) || 0) + 1;
      var newA = Object.assign({}, A); newA[txId] = S;
      var put = await fetch(balPath, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, etag ? { 'if-match': etag } : {}),
        body: JSON.stringify({ 'MAIN-BALANCE': r2(have - amount), S: S, A: newA })
      });
      if (put.ok) return { ok: true, txId: txId, balance: r2(have - amount) };
      if (put.status === 412) continue;
      return { ok: false, reason: 'write-failed', txId: txId };
    }
    return { ok: false, reason: 'busy', txId: txId };
  }

  async function record(opts) {
    var u = uid();
    var amount = r2(opts && opts.amount);
    if (!u || !(amount > 0)) return { ok: false, error: 'Invalid request' };

    /* 1) balance debit */
    var debit = await debitBalance(u, amount);
    if (!debit.ok) {
      return { ok: false, error: debit.reason === 'insufficient' ? 'Insufficient balance' : 'Could not process withdrawal', reason: debit.reason };
    }

    /* 2) history entries */
    var id = newId();
    var time = stamp();
    var method = String((opts && opts.method) || 'UPI');
    var account = String((opts && opts.account) || '');
    var accountName = String((opts && opts.accountName) || '');

    /* balance UI turant sync (agar balance-core chalu ho) */
    try { if (window.RSBalCore && RSBalCore.refresh) RSBalCore.refresh(); } catch (e) {}

    var rec = {
      ID: id, AMOUNT: amount, METHOD: method, ACCOUNT: account, 'ACCOUNT-NAME': accountName,
      STATUS: 'Pending', TIME: time, 'TX-ID': debit.txId || ''
    };
    try {
      await fetch(FB + '/USERS/' + encodeURIComponent(u) + '/WITHDRAWL-HISTORY/' + encodeURIComponent(id) + '.json', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec)
      });
    } catch (e) {}
    try {
      await fetch(FB + '/USERS/' + encodeURIComponent(u) + '/TRANSECTION-HISTORY/' + encodeURIComponent(id) + '.json', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          TYPE: 'Withdraw', AMOUNT: amount, STATUS: 'Pending', TIME: time,
          NOTE: method + (account ? ' ' + account : ''), 'ORDER-ID': id
        })
      });
    } catch (e) {}

    return { ok: true, id: id, amount: amount, balance: debit.balance, status: 'Pending' };
  }

  window.RSWithdraw = { record: record, uid: uid, stamp: stamp };
})();
