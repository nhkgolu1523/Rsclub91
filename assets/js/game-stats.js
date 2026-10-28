/* ============================================================================
   GAME STATISTICS  (pages/game-statistics)  ->  assets/js/game-stats.js
   ----------------------------------------------------------------------------
   Original: views/main/GameStats/index.vue (assets/js/index-Db6NVlBC.js)
     - 4 card tabs: Today / Yesterday / This week / This month
     - banner: sumBetAmount + "Total bet"
     - list: per game type -> Total bet / Number of bets / Winning amount
     - API: GameStatis -> { gameStatis:[{gameTypeName,betAmount,betCount,
                                          betWinLossAmount}], sumBetAmount }

   Hamare paas abhi sirf WINGO (=Lottery) ka data hai, aur wo Firebase ke
   per-bet node me hai (USERS/<uid>/BETS-HISTORY/WINGO). Isliye hum wahi
   aggregate karte hain — UI/markup bilkul original jaisa rehta hai.
   (Baaki game types baad me add honge - unke liye data node aane par
    yahin ek row aur add karni hai.)

   Scope-id "data-v-0fabbe57" har generated element par lagana ZAROORI hai
   warna styles.css ke (scoped) card styles apply nahi honge.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__RSGameStats) return;
  window.__RSGameStats = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var SCOPE = 'data-v-0fabbe57';

  function uid() {
    try {
      var m = /[?&]uid=([^&#]+)/.exec(location.search);
      if (m) {
        var q = decodeURIComponent(m[1]).trim();
        if (q && q !== 'null' && q !== 'undefined') return q;
      }
    } catch (e) {}
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }

  function money(n) {
    var v = Number(n) || 0;
    return '\u20B9' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* original getTime(): today / yesterday / last7days / thisMonth
     (dates as YYYY-MM-DD, bet TIME isi format ka pehla 10 char hai) */
  function rangeFor(idx) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    function add(base, n) { var d = new Date(base.getTime()); d.setDate(d.getDate() + n); return d; }
    if (idx === 0) return { from: ymd(today), to: ymd(today) };                 /* Today */
    if (idx === 1) { var y = add(today, -1); return { from: ymd(y), to: ymd(y) }; }  /* Yesterday */
    if (idx === 2) return { from: ymd(add(today, -6)), to: ymd(today) };       /* This week (7d) */
    /* This month */
    var first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: ymd(first), to: ymd(today) };
  }

  /* abhi sirf Lottery (WINGO) hai; baaki types ke liye yahan row add karenge */
  var TYPES = [
    { name: 'lottery', src: 'WINGO', icon: 'iconLottery-DvMeF7Lu.svg' }
    /* future: { name:'video', src:'...', icon:'iconRealPerson-CgGu5NPf.svg' } ... */
  ];

  var state = { tab: 0, bets: {} };
  var holder = null;
  var bannerH1 = null;
  var listWrapper = null;

  function refs() {
    holder = document.querySelector('.gamestats-container-items');
    bannerH1 = document.querySelector('.gamestats-container-banner h1');
    listWrapper = document.querySelector('.gamestats-container-list-wrapper');
  }

  function inRange(t, r) {
    var d = String(t || '').slice(0, 10);
    if (!d) return false;
    return d >= r.from && d <= r.to;
  }

  /* ek type ka aggregate (original row ka data) */
  function aggregate(src) {
    var r = rangeFor(state.tab);
    var betAmount = 0, betCount = 0, winAmount = 0;
    for (var id in state.bets) {
      var b = state.bets[id];
      if (!b || typeof b !== 'object') continue;
      if (!inRange(b.TIME, r)) continue;
      betAmount += Number(b.STAKE) || 0;
      betCount += 1;
      winAmount += Number(b['WIN-AMOUNT']) || 0;
    }
    return {
      gameTypeName: src.name,
      icon: src.icon,
      betAmount: Math.round(betAmount * 100) / 100,
      betCount: betCount,
      betWinLossAmount: Math.round(winAmount * 100) / 100
    };
  }

  /* original row markup (.gamestats-container-item) */
  function itemHtml(g) {
    var mask = 'url(/assets/svg/' + g.icon + ')';
    return ''
      + '<div class="gamestats-container-item">'
      + '<h1><i class="gamestats-container-item-icon" style="mask-image:' + mask
      + ';-webkit-mask-image:' + mask + '"></i><span>' + g.gameTypeName + '</span></h1>'
      + '<div class="gamestats-container-item-content">'
      + '<i class="gamestats-container-item-steps"></i>'
      + '<div class="gamestats-container-item-content-list">'
      + '<div><h4>Total bet</h4><h5>' + money(g.betAmount) + '</h5></div>'
      + '<div><h4>Number of bets</h4><h5>' + g.betCount + '</h5></div>'
      + '<div><h4>Winning amount</h4><span>' + money(g.betWinLossAmount) + '</span></div>'
      + '</div></div></div>';
  }

  var EMPTY_HTML = ''
    + '<div class="empty__container" style="margin-top:40px">'
    + '<svg class="svg-icon icon-empty"><use xlink:href="#icon-empty"></use></svg>'
    + '<p>No data</p></div>';

  function render() {
    refs();
    if (!holder) return;

    var rows = [], sum = 0;
    for (var i = 0; i < TYPES.length; i++) {
      var g = aggregate(TYPES[i]);
      sum += g.betAmount;
      rows.push(g);
    }
    sum = Math.round(sum * 100) / 100;

    if (bannerH1) bannerH1.textContent = money(sum);

    var hasData = rows.some(function (g) { return g.betCount > 0; });
    if (!hasData) {
      /* original: list empty -> Empty ("No data"), banner 0 dikhega */
      holder.innerHTML = EMPTY_HTML.replace(/<div /g, '<div ' + SCOPE + ' ')
        .replace(/<svg /g, '<svg ' + SCOPE + ' ')
        .replace(/<use /g, '<use ' + SCOPE + ' ')
        .replace(/<p /g, '<p ' + SCOPE + ' ');
      return;
    }

    holder.innerHTML = rows.map(itemHtml).join('');
    /* scoped-CSS: har generated element par data-v-0fabbe57 lagao */
    var all = holder.querySelectorAll('.gamestats-container-item, .gamestats-container-item *');
    for (var j = 0; j < all.length; j++) all[j].setAttribute(SCOPE, '');
  }

  function load() {
    var u = uid();
    if (!u) { state.bets = {}; render(); return; }
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/BETS-HISTORY/WINGO.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { state.bets = data || {}; render(); })
      .catch(function () { /* keep whatever is shown */ });
  }

  /* original card tabs wire: Android/Vue first me hum (capture) - taaki
     account-subpage.js ke generic van-tab handler se pehle hum tab set karein */
  function wireTabs() {
    var tabs = document.querySelectorAll('.gamestats-container-header .van-tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (idx, el) {
        el.addEventListener('click', function () {
          state.tab = idx;
          for (var k = 0; k < tabs.length; k++) {
            tabs[k].classList.toggle('van-tab--active', k === idx);
            tabs[k].setAttribute('aria-selected', k === idx ? 'true' : 'false');
            tabs[k].setAttribute('tabindex', k === idx ? '0' : '-1');
          }
          render();
        }, true);
      })(i, tabs[i]);
    }
  }

  function start() {
    wireTabs();
    load();
    setInterval(load, 8000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
