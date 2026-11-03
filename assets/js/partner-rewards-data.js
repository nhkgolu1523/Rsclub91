/* ============================================================================
   PARTNER REWARDS data  --  assets/js/partner-rewards-data.js
   ----------------------------------------------------------------------------
   pages/partner-rewards ka backend:
     * Invitation count          -> kitne log invite kiye (direct invitees)
     * Effective Invitation count-> invitees jinhone deposit kiya (effective)
     * Invitation total bonus    -> ab tak mila total invite bonus

   Data worker (RSInvite /bonus) se aata hai - browser sirf GET karta hai.
   invite-link.js (link/code) alag script hai - ismein koi link kaam nahi.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSPartnerRewards) return;
  window.__RSPartnerRewards = true;

  function money(n) { return '\u20B9' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function setText(root, sel, value) {
    var el = root.querySelector(sel);
    if (el) el.textContent = value;
  }

  function load() {
    if (!window.RSInvite) return;
    var u = window.RSInvite.uid();
    if (!u) return;

    /* pehle cached value (koi 0-flash nahi) */
    try {
      var cached = localStorage.getItem('rs_partner_cache_' + u);
      if (cached) { fill(JSON.parse(cached)); }
    } catch (e) {}

    window.RSInvite.bonus({ uid: u }).then(function (res) {
      if (!res || !res.ok) return;
      var data = {
        inviteCount: Number(res.inviteCount) || 0,
        effectiveCount: Number(res.effectiveCount) || 0,
        totalBonus: Number(res.totalBonus) || 0
      };
      fill(data);
      try { localStorage.setItem('rs_partner_cache_' + u, JSON.stringify(data)); } catch (e) {}
    });
  }

  function fill(data) {
    var main = document.querySelector('.partner-main');
    if (!main) return;

    /* label ke hisaab se row dhoondho (original markup me class number/count/money) */
    var items = main.querySelectorAll('.partner-item');
    for (var i = 0; i < items.length; i++) {
      var label = items[i].querySelector('span');
      var txt = label ? String(label.textContent || '').toLowerCase() : '';
      if (txt.indexOf('effective') >= 0) {
        setText(items[i], '.count', String(data.effectiveCount));
      } else if (txt.indexOf('total bonus') >= 0) {
        setText(items[i], '.money', money(data.totalBonus));
      } else if (txt.indexOf('invitation count') >= 0) {
        setText(items[i], '.number', String(data.inviteCount));
      }
    }
  }

  function boot() {
    if (!document.querySelector('.partner-main')) return;
    load();
    setInterval(load, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.RSPartnerRewards = { load: load, fill: fill };
})();
