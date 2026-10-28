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

      /* "Promotion data" box: This Week / Total commission / Direct / Total team */
      var directCount = Number(d.COUNT) || 0;
      var teamCount = Number(t.COUNT) || 0;
      var boxes = document.querySelectorAll('.commission .commission__body');
      if (boxes[0]) {
        var chips = boxes[0].querySelectorAll('span');
        if (chips[0]) chips[0].textContent = Number(window.__rsCommWeek || 0).toFixed(2);
        if (chips[2]) chips[2].textContent = Number(window.__rsCommTotal || 0).toFixed(2);
      }
      if (boxes[1]) {
        var chips2 = boxes[1].querySelectorAll('span');
        if (chips2[0]) chips2[0].textContent = directCount;
        if (chips2[2]) chips2[2].textContent = teamCount;
      }
      window.__rsDirect = directCount;
      window.__rsTeam = teamCount;
    });
  }

  /* commission totals (worker /commissions se) */
  function loadCommissions() {
    if (!window.RSInvite) return;
    var u = window.RSInvite.uid();
    if (!u) return;
    window.RSInvite.commissions({ uid: u }).then(function (res) {
      var list = (res && res.ok && res.list) ? res.list : [];
      var total = 0, week = 0, yesterday = 0;
      var today = new Date();
      var wkStart = new Date(today.getTime() - 6 * 86400000);
      var yd = new Date(today.getTime() - 86400000);
      function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
      var wk = ymd(wkStart), yes = ymd(yd);
      for (var i = 0; i < list.length; i++) {
        var a = Number(list[i].AMOUNT) || 0;
        var day = String(list[i].DAY || '');
        total += a;
        if (day >= wk) week += a;
        if (day === yes) yesterday += a;
      }
      window.__rsCommTotal = Math.round(total * 100) / 100;
      window.__rsCommWeek = Math.round(week * 100) / 100;
      window.__rsCommYesterday = Math.round(yesterday * 100) / 100;
      /* hero "amount" = YESTERDAY ka total commission (label ke mutabik) */
      var amt = document.querySelector('.promotion-hero .amount');
      if (amt) amt.textContent = window.__rsCommYesterday.toFixed(2);
      /* re-fill promotion data box with fresh totals */
      var boxes = document.querySelectorAll('.commission .commission__body');
      if (boxes[0]) {
        var c = boxes[0].querySelectorAll('span');
        if (c[0]) c[0].textContent = window.__rsCommWeek.toFixed(2);
        if (c[2]) c[2].textContent = window.__rsCommTotal.toFixed(2);
      }
    });
  }

  function boot() {
    if (!document.querySelector('.promotion-hero')) return;
    load();
    loadCommissions();
    setInterval(function () { load(); loadCommissions(); }, 12000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
