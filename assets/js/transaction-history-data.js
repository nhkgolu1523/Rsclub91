/* ============================================================================
   TRANSACTION HISTORY data  --  assets/js/transaction-history-data.js
   ----------------------------------------------------------------------------
   pages/transaction-history ka backend:
     * USERS/<uid>/TRANSECTION-HISTORY se saari entries laata hai
     * type filter (All / Deposit / Bet / Win / Agent commission / ...) +
       date filter se filter karta hai
     * .transRecord__container-content me cards render karta hai (original jaisa)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSTxData) return;
  window.__RSTxData = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function money(n) { return '\u20B9' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  var all = [];
  var typeFilter = 'All';
  var dateFilter = '';

  function activeType() {
    var sels = document.querySelectorAll('.ar-searchbar__selector');
    if (!sels[0]) return 'All';
    var span = sels[0].querySelector('.ar-searchbar__selector-default');
    return span ? String(span.textContent || 'All').trim() : 'All';
  }
  function activeDate() {
    var sels = document.querySelectorAll('.ar-searchbar__selector');
    if (!sels[1]) return '';
    var span = sels[1].querySelector('.ar-searchbar__selector-default');
    var t = span ? String(span.textContent || '').trim() : '';
    /* "Choose a date" / "All dates" = koi filter nahi */
    if (!t || /choose a date|all dates/i.test(t)) return '';
    return t.slice(0, 10);   /* YYYY-MM-DD */
  }

  function drawer() { return document.querySelector('.transRecord__container-content'); }

  function render() {
    var box = drawer();
    if (!box) return;
    typeFilter = activeType();
    dateFilter = activeDate();

    var rows = all.filter(function (r) {
      if (typeFilter && typeFilter !== 'All' && String(r.TYPE) !== typeFilter) return false;
      if (dateFilter && String(r.TIME || '').slice(0, 10) !== dateFilter) return false;
      return true;
    });

    if (!rows.length) {
      box.innerHTML = '';
      var loading = document.querySelector('.infiniteScroll__loading');
      if (loading) loading.style.display = '';
      return;
    }
    var loading2 = document.querySelector('.infiniteScroll__loading');
    if (loading2) loading2.style.display = 'none';

    var A = ' data-v-2565e76d=""';
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var up = String(r.TYPE) !== 'Bet' && String(r.TYPE) !== 'Withdraw';
      html += '<div class="transRecord__container-content__card"' + A + '>'
        + '<div class="transRecord__container-content__card-top"' + A + '>'
        + '<h3' + A + '>' + esc(r.TYPE || 'Transaction') + '</h3>'
        + '</div>'
        + '<div class="transRecord__container-content__card-mid"' + A + '>'
        + '<div class="line"' + A + '>'
        + '<span class="left"' + A + '>Time</span>'
        + '<span class="right"' + A + '>' + esc(r.TIME || '') + '</span>'
        + '</div>'
        + '<div class="line"' + A + '>'
        + '<span class="left"' + A + '>Status</span>'
        + '<span class="right"' + A + '>' + esc(r.STATUS || 'Success') + '</span>'
        + '</div>'
        + (r.NOTE ? ('<div class="line"' + A + '><span class="left"' + A + '>Remark</span>'
          + '<span class="right"' + A + '>' + esc(r.NOTE) + '</span></div>') : '')
        + '<div class="line"' + A + '>'
        + '<span class="left"' + A + '>Amount</span>'
        + '<span class="right ' + (up ? 'green' : 'red') + '"' + A + '>'
        + (up ? '+' : '-') + esc(money(r.AMOUNT)) + '</span>'
        + '</div>'
        + '</div></div>';
    }
    box.innerHTML = html;
  }

  function load() {
    var u = uid();
    if (!u) { all = []; render(); return; }
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/TRANSECTION-HISTORY.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        all = [];
        if (data && typeof data === 'object') {
          for (var id in data) { var o = data[id] || {}; o._id = id; all.push(o); }
        }
        /* naya pehle */
        all.sort(function (a, b) { return String(b.TIME || '').localeCompare(String(a.TIME || '')); });
        render();
      })
      .catch(function () { render(); });
  }

  function boot() {
    if (!document.querySelector('.transRecord__container-content')) return;
    load();
    /* dropdown confirm / tab click par dobara filter */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && (t.closest('.van-picker__confirm') || t.closest('.ar-searchbar__selector'))) {
        setTimeout(render, 60);
      }
    }, true);
    setInterval(load, 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.RSTxData = { load: load, render: render };
})();
