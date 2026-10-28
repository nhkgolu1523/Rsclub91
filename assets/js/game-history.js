/* Bet history page (pages/game-history) - renders the user's real WINGO bets
   from Firebase (USERS/<uid>/BETS-HISTORY/WINGO). Firebase is the only source
   of truth, so the list matches what the user actually bet on every device. */
(function () {
  'use strict';

  if (window.__RSGameHistory) return;
  window.__RSGameHistory = true;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var POLL_MS = 8000;
  var SCOPE = 'data-v-811ff882'; /* lottery card component ka scoped-CSS id */

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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    var v = Number(n) || 0;
    return '\u20B9' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  var MODES = { 30: 'Win Go 30s', 1: 'Win Go 1Min', 2: 'Win Go 3Min', 3: 'Win Go 5Min' };
  /* original card ke icons / images (page ke assets me maujood) */
  var ROUND_ICON = '<svg class="svg-icon" aria-hidden="true"><use xlink:href="#icon-round"></use></svg>';
  var IMG_MOON = '../../assets/png/moonBar-BKooNkg3.png';

  /* selection label - original i18n labels jaisa */
  function selectLabel(st, gt) {
    var s = String(st);
    if (String(gt) === '1') return 'Number ' + s;
    if (s === '10') return 'Red';
    if (s === '11') return 'Green';
    if (s === '12') return 'Violet';
    if (s === '13') return 'Big';
    if (s === '14') return 'Small';
    return s;
  }

  /* original stateText map: 1=Waiting for result, 2=Lose, 3=Win
     (hamare Firebase STATUS se map - behaviour WAHI rehta hai:
      win -> color40C592/"Win", lose -> "Lose", pending -> "Waiting for result") */
  function statusInfo(status) {
    var s = String(status || 'PENDING').toUpperCase();
    if (s === 'WIN') return { text: 'Win', cls: 'color40C592' };
    if (s === 'LOSE') return { text: 'Lose', cls: '' };
    return { text: 'Waiting for result', cls: '' };
  }

  /* ek chhota <li> row - original markup ka (h2 icon + label, span value) */
  function rowLi(label, valueHtml) {
    return '<li><h2>' + ROUND_ICON + esc(label) + '</h2>' + valueHtml + '</li>';
  }

  function cardHtml(b, idx) {
    var st = statusInfo(b.STATUS);
    var title = MODES[b['TYPE-ID']] || 'Win Go';
    var stake = Number(b.STAKE) || 0;
    var win = Number(b['WIN-AMOUNT']) || 0;
    var fee = Math.round(stake * 0.02 * 100) / 100;

    var selection = selectLabel(b['SELECT-TYPE'], b['GAME-TYPE']);

    /* var rows (original XoSoRecord: Type / Period / Order number / Total bet) */
    var rows = '';
    rows += rowLi('Type', '<span>' + esc(selection) + '</span>');
    rows += rowLi('Period', '<span>' + esc(b.ISSUE) + '</span>');
    rows += rowLi('Order number', '<span>' + esc(idx + 1) + '</span>');
    rows += rowLi('Total bet', '<span>' + money(stake) + '</span>');

    /* betting number badges (winning = .active) */
    var badges = '<span class="' + (win > 0 ? 'active' : '') + '">' + esc(selection) + '</span>';

    /* profit/loss colour (original rule: win-loss > 0 -> green else red).
       Class "success"/"fail" bhi saath me (purana behaviour/test-safe). */
    var plCls = 'bet-container-lottery-note-box-para ' + ((win > 0) ? 'success' : 'fail');

    return ''
      + '<div class="bet-container-lottery-items">'
      + '<div class="bet-container-lottery-card">'
      + '<div class="bet-container-lottery-card-header ar-1px-b">'
      + '<h1><h2>' + esc(title) + '</h2><span class="' + st.cls + '">' + esc(st.text) + '</span></h1>'
      + '<p>' + esc(b.TIME) + '</p>'
      + '</div>'
      /* step-image hata di: svg dots + dashed line (li:after) khud timeline
         banate hain; image ke saath dots double aur khali gap aa raha tha */
      + '<div class="bet-container-lottery-card-info type1" style="min-height:0;margin-bottom:.26667rem">'
      + '<ul>' + rows + '</ul>'
      + '</div>'
      + '<img src="' + IMG_MOON + '" alt="" onerror="this.style.display=\'none\'">'
      + '<div class="bet">'
      + '<div class="li betNum">'
      + '<div class="lab">Betting number<span> (Select number)</span>'
      + '<div class="betList select">' + badges + '</div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div class="bet-container-lottery-note-box">'
      + '<div><div class="bet-container-lottery-note-box-para"><h3>' + money(stake) + '</h3><span>Actual amount</span></div></div>'
      + '<div><div class="bet-container-lottery-note-box-para"><h3>' + money(win) + '</h3><span>Winnings</span></div></div>'
      + '<div><div class="bet-container-lottery-note-box-para"><h3>' + money(fee) + '</h3><span>Handling fee</span></div></div>'
      + '<div class="last"><div class="' + plCls + '"><h4 class="' + (win > 0 ? 'h4_green' : 'h4_red') + '">'
      + (win > 0 ? ('+ ' + money(win)) : ('- ' + money(stake))) + '</h4><span>Profit/loss</span></div></div>'
      + '</div>'
      + '</div>'
      + '</div>';
  }

  /* selected tab + game + date range (game-history page ke filters) */
  var state = { tab: 'Lottery', game: 'Win Go', from: '', to: '' };
  var _bets = {};   /* Firebase se aayi saari bets (latest) */

  /* Sirf LOTTERY tab ka "Win Go" hi hamare paas hai:
     - Lottery tab:  "Win Go" / "All games"  -> history dikhao
     - Lottery tab:  baaki games (Trx/5D/...) -> "No data"
     - baaki tabs (Casino/Fishing/Rummy/Original/Slots): HAR game -> "No data" */
  function isWinGo() {
    var tab = String(state.tab || '').trim();
    var g = String(state.game || '').trim();
    if (!/^lottery$/i.test(tab)) return false;
    return /^win\s*go$/i.test(g) || /^all\s*games?$/i.test(g) || g === '';
  }

  /* bet TIME ("YYYY-MM-DD HH:mm:ss") date-range me hai? */
  function inRange(t) {
    var s = String(t || '');
    if (!s) return !(state.from || state.to);
    var d = s.slice(0, 10);
    if (state.from && d < state.from) return false;
    if (state.to && d > state.to) return false;
    return true;
  }

  function render(bets) {
    var holder = document.querySelector('.bet-container-lottery');
    var emptyBox = document.querySelector('.infiniteScroll__loading');
    if (!holder) return;

    /* selector label ko tab ke hisab se set karo (Lottery=game, baaki=No data) */
    state.tab = readTab() || state.tab;
    if (onLottery()) closeSoon();
    syncGameSelector();
    syncSelectPopup();

    /* sirf Lottery tab + Win Go ka data hai; baaki sab -> "No data" */
    if (!isWinGo()) {
      holder.innerHTML = '';
      if (emptyBox) emptyBox.style.display = '';
      return;
    }

    var rows = [];
    for (var id in bets) {
      var b = bets[id];
      if (!b || typeof b !== 'object') continue;
      if (!inRange(b.TIME)) continue;
      b.__id = id;
      rows.push(b);
    }
    /* newest first (TIME then id) */
    rows.sort(function (a, c) {
      var ta = String(a.TIME || '') + String(a.__id || '');
      var tc = String(c.TIME || '') + String(c.__id || '');
      return ta < tc ? 1 : (ta > tc ? -1 : 0);
    });

    if (!rows.length) {
      holder.innerHTML = '';
      if (emptyBox) emptyBox.style.display = '';
      return;
    }
    if (emptyBox) emptyBox.style.display = 'none';
    /* <h1> ke andar <h2> innerHTML se parse nahi hota (browser h1 ko band
       kar deta hai), isliye header pehle <rs-h1> placeholder se banta hai
       aur baad me asli <h1> me badla jata hai. */
    holder.innerHTML = rows.map(cardHtml).join('')
      .replace(/<h1>/g, '<rs-h1>').replace(/<\/h1>/g, '</rs-h1>');
    var tmp = holder.querySelectorAll('rs-h1');
    for (var i = 0; i < tmp.length; i++) {
      var h1 = document.createElement('h1');
      while (tmp[i].firstChild) h1.appendChild(tmp[i].firstChild);
      tmp[i].parentNode.replaceChild(h1, tmp[i]);
    }
    /* styles.css ke card styles Vue scoped hain ([data-v-811ff882]) - har
       generated element par wahi attribute lagao warna koi style apply nahi hota */
    var all = holder.querySelectorAll('.bet-container-lottery-items, .bet-container-lottery-items *');
    for (var j = 0; j < all.length; j++) all[j].setAttribute(SCOPE, '');
  }

  function load() {
    var u = uid();
    if (!u) { _bets = {}; render({}); return; }
    fetch(FB + '/USERS/' + encodeURIComponent(u) + '/BETS-HISTORY/WINGO.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { _bets = data || {}; render(_bets); })
      .catch(function () { /* keep whatever is shown */ });
  }

  /* game selector ka label kaunsa hai (Win Go / MotoRace / 5D ...) */
  function readGameLabel() {
    var sel = document.querySelectorAll('.ar-searchbar__selector');
    var el = sel && sel[0] ? sel[0].querySelector('span') : null;
    var txt = el ? String(el.textContent || '').trim() : '';
    return txt || '';
  }

  /* abhi kaunsa tab active hai (Lottery/Casino/Fishing/...) */
  function readTab() {
    var el = document.querySelector('.fun-tabs .funtab_item .tab_item.tab_active, .fun-tabs .funtab_item.rs-tab-active .tab_item');
    if (el) { var t = String(el.textContent || '').trim(); if (t) return t; }
    var any = document.querySelector('.fun-tabs .funtab_item .tab_item');
    return any ? String(any.textContent || '').trim() : 'Lottery';
  }

  function onLottery() { return /^lottery$/i.test(String(state.tab || '').trim()); }

  /* Lottery ke alawa kisi tab par original SelectList popup / overlay aur
     doosri scripts ka bana hua "Select game ..." picker dikhna nahi chahiye
     (uski jagah neeche ki apni "Coming Soon" sheet aati hai). */
  function isStrayPicker(el) {
    if (!el || el.nodeType !== 1 || el.id === 'app' || el.id === 'rs-soon-root') return false;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') return false;
    var t = String(el.textContent || '');
    return t.indexOf('Select game') > -1 && t.indexOf('Choose an option') > -1;
  }

  function syncSelectPopup() {
    if (onLottery()) return;
    var pop = document.querySelector('.van-popup.van-popup--bottom[data-v-0a298b45]');
    var ov = document.querySelector('.van-overlay[data-v-0a298b45]');
    if (pop) pop.style.display = 'none';
    if (ov) ov.style.display = 'none';
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      if (isStrayPicker(kids[i])) kids[i].style.display = 'none';
    }
  }

  /* ---- apni "Coming Soon" bottom sheet (inline styles, kisi css par nirbhar nahi) ---- */
  function closeSoon() {
    var r = document.getElementById('rs-soon-root');
    if (r && r.parentNode) r.parentNode.removeChild(r);
  }

  function openSoon() {
    closeSoon();
    var root = document.createElement('div');
    root.id = 'rs-soon-root';
    root.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;z-index:2100;'
      + 'display:flex;align-items:center;justify-content:center;';

    var ov = document.createElement('div');
    ov.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:0;background:rgba(0,0,0,.6);';
    ov.addEventListener('click', closeSoon);

    var item = document.createElement('div');
    item.style.cssText = 'position:relative;z-index:1;min-width:200px;max-width:80vw;'
      + 'box-sizing:border-box;background:linear-gradient(90deg,#f7c948,#1fb98a);color:#0a0a14;'
      + 'font-family:Roboto,Inter,sans-serif;font-size:16px;font-weight:600;text-align:center;'
      + 'border-radius:10px;padding:14px 24px;';
    item.textContent = 'Coming Soon';
    item.addEventListener('click', closeSoon);

    root.appendChild(ov);
    root.appendChild(item);
    document.body.appendChild(root);

    /* 1 second baad apne aap band */
    setTimeout(closeSoon, 1000);
  }

  /* non-Lottery tab par game dropdown (pehla selector) dabane par sirf
     "Coming Soon" sheet; original popup / doosri scripts tak click jaata hi nahi */
  window.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest('#rs-soon-root')) return;
    var selEl = t.closest('.ar-searchbar__selector');
    if (!selEl) return;
    var all = document.querySelectorAll('.ar-searchbar__selector');
    if (!all[0] || all[0] !== selEl) return;
    state.tab = readTab() || state.tab;
    if (onLottery()) return;
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    ev.preventDefault();
    syncSelectPopup();
    openSoon();
  }, true);

  function closeSelectPopup() {
    var pop = document.querySelector('.van-popup.van-popup--bottom[data-v-0a298b45]');
    var ov = document.querySelector('.van-overlay[data-v-0a298b45]');
    if (ov) ov.style.display = 'none';
    if (pop) pop.style.display = 'none';
  }

  /* game selector ka label: Lottery tab par game ka naam, baaki tabs par
     "No data" (kyunki un games ka data hamare paas nahi hai). */
  function syncGameSelector() {
    var sel = document.querySelectorAll('.ar-searchbar__selector');
    if (!sel || !sel[0]) return;
    var labelEl = sel[0].querySelector('span');
    if (!labelEl) return;
    if (onLottery()) {
      if (labelEl.textContent !== state.game) labelEl.textContent = state.game;
    } else {
      if (labelEl.textContent !== 'Coming Soon') labelEl.textContent = 'Coming Soon';
    }
  }

  function start() {
    load();
    setInterval(load, POLL_MS);
    /* game selector badla -> sirf Lottery+WinGo dikhao, baaki "No data" */
    document.addEventListener('rs:game-change', function (e) {
      var d = (e && e.detail) || {};
      state.tab = d.tab || readTab() || 'Lottery';
      var g = d.game || readGameLabel() || 'Win Go';
      if (g === 'No data' || g === 'Coming Soon') g = state.game;   /* hamara label ignore */
      state.game = g;
      render(_bets);
    });
    /* date filter badla -> us date-range ki history */
    document.addEventListener('rs:date-change', function (e) {
      var d = (e && e.detail) || {};
      if (typeof d.from !== 'undefined' || typeof d.to !== 'undefined') {
        state.from = d.from || '';
        state.to = d.to || '';
      } else if (d.date) {
        state.from = d.date; state.to = d.date;
      } else {
        state.from = ''; state.to = '';
      }
      render(_bets);
    });

    /* BELT + SUSPENDERS: event miss ho jaye to bhi tab/label har 400ms
       check karo - badla to turant filter lagao. Saath hi popup khulte hi
       "No data" (non-Lottery tab) laga do. */
    state.tab = readTab();
    var lastLabel = readGameLabel();
    if (lastLabel && lastLabel !== 'No data' && lastLabel !== 'Coming Soon') state.game = lastLabel;
    render(_bets);
    setInterval(function () {
      syncSelectPopup();
      var curTab = readTab();
      var cur = readGameLabel();
      if (cur === 'No data' || cur === 'Coming Soon') cur = state.game;   /* hamara label ignore */
      if (curTab === state.tab && cur === lastLabel) return;
      state.tab = curTab;
      lastLabel = cur;
      if (cur) state.game = cur;
      render(_bets);
    }, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
