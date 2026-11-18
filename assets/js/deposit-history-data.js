/* ============================================================================
   DEPOSIT HISTORY data  --  assets/js/deposit-history-data.js
   ----------------------------------------------------------------------------
   pages/deposit-history ka backend:
     * USERS/<uid>/DEPOSIT-HISTORY se entries laata hai
     * .rechargeh__container-content me rows render karta hai
     * status + date filter (page me pehle se controls hain)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSDepHist) return;
  window.__RSDepHist = true;

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

    var A = ' data-v-f851bd18=""';
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var st = String(r.STATUS || '');
      var ok = /success|completed|approved|paid/i.test(st);
      var note = String(r.NOTE || '');
      /* NOTE = "UPI UTR:xxx" -> method + utr */
      var utrMatch = /UTR:([^\s]+)/i.exec(note);
      var method = note ? note.replace(/\s*UTR:.*/i, '').trim() : '';
      html += '<div class="rechargeh__container-content__item"' + A + '>'
        + '<div class="rs-dep-top"' + A + '>'
        + '<span>' + esc(method || 'UPI QR') + '</span>'
        + '<span class="' + (ok ? 'rs-dep-ok' : 'rs-dep-pend') + '">' + esc(st || 'Pending') + '</span>'
        + '</div>'
        + '<div class="rs-dep-mid"' + A + '>'
        + '<span>' + esc((r.TIME || '').split('.')[0]) + '</span>'
        + '<span class="rs-dep-amt">+' + esc(money(r.AMOUNT)) + '</span>'
        + '</div>'
        + (utrMatch ? ('<div class="rs-dep-utr"' + A + '>UTR: ' + esc(utrMatch[1]) + '</div>') : '')
        + (r['ORDER-ID'] ? ('<div class="rs-dep-utr"' + A + '>Order: ' + esc(r['ORDER-ID']) + '</div>') : '')
        + '</div>';
    }
    box.innerHTML = html;
  }

  function load() {
    var u = uid();
    if (!u) { all = []; render(); return; }
    /* TRANSECTION-HISTORY se sirf DEPOSIT type (Pending bhi dikhe) */
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/TRANSECTION-HISTORY.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        all = [];
        if (data && typeof data === 'object') {
          for (var id in data) {
            var o = data[id] || {};
            if (String(o.TYPE) !== 'Deposit') continue;
            all.push(o);
          }
        }
        all.sort(function (a, b) { return String(b.TIME || '').localeCompare(String(a.TIME || '')); });
        render();
      })
      .catch(function () { render(); });
  }

  function injectCss() {
    if (document.getElementById('rs-dep-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-dep-css';
    st.textContent =
      '.rs-dep-item{background:var(--bg_color_L2,#25272A);border-radius:.16rem;padding:.28rem .3rem;margin-bottom:.2rem}'
      + '.rechargeh__container-content__item{background:var(--bg_color_L2,#25272A);border-radius:.16rem;padding:.28rem .3rem;margin-bottom:.2rem}'
      + '.rs-dep-top{display:flex;justify-content:space-between;align-items:center;font-size:.32rem;color:var(--text_color_L1,#fff);font-weight:600}'
      + '.rs-dep-mid{display:flex;justify-content:space-between;align-items:center;margin-top:.14rem;font-size:.3rem;color:var(--text_color_L2,#D7D7D7)}'
      + '.rs-dep-amt{color:var(--norm_green-color,#20D374);font-weight:700;font-size:.38rem}'
      + '.rs-dep-ok{color:var(--norm_green-color,#20D374);font-size:.28rem;font-weight:600}'
      + '.rs-dep-pend{color:var(--norm_secondary-color,#f5a623);font-size:.28rem;font-weight:600}'
      + '.rs-dep-utr{margin-top:.08rem;font-size:.26rem;color:var(--text_color_L2,#8b8e9b)}';
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

  window.RSDepHist = { load: load, render: render };
})();
