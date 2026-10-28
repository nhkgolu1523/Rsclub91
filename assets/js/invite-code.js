(function () {
  'use strict';

  if (window.__RSInviteCodeBooted) {
    if (window.RSInviteCode) window.RSInviteCode.load();
    return;
  }
  window.__RSInviteCodeBooted = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      if (!u || u === 'null' || u === 'undefined') return '';
      return u;
    } catch (e) { return ''; }
  }

  function codeSlot() {
    var items = document.querySelectorAll('.promote__cell-item');
    for (var i = 0; i < items.length; i++) {
      var label = items[i].querySelector('.label span');
      if (label && /copy invitation code/i.test(label.textContent || '')) {
        return items[i].querySelector('.arrow span');
      }
    }
    return null;
  }

  var currentCode = '';

  function setCode(slot, code) {
    if (!slot) return;
    currentCode = code;
    var svg = slot.querySelector('svg');
    slot.textContent = code + ' ';
    if (svg) slot.appendChild(svg);
  }

  function toast(msg) {
    var old = document.getElementById('rsInviteToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsInviteToast';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'z-index:99999;background:rgba(30,30,36,.94);color:#fff;font-size:.32rem;'
      + 'padding:.2rem .4rem;border-radius:.4rem;opacity:0;transition:opacity .2s;'
      + 'pointer-events:none;';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 1400);
  }

  function copy(code) {
    if (!code) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { toast('Invitation code copied'); }, function () { fallback(code); });
    } else {
      fallback(code);
    }
    function fallback(text) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('Invitation code copied');
      } catch (e) { toast('Copy failed'); }
    }
  }

  function load() {
    var slot = codeSlot();
    if (!slot) return;
    var u = uid();
    if (!u) return;
    var cacheKey = 'rs_invite_code_cache_' + u;
    var cached = '';
    try { cached = localStorage.getItem(cacheKey) || ''; } catch (e) {}
    if (cached) setCode(slot, cached);
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/INVITE-CODE.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (code) {
        if (code) {
          setCode(slot, String(code));
          try { localStorage.setItem(cacheKey, String(code)); } catch (e) {}
        }
      })
      .catch(function () {});
  }

  document.addEventListener('click', function (e) {
    var slot = codeSlot();
    if (!slot) return;
    var item = slot.closest('.promote__cell-item');
    if (!item || !item.contains(e.target)) return;
    if (!currentCode) return;
    copy(currentCode);
  }, true);

  function boot() { load(); wirePromotionLinks(); }

  function wirePromotionLinks() {
    document.addEventListener('click', function (e) {
      /* "INVITATION LINK" share button -> invite (poster/share) page */
      var shareBtn = e.target && e.target.closest ? e.target.closest('.shareBtn') : null;
      if (shareBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (!uid()) { window.location.href = '/pages/login/index.html'; return; }
        var c = currentCode || '';
        window.location.href = '/pages/invite/index.html' + (c ? ('?code=' + encodeURIComponent(c)) : '');
        return;
      }

      var item = e.target && e.target.closest ? e.target.closest('.promote__cell-item') : null;
      if (item) {
        var label = item.querySelector('.label span');
        if (label) {
          var text = (label.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (text === 'partner rewards' || text === 'partner reward') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/pages/partner-rewards/index.html';
            return;
          }
          if (text === 'subordinate data') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/pages/subordinate/index.html';
            return;
          }
          if (text === 'commission detail' || text === 'commission details') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/pages/commission-details/index.html';
            return;
          }
          if (text === 'invitation rules') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/pages/invitation-rules/index.html';
            return;
          }
          if (text === 'agent line customer service') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/pages/agent-line-service/index.html';
            return;
          }
          if (text === 'rebate ratio') {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/pages/rebate-ratio/index.html';
            return;
          }
        }
      }

      var guestBtn = e.target && e.target.closest ? e.target.closest('.promotionGuest__action') : null;
      if (guestBtn) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = '/pages/login/index.html';
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', function () { setTimeout(load, 300); });

  window.RSInviteCode = { load: load, copy: copy };
})();
