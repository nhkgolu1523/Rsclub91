/* ============================================================================
   UID + PHONE tag  --  assets/js/uid-tag.js
   ----------------------------------------------------------------------------
   Home page par ek (default HIDDEN) tag banata hai jisme user ka
   UID aur PHONE NUMBER (Firebase me jaisa raw 10-digit) hota hai.
   Login hone par ye Firebase (USERS/<uid>/PHONE-NUMBER) se auto bhar jata hai.

   Visibility (test ke liye):
     - Default: HIDDEN (koi ko pata nahi chalega)
     - Test:    URL me  ?showtag=1  daalo -> tag top-left corner par dikhega
                e.g.  /pages/home/?showtag=1
   ========================================================================== */
(function () {
  'use strict';
  if (window.__rsUidTag) return;
  window.__rsUidTag = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  /* Test ke liye: ?showtag=1 -> visible, warna hidden */
  function shouldShow() {
    try {
      var p = new URLSearchParams(location.search || '');
      return p.get('showtag') === '1' || p.get('showtag') === 'true';
    } catch (e) { return false; }
  }

  function injectCss() {
    if (document.getElementById('rs-uid-tag-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-uid-tag-css';
    st.textContent =
      '#rsUserTag{position:fixed;top:.2rem;left:.2rem;z-index:100003;'
      + 'background:rgba(0,0,0,.78);color:#20D374;font:600 .28rem/1.5 -apple-system,Segoe UI,Roboto,sans-serif;'
      + 'padding:.14rem .24rem;border-radius:.16rem;letter-spacing:.01em;white-space:pre;pointer-events:none;'
      + 'border:.01333rem solid rgba(32,211,116,.35)}'
      + '#rsUserTag[hidden]{display:none!important}';
    document.head.appendChild(st);
  }

  function ensureTag() {
    var el = document.getElementById('rsUserTag');
    if (el) return el;
    injectCss();
    el = document.createElement('div');
    el.id = 'rsUserTag';
    el.setAttribute('hidden', '');
    el.textContent = 'UID: -\nNUMBER: -';
    document.body.appendChild(el);
    return el;
  }

  function paint() {
    var el = ensureTag();
    var u = uid();

    /* pehle localStorage ka cached phone (turant), phir Firebase se accurate */
    var phone = '';
    try { phone = localStorage.getItem('rsclub_phone') || ''; } catch (e) {}
    el.textContent = 'UID: ' + (u || '-') + '\nNUMBER: ' + (phone || '-');

    if (!u) { applyVisibility(el); return; }

    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/PHONE-NUMBER.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (v == null) { applyVisibility(el); return; }
        var num = String(v).trim();               /* raw, jaisa Firebase me (10-digit) */
        el.textContent = 'UID: ' + u + '\nNUMBER: ' + num;
        try { localStorage.setItem('rsclub_phone', num); } catch (e) {}
        applyVisibility(el);
      })
      .catch(function () { applyVisibility(el); });
  }

  function applyVisibility(el) {
    if (shouldShow()) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  function boot() {
    if (!document.body) return;
    paint();
    /* login hone par (uid set) tag update */
    window.addEventListener('storage', function (e) {
      if (!e || e.key === 'rsclub_uid' || e.key === 'rsclub_phone') paint();
    });
    setInterval(paint, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
