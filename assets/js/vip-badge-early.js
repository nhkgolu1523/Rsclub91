/* ============================================================================
   VIP BADGE (early)  --  assets/js/vip-badge-early.js
   ----------------------------------------------------------------------------
   Account page me username ke bagal jo VIP level badge hai (class n0..n10),
   wo HTML me hardcoded `n0` hota hai. Isliye har refresh me pehle VIP0 badge
   dikhta tha, phir (Firebase fetch ke ~2s baad) sahi level.

   Yeh script localStorage cache (`rs_vip_cache_<uid>`) se badge TURANT sahi
   level par set kar deti hai - network ka wait nahi. Phir vip-backend.js
   server ki authoritative value se update karta hai (wahi cache likhta hai).
   ========================================================================== */
(function () {
  'use strict';

  var BADGE_SEL = '.userInfo__container-content-nickname .n0,'
    + '.userInfo__container-content-nickname .n1,'
    + '.userInfo__container-content-nickname .n2,'
    + '.userInfo__container-content-nickname .n3,'
    + '.userInfo__container-content-nickname .n4,'
    + '.userInfo__container-content-nickname .n5,'
    + '.userInfo__container-content-nickname .n6,'
    + '.userInfo__container-content-nickname .n7,'
    + '.userInfo__container-content-nickname .n8,'
    + '.userInfo__container-content-nickname .n9,'
    + '.userInfo__container-content-nickname .n10,'
    + '.vip-header-wrapper-name-vip';

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  var u = uid();
  if (!u) return;

  var cached = null;
  try {
    var raw = localStorage.getItem('rs_vip_cache_' + u);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {}

  function q() { return document.querySelectorAll(BADGE_SEL); }

  /* Cache nahi hai -> hardcoded n0 (VIP0) galat dikh sakta hai. Us waqt badge
     ko chhupa do; vip-backend.js sahi level aane par wapas dikha dega. */
  if (!cached || !isFinite(Number(cached.level))) {
    var hiding = false;
    function hideUntil() {
      if (hiding) return;
      hiding = true;
      try {
        var list = q();
        for (var i = 0; i < list.length; i++) {
          if (!list[i].classList.contains('rs-vip-pending')) {
            list[i].classList.add('rs-vip-pending');
          }
        }
      } finally { hiding = false; }
    }
    var st = document.createElement('style');
    st.textContent = '.rs-vip-pending{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(st);
    hideUntil();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideUntil, { once: true });
    window.addEventListener('load', hideUntil);
    var hticks = [150, 400, 800, 1500, 2500, 4000, 6000];
    for (var ht = 0; ht < hticks.length; ht++) setTimeout(hideUntil, hticks[ht]);
    return;
  }

  var level = Number(cached.level);
  if (!isFinite(level) || level < 0) return;
  if (level > 10) level = 10;

  var painting = false;
  function paint() {
    if (painting) return;          /* re-entrancy guard (observer loop rok) */
    painting = true;
    try {
      var list = q();
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        el.classList.remove('rs-vip-pending');
        var cur = null;
        for (var k = 0; k <= 10; k++) if (el.classList.contains('n' + k)) cur = k;
        if (cur === level) continue;
        for (var j = 0; j <= 10; j++) el.classList.remove('n' + j);
        el.classList.add('n' + level);
      }
    } finally {
      painting = false;
    }
  }

  paint();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paint, { once: true });
  }
  window.addEventListener('load', paint);
  /* Vue app hydrate hone ke baad badge dobara n0 ban sakta hai, aur SPA
     navigation par naya node aata hai. Isliye kuch der tak thode-thode
     intervals par dobara apply karte hain (koi observer nahi -> koi
     infinite-loop / high-CPU risk nahi). */
  var ticks = [150, 400, 800, 1500, 2500, 4000, 6000];
  for (var t = 0; t < ticks.length; t++) setTimeout(paint, ticks[t]);
})();
