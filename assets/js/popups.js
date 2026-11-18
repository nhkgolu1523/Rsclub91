/* =====================================================================
   Login / welcome + first-deposit popups.

   The welcome popup is shown when the login/register controller writes
   the one-shot session flag `rs_show_welcome_popup` and sends the user
   to Home. The first-deposit reminder is shown to logged-in users on
   every Home load, unless dismissed for the current reminder day.
   Reminder day resets daily at 04:00 local time.
   ===================================================================== */
(function () {
  'use strict';

  var TRIGGER_KEY = 'rs_show_welcome_popup';
  var FIRST_DEPOSIT_HIDE_KEY = 'rs_first_deposit_hidden_on';
  var IMAGE_OVERRIDE_KEY = 'rs_login_popup_image';
  var RESET_HOUR = 4;

  function isLoggedIn() {
    try {
      var uid = localStorage.getItem('rsclub_uid');
      uid = uid == null ? '' : String(uid).trim();
      return !!uid && uid !== 'null' && uid !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  var cfg = window.RS_POPUP_CONFIG || {};
  var loginCfg = cfg.login || {};
  var depositCfg = cfg.firstDeposit || {};

  function byId(id) { return document.getElementById(id); }
  function takeFlag(key) {
    try {
      if (sessionStorage.getItem(key) === '1') {
        sessionStorage.removeItem(key);
        return true;
      }
    } catch (e) {}
    try {
      if (localStorage.getItem(key) === '1') {
        localStorage.removeItem(key);
        return true;
      }
    } catch (e) {}
    return false;
  }
  function todayKey() {
    var d = new Date();
    if (d.getHours() < RESET_HOUR) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function setText(id, value) {
    var el = byId(id);
    if (el && value) el.textContent = value;
  }

  function resolveImage() {
    var img = byId('rsLoginPopupImage');
    if (!img) return;

    var custom = '';
    try {
      var params = new URLSearchParams(window.location.search || '');
      custom = params.get('popupImage') || '';
    } catch (e) {}
    if (!custom) {
      try { custom = localStorage.getItem(IMAGE_OVERRIDE_KEY) || ''; } catch (e) {}
    }
    if (custom) img.src = custom;
    else if (loginCfg.image) img.src = loginCfg.image;
  }

  function applyConfig() {
    var title = byId('rsLoginPopupTitle');
    if (title && loginCfg.title) title.textContent = loginCfg.title;
    setText('rsLoginPopupHeading', loginCfg.heading);
    setText('rsLoginPopupSubheading', loginCfg.subheading);
    setText('rsLoginPopupTagline', loginCfg.tagline);
    setText('rsLoginPopupConfirm', loginCfg.confirmText);
    resolveImage();

    setText('rsFirstDepositTitle', depositCfg.title);
    setText('rsFirstDepositTip', depositCfg.tip);
  }

  var announcement = null;
  var firstDeposit = null;

  function closeAnnouncement() {
    if (announcement) announcement.hidden = true;
    document.body.style.overflow = '';
    if (depositCfg.enabled !== false && canShowFirstDeposit()) {
      window.setTimeout(openFirstDeposit, 180);
    }
  }

  function openAnnouncement() {
    if (!announcement) return;
    resolveImage();
    announcement.hidden = false;
    document.body.style.overflow = 'hidden';
    var btn = byId('rsLoginPopupConfirm');
    if (btn) btn.focus({ preventScroll: true });
  }

  function canShowFirstDeposit() {
    try {
      if (localStorage.getItem(FIRST_DEPOSIT_HIDE_KEY) === todayKey()) return false;
    } catch (e) {}
    return true;
  }

  function closeFirstDeposit() {
    if (!firstDeposit) return;
    var box = byId('rsFirstDepositNoMore');
    if (box && box.getAttribute('aria-checked') === 'true') {
      try { localStorage.setItem(FIRST_DEPOSIT_HIDE_KEY, todayKey()); } catch (e) {}
    }
    firstDeposit.hidden = true;
    document.body.style.overflow = '';
  }

  function openFirstDeposit() {
    if (!firstDeposit) return;
    firstDeposit.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function wireCheckbox(box) {
    if (!box) return;

    function setChecked(on) {
      var icon = box.querySelector('.van-checkbox__icon');
      box.setAttribute('aria-checked', on ? 'true' : 'false');
      if (icon) icon.classList.toggle('van-checkbox__icon--checked', on);
    }

    function toggle() {
      setChecked(!(box.getAttribute('aria-checked') === 'true'));
    }

    box.addEventListener('click', toggle);
    box.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
    });

    var label = box.parentElement;
    if (label) {
      label.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.van-checkbox')) return;
        toggle();
      });
    }
  }

  function popupOpen() {
    return !!((announcement && !announcement.hidden) || (firstDeposit && !firstDeposit.hidden));
  }

  function activityTabAt(x, y) {
    var tabs = document.querySelectorAll('.tabbar__items-tab:not(.placeholder)');
    for (var i = 0; i < tabs.length; i++) {
      var label = (tabs[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (label !== 'activity') continue;
      var r = tabs[i].getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return tabs[i];
    }
    return null;
  }

  function closeButtonAt(x, y) {
    var btn = byId('rsFirstDepositClose');
    if (!btn) return null;
    var r = btn.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    var pad = 4;
    if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return btn;
    return null;
  }

  function goActivity() {
    if (announcement) announcement.hidden = true;
    if (firstDeposit) firstDeposit.hidden = true;
    document.body.style.overflow = '';
    window.location.href = '../activity/index.html';
  }

  function go(url) {
    closeFirstDeposit();
    window.location.href = url;
  }

  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    announcement = byId('rsLoginPopup');
    firstDeposit = byId('rsFirstDepositPopup');

    applyConfig();

    if (announcement) {
      var confirm = byId('rsLoginPopupConfirm');
      if (confirm) confirm.addEventListener('click', closeAnnouncement);
    }

    if (firstDeposit) {
      wireCheckbox(byId('rsFirstDepositNoMore'));

      var close = byId('rsFirstDepositClose');
      if (close) close.addEventListener('click', closeFirstDeposit);

      var fpOverlay = firstDeposit.querySelector('.dialog-queue-host__overlay');
      if (fpOverlay) fpOverlay.addEventListener('click', closeFirstDeposit);

      var act = byId('rsFirstDepositActivity');
      if (act) act.addEventListener('click', goActivity);

      Array.prototype.forEach.call(
        firstDeposit.querySelectorAll('[data-deposit-amount]'),
        function (btn) {
          btn.addEventListener('click', function () {
            go('../deposit/index.html?amount=' + encodeURIComponent(btn.getAttribute('data-deposit-amount')));
          });
        }
      );
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (announcement && !announcement.hidden) closeAnnouncement();
      else if (firstDeposit && !firstDeposit.hidden) closeFirstDeposit();
    });

    /* While either popup covers the screen, its dimmed bottom bar is still
       visible. Let a tap on the Activity tab pass through to the Activity page. */
    document.addEventListener('click', function (e) {
      if (!popupOpen()) return;
      if (!activityTabAt(e.clientX, e.clientY)) return;
      e.preventDefault();
      e.stopPropagation();
      goActivity();
    }, true);

    /* The close button sits over the dimmed bottom bar. Catch the tap at its
       visual position before any nav/overlay handler can swallow it. */
    function closePoint(e) {
      if (!firstDeposit || firstDeposit.hidden) return;
      var touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
      var x = touch ? touch.clientX : e.clientX;
      var y = touch ? touch.clientY : e.clientY;
      if (!closeButtonAt(x, y)) return;
      e.preventDefault();
      e.stopPropagation();
      closeFirstDeposit();
    }
    ['pointerdown', 'touchstart', 'click'].forEach(function (type) {
      window.addEventListener(type, closePoint, type === 'touchstart' ? { capture: true, passive: false } : true);
    });

    var hadFlag = takeFlag(TRIGGER_KEY);

    if (hadFlag) {
      if (announcement && loginCfg.enabled !== false) openAnnouncement();
      else if (firstDeposit && depositCfg.enabled !== false && canShowFirstDeposit()) openFirstDeposit();
      return;
    }

    if (firstDeposit && depositCfg.enabled !== false && !window.__rsTabSwap && isLoggedIn() && canShowFirstDeposit()) {
      openFirstDeposit();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
