/* ============================================================================
   BONUS DETAILS data  --  assets/js/bonus-details-data.js
   ----------------------------------------------------------------------------
   pages/bonus-details ka backend:
     * worker (RSInvite /bonus) se saari bonus entries (list) laata hai
     * type filter (All / Deposit Gift / Invitation bonus / Bonus / VIP...)
       aur status tabs (To be collected / Received / Expired) se filter karta hai
     * .infiniteScroll me rows render karta hai (original jaisa)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSBonusDetails) return;
  window.__RSBonusDetails = true;

  function money(n) { return '\u20B9' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var all = [];
  var typeFilter = 'All';
  var statusTab = 'Received';

  function listBox() { return document.querySelector('.bonus__container-header ~ .infiniteScroll, .infiniteScroll'); }

  function statusOf(row) { return String(row.STATUS || 'Received'); }

  function activeTab() {
    var tabs = document.querySelectorAll('.bonus__container-tabs li');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].classList.contains('active')) return String(tabs[i].textContent || '').trim();
    }
    return statusTab;
  }

  function render() {
    var box = document.querySelector('.infiniteScroll');
    if (!box) return;
    statusTab = activeTab() || statusTab;

    var rows = all.filter(function (r) {
      if (typeFilter && typeFilter !== 'All' && r.TYPE !== typeFilter) return false;
      return statusOf(r) === statusTab;
    });

    if (!rows.length) {
      box.innerHTML = '<div class="infiniteScroll__loading"><div class="empty__container">'
        + '<svg class="svg-icon icon-empty"><use xlink:href="#icon-empty"></use></svg><p>No data</p></div></div>';
      return;
    }

    var html = '<div class="rs-bonus-list">';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var st = statusOf(r);
      html += '<div class="rs-bonus-item">'
        + '<div class="rs-bonus-mid">'
        + '<div class="rs-bonus-type">' + esc(r.TYPE || 'Bonus') + '</div>'
        + '<div class="rs-bonus-time">' + esc((r.TIME || '').split('.')[0]) + '</div>'
        + '</div>'
        + '<div class="rs-bonus-right">'
        + '<div class="rs-bonus-amt">' + money(r.AMOUNT) + '</div>'
        + '<div class="rs-bonus-status ' + esc(st.toLowerCase().replace(/\s+/g, '-')) + '">' + esc(st) + '</div>'
        + '</div></div>';
    }
    html += '</div>';
    box.innerHTML = html;
  }

  function load() {
    if (!window.RSInvite) return;
    var u = window.RSInvite.uid();
    if (!u) { all = []; render(); return; }
    window.RSInvite.bonus({ uid: u }).then(function (res) {
      all = (res && res.ok && res.list) ? res.list : [];
      render();
    });
  }

  function injectCss() {
    if (document.getElementById('rs-bonus-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-bonus-css';
    st.textContent =
      '.rs-bonus-list{padding:.2rem .3rem}'
      + '.rs-bonus-item{display:flex;align-items:center;justify-content:space-between;gap:.2rem;background:var(--bg_color_L2);'
      + 'border-radius:.16rem;padding:.28rem .3rem;margin-bottom:.2rem}'
      + '.rs-bonus-mid{flex:1 1 auto;min-width:0}'
      + '.rs-bonus-type{color:var(--text_color_L1);font-size:.36rem;font-weight:600}'
      + '.rs-bonus-time{color:var(--text_color_L2);font-size:.28rem;margin-top:.06rem}'
      + '.rs-bonus-right{flex:0 0 auto;text-align:end}'
      + '.rs-bonus-amt{color:var(--norm_red-color);font-size:.4rem;font-weight:700}'
      + '.rs-bonus-status{font-size:.28rem;margin-top:.06rem;color:var(--text_color_L2)}'
      + '.rs-bonus-status.received{color:var(--norm_green-color)}'
      + '.rs-bonus-status.expired{color:var(--text_color_L2)}'
      + '.rs-bonus-status.to-be-collected{color:var(--norm_secondary-color)}';
    document.head.appendChild(st);
  }

  function readTypeFilter() {
    /* pehla selector = type (All / Deposit Gift / ...). Doosra = date filter. */
    var sels = document.querySelectorAll('.bonus__container-header .ar-searchbar__selector');
    var first = sels[0];
    if (!first) return;
    /* agar date picker (bonusStates) uske upar aa jaye to type = pehla non-date */
    var typeSel = first;
    for (var i = 0; i < sels.length; i++) {
      if (!sels[i].classList.contains('bonusStates')) { typeSel = sels[i]; break; }
    }
    var span = typeSel.querySelector('.ar-searchbar__selector-default');
    if (span) typeFilter = String(span.textContent || 'All').trim();
  }

  function boot() {
    if (!document.querySelector('.bonus__container-header')) return;
    injectCss();
    readTypeFilter();
    load();

    /* status tab click */
    document.addEventListener('click', function (e) {
      var li = e.target && e.target.closest ? e.target.closest('.bonus__container-tabs li') : null;
      if (li) { setTimeout(function () { render(); }, 0); }
    }, true);

    /* type filter change (picker confirm ke baad) */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && (t.closest('.van-picker__confirm') || t.closest('.ar-searchbar__selector'))) {
        setTimeout(function () { readTypeFilter(); render(); }, 50);
      }
    }, true);

    setInterval(load, 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.RSBonusDetails = { load: load, render: render };
})();
