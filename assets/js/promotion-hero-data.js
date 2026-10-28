/* ============================================================================
   PROMOTION HERO stats (assets/js/promotion-hero-data.js)
   ----------------------------------------------------------------------------
   Promotion page ke .promotion-hero (Direct/Team subordinates) ko worker
   (RSInvite /subordinates) se live bharta hai.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSPromoHero) return;
  window.__RSPromoHero = true;

  function setNum(parent, sel, value) {
    var el = parent ? parent.querySelector(sel) : null;
    if (!el) return;
    var inner = el.querySelector('div');
    if (inner) inner.textContent = value;
    else {
      var txt = el.textContent;
      el.textContent = '';
      var d = document.createElement('div');
      d.textContent = value;
      el.appendChild(d);
      el.appendChild(document.createTextNode(txt.replace(/^\s*\d+\s*/, ' ')));
    }
  }

  function load() {
    if (!window.RSInvite) return;
    var u = window.RSInvite.uid();
    if (!u) return;
    window.RSInvite.subordinates({ uid: u }).then(function (res) {
      if (!res || !res.ok) return;
      var hero = document.querySelector('.promotion-hero');
      if (!hero) return;
      var d = res.summary || {}, t = res.team || {};

      /* Direct subordinates */
      var infos = hero.querySelectorAll('.info_content .info');
      if (infos[0]) {
        var lines = infos[0].querySelectorAll('div[class^="line"]');
        if (lines[0]) lines[0].querySelector('div').textContent = d.COUNT || 0;
        if (lines[1]) lines[1].querySelector('div').textContent = d['DEPOSIT-COUNT'] || 0;
        if (lines[2]) lines[2].querySelector('div').textContent = (Number(d['DEPOSIT-AMOUNT']) || 0).toFixed(0);
        if (lines[3]) lines[3].querySelector('div').textContent = d['FIRST-DEPOSIT-COUNT'] || 0;
      }
      /* Team subordinates */
      if (infos[1]) {
        var tl = infos[1].querySelectorAll('div[class^="line"]');
        if (tl[0]) tl[0].querySelector('div').textContent = t.COUNT || 0;
        if (tl[1]) tl[1].querySelector('div').textContent = t['DEPOSIT-COUNT'] || 0;
        if (tl[2]) tl[2].querySelector('div').textContent = (Number(t['DEPOSIT-AMOUNT']) || 0).toFixed(0);
        if (tl[3]) tl[3].querySelector('div').textContent = t['FIRST-DEPOSIT-COUNT'] || 0;
      }
    });
  }

  function boot() {
    if (!document.querySelector('.promotion-hero')) return;
    load();
    setInterval(load, 12000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
