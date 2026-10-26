/* Account page menu routing + saved profile/avatar rendering. */
(function () {
  'use strict';

  function label(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function itemKey(item) {
    if (item.matches('.settingPanel__container-items__item')) {
      return label(item.querySelector('.settingPanel__container-items__title') || item);
    }
    if (item.matches('.financialServices__container-box > div')) {
      return label(item.querySelector('.financialServices__container-box-para h3') || item);
    }
    return label(item);
  }

  function stored(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function toast(message) {
    var old = document.getElementById('rsAccountToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsAccountToast';
    el.className = 'rs-toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('rs-toast--show'); });
    setTimeout(function () {
      el.classList.remove('rs-toast--show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 1500);
  }

  function go(url) {
    window.location.href = url;
  }

  var SERVICE = {
    'settings': '../settings/index.html',
    'feedback': '../feedback/index.html',
    'announcement': '../notification-center/index.html?tab=information',
    'about us': '../about-us/index.html'
  };
  var SETTINGS = {
    'notification': '../notification-center/index.html?tab=notification',
    'gifts': '../gift/index.html',
    'my top-up coupons': '../topup-coupons/index.html',
    'game statistics': '../game-statistics/index.html',
    'language': '../language/index.html'
  };
  var FINANCE = {
    'game history': '../game-history/index.html',
    'transaction': '../transaction-history/index.html',
    'deposit': '../deposit-history/index.html',
    'withdraw': '../withdrawal-history/index.html'
  };

  function handle(e) {
    var item = e.target.closest ? e.target.closest(
      '.serviceCenter__container-items__item,' +
      '.settingPanel__container-items__item,' +
      '.financialServices__container-box > div'
    ) : null;
    if (!item) return;

    var key = itemKey(item);
    var url = '';
    if (item.matches('.serviceCenter__container-items__item')) url = SERVICE[key] || '';
    else if (item.matches('.settingPanel__container-items__item')) url = SETTINGS[key] || '';
    else if (item.matches('.financialServices__container-box > div')) url = FINANCE[key] || '';

    if (!url) {
      if (key === 'customer service') toast('Customer service will be available soon.');
      else if (key === 'beginner\'s guide') toast('Beginner guide will be available soon.');
      return;
    }
    e.preventDefault();
    go(url);
  }

  function profile() {
    var user = stored('rsclub_username') || ('MEMBER' + stored('rsclub_uid').slice(0, 4));
    var uid = stored('rsclub_uid');
    var avatar = stored('rsclub_avatar');

    ['rsUserName', 'rsUserNameSetting'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = user;
    });

    var nickEl = document.querySelector('.userInfo__container-content-nickname h3');
    if (nickEl) nickEl.textContent = user;

    document.querySelectorAll('.userInfo__container-setting-center-content').forEach(function (row) {
      var h = row.querySelector('h5');
      var value = row.querySelector('span');
      if (!h || !value) return;
      if (/^nickname$/i.test((h.textContent || '').trim())) value.textContent = user;
      if (/^uid$/i.test((h.textContent || '').trim()) && uid) value.textContent = uid;
    });

    if (avatar) {
      document.querySelectorAll('.userInfo__container-content__avatar img, .userAvatar').forEach(function (img) {
        img.src = avatar;
      });
    }
  }
  document.addEventListener('click', handle);

  document.addEventListener('click', function (e) {
    var avatar = e.target.closest ? e.target.closest('.userInfo__container-content__avatar') : null;
    if (avatar) { go('../change-avatar/index.html'); return; }
    var nick = e.target.closest ? e.target.closest('.userInfo__container-setting-center-content') : null;
    if (nick && /nickname/i.test((nick.textContent || ''))) go('../change-nickname/index.html');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', profile);
  else profile();

  /* show a one-shot success toast after a feedback submit redirect */
  try {
    if (sessionStorage.getItem('rs_feedback_toast') === '1') {
      sessionStorage.removeItem('rs_feedback_toast');
      setTimeout(function () { toast('Your feedback has been submitted. Thank you!'); }, 150);
    }
  } catch (e) {}
})();
