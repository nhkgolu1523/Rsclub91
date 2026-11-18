/* ==========================================================================
   Global WINGO settler  (pages: home / account / deposit / wallet)
   --------------------------------------------------------------------------
   Kaam: user ne bet lagaya aur game/phone band kar diya -> jis bhi site page
   par wapas aaye, finished period ke bets settle ho jate hain aur WIN ka
   paisa credit ho jata hai.

   PAISA KA NIYAM (glitch-free)
     * credit SIRF RSBalCore.apply('WIN:' + betId, win) se hota hai.
       betId se bani txId idempotent hai -> chahe engine bhi settle kare,
       chahe 3 tabs, chahe refresh - win EXACTLY ek baar add hoti hai.
     * koi "GET -> +winTotal -> PUT absolute" nahi (wahi purana double
       credit / lost update wala bug tha).
     * SETTLED-BY ab sirf "kaun result likh raha hai" ka marker hai, paisa
       uspar depend nahi karta. Token har attempt me fresh hota hai, aur
       SETTLED-BY set hone par hum bet SKIP nahi karte (warna kisi dead
       writer ke case me win kabhi credit hi na hoti).
   ========================================================================== */
(function () {
  'use strict';

  if (window.RSWingoSettle) return;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  /* mode -> Firebase GAME-RESULTS branch + period seq/len (must match engine) */
  var MODES = {
    30: { branch: '30SEC', seq: '10030', len: 4 },
    1: { branch: '1MIN', seq: '10001', len: 4 },
    2: { branch: '3MIN', seq: '100020', len: 3 },
    3: { branch: '5MIN', seq: '10101', len: 4 }
  };

  var RUNNING = false;

  /* is writer ka base id + per-attempt counter (fresh claim token) */
  var WRITER = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var _claimSeq = 0;

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

  function r2(v) { return Math.round(v * 100) / 100; }

  /* same payout table as the WINGO engine */
  function multiplier(selectType, gameType, n) {
    var st = parseInt(selectType, 10), gt = parseInt(gameType, 10);
    if (gt === 1) return (st === n) ? 9 : 0;
    if (gt === 0) {
      if (st === 10) return (n === 0) ? 1.5 : ((n % 2 === 0) ? 2 : 0);
      if (st === 11) return (n === 5) ? 1.5 : ((n % 2 === 1) ? 2 : 0);
      if (st === 12) return (n === 0 || n === 5) ? 4.5 : 0;
    }
    if (gt === 2) {
      if (st === 13) return (n >= 5) ? 2 : 0;
      if (st === 14) return (n <= 4) ? 2 : 0;
    }
    return 0;
  }

  /* period end-time (ms) from issue id, so we only settle FINISHED rounds.
     Mirrors engine periodFromIssue (browser local time). */
  function periodEnd(typeId, issue) {
    var c = MODES[typeId];
    if (!c) return 0;
    var s = String(issue);
    var y = +s.substr(0, 4), mo = +s.substr(4, 2) - 1, da = +s.substr(6, 2);
    var idx = parseInt(s.substr(8 + c.seq.length), 10);
    if (!y || isNaN(idx) || idx < 1) return 0;
    var iv = (c.branch === '30SEC') ? 30000 : c.branch === '1MIN' ? 60000 : c.branch === '3MIN' ? 180000 : 300000;
    var start = new Date(y, mo, da).getTime() + (idx - 1) * iv;
    return start + iv;
  }

  /* balance widget ko bolo abhi re-read kare (instant win reflection) */
  function nudgeBalance() {
    try { var c = window.RSBalCore; if (c) c.refresh(); } catch (e) {}
    try { if (window.__WINGO_BAL_REFRESH__) window.__WINGO_BAL_REFRESH__(); } catch (e) {}
  }

  function get(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; });
  }
  function patch(url, obj) {
    return fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
      .then(function (r) { return r.ok; }).catch(function () { return false; });
  }
function settle(cb) {
    var u = uid();
    var core = window.RSBalCore || null;
    /* core ke bina paisa touch hi nahi karte (non-atomic fallback nahi chahiye) */
    if (!u || !core || RUNNING) { if (cb) cb(0); return; }
    RUNNING = true;

    var base = FB + '/USERS/' + encodeURIComponent(u);
    var betsUrl = base + '/BETS-HISTORY/WINGO.json';

    function done(v) { RUNNING = false; if (cb) cb(v); }

    /* step 1: finished but still PENDING bets */
    get(betsUrl).then(function (bets) {
      if (!bets || typeof bets !== 'object') { done(0); return; }

      var now = Date.now();
      var ids = Object.keys(bets);
      var pending = [];
      for (var i = 0; i < ids.length; i++) {
        var b = bets[ids[i]];
        if (!b || typeof b !== 'object') continue;
        var st = String(b.STATUS || 'PENDING').toUpperCase();
        if (st !== 'PENDING') continue;                 /* result already final */
        var end = periodEnd(b['TYPE-ID'], b['ISSUE']);
        if (!end || end > now) continue;                /* not finished yet */
        pending.push({ id: ids[i], b: b });
      }

      if (!pending.length) { done(0); return; }

      /* step 2: claim (fresh token each attempt), read-back verify */
      var claims = pending.map(function (p) {
        var betUrl = base + '/BETS-HISTORY/WINGO/' + encodeURIComponent(p.id) + '.json';
        var token = WRITER + ':' + (++_claimSeq);
        return patch(betUrl, { 'SETTLED-BY': token }).then(function (ok) {
          if (!ok) return null;
          return get(betUrl).then(function (after) {
            var st2 = String((after && after.STATUS) || 'PENDING').toUpperCase();
            return (after && after['SETTLED-BY'] === token && st2 === 'PENDING') ? p : null;
          });
        });
      });

      Promise.all(claims).then(function (claimed) {
        var mine = claimed.filter(Boolean);
        if (!mine.length) { done(0); return; }

        /* step 3: real results (Firebase = only source of truth) */
        var modes = {};
        for (var p = 0; p < mine.length; p++) {
          var m = MODES[mine[p].b['TYPE-ID']];
          if (m) modes[m.branch] = true;
        }
        Promise.all(Object.keys(modes).map(function (br) {
          return get(FB + '/GAME-RESULTS/WINGO/' + br + '.json').then(function (res) { return { br: br, res: res || {} }; });
        })).then(function (results) {
          var byBranch = {};
          for (var r = 0; r < results.length; r++) byBranch[results[r].br] = results[r].res;

          var updates = {};
          for (var z = 0; z < mine.length; z++) {
            var bet = mine[z].b;
            var mode = MODES[bet['TYPE-ID']];
            var map = mode ? byBranch[mode.branch] : null;
            var n = map ? map[bet['ISSUE']] : undefined;
            if (n === undefined || n === null) continue;   /* result not written yet */
            n = parseInt(n, 10);
            var k = multiplier(bet['SELECT-TYPE'], bet['GAME-TYPE'], n);
            var stake = r2((Number(bet.AMOUNT) || 0) * (Number(bet['BET-COUNT']) || 1));
            var win = k > 0 ? r2(stake * 0.98 * k) : 0;

            /* PAISA: idempotent txId -> exactly once, chahe engine bhi credit kare */
            if (win > 0) core.apply('WIN:' + mine[z].id, win);

            updates[mine[z].id] = {
              STATUS: k > 0 ? 'WIN' : 'LOSE',
              NUMBER: n,
              'WIN-AMOUNT': win,
              'SETTLED-AT': new Date().toISOString()
            };
          }

          var idl = Object.keys(updates);
          if (!idl.length) { done(0); return; }

          /* per-bet PATCH (parent PATCH would replace the node) */
          Promise.all(idl.map(function (bid) {
            return patch(base + '/BETS-HISTORY/WINGO/' + encodeURIComponent(bid) + '.json', updates[bid]);
          })).then(function () {
            nudgeBalance();
            done(0);
          });
        }).catch(function () { done(0); });
      }).catch(function () { done(0); });
    }).catch(function () { done(0); });
  }

  window.RSWingoSettle = {
    settle: settle,
    multiplier: multiplier,
    mode: MODES
  };

  /* run on load + poll while the page is open (covers "bet then leave game").
     WINGO page par engine khud settle + instant credit karta hai, isliye wahan
     ye nahi chalta (dono saath chalne se koi nuksan nahi hota - txId
     idempotent hai - par duplicate PATCH bekaar hai). */
  function onWingoPage() {
    try {
      if (window.__WINGO_ENGINE__) return true;
      if (document.querySelector('script[src*="wingo-engine.js"]')) return true;
      if (/AllLotteryGames\/WinGo/i.test(location.hash || '')) return true;
      if (typeof window.__WINGO_BAL_GET__ === 'function') return true;
    } catch (e) {}
    return false;
  }
  var _timer = null;
  function start() {
    var run = function () {
      if (onWingoPage()) {
        if (_timer) { clearInterval(_timer); _timer = null; }
        return;
      }
      settle();
    };
    run();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(run, 1500);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();