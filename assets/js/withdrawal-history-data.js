/* ============================================================================
   WITHDRAWAL HISTORY data  --  assets/js/withdrawal-history-data.js
   ----------------------------------------------------------------------------
   pages/withdrawal-history ka backend:
     * USERS/<uid>/WITHDRAWL-HISTORY se entries laata hai
     * .rechargeh__container-content me rows render karta hai
     * STATUS: Pending / Success / Rejected (colour-coded)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSWdHist) return;
  window.__RSWdHist = true;

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

  function drawer() { return document.querySelector('.rechargeh__container-content'); }

  function readFilter() {
    var sels = document.querySelectorAll('.ar-searchbar__selector');
    if (sels[0]) {
      var span = sels[0].querySelector('.ar-searchbar__selector-default');
      if (span) typeFilter = String(span.textContent || 'All').trim();
    }
  }

  function statusCls(st) {
    var s = String(st || 'pending').toLowerCase();
    if (s === 'success' || s === 'completed' || s === 'paid' || s === 'approved') return 'rs-wd-ok';
    if (s === 'rejected' || s === 'failed' || s === 'cancelled' || s === 'canceled') return 'rs-wd-fail';
    return 'rs-wd-pend';
  }

  function render() {
    var box = drawer();
    if (!box) return;
    readFilter();
    var rows = all.filter(function (r) {
      if (typeFilter && typeFilter !== 'All' && String(r.STATUS) !== typeFilter) return false;
      return true;
    });

    var loading = document.querySelector('.infiniteScroll__loading');
    if (!rows.length) {
      box.innerHTML = '';
      if (loading) loading.style.display = '';
      return;
    }
    if (loading) loading.style.display = 'none';

    var A = ' data-v-e4760c44=""';
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var st = String(r.STATUS || 'Pending');
      html += '<div class="rechargeh__container-content__item"' + A + '>'
        + '<div class="rs-wd-top"' + A + '>'
        + '<span>' + esc(r.METHOD || 'UPI') + '</span>'
        + '<span class="' + statusCls(st) + '">' + esc(st) + '</span>'
        + '</div>'
        + '<div class="rs-wd-mid"' + A + '>'
        + '<span>' + esc((r.TIME || '').split('.')[0]) + '</span>'
        + '<span class="rs-wd-amt">' + esc(money(r.AMOUNT)) + '</span>'
        + '</div>'
        + (r.ACCOUNT ? ('<div class="rs-wd-acct"' + A + '>Account: ' + esc(r.ACCOUNT) + (r['ACCOUNT-NAME'] ? (' (' + esc(r['ACCOUNT-NAME']) + ')') : '') + '</div>') : '')
        + (r.ID ? ('<div class="rs-wd-acct"' + A + '>Order: ' + esc(r.ID) + '</div>') : '')
        + '</div>';
    }
    box.innerHTML = html;
  }

  function load() {
    var u = uid();
    if (!u) { all = []; render(); return; }
    /* WITHDRAWL-HISTORY node se (yahi STATUS control karta hai — admin yahan
       'Success' kare, page yahi dikhaye). */
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/WITHDRAWL-HISTORY.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        all = [];
        if (data && typeof data === 'object') { for (var id in data) all.push(data[id] || {}); }
        all.sort(function (a, b) { return String(b.TIME || '').localeCompare(String(a.TIME || '')); });
        render();
      })
      .catch(function () { render(); });
  }

  function injectCss() {
    if (document.getElementById('rs-wd-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-wd-css';
    st.textContent =
      '.rechargeh__container-content__item{background:var(--bg_color_L2,#25272A);border-radius:.16rem;padding:.28rem .3rem;margin-bottom:.2rem}'
      + '.rs-wd-top{display:flex;justify-content:space-between;align-items:center;font-size:.32rem;color:var(--text_color_L1,#fff);font-weight:600}'
      + '.rs-wd-mid{display:flex;justify-content:space-between;align-items:center;margin-top:.14rem;font-size:.3rem;color:var(--text_color_L2,#D7D7D7)}'
      + '.rs-wd-amt{color:var(--norm_green-color,#20D374);font-weight:700;font-size:.38rem}'
      + '.rs-wd-ok{color:var(--norm_green-color,#20D374);font-size:.28rem;font-weight:600}'
      + '.rs-wd-pend{color:var(--norm_secondary-color,#f5a623);font-size:.28rem;font-weight:600}'
      + '.rs-wd-fail{color:var(--norm_red-color,#FB5B5B);font-size:.28rem;font-weight:600}'
      + '.rs-wd-acct{margin-top:.08rem;font-size:.26rem;color:var(--text_color_L2,#8b8e9b)}';
    document.head.appendChild(st);
  }

  function boot() {
    if (!document.querySelector('.rechargeh__container-content')) return;
    injectCss();
    load();
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && (t.closest('.van-picker__confirm') || t.closest('.ar-searchbar__selector'))) {
        setTimeout(render, 60);
      }
    }, true);
    setInterval(load, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.RSWdHist = { load: load, render: render };
})();
