/* Logged-out Activity page: login prompt. */
(function () {
  'use strict';

  var host = document.querySelector('.dialog-queue-host');
  var login = document.querySelector('.activity-banner .bonus-button');
  var primary = document.querySelector('.event-rewards-login-dialog__primary');
  var secondary = document.querySelector('.event-rewards-login-dialog__secondary');
  var mask = document.querySelector('.event-rewards-login-dialog__panel-mask');

  function open() {
    if (host) host.classList.remove('game-popup-hidden');
  }
  function close() {
    if (host) host.classList.add('game-popup-hidden');
  }

  if (login) {
    login.style.cursor = 'pointer';
    login.addEventListener('click', function (e) {
      e.preventDefault();
      open();
    });
  }
  if (primary) {
    primary.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = '../login/index.html';
    });
  }
  if (secondary) {
    secondary.addEventListener('click', function (e) {
      e.preventDefault();
      close();
    });
  }
  if (mask) mask.addEventListener('click', close);
})();
