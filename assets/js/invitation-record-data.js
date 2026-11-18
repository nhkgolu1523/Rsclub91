/* ============================================================================
   INVITATION RECORD  (assets/js/invitation-record-data.js)
   ----------------------------------------------------------------------------
   pages/invitation-record ke .container > .van-list me user ke referred
   (direct) subordinates dikhata hai.

   Data:  USERS/<uid>/SUBORDINATES/<childUid>  (LV === 1 = direct invite)
          + USERS/<childUid>  (username / phone / time)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSInviteRecord) return;
  window.__RSInviteRecord = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function uid() {
    try {
      var m = /[?&]uid=([^&#]+)/.exec(location.search);
      if (m) { var q = decodeURIComponent(m[1]).trim(); if (q && q !== 'null' && q !== 'undefined') return q; }
    } catch (e) {}
    try { if (window.RSInvite && RSInvite.uid) { var a = RSInvite.uid(); if (a) return String(a).trim(); } } catch (e) {}
    try { if (window.RS && RS.uid) { var b = RS.uid(); if (b) return String(b).trim(); } } catch (e) {}
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function list() { return document.querySelector('.container > .van-list') || document.querySelector('.van-list'); }

  function showLoading(listEl) {
    if (!listEl || listEl.querySelector('.rs-ir-item')) return;
    if (listEl.querySelector('.rs-ir-loading')) return;
    var d = document.createElement('div');
    d.className = 'rs-ir-loading';
    d.setAttribute('style', 'text-align:center;color:var(--text_color_L3,#93939D);font-size:.32rem;padding:.8rem .3rem;');
    d.textContent = 'Loading...';
    listEl.insertBefore(d, listEl.firstChild);
  }
  function clearLoading() {
    var l = document.querySelectorAll('.rs-ir-loading');
    for (var i = 0; i < l.length; i++) l[i].parentNode.removeChild(l[i]);
  }

  function renderEmpty(listEl) {
    var holder = document.querySelector('.container');
    if (holder && !holder.querySelector('.rs-ir-empty')) {
      var d = document.createElement('div');
      d.className = 'rs-ir-empty';
      d.setAttribute('style', 'text-align:center;color:var(--text_color_L3,#93939D);font-size:.32rem;padding:.8rem .3rem;');
      d.textContent = 'No data';
      holder.insertBefore(d, listEl);
    }
  }

  function render(rows) {
    var listEl = list();
    if (!listEl) return;
    clearLoading();
    var olds = listEl.querySelectorAll('.rs-ir-item');
    for (var i = 0; i < olds.length; i++) olds[i].parentNode.removeChild(olds[i]);
    var holder = document.querySelector('.container');
    var empty = holder ? holder.querySelector('.rs-ir-empty') : null;

    if (!rows.length) { renderEmpty(listEl); return; }
    if (empty && empty.parentNode) empty.parentNode.removeChild(empty);

    var frag = document.createDocumentFragment();
    rows.forEach(function (r) {
      var el = document.createElement('div');
      el.className = 'rs-ir-item';
      el.setAttribute('data-v-67e25db3', '');
      el.setAttribute('style',
        'background:var(--bg_color_L2,#25272A);border-radius:.18rem;padding:.28rem .32rem;margin:.24rem .3rem;');
      el.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<span style="font-size:.36rem;color:var(--text_color_L1,#fff);font-weight:600;">' + esc(r.name || r.uid) + '</span>'
        + '<span style="font-size:.32rem;color:' + (r.lv === 1 ? '#20D374' : '#93939D') + ';">'
        + (r.lv === 1 ? 'Direct' : ('L' + r.lv)) + '</span>'
        + '</div>'
        + '<div style="margin-top:.12rem;font-size:.3rem;color:var(--text_color_L2,#D7D7D7);">'
        + 'UID: ' + esc(r.uid) + '</div>'
        + (r.phone ? ('<div style="margin-top:.06rem;font-size:.3rem;color:var(--text_color_L2,#D7D7D7);">Phone: ' + esc(r.phone) + '</div>') : '')
        + '<div style="margin-top:.06rem;font-size:.3rem;color:var(--text_color_L2,#D7D7D7);">Deposit: \u20B9' + (Number(r.deposit) || 0).toFixed(2) + '</div>'
        + (r.time ? ('<div style="margin-top:.06rem;font-size:.28rem;color:var(--text_color_L3,#93939D);">' + esc(r.time) + '</div>') : '');
      frag.appendChild(el);
    });
    var anchor = listEl.querySelector('.van-list__finished-text') || listEl.querySelector('.van-list__placeholder');
    if (anchor) listEl.insertBefore(frag, anchor); else listEl.appendChild(frag);
  }

  function load() {
    var u = uid();
    if (!u) return;

    try {
      var cached = localStorage.getItem('rs_ir_cache_' + u);
      if (cached) render(JSON.parse(cached));
    } catch (e) {}

    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/SUBORDINATES.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (subs) {
        if (!subs || typeof subs !== 'object') { render([]); return null; }
        var kids = Object.keys(subs);
        return Promise.all(kids.map(function (k) {
          var lv = Number((subs[k] && subs[k].LV) || 0) || 1;
          return fetch(FB + '/USERS/' + encodeURIComponent(k) + '.json', { cache: 'no-store' })
            .then(function (r2) { return r2.ok ? r2.json() : null; })
            .then(function (usr) {
              usr = usr || {};
              return {
                uid: k,
                lv: lv,
                name: usr['USERNAME'] || usr['NICKNAME'] || usr['NAME'] || ('User ' + k),
                phone: usr['PHONE-NUMBER'] || '',
                deposit: Number((subs[k] && subs[k]['DEPOSIT-AMOUNT']) || 0) || 0,
                time: (subs[k] && subs[k].JOINED) || usr['INVITED-TIME'] || ''
              };
            })
            .catch(function () { return { uid: k, lv: lv, name: 'User ' + k, phone: '', deposit: 0, time: '' }; });
        }));
      })
      .then(function (rows) {
        if (!rows) return;
        rows.sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
        render(rows);
        try { localStorage.setItem('rs_ir_cache_' + u, JSON.stringify(rows.slice(0, 100))); } catch (e) {}
      })
      .catch(function () {});
  }

  var _started = false;
  function start() {
    var listEl = list();
    if (!listEl) return false;         /* container abhi nahi -> retry */
    if (!_started) {
      _started = true;
      showLoading(listEl);
      load();
      setInterval(load, 15000);
    }
    return true;
  }

  /* container design ke render ke baad aata hai -> thodi der retry karo */
  var tries = 0;
  function bootTry() {
    if (start()) return;
    tries++;
    if (tries < 40) setTimeout(bootTry, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootTry);
  else bootTry();
  window.addEventListener('load', bootTry);
  window.RSInviteRecord = { load: load, reload: start };
})();
