(function () {
  'use strict';

  if (window.RSVip) return;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var POLL_MS = 2000;
  var THRESHOLDS = [3000, 30000, 400000, 4000000, 20000000, 80000000, 300000000, 1000000000, 5000000000, 10000000000];

  var BENEFITS = {
    1: { levelUp: '60', monthly: '3', rebate: '0.04%' },
    2: { levelUp: '180', monthly: '9', rebate: '0.04%' },
    3: { levelUp: '690', monthly: '29', rebate: '0.1%' },
    4: { levelUp: '1,690', monthly: '690', rebate: '0.1%' },
    5: { levelUp: '6,900', monthly: '1,690', rebate: '0.1%' },
    6: { levelUp: '16,900', monthly: '6,900', rebate: '0.15%' },
    7: { levelUp: '69,000', monthly: '16,900', rebate: '0.15%' },
    8: { levelUp: '169,000', monthly: '69,000', rebate: '0.15%' },
    9: { levelUp: '690,000', monthly: '169,000', rebate: '0.2%' },
    10: { levelUp: '1,690,000', monthly: '690,000', rebate: '0.3%' }
  };

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  function num(v) {
    if (v === null || v === undefined || v === '' || v === 'null' || v === 'undefined') return 0;
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function levelForExp(exp) {
    var lvl = 0;
    for (var i = 0; i < THRESHOLDS.length; i++) if (exp >= THRESHOLDS[i]) lvl = i + 1;
    return lvl;
  }

  function fmtExp(n) {
    return Number(n).toLocaleString('en-IN');
  }

  /* Payout time = days until 1st of next month, 2:00 AM. floor; 0 -> "Today". */
  function payoutDays() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 2, 0, 0, 0);
    var days = Math.floor((next.getTime() - now.getTime()) / 86400000);
    return Math.max(0, days);
  }

  function vipUrl(userId) { return FB + '/USERS/' + encodeURIComponent(userId) + '/VIP.json'; }

  var state = { exp: 0, level: 0 };
  var autoSlided = false;

  /* Auto-slide the card carousel to the user's current target level, once.
     VIP0 -> VIP1 card (index 0), VIP1 -> VIP2 card (index 1), ...
     VIP10 (max) -> stay on VIP10 (last index). Never resets a manual swipe. */
  function autoSlideToLevel() {
    if (autoSlided) return;
    if (typeof window.__vipCardScrollTo !== 'function') return;
    var cards = document.querySelectorAll('.vip-content-card .swiper-slide').length;
    if (!cards) return;
    var idx = Math.max(0, Math.min(state.level, cards - 1));
    window.__vipCardScrollTo(idx, false);
    autoSlided = true;
  }

  function setBadge(level) {
    var cls = 'n' + level;
    var badges = document.querySelectorAll(
      '.vip-header-wrapper-name-vip,.userInfo__container-content-nickname .n0'
    );
    for (var i = 0; i < badges.length; i++) {
      var el = badges[i];
      for (var k = 0; k <= 10; k++) el.classList.remove('n' + k);
      el.classList.add(cls);
    }
  }

  function paintHeader() {
    setBadge(state.level);
    var expEl = document.querySelector('.vip-content-empirical .red');
    if (expEl) expEl.textContent = fmtExp(state.exp) + ' EXP';
    var d = payoutDays();
    var dayEl = document.querySelector('.vip-content-empirical .timeTop span');
    if (dayEl) {
      if (d === 0) dayEl.textContent = '0 Days';
      else if (d === 1) dayEl.textContent = '1 Day';
      else dayEl.textContent = d + ' Days';
    }
  }

  /* Mirrors the original VipCard.vue three states:
     - level <  currentLevel -> "Achieved"   (reached crown, no lock)
     - level == currentLevel -> current card (progress, no lock, no "Not open yet")
     - level >  currentLevel -> "Not open yet" + lock icon
     Lock icon is the <img> right after the <h1> (original ununlocked.png). */
  var LOCK_IMG = '../../assets/png/ununlocked-qDFYjbz7.png';
  var REACHED_IMG = '../../assets/png/HaveReached-kgmY4sfO.png';

  function paintCards() {
    var slides = document.querySelectorAll('.vip-content-card .swiper-slide');
    if (!slides.length) return;
    for (var i = 0; i < slides.length; i++) {
      var level = i + 1;
      var thr = THRESHOLDS[i];
      var reach = state.level >= level;
      var pct = thr ? Math.min(100, Math.round((state.exp / thr) * 100)) : 0;

      var portion = slides[i].querySelector('.van-progress__portion');
      if (portion) portion.style.width = pct + '%';

      /* progress bar ke niche ka "currentExp/threshold" (left side, e.g. 0/3000) */
      var levelSpan = slides[i].querySelector('.itemInfo-bottom span.level');
      if (levelSpan) levelSpan.textContent = fmtExp(Math.min(state.exp, thr)) + '/' + fmtExp(thr);

      var headWrap = slides[i].querySelector('.itemInfo-head > div');
      if (!headWrap) continue;
      var h1 = headWrap.querySelector('h1');
      var lockImg = h1 ? h1.nextElementSibling : null;
      if (lockImg && lockImg.tagName !== 'IMG') lockImg = null;
      var stateSpan = (lockImg ? lockImg.nextElementSibling : h1 ? h1.nextElementSibling : null);
      if (stateSpan && stateSpan.tagName !== 'SPAN') stateSpan = null;

      if (reach) {
        /* reached (past level or the current one) -> reached crown + "Achieved" */
        slides[i].classList.add('unlocked');
        if (lockImg) {
          lockImg.src = REACHED_IMG;
          lockImg.style.display = '';
        }
        if (stateSpan) {
          stateSpan.textContent = 'Achieved';
          stateSpan.className = 'bgg';
          stateSpan.style.display = '';
        }
      } else {
        /* not reached -> "Not open yet" + lock icon */
        slides[i].classList.remove('unlocked');
        if (lockImg) {
          lockImg.src = LOCK_IMG;
          lockImg.style.display = '';
        }
        if (stateSpan) {
          stateSpan.textContent = 'Not open yet';
          stateSpan.className = '';
          stateSpan.style.display = '';
        }
      }
    }
  }

  function setTrailingText(el, value) {
    if (!el) return;
    var node = el.lastChild;
    while (node && node.nodeType !== 3) node = node.previousSibling;
    if (node) node.nodeValue = ' ' + value;
    else el.appendChild(document.createTextNode(' ' + value));
  }

  function paintBenefits() {
    var level = state.level < 1 ? 1 : state.level;
    var data = BENEFITS[level];
    var weal = document.querySelector('.vip-content-weal');
    if (!data || !weal) return;
    var title = weal.querySelector('.vip-content-weal-head h1');
    if (title) title.textContent = 'VIP' + level + ' Benefits level';
    var rows = weal.querySelectorAll('.vip-content-weal-con');
    if (rows[0]) setTrailingText(rows[0].querySelectorAll('p')[0], data.levelUp);
    if (rows[1]) setTrailingText(rows[1].querySelectorAll('p')[0], data.monthly);
    if (rows[2]) setTrailingText(rows[2].querySelector('p'), data.rebate);
  }

  function paint() {
    paintHeader();
    paintCards();
    paintBenefits();
    autoSlideToLevel();
  }

  function fetchVip(cb) {
    var u = uid();
    if (!u) { if (cb) cb(null); return; }
    fetch(vipUrl(u), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || typeof data !== 'object') { if (cb) cb(null); return; }
        state.exp = num(data.EXP);
        state.level = num(data.LEVEL) || levelForExp(state.exp);
        if (cb) cb(state);
      })
      .catch(function () { if (cb) cb(null); });
  }

  var timer = null;
  function startPoll() {
    if (timer) return;
    fetchVip(paint);
    timer = setInterval(function () { fetchVip(paint); }, POLL_MS);
  }

  window.RSVip = {
    uid: uid,
    levelForExp: levelForExp,
    payoutDays: payoutDays,
    thresholds: THRESHOLDS,
    fetch: fetchVip,
    refresh: function () { fetchVip(paint); },
    start: startPoll,
    state: state
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPoll);
  } else {
    startPoll();
  }
})();
