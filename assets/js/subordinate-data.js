/* ============================================================================
   SUBORDINATE page data (assets/js/subordinate-data.js)
   ----------------------------------------------------------------------------
   Worker (RSInvite) se real subordinate data laakar page par render karta hai:
     * header stats: Deposit number / Deposit amount / Number of bettors /
                     Total bet / Number first deposit / First deposit amount
     * list: har subordinate (UID, level, joined, deposit)
   Existing subordinate.js (picker) ko chhoota nahi - bas data bharta hai.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSSubData) return;
  window.__RSSubData = true;

  function money(n) { return '\u20B9' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var filter = { lv: 'All', day: '' };

  function headerEls() {
    var hc = document.querySelector('.TeamReport__C-body .header-container');
    return hc ? hc.querySelectorAll(':scope > div') : null;
  }

  function setStat(cols, idx, value) {
    if (!cols || !cols[idx]) return;
    var num = cols[idx].querySelector('.num');
    if (num) num.textContent = value;
  }

  function renderSummary(s, team) {
    var cols = headerEls();
    if (!cols) return;
    /* header (jaisa original): DIRECT bucket se */
    setStat(cols, 0, (s['DEPOSIT-COUNT'] || 0));                 /* Deposit number */
    setStat(cols, 1, money(s['DEPOSIT-AMOUNT']));               /* Deposit amount */
    setStat(cols, 2, (team['COUNT'] || 0));                     /* Number of bettors (team count ~) */
    setStat(cols, 3, money(0));                                 /* Total bet (team bet yahan) */
    setStat(cols, 4, (s['FIRST-DEPOSIT-COUNT'] || 0));          /* Number first deposit */
    setStat(cols, 5, money(0));                                 /* First deposit amount */
  }

  function renderList(list) {
    var box = document.querySelector('.TeamReport__C-body .infiniteScroll');
    if (!box) return;
    var loading = box.querySelector('.infiniteScroll__loading');
    if (!list || !list.length) {
      box.innerHTML = '<div class="infiniteScroll__loading">'
        + '<div class="empty__container"><svg class="svg-icon icon-empty"><use xlink:href="#icon-empty"></use></svg><p>No data</p></div></div>';
      return;
    }
    var html = '<div class="rs-sub-list">';
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      html += '<div class="rs-sub-item">'
        + '<div class="rs-sub-lv">L' + esc(x.LV || 1) + '</div>'
        + '<div class="rs-sub-mid"><div class="rs-sub-uid">UID: ' + esc(x.uid) + '</div>'
        + '<div class="rs-sub-name">' + esc(x.USERNAME || x.uid) + '</div>'
        + '<div class="rs-sub-time">' + esc(x.JOINED || '') + '</div></div>'
        + '<div class="rs-sub-dep">' + money(x['DEPOSIT-AMOUNT']) + '</div>'
        + '</div>';
    }
    html += '</div>';
    box.innerHTML = html;
  }

  function load() {
    if (!window.RSInvite) return;
    var u = window.RSInvite.uid();
    if (!u) { renderList([]); return; }
    window.RSInvite.subordinates({ uid: u, lv: (filter.lv === 'All' ? '' : filter.lv), day: filter.day })
      .then(function (res) {
        if (!res || !res.ok) { renderSummary({}, {}); renderList([]); return; }
        renderSummary(res.summary || {}, res.team || {});
        renderList(res.list || []);
      });
  }

  function injectCss() {
    if (document.getElementById('rs-sub-data-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-sub-data-css';
    st.textContent =
      '.rs-sub-list{padding:.2rem .3rem}'
      + '.rs-sub-item{display:flex;align-items:center;gap:.26rem;background:var(--bg_color_L2);'
      + 'border-radius:.16rem;padding:.26rem .3rem;margin-bottom:.2rem}'
      + '.rs-sub-lv{flex:0 0 auto;background:var(--main_gradient-color);color:#fff;font-weight:700;'
      + 'border-radius:.12rem;padding:.08rem .18rem;font-size:.32rem}'
      + '.rs-sub-mid{flex:1 1 auto;min-width:0}'
      + '.rs-sub-uid{color:var(--text_color_L1);font-size:.34rem;font-weight:600}'
      + '.rs-sub-name{color:var(--text_color_L2);font-size:.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.rs-sub-time{color:var(--text_color_L2);font-size:.28rem}'
      + '.rs-sub-dep{flex:0 0 auto;color:var(--norm_green-color);font-weight:700;font-size:.34rem}';
    document.head.appendChild(st);
  }

  function boot() {
    injectCss();
    if (!document.querySelector('.TeamReport__C-body')) return;
    load();
    document.addEventListener('rs:subordinate-filter', function (e) {
      var d = (e && e.detail) || {};
      if (d.type) filter.lv = String(d.type).trim();
      if (d.date) filter.day = String(d.date).trim();
      load();
    });
    setInterval(load, 10000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
