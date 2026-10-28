/* =====================================================================
   ACCOUNT BAN GUARD  (assets/js/account-ban.js)
   ---------------------------------------------------------------------
   USERS/<uid>/STATUS : "OFF"  ->  turant Account Banned popup (poora block)
                       "ON"  ->  normal (kuch nahi)

   * Alag self-contained file - baaki kisi code ko chhooti nahi.
   * Chhota STATUS check (15 bytes) har 10s + page load / focus /
     tab visible par TURANT check.
   * Network fail / null / garbage par KUCH nahi karta (jhoothi ban nahi).
   * Sirf exact "off" (case-insensitive) par hi ban.
   * Bypass-proof: DOM delete -> wapas, back/hash blocked, Escape /
     bahar-click se band nahi hota, reload par server se dobara check.
   ===================================================================== */
(function () {
  'use strict';

  if (window.RSAccountBan) return;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var POLL_MS = 10000;          /* chhota payload - practically 0 load */
  var TIMEOUT_MS = 5000;        /* latki hui request nahi */
  var BACKOFF = [10000, 20000, 40000, 60000];
  /* ---------------- helpers ---------------- */
  function uid() {
    try {
      var m = /[?&]uid=([^&#]+)/.exec(location.search);
      if (m) {
        var q = decodeURIComponent(m[1]).trim();
        if (q && q !== 'null' && q !== 'undefined') return q;
      }
    } catch (e) {}
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  var banned = false;     /* popup dikh chuka hai */
  var pending = false;    /* ek waqt me ek hi request (single flight) */
  var fails = 0;          /* lagataar fail -> backoff */
  var timer = null;       /* setTimeout chain (setInterval nahi) */

  /* request kabhi latke nahi (timeout + abort) */
  function fetchStatus(u, cb) {
    var done = false, to = null, ctl = null;
    function fin(err, txt) {
      if (done) return;
      done = true;
      if (to) { try { clearTimeout(to); } catch (e) {} }
      cb(err, txt);
    }
    to = setTimeout(function () {
      try { if (ctl) ctl.abort(); } catch (e) {}
      fin(new Error('timeout'));
    }, TIMEOUT_MS);
    try {
      if (typeof AbortController === 'function') ctl = new AbortController();
      var url = FB + '/USERS/' + encodeURIComponent(u) + '/STATUS.json';
      var opts = { cache: 'no-store' };
      if (ctl) opts.signal = ctl.signal;
      fetch(url, opts).then(function (r) {
        if (!r || !r.ok) { fin(new Error('HTTP ' + (r ? r.status : 0))); return; }
        r.text().then(function (t) { fin(null, t); }, function () { fin(new Error('read')); });
      }, function (e) { fin(e || new Error('network')); });
    } catch (e) { fin(e); }
  }  /* ---------------- popup CSS ----------------
     FIX: pehle CSS '#rsBanPopup' par tha par markup me id 'banPopup' thi,
     aur site ke .dialog-queue-host[data-v-...] styles scoped hain (lagte nahi).
     Isliye popup body ke flex-row me #app ke BAAD aa ke right side me chala jata tha.
     Ab: ek hi root '#rsBanRoot' (position:fixed; inset:0) + saari sizing PX me,
     kyunki page ka rem 54px (mobile) / 40px (PC) alag-alag hota hai. */
  function css() {
    return '' +
      'html.rs-banned{overflow:hidden!important}' +
      /* background page DIKHE (halka blur, halka dim) - hide NAHI karte, taaki
         user ko lage popup uske page ke upar khula hai. pointer-events:none se
         background par koi click/tap nahi jaata (lock bana rehta hai). */
      'html.rs-banned body>*:not(#rsBanRoot){filter:blur(2px) brightness(.85);' +
      'pointer-events:none!important;-webkit-user-select:none;user-select:none;' +
      'transition:filter .25s ease}' +
      '#rsBanRoot,#rsBanRoot *{box-sizing:border-box}' +
      '#rsBanRoot{position:fixed!important;top:0!important;left:0!important;right:0!important;' +
      'bottom:0!important;width:100%!important;height:100%!important;margin:0!important;' +
      'z-index:2147483000!important;display:flex!important;align-items:center;justify-content:center;' +
      'padding:16px;padding-top:max(16px,env(safe-area-inset-top));' +
      'padding-bottom:max(16px,env(safe-area-inset-bottom));' +
      'overflow-y:auto;-webkit-overflow-scrolling:touch;outline:none;visibility:visible!important;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;' +
      'line-height:normal;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
      '#rsBanRoot .ban-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45)}' +
      '#rsBanRoot .ban-wrap{position:relative;z-index:1;width:100%;max-width:380px;margin:auto;' +
      'display:flex;justify-content:center}' +
      '#rsBanRoot .ban-dialog{position:relative;width:100%;background:var(--bg_color_L2,#25272A);' +
      'border-radius:20px;padding:30px 22px 22px;text-align:center;overflow:hidden;' +
      'border:1px solid rgba(251,91,91,.18);' +
      'box-shadow:0 16px 50px rgba(0,0,0,.45),0 0 0 1px rgba(251,91,91,.08);' +
      'animation:banPopIn .32s cubic-bezier(.22,.8,.35,1)}' +
      '@keyframes banPopIn{0%{opacity:0;transform:translateY(20px) scale(.92)}' +
      '100%{opacity:1;transform:translateY(0) scale(1)}}' +
      '#rsBanRoot .ban-dialog::before{content:"";position:absolute;left:0;top:0;width:100%;height:140px;' +
      'background:linear-gradient(180deg,rgba(251,91,91,.24) 0%,transparent 100%);' +
      'pointer-events:none}' +
      '#rsBanRoot .ban-dialog__icon{position:relative;z-index:1;width:76px;height:76px;margin:0 auto 16px;' +
      'border-radius:50%;background:rgba(251,91,91,.14);border:2px solid rgba(251,91,91,.35);' +
      'display:flex;align-items:center;justify-content:center;box-shadow:0 0 28px rgba(251,91,91,.3)}' +
      '#rsBanRoot .ban-dialog__icon svg{width:40px;height:40px;color:var(--norm_red-color,#FB5B5B)}' +
      '#rsBanRoot .ban-dialog__title{position:relative;z-index:1;margin:0 0 8px;font-size:24px;' +
      'font-weight:700;color:var(--text_color_L1,#fff);letter-spacing:.2px;line-height:1.25}' +
      '#rsBanRoot .ban-dialog__desc{position:relative;z-index:1;margin:0 0 18px;font-size:14.5px;' +
      'line-height:1.5;color:var(--text_color_L2,#D7D7D7);padding:0 2px}';
  }
  function css2() {
    return '' +
      '#rsBanRoot .ban-reason{position:relative;z-index:1;background:var(--bg_color_L1,#111217);' +
      'border-radius:14px;margin-bottom:18px;border:1px solid var(--dividing-line,#374963);' +
      'overflow:hidden;text-align:left;transition:border-color .25s}' +
      '#rsBanRoot .ban-reason.is-open{border-color:rgba(251,91,91,.35)}' +
      '#rsBanRoot .ban-reason__head{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'width:100%;margin:0;padding:14px 16px;background:transparent;border:0;font-family:inherit;' +
      'color:var(--text_color_L1,#fff);cursor:pointer;text-align:left;-webkit-user-select:none;' +
      'user-select:none;-webkit-tap-highlight-color:transparent;transition:background .18s}' +
      '#rsBanRoot .ban-reason__head:active{background:rgba(255,255,255,.03)}' +
      '#rsBanRoot .ban-reason__head-left{display:flex;align-items:center;gap:10px;min-width:0;line-height:1}' +
      '#rsBanRoot .ban-reason__dot{flex-shrink:0;width:10px;height:10px;border-radius:50%;' +
      'background:var(--norm_red-color,#FB5B5B);box-shadow:0 0 8px rgba(251,91,91,.6);display:block}' +
      '#rsBanRoot .ban-reason__label{display:block;font-size:16px;font-weight:600;' +
      'color:var(--text_color_L1,#fff);letter-spacing:.2px;line-height:1.2}' +
      '#rsBanRoot .ban-reason__chev{flex-shrink:0;width:22px;height:22px;color:var(--text_color_L3,#93939D);' +
      'transition:transform .35s cubic-bezier(.4,0,.2,1),color .25s ease}' +
      '#rsBanRoot .ban-reason.is-open .ban-reason__chev{transform:rotate(180deg);' +
      'color:var(--norm_red-color,#FB5B5B)}' +
      '#rsBanRoot .ban-reason__body{display:grid;grid-template-rows:0fr;' +
      'transition:grid-template-rows .38s cubic-bezier(.4,0,.2,1)}' +
      '#rsBanRoot .ban-reason.is-open .ban-reason__body{grid-template-rows:1fr}' +
      '#rsBanRoot .ban-reason__clip{min-height:0;overflow:hidden}' +
      '#rsBanRoot .ban-reason__inner{padding:12px 16px 14px 36px;' +
      'border-top:1px dashed rgba(251,91,91,.22);background:rgba(251,91,91,.04)}' +
      '#rsBanRoot .ban-reason__text{font-size:14.5px;color:var(--norm_red-color,#FB5B5B);line-height:1.55;' +
      'font-weight:500;word-break:break-word;overflow-wrap:anywhere;text-align:left;margin:0;opacity:0;' +
      'transform:translateY(-4px);transition:opacity .32s ease,transform .32s ease}' +
      '#rsBanRoot .ban-reason.is-open .ban-reason__text{opacity:1;transform:translateY(0)}' +
      '#rsBanRoot .ban-dialog__actions{position:relative;z-index:1;display:flex;flex-direction:column;gap:10px}' +
      '#rsBanRoot .ban-dialog__btn{width:100%;height:50px;margin:0;padding:0 16px;border-radius:30px;' +
      'font-family:inherit;font-size:17px;font-weight:700;border:0;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;transition:transform .15s,opacity .2s}' +
      '#rsBanRoot .ban-dialog__btn:active{transform:scale(.98)}' +
      '#rsBanRoot .ban-dialog__btn--ghost{background:transparent;border:1.5px solid var(--norm_red-color,#FB5B5B);' +
      'color:var(--norm_red-color,#FB5B5B)}' +
      '@media (max-width:360px){#rsBanRoot{padding:10px}#rsBanRoot .ban-dialog{padding:24px 16px 18px}' +
      '#rsBanRoot .ban-dialog__title{font-size:21px}#rsBanRoot .ban-reason__inner{padding-left:30px}}' +
      '@media (max-height:520px){#rsBanRoot{align-items:flex-start}' +
      '#rsBanRoot .ban-dialog__icon{width:56px;height:56px;margin-bottom:10px}' +
      '#rsBanRoot .ban-dialog__icon svg{width:30px;height:30px}}';
  }
  /* ---------------- popup markup ---------------- */
  function markup() {
    return '' +
      '<div class="ban-overlay" id="banOverlay"></div>' +
      '<div class="ban-wrap">' +
      '<div class="ban-dialog" role="document">' +
      '<div class="ban-dialog__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none">' +
      '<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/>' +
      '<line x1="5.5" y1="5.5" x2="18.5" y2="18.5" stroke="currentColor"' +
      ' stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
      '<h2 class="ban-dialog__title" id="banTitle">Account Banned</h2>' +
      '<p class="ban-dialog__desc" id="banDesc">Your account has been banned because it broke our' +
      ' Terms &amp; Conditions, so you can no longer use the platform.</p>' +
      '<div class="ban-reason" id="banReasonBox">' +
      '<button type="button" class="ban-reason__head" id="banReasonToggle"' +
      ' aria-expanded="false" aria-controls="banReasonBody">' +
      '<span class="ban-reason__head-left"><span class="ban-reason__dot" aria-hidden="true"></span>' +
      '<span class="ban-reason__label">Reason Cheat</span></span>' +
      '<svg class="ban-reason__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="ban-reason__body" id="banReasonBody" role="region"><div class="ban-reason__clip">' +
      '<div class="ban-reason__inner"><p class="ban-reason__text">' +
      'System has been detected using cheat in your account. This breaks our fair-play rules.' +
      '</p></div></div></div></div>' +
      '<div class="ban-dialog__actions">' +
      '<button type="button" class="ban-dialog__btn ban-dialog__btn--ghost" id="banLogoutBtn">Log Out</button>' +
      '</div></div></div>';
  }
  /* ---------------- inject (ek hi baar) ---------------- */
  function inject() {
    try {
      if (!document.getElementById('rsBanStyle')) {
        var st = document.createElement('style');
        st.id = 'rsBanStyle';
        st.textContent = css() + css2();
        (document.head || document.documentElement).appendChild(st);
      }
      if (document.getElementById('rsBanRoot')) return;
      var root = document.createElement('div');
      root.id = 'rsBanRoot';
      root.className = 'rs-ban-root';
      root.setAttribute('role', 'alertdialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-labelledby', 'banTitle');
      root.setAttribute('aria-describedby', 'banDesc');
      root.innerHTML = markup();
      (document.body || document.documentElement).appendChild(root);
      bind();
    } catch (e) {}
  }

  function bind() {
    var popup = document.getElementById('rsBanRoot');
    if (!popup) return;
    var overlay = document.getElementById('banOverlay');
    var logout = document.getElementById('banLogoutBtn');
    var reasonBox = document.getElementById('banReasonBox');
    var reasonToggle = document.getElementById('banReasonToggle');

    if (reasonToggle && reasonBox) {
      reasonToggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = !reasonBox.classList.contains('is-open');
        reasonBox.classList.toggle('is-open', open);
        reasonToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    /* Log Out: session clear -> login page. Dobara click par kuch nahi. */
    var leaving = false;
    function onLogout(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (leaving) return;
      leaving = true;
      clearSession();
      /* login page ka path ROOT se absolute rakho. Saare pages
         pages/NAME/index.html me hain, isliye relative dot-dot galat folder
         me chala jata tha (jaise pages/promotion/login/index.html). */
      var login = '/pages/login/index.html';
      try {
        /* site kisi sub-folder me host ho to pathname se prefix nikal lo */
        var pn = location.pathname || '';
        var at = pn.indexOf('/pages/');
        if (at > 0) login = pn.slice(0, at) + '/pages/login/index.html';
      } catch (e2) {}
      location.replace(login);
    }
    if (logout) logout.addEventListener('click', onLogout);

    /* bahar click / Escape se popup band NAHI hota.
       ZAROORI: ye CAPTURE phase me nahi hona chahiye, warna andar ke button
       (jaise "Reason Cheat" dropdown aur "Log Out") ka click hi ruk jata hai. */
    if (overlay) overlay.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
    }, true);
    popup.setAttribute('tabindex', '-1');
    try { popup.focus(); } catch (e) {}
  }

  function clearSession() {
    try {
      ['rsclub_uid', 'rsclub_phone', 'rsclub_status', 'rsclub_email',
       'rsclub_language', 'rsclub_avatar_id', 'rsclub_avatar',
       'rsclub_profile_uid', 'rsclub_username', 'rsclub_token'
      ].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    } catch (e) {}
  }
  /* ---------------- banned lock (bypass-proof) ---------------- */
  function lock() {
    try {
      if (document.documentElement.className.indexOf('rs-banned') === -1) {
        document.documentElement.className =
          (document.documentElement.className || '') + ' rs-banned';
      }
    } catch (e) {}
    try { document.title = 'Account Banned - Rsclub91'; } catch (e) {}
    try {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } catch (e) {}
    if (banned) return;
    banned = true;
    /* 1s: popup/DOM hataya gaya to wapas, aur hash/back band rakho */
    setInterval(function () {
      if (!document.getElementById('rsBanRoot')) inject();
      lock();
    }, 1000);
    try {
      window.addEventListener('hashchange', function () {
        try { location.replace(location.pathname + location.search); } catch (e) {}
      }, true);
      window.addEventListener('popstate', function () {
        try { history.pushState(null, '', location.href); } catch (e) {}
      }, true);
    } catch (e) {}
  }

  /* ---------------- show ---------------- */
  function show() {
    if (banned) return;
    inject();
    clearSession();             /* banned user ke token/local data na rahein */
    lock();
    try { if (location.hash) location.replace(location.pathname + location.search); } catch (e) {}
    stopPoll();                 /* ban ke baad koi bekaar request nahi */
  }

  /* ---------------- poll (single-flight + backoff + hidden pause) ---------- */
  function stopPoll() {
    if (timer) { try { clearTimeout(timer); } catch (e) {} timer = null; }
  }
  function schedule(ms) {
    stopPoll();
    if (banned) return;
    timer = setTimeout(check, ms);
  }
  function nextDelay() {
    var base = POLL_MS;
    if (fails > 0) base = BACKOFF[Math.min(fails - 1, BACKOFF.length - 1)];
    return Math.round(base * (0.8 + Math.random() * 0.4));   /* jitter */
  }

  function check() {
    if (banned || pending) return;
    var u = uid();
    if (!u) { schedule(nextDelay()); return; }
    if (document.hidden) { schedule(nextDelay()); return; }   /* tab chhupa -> poll band */
    pending = true;
    fetchStatus(u, function (err, txt) {
      pending = false;
      if (banned) return;
      if (err) { fails++; schedule(nextDelay()); return; }     /* fail -> KUCH nahi */
      var s = '';
      try { s = (txt === null || txt === undefined) ? '' : String(txt).trim().toUpperCase(); } catch (e) { s = ''; }
      s = s.replace(/"/g, '').replace(/\s/g, '');
      if (s === 'OFF') { fails = 0; show(); return; }
      fails = 0;
      schedule(nextDelay());
    });
  }
  /* ---------------- boot ---------------- */
  function start() {
    schedule(50);               /* page load par turant check */
    try {
      window.addEventListener('focus', function () { fails = 0; schedule(50); });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { fails = 0; schedule(50); }
      });
      window.addEventListener('pageshow', function (e) {
        if (e && e.persisted) { fails = 0; schedule(50); }
      });
      window.addEventListener('online', function () { fails = 0; schedule(50); });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.RSAccountBan = {
    check: function () { fails = 0; schedule(0); },
    isBanned: function () { return banned; },
    ban: function () { show(); }
  };
})();