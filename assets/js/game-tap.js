(function () {
  'use strict';

  if (window.__RSGameTapBooted) {
    if (window.RSGameTap) window.RSGameTap.enforce();
    return;
  }
  window.__RSGameTapBooted = true;

  var DB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var GAMES_PATH = '/GAMES';
  var TOAST_ID = 'rsComingSoonToast';
  var TOAST_STYLE_ID = 'rs-coming-soon-style';

  var gamesReady = false;
  var gamesMap = {};

  var CARD_SELECTOR = [
    '[data-game-name]',
    '.onlineGamesItem',
    '.lotterySlotItem',
    '.lotterySlotItem__container',
    '.game_img',
    '.slot_img',
    '.slot_item',
    '.hot_container .item',
    '.popular .item',
    '.van-grid-item',
    '.game-item',
    '[class*="grid-item"]',
    '[class*="game-card"]',
    '.van-swipe-slide',
    '.swiper-slide',
    '.top-games img',
    '.mini-games img',
    '.slots img',
    '.activity-cards__item',
    '.b-item',
    '.jackpot-banner'
  ].join(',');

  var SKIP_SELECTOR = [
    '.partner-logos',
    '.more',
    '.game-section__head',
    '.gamesList__container-search',
    '.tabbar',
    '.van-tab',
    '.nav'
  ].join(',');

  function isLoggedIn() {
    if (window.RSLoginGate && typeof window.RSLoginGate.isLoggedIn === 'function') {
      return window.RSLoginGate.isLoggedIn();
    }
    try {
      var uid = localStorage.getItem('rsclub_uid');
      uid = uid == null ? '' : String(uid).trim();
      return !!uid && uid !== 'null' && uid !== 'undefined';
    } catch (e) {
      return false;
    }
  }

  function normalizeKey(raw) {
    var key = String(raw || '').split('/').pop().split('?')[0];
    key = key.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
    key = key.replace(/_[0-9]{12,}.*$/, '');
    key = key.replace(/[_\s-]?game$/i, '');
    return key.trim().toLowerCase();
  }

  function resolveGameName(el) {
    var maps = window.RS_GAME_NAMES;

    var named = el.matches && el.matches('[data-game-name]')
      ? el
      : (el.closest ? el.closest('[data-game-name]') : null);
    if (named) {
      var attr = named.getAttribute('data-game-name');
      if (attr) return attr.trim().toLowerCase();
    }

    var img = el.tagName === 'IMG' ? el : (el.querySelector ? el.querySelector('img') : null);
    if (!img && el.closest) img = el.closest('img');
    if (img) {
      var src = img.getAttribute('data-origin') || img.getAttribute('src') || '';
      var key = normalizeKey(src);
      if (key) {
        if (maps && maps.byName && maps.byName[key]) return maps.byName[key];
        if (maps && maps.byCode && maps.byCode[key]) return maps.byCode[key];
      }
    }

    var textEl = el.querySelector ? el.querySelector('.tit, span, .name, .title, .t') : null;
    var text = textEl ? String(textEl.textContent || '').trim().toLowerCase() : '';
    if (text && maps && maps.byName && maps.byName[text]) return maps.byName[text];
    if (text) return text;

    if (img) {
      var raw = normalizeKey(img.getAttribute('data-origin') || img.getAttribute('src') || '');
      if (raw) return raw;
    }

    return null;
  }

  function applyGamesData(data) {
    gamesMap = {};
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(function (k) {
        var v = data[k];
        if (v != null && String(v).trim() !== '') {
          gamesMap[k.trim().toLowerCase()] = String(v);
        }
      });
    }
  }

  function preloadGames() {
    if (gamesReady) return;
    gamesReady = true;
    var CACHE_KEY = 'rs_games_cache_v1';
    try {
      var cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.data) applyGamesData(parsed.data);
      }
    } catch (e) {}
    fetch(DB + GAMES_PATH + '.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        applyGamesData(data);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: data })); } catch (e) {}
      })
      .catch(function () {});
  }

  function gameValueExists(gameName) {
    if (!gameName) return false;
    return gamesMap[String(gameName).trim().toLowerCase()] !== undefined;
  }

  function injectToastCSS() {
    if (document.getElementById(TOAST_STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = TOAST_STYLE_ID;
    style.textContent = '#' + TOAST_ID + '{position:fixed;left:50%;top:50%;z-index:100001;max-width:8rem;padding:.22rem .42rem;border-radius:.4rem;background:rgba(20,21,27,.96);color:#fff;font-size:.32rem;line-height:1.45;text-align:center;opacity:0;transform:translate(-50%,-50%);transition:opacity .18s ease;pointer-events:none;}' +
      '#' + TOAST_ID + '.rs-coming-soon--show{opacity:1;}';
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureToast() {
    var existing = document.getElementById(TOAST_ID);
    if (existing) return existing;
    injectToastCSS();
    var el = document.createElement('div');
    el.id = TOAST_ID;
    el.className = 'rs-coming-soon';
    document.body.appendChild(el);
    return el;
  }

  var hideTimer = null;

  function showComingSoon(gameName) {
    var el = ensureToast();
    el.textContent = 'Coming Soon';
    requestAnimationFrame(function () { el.classList.add('rs-coming-soon--show'); });
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideComingSoon, 1600);
  }

  function hideComingSoon() {
    var el = document.getElementById(TOAST_ID);
    if (!el) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    el.classList.remove('rs-coming-soon--show');
  }

  function openLoginPopup() {
    if (typeof window.__openEventRewardsPopup === 'function') {
      window.__openEventRewardsPopup();
      return true;
    }
    return false;
  }

  function handleTap(e) {
    if (e.__rsGameTapHandled) return;
    var target = e.target;
    if (!target || !target.closest) return;
    if (target.closest('#' + TOAST_ID) || target.closest('#gamePopup')) return;
    if (target.closest(SKIP_SELECTOR)) return;

    var card = target.closest(CARD_SELECTOR);
    if (!card) return;

    var gameName = resolveGameName(card);
    if (!gameName) return;

    e.__rsGameTapHandled = true;

    if (!isLoggedIn()) {
      openLoginPopup();
      return;
    }

    if (gameValueExists(gameName)) showComingSoon(gameName);
  }

  window.RSGameTap = {
    isLoggedIn: isLoggedIn,
    resolveGameName: resolveGameName,
    gameValueExists: gameValueExists,
    showComingSoon: showComingSoon,
    hideComingSoon: hideComingSoon,
    reload: function () { gamesReady = false; preloadGames(); },
    enforce: function () { preloadGames(); }
  };

  document.addEventListener('click', handleTap, false);

  preloadGames();
  window.addEventListener('pageshow', preloadGames);
  document.addEventListener('DOMContentLoaded', preloadGames);
})();
