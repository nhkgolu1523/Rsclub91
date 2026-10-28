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
        html += '<div class="myCommission__container-content__item-body">'
          + '<div class="rs-comm-row">'
          + '<div class="rs-comm-left">'
          + '<span>Agent level</span>'
          + '<span class="rs-comm-lv">L' + esc(c.LV || 0) + '</span>'
          + '</div>'
          + '<div class="rs-comm-right">'
          + '<span>Commission</span>'
          + '<span class="rs-comm-amt">' + money(c.AMOUNT) + '</span>'
          + '</div>'
          + '<div class="rs-comm-right">'
          + '<span>Date</span>'
          + '<span class="rs-comm-time">' + esc(c.TIME || c.DAY || '') + '</span>'
          + '</div>'
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
      '.rs-comm-list{padding:.2rem .3rem}'
      + '.myCommission__container-content__item-body{background:var(--bg_color_L2);border-radius:.16rem;'
      + 'padding:.26rem .3rem;margin-bottom:.2rem}'
      + '.rs-comm-row{display:flex;flex-direction:column;gap:.14rem}'
      + '.rs-comm-left,.rs-comm-right{display:flex;justify-content:space-between;align-items:center;font-size:.32rem;color:var(--text_color_L2)}'
      + '.rs-comm-lv{background:var(--main_gradient-color);color:#fff;font-weight:700;border-radius:.1rem;padding:.04rem .18rem}'
      + '.rs-comm-amt{color:var(--norm_green-color);font-weight:700}'
      + '.rs-comm-time{color:var(--text_color_L2)}';
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
