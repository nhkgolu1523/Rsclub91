(function () {
  'use strict';

  if (window.__RSLoginGateBooted) {
    if (window.RSLoginGate) window.RSLoginGate.enforce();
    return;
  }
  window.__RSLoginGateBooted = true;

  var POPUP_ID = 'gamePopup';
  var STYLE_ID = 'rs-login-gate-style';

  function isLoggedIn() {
    try {
      var uid = localStorage.getItem('rsclub_uid');
      uid = uid == null ? '' : String(uid).trim();
      return !!uid && uid !== 'null' && uid !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  function getPopup() {
    return document.getElementById(POPUP_ID);
  }

  function closePopup() {
    var popup = getPopup();
    if (!popup) return;
    popup.classList.add('game-popup-hidden');
    popup.setAttribute('aria-hidden', 'true');
  }

  function apply() {
    var loggedIn = isLoggedIn();
    var style = document.getElementById(STYLE_ID);
    var popup = getPopup();

    if (loggedIn) {
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = '#gamePopup{display:none!important;visibility:hidden!important;pointer-events:none!important}';
        (document.head || document.documentElement).appendChild(style);
      }
      document.documentElement.classList.add('rs-user-logged-in');
      closePopup();
      return;
    }

    if (style && style.parentNode) style.parentNode.removeChild(style);
    document.documentElement.classList.remove('rs-user-logged-in');
    if (popup) {
      popup.removeAttribute('aria-hidden');
      if (!popup.classList.contains('game-popup-hidden')) popup.removeAttribute('hidden');
    }
  }

  function boot() {
    apply();
  }

  window.RSLoginGate = {
    isLoggedIn: isLoggedIn,
    canShowPopup: function () { return !isLoggedIn(); },
    enforce: apply
  };

  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === 'rsclub_uid') apply();
  });
  window.addEventListener('pageshow', apply);
  window.addEventListener('focus', apply);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) apply();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  setInterval(apply, 1500);
})();
