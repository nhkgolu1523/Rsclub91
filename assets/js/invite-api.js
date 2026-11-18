/* ============================================================================
   INVITE API client  (assets/js/invite-api.js)
   ----------------------------------------------------------------------------
   Cloudflare Worker (rsclub-invite) se baat karne ke liye ek chhota client.
   Saara paisa/commission hisaab SERVER (worker) karta hai - ye sirf GET/POST
   bhejta hai.

   window.RSInvite = {
     uid(), get(path, params), post(path, body),
     subordinates(uid, opts), commissions(uid), bonus(uid), claim(uid, taskId)
   }
   ========================================================================== */
(function () {
  'use strict';
  if (window.RSInvite) return;

  var API = 'https://rsclub-invite.99infinity.workers.dev';

  function uid() {
    try {
      var m = /[?&]uid=([^&#]+)/.exec(location.search);
      if (m) { var q = decodeURIComponent(m[1]).trim(); if (q && q !== 'null') return q; }
    } catch (e) {}
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  function get(path, params) {
    var qs = '';
    if (params) {
      var a = [];
      for (var k in params) if (params[k] != null) a.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      if (a.length) qs = '?' + a.join('&');
    }
    return fetch(API + path + qs, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function subordinates(opts) {
    opts = opts || {};
    return get('/subordinates', { uid: opts.uid || uid(), lv: opts.lv || '', day: opts.day || '', q: opts.q || '' });
  }
  function commissions(opts) { return get('/commissions', { uid: (opts && opts.uid) || uid() }); }
  function bonus(opts) { return get('/bonus', { uid: (opts && opts.uid) || uid() }); }
  function claim(taskId) { return post('/claim', { uid: uid(), taskId: taskId }); }

  window.RSInvite = {
    API: API,
    uid: uid,
    get: get,
    post: post,
    subordinates: subordinates,
    commissions: commissions,
    bonus: bonus,
    claim: claim
  };
})();
