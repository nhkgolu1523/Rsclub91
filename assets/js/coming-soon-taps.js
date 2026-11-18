/* ============================================================================
   COMING SOON TAPS  --  assets/js/coming-soon-taps.js
   ----------------------------------------------------------------------------
   Kuch method buttons jinke liye feature abhi live nahi hai -> un par click
   karne se wahi "Coming Soon" popup dikhta hai jo games par dikhta hai
   (assets/js/game-tap.js wala, same style/ID).

   Covered:
     1. Withdraw  -> "USDT" method button          (.withdrawWay > div)
     2. Withdraw  -> "ARPay" card                  (.c2c.Ar)
     3. Deposit   -> "ARPay" payment card          (.Recharge__container-tabcard__items,
                                                    jiska bot-text "ARPay" ho)

   Baaki methods (UPI / BANK CARD / UPI-QR / PAYTM etc.) pehle jaise chalte
   rahenge.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__rsComingSoonTaps) return;
  window.__rsComingSoonTaps = true;

  var TOAST_ID = 'rsComingSoonToast';
  var TOAST_STYLE_ID = 'rs-coming-soon-style';

  function injectToastCSS() {
    if (document.getElementById(TOAST_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = TOAST_STYLE_ID;
    /* games (game-tap.js) jaisa exact same popup */
    style.textContent =
      '#' + TOAST_ID + '{position:fixed;left:0;right:0;top:0;bottom:0;z-index:100001;display:none;'
      + 'align-items:center;justify-content:center;}'
      + '#' + TOAST_ID + '.rs-coming-soon--show{display:flex;}'
      + '#' + TOAST_ID + ' .rs-cs-ov{position:absolute;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,.6);}'
      + '#' + TOAST_ID + ' .rs-cs-box{position:relative;z-index:1;min-width:200px;max-width:80vw;box-sizing:border-box;'
      + 'background:linear-gradient(90deg,#f7c948,#1fb98a);color:#0a0a14;font-family:Roboto,Inter,sans-serif;'
      + 'font-size:16px;font-weight:600;text-align:center;border-radius:10px;padding:14px 24px;}';
    (document.head || document.documentElement).appendChild(style);
  }

  var hideTimer = null;

  function hideComingSoon() {
    var el = document.getElementById(TOAST_ID);
    if (!el) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    el.classList.remove('rs-coming-soon--show');
  }

  function ensureToast() {
    var existing = document.getElementById(TOAST_ID);
    if (existing) return existing;
    injectToastCSS();
    var el = document.createElement('div');
    el.id = TOAST_ID;
    el.className = 'rs-coming-soon';
    el.innerHTML = '<div class="rs-cs-ov"></div><div class="rs-cs-box">Coming Soon</div>';
    document.body.appendChild(el);
    var ov = el.querySelector('.rs-cs-ov');
    if (ov) ov.addEventListener('click', hideComingSoon);
    var box = el.querySelector('.rs-cs-box');
    if (box) box.addEventListener('click', hideComingSoon);
    return el;
  }

  function showComingSoon() {
    var el = ensureToast();
    var box = el.querySelector('.rs-cs-box');
    if (box) box.textContent = 'Coming Soon';
    el.classList.add('rs-coming-soon--show');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideComingSoon, 1000);
  }

  /* ---------- detection helpers ---------- */

  function tabText(el) {
    return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  /* withdraw: USDT method button */
  function isWithdrawUsdt(el) {
    if (tabText(el) === 'USDT') return true;
    var img = el.querySelector ? el.querySelector('img') : null;
    var src = img ? String(img.getAttribute('src') || '') : '';
    return /WithBeforeImgIcon_20260905181924qv6c/.test(src);
  }

  /* withdraw: ARPay card (.c2c.Ar) */
  function isWithdrawArpay(el) {
    return !!el.classList && el.classList.contains('Ar');
  }

  /* deposit: ARPay payment card */
  function isDepositArpay(card) {
    var bot = card.querySelector ? card.querySelector('.Recharge__container-tabcard__bot') : null;
    return tabText(bot) === 'ARPAY';
  }

  /* capture phase: page ke apne click handler se PEHLE chalo, taaki method
     switch hone se rok sakein. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    /* 1) withdraw method tabs */
    var tab = t.closest('.withdrawWay > div');
    if (tab && !tab.classList.contains('c2c') && isWithdrawUsdt(tab)) {
      e.preventDefault(); e.stopPropagation(); showComingSoon(); return;
    }

    /* 2) withdraw ARPay card */
    var ar = t.closest('.c2c.Ar');
    if (ar && isWithdrawArpay(ar)) {
      e.preventDefault(); e.stopPropagation(); showComingSoon(); return;
    }

    /* 3) deposit ARPay card */
    var card = t.closest('.Recharge__container-tabcard__items');
    if (card && isDepositArpay(card)) {
      e.preventDefault(); e.stopPropagation(); showComingSoon(); return;
    }
  }, true);

  window.RSComingSoonTaps = { show: showComingSoon, hide: hideComingSoon };
})();
