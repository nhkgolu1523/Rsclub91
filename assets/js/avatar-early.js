(function () {
  'use strict';

  var AVATAR_KEY = 'rsclub_avatar_id';
  var AVATAR_SRC_KEY = 'rsclub_avatar';
  var MAX_AVATAR = 20;
  var AVATAR_SEL = '.userInfo__container-content__avatar img,.userAvatar,'
    + '.userInfo__container-setting-center-header img';

  function store(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }

  var uid = store('rsclub_uid');
  if (!uid) return;

  var base = '/assets/images/avatars/';
  try {
    var s = document.querySelector('script[src*="avatar-early.js"]');
    if (s) base = (s.getAttribute('src') || '').replace(/[^/]*$/, '') + '../images/avatars/';
  } catch (e) {}

  var src = store(AVATAR_SRC_KEY);
  if (!src) {
    var id = parseInt(store(AVATAR_KEY), 10);
    if (!isFinite(id) || id < 1 || id > MAX_AVATAR) id = 1;
    src = base + id + '.png';
  }
  if (!src) return;

  var idMatch = src.match(/(\d+)\.png$/);
  if (idMatch) document.documentElement.setAttribute('data-rs-avatar-id', idMatch[1]);

  function paint() {
    var list = document.querySelectorAll(AVATAR_SEL);
    for (var i = 0; i < list.length; i++) {
      if (list[i].getAttribute('src') !== src) list[i].setAttribute('src', src);
    }
  }

  paint();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paint, { once: true });
  }
  if (typeof MutationObserver === 'function') {
    var mo = new MutationObserver(paint);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 5000);
  }
  window.addEventListener('load', paint);
})();
