(function () {
  'use strict';

  if (window.__RSWingoButtons) return;
  window.__RSWingoButtons = true;

  var HOME = 'http://127.0.0.1:5500/pages/home/index.html';
  var WALLET = 'http://127.0.0.1:5500/pages/wallet/index.html';
  var DEPOSIT = 'http://127.0.0.1:5500/pages/deposit/index.html';
  var DETAIL = 'http://127.0.0.1:5500/pages/notification-center/index.html';
  var SUPPORT = 'http://127.0.0.1:5500/pages/agent-line-service/index.html';

  function go(url) { window.location.href = url; }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var NOTICE_TEXT = '\uD83D\uDD14 Our Rsclub91 Customer Service will never send links directly to members. '
      + 'If you receive any link from someone claiming to be Rsclub91 Customer Service, please do not click it, '
      + 'as it may lead to account hacking or loss of personal information. For your safety, always verify '
      + 'information and access Rsclub91 only through our official website and official channels.';

    function fillNotice() {
      var bodies = document.querySelectorAll('.noticeBar__container-body');
      for (var i = 0; i < bodies.length; i++) {
        if ((bodies[i].textContent || '').trim()) continue;
        bodies[i].innerHTML = '<div class="noticeBar__container-body-text">' + NOTICE_TEXT + '</div>';
      }
    }
    fillNotice();
    if (typeof MutationObserver === 'function') {
      var mo = new MutationObserver(fillNotice);
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); }, 6000);
    }
    window.addEventListener('load', fillNotice);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      /* Back button -> home tab */
      var back = t.closest('.navbar__content-left');
      if (back) {
        e.preventDefault();
        e.stopPropagation();
        go(HOME);
        return;
      }

      /* Customer support icon (top-right of the navbar) */
      if (t.closest('.navbar__content-right')) {
        e.preventDefault();
        e.stopPropagation();
        go(SUPPORT);
        return;
      }

      /* Text buttons: Withdraw / Deposit / Detail (and a plain "Wallet") */
      var btn = t.closest('button,div,span,a,i');
      if (!btn) return;
      var label = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

      if (label === 'deposit') { e.preventDefault(); e.stopPropagation(); go(DEPOSIT); return; }
      if (label === 'withdraw') { e.preventDefault(); e.stopPropagation(); go(WALLET); return; }
      if (label === 'detail' || label === 'details') { e.preventDefault(); e.stopPropagation(); go(DETAIL); return; }
      if (label === 'wallet' || label === 'wallet balance') { e.preventDefault(); e.stopPropagation(); go(WALLET); return; }
    }, true);
  });
})();
