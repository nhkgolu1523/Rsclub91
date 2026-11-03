/* ============================================================================
   COMMISSION DETAILS data (assets/js/commission-data.js)
   ----------------------------------------------------------------------------
   Worker (RSInvite /commissions) se user ki commission records laakar
   .myCommission__container me render karta hai (original jaisa layout).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSCommData) return;
  window.__RSCommData = true;

  function money(n) { return '\u20B9' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var filterDay = '';

  function render(list) {
    var box = document.querySelector('.myCommission__container');
    if (!box) return;
    var old = box.querySelector('.rs-comm-list');
    if (old) old.parentNode.removeChild(old);

    /* dark overlay/toast jaise elements ko chhoote nahi; sirf list add karte hain */
    var html = '<div class="rs-comm-list myCommission__container-content">';
    if (!list || !list.length) {
      html += '<div class="infiniteScroll__loading"><div class="empty__container">'
        + '<svg class="svg-icon icon-empty"><use xlink:href="#icon-empty"></use></svg><p>No data</p></div></div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        var pct = (Number(c.RATE) || 0) ? ((Number(c.RATE) * 100).toFixed(3).replace(/\.?0+$/, '') + '%') : '';
        html += '<div class="myCommission__container-content__item">'
          + '<div class="myCommission__container-content__item-body">'
          + '<p class="settle">Settlement successful</p>'
          + '<span class="time">' + esc(c.TIME || c.DAY || '') + '</span>'
          + '<p class="sub">The commission has been automatically credited to your balance</p>'
          + '<div><span>Agent level</span><span class="level">L' + esc(c.LV || 0) + '</span></div>'
          + '<div><span>Bet amount</span><span class="amount grey">' + money(c['BET-AMOUNT']) + '</span></div>'
          + '<div><span>Number of bettors</span><span class="amount grey">1 people</span></div>'
          + '<div><span>Payout rate</span><span class="amount grey">' + esc(pct) + '</span></div>'
          + '<div><span>Commission payout</span><span class="amount orange fw">' + money(c.AMOUNT) + '</span></div>'
          + '<div><span>Date</span><span class="amount grey">' + esc((c.DAY || '') + ' ' + (String(c.TIME || '').split(' ')[1] || '')) + '</span></div>'
          + '</div></div>';
      }
    }
    html += '</div>';
    box.insertAdjacentHTML('beforeend', html);
  }

  function load() {
    if (!window.RSInvite) return;
    var u = window.RSInvite.uid();
    if (!u) { render([]); return; }
    window.RSInvite.commissions({ uid: u }).then(function (res) {
      var list = (res && res.ok && res.list) ? res.list : [];
      if (filterDay) list = list.filter(function (c) { return String(c.DAY || '').indexOf(filterDay) === 0 || String(c.TIME || '').indexOf(filterDay) === 0; });
      render(list);
    });
  }

  function injectCss() {
    if (document.getElementById('rs-comm-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-comm-css';
    st.textContent =
      '.rs-comm-list{padding:0 .3rem}'
      + '.rs-comm-list.myCommission__container-content{display:flex;flex-direction:column;gap:.26667rem;margin-top:.56rem}'
      + '.rs-comm-list .myCommission__container-content__item{border-radius:.13333rem;font-size:.34667rem;font-weight:500;background:var(--bg_color_L2)}'
      + '.rs-comm-list .myCommission__container-content__item-body{display:flex;flex-direction:column;gap:.2rem;padding:.26667rem .13333rem;color:var(--text_color_L2);font-size:.32rem}'
      + '.rs-comm-list .myCommission__container-content__item-body .settle{font-size:.37333rem;font-weight:600;color:var(--main-color);margin:0;padding-left:.26667rem}'
      + '.rs-comm-list .myCommission__container-content__item-body .time{font-size:.32rem;color:var(--text_color_L2);padding-left:.26667rem}'
      + '.rs-comm-list .myCommission__container-content__item-body .sub{font-size:.32rem;color:var(--text_color_L2);margin:0 0 .08rem;padding-left:.26667rem}'
      + '.rs-comm-list .myCommission__container-content__item-body>div{display:flex;justify-content:space-between;background-color:var(--bg_color_L3)}'
      + '.rs-comm-list .myCommission__container-content__item-body>div span{height:.8rem;padding:0 .26667rem;color:var(--text_color_L2);font-size:.32rem;line-height:.8rem}'
      + '.rs-comm-list .myCommission__container-content__item-body>div span:first-of-type{flex:.45}'
      + '.rs-comm-list .myCommission__container-content__item-body>div .amount{color:var(--norm_secondary-color);font-size:.4rem}'
      + '.rs-comm-list .myCommission__container-content__item-body>div .amount.orange{color:var(--norm_secondary-color)}'
      + '.rs-comm-list .myCommission__container-content__item-body>div .amount.grey{color:var(--text_color_L1)}'
      + '.rs-comm-list .myCommission__container-content__item-body>div .amount.fw{font-weight:600}'
      + '.rs-comm-list .myCommission__container-content__item-body>div .level{color:var(--main-color);font-size:.4rem;font-weight:700}';
    document.head.appendChild(st);
  }

  function boot() {
    injectCss();
    if (!document.querySelector('.myCommission__container')) return;
    load();
    document.addEventListener('rs:commission-date', function (e) {
      filterDay = (e && e.detail && e.detail.date) ? String(e.detail.date).slice(0, 10) : '';
      load();
    });
    setInterval(load, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
