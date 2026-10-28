/* ============================================================================
   INVITE LINK  (assets/js/invite-link.js)
   ----------------------------------------------------------------------------
   Har user ka apna invitation link banata hai aur dikhata hai.

     * Link format :  <origin>/?ref=<INVITE-CODE>
       e.g.  https://rsclub91.vercel.app/?ref=635261426676
       (root index.html ?ref= padhega aur login/register par bhejega)

     * Code source :  1) ?code= URL param (invite page button ise bhejta hai)
                      2) Firebase   USERS/<uid>/INVITE-CODE

   Kahan use hota hai:
     - pages/partner-rewards  ->  .partner-code > span  (link dikhaye) + copy
     - pages/invite           ->  .cpy "Copy invitation link" (copy)

   NOTE: kisi existing element/markup ko nahi todta - sirf text badalta aur
   click par copy karta hai.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__RSInviteLink) return;
  window.__RSInviteLink = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

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

  function param(name) {
    try {
      var m = new RegExp('[?&]' + name + '=([^&#]+)').exec(location.search || '');
      if (m) { var v = decodeURIComponent(m[1]).trim(); if (v && v !== 'null') return v; }
    } catch (e) {}
    return '';
  }

  /* link = <origin>/?ref=<code>  (root par kaam karta hai) */
  function buildLink(code) {
    if (!code) return '';
    return location.origin + '/?ref=' + encodeURIComponent(code);
  }

  var currentLink = '';

  function applyLink(link) {
    currentLink = link || '';
    /* partner-rewards: .partner-code ka pehla span */
    var pc = document.querySelector('.partner-code');
    if (pc) {
      var span = pc.querySelector('span');
      if (span) span.textContent = currentLink;
    }
  }

  function setFromCode(code) {
    if (!code) return;
    applyLink(buildLink(code));
  }

  function load() {
    /* 1) URL param code (invite page button deta hai) */
    var c = param('code') || param('ref') || param('invitationCode');
    if (c) setFromCode(c);
    /* 2) Firebase se apna code */
    var u = uid();
    if (!u) return;
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/INVITE-CODE.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (code) {
        if (code && String(code) !== 'NONE') setFromCode(String(code));
      })
      .catch(function () {});
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'z-index:99999;background:rgba(30,30,36,.94);color:#fff;font-size:14px;'
      + 'padding:10px 18px;border-radius:8px;pointer-events:none;';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1400);
  }

  function copy(text, okMsg) {
    if (!text) return;
    function done() { toast(okMsg || 'Invitation link copied'); }
    function fallback(t) {
      try {
        var ta = document.createElement('textarea');
        ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) { toast('Copy failed'); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); });
    } else { fallback(text); }
  }

  /* click handlers: .cpy (Copy invitation link) aur .partner-code copy icon */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.cpy')) {
      e.preventDefault(); e.stopPropagation();
      copy(currentLink || (currentLink = buildLink(param('code'))), 'Invitation link copied');
      return;
    }
    if (t.closest('.partner-code')) {
      e.preventDefault(); e.stopPropagation();
      copy(currentLink, 'Invitation link copied');
    }
  }, true);

  function start() { load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.RSInviteLink = { load: load, build: buildLink, copy: copy, current: function () { return currentLink; } };
})();
