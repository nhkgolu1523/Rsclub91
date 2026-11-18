/* ============================================================================
   DEPOSIT PAGE history  --  assets/js/deposit-page-history.js
   ----------------------------------------------------------------------------
   Deposit page ke andar wale ".record__main" section (jise "Deposit history"
   navbar-right link scroll karta hai) me USERS/<uid>/DEPOSIT-HISTORY se
   entries render karta hai.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSDepPageHist) return;
  window.__RSDepPageHist = true;

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

  function statusInfo(st) {
    var s = String(st || '').toLowerCase();
    if (s === 'success' || s === 'completed' || s === 'approved' || s === 'paid') return { txt: 'Paid', cls: 'success' };
    if (s === 'pending') return { txt: 'Unpaid', cls: 'timeout' };
    if (s === 'cancelled' || s === 'canceled') return { txt: 'Cancelled', cls: 'cancel' };
    if (s === 'expired') return { txt: 'Expired', cls: 'danger' };
    if (s === 'failed' || s === 'rejected') return { txt: 'Failed', cls: 'rechargeFail' };
    return { txt: String(st || 'Unpaid'), cls: 'cancel' };
  }

  function root() { return document.querySelector('.record__main'); }

  function render(list) {
    var box = root();
    if (!box) return;
    var A = ' data-v-9f5f4114=""';
    var head = '<div class="record__main-title"' + A + '>'
      + '<svg class="svg-icon icon-historyHead"' + A + '><use xlink:href="#icon-historyHead"></use></svg>'
      + '<span' + A + '>Deposit history</span></div>';
    if (!list || !list.length) {
      box.innerHTML = head + '<div class="empty__container mgt40"' + A + '>'
        + '<svg class="svg-icon icon-empty"' + A + '><use xlink:href="#icon-empty"></use></svg>'
        + '<p' + A + '>No data</p></div>';
      return;
    }
    var html = head;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var si = statusInfo(r.STATUS);
      var method = String(r.NOTE || '').replace(/\s*UTR:.*/i, '').trim() || r.METHOD || 'UPI QR';
      html += '<div class="record__main-info"' + A + '>'
        + '<div class="record__main-info__title flex_between"' + A + '>'
        + '<div class="recharge_text"' + A + '>Deposit</div>'
        + '<div class="flex_between"' + A + '><div class="' + si.cls + '"' + A + '>' + esc(si.txt) + '</div></div>'
        + '</div>'
        + '<div class="record__main-info__money item flex_between"' + A + '>'
        + '<span' + A + '>Actual amount</span><span' + A + '>' + esc(money(r.AMOUNT)) + '</span></div>'
        + '<div class="record__main-info__type item flex_between"' + A + '>'
        + '<span' + A + '>Type</span><span' + A + '>' + esc(method) + '</span></div>'
        + '<div class="record__main-info__time item flex_between"' + A + '>'
        + '<span' + A + '>Time</span><span' + A + '>' + esc((r.TIME || '').split('.')[0]) + '</span></div>'
        + (r['ORDER-ID'] ? ('<div class="record__main-info__orderNumber item flex_between"' + A + '>'
          + '<span' + A + '>Order number</span><span' + A + '>' + esc(r['ORDER-ID']) + '</span></div>') : '')
        + '</div>';
    }
    box.innerHTML = html;
  }


  function load() {
    var u = uid();
    if (!u) return;
    /* deposit history = TRANSECTION-HISTORY se sirf DEPOSIT type (jaise
       transaction-history page karta hai) -> Pending bhi dikhte hain. */
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/TRANSECTION-HISTORY.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = [];
        if (data && typeof data === 'object') {
          for (var id in data) {
            var o = data[id] || {};
            if (String(o.TYPE) !== 'Deposit') continue;
            o._id = id;
            list.push(o);
          }
        }
        list.sort(function (a, b) { return String(b.TIME || '').localeCompare(String(a.TIME || '')); });
        render(list);
      })
      .catch(function () { render([]); });
  }

  function injectCss() {
    if (document.getElementById('rs-dep-page-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-dep-page-css';
    st.textContent =
      '.record__main-info{background:var(--bg_color_L2,#25272A);border-radius:.16rem;padding:.3rem .28rem;margin-bottom:.24rem}'
      + '.record__main-info__title{display:flex;justify-content:space-between;align-items:center;padding-bottom:.24rem;margin-bottom:.22rem;border-bottom:.01333rem solid rgba(255,255,255,.08);font-size:.36rem;color:var(--text_color_L1,#fff)}'
      + '.record__main-info__title .recharge_text{min-width:1.8rem;height:.62rem;line-height:.62rem;text-align:center;color:#fff;background:var(--norm_green-color,#20D374);border-radius:.12rem;font-size:.34rem}'
      + '.record__main-info__title .success{color:var(--norm_green-color,#20D374)}'
      + '.record__main-info__title .timeout{color:#f6a50b}'
      + '.record__main-info__title .cancel{color:var(--text_color_L2,#8b8e9b)}'
      + '.record__main-info__title .danger,.record__main-info__title .rechargeFail{color:var(--norm_red-color,#FB5B5B)}'
      + '.record__main-info .item{display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem}'
      + '.record__main-info .item span:first-child{font-size:.32rem;color:var(--text_color_L2,#8b8e9b)}'
      + '.record__main-info .item span:last-child{font-size:.34rem;color:var(--text_color_L1,#fff)}'
      + '.record__main-info .item:last-child{margin-bottom:0}';
    document.head.appendChild(st);
  }

  function boot() {
    if (!document.querySelector('.record__main')) return;
    injectCss();
    load();
    setInterval(load, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* deposit page ke actions (create/cancel/success) turant refresh kar sakein */
  window.RSDepPageHist = { load: load };
})();
