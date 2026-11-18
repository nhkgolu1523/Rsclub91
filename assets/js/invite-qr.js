/* ============================================================================
   INVITE QR  (assets/js/invite-qr.js)
   ----------------------------------------------------------------------------
   pages/invite ke hardcoded .qr-code (invite page) ko user ke ASLI invite link
   ke QR se replace karta hai (koi hardcoded QR nahi).

   Link source:
     1) ?code= / ?ref= URL param  (turant)
     2) window.RSInviteLink.current()  (agar invite-link.js ne bana diya)
     3) Firebase  USERS/<uid>/INVITE-CODE  ->  <origin>/?ref=<code>

   QR generate: window.RSQR.render(link, size)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSInviteQR) return;
  window.__RSInviteQR = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function param(name) {
    try {
      var m = new RegExp('[?&]' + name + '=([^&#]+)').exec(location.search || '');
      if (m) { var v = decodeURIComponent(m[1]).trim(); if (v && v !== 'null') return v; }
    } catch (e) {}
    return '';
  }

  function uid() {
    try {
      var m = /[?&]uid=([^&#]+)/.exec(location.search);
      if (m) { var q = decodeURIComponent(m[1]).trim(); if (q && q !== 'null' && q !== 'undefined') return q; }
    } catch (e) {}
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  function buildLink(code) {
    if (!code) return '';
    return location.origin + '/?ref=' + encodeURIComponent(code);
  }

  function targets() {
    return Array.prototype.slice.call(document.querySelectorAll('.qr-block img.qr-code, img.qr-code'));
  }

  function apply(link) {
    if (!link) return;
    var imgs = targets();
    if (!imgs.length) return;
    if (!window.RSQR || !window.RSQR.render) return;
    var dataUrl;
    try { dataUrl = window.RSQR.render(link, 320); }
    catch (e) { return; }
    if (!dataUrl) return;
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].getAttribute('data-rs-qr') === '1') continue;   /* already done */
      imgs[i].setAttribute('data-rs-qr', '1');
      /* data-v-3b74cce6 attribute RAKHO — design ki CSS (.qr-code[data-v-...])
         isi par size (2.42rem) set karti hai. Hatane se QR bohot bada dikhta hai. */
      imgs[i].setAttribute('src', dataUrl);
    }
  }

  var currentLink = '';

  function load() {
    /* 1) URL param code -> instant */
    var c = param('code') || param('ref') || param('invitationCode');
    if (c) { currentLink = buildLink(c); apply(currentLink); return; }

    /* 2) already-built link (invite-link.js) */
    try {
      if (window.RSInviteLink && RSInviteLink.current) {
        var l = RSInviteLink.current();
        if (l) { currentLink = l; apply(l); return; }
      }
    } catch (e) {}

    var u = uid();
    if (!u) return;

    /* 3) cache (instant) */
    var cacheKey = 'rs_invite_link_cache_' + u;
    try {
      var cached = localStorage.getItem(cacheKey) || '';
      if (cached) { currentLink = cached; apply(cached); }
    } catch (e) {}

    /* 4) Firebase authoritative */
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/INVITE-CODE.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (code) {
        if (code && String(code) !== 'NONE') {
          var link = buildLink(String(code));
          currentLink = link;
          apply(link);
          try { localStorage.setItem(cacheKey, link); } catch (e) {}
        }
      })
      .catch(function () {});
  }

  function start() {
    load();
    /* poster strip / swiper ke baad bhi lag jaye */
    setTimeout(load, 400);
    setTimeout(load, 1200);
    setTimeout(load, 2500);
  }

  window.RSInviteQR = { load: load, apply: apply, current: function () { return currentLink; } };

  /* ---------------- DOWNLOAD QR ----------------
     ".share" button (DOWNLOAD QR CODE) ya QR img par click -> QR download. */
  function download() {
    var img = document.querySelector('.qr-block img.qr-code') || document.querySelector('img.qr-code');
    if (!img || !img.src) return;
    /* QR ko high-res dobara banao (download me bada, screen par chhota) */
    var link = currentLink || '';
    var dataUrl = img.src;
    if (link && window.RSQR && window.RSQR.render) {
      try { dataUrl = window.RSQR.render(link, 1024); } catch (e) {}
    }
    var name = 'rsclub91-invite-qr.png';
    try {
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 100);
    } catch (e) {
      /* fallback: nayi tab me kholo */
      try { window.open(dataUrl, '_blank'); } catch (e2) {}
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.share') || (t.tagName === 'IMG' && t.classList && t.classList.contains('qr-code'))) {
      e.preventDefault(); e.stopPropagation();
      download();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('load', start);
})();
