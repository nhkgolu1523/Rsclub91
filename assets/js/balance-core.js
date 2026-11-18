/* ==========================================================================
   Rsclub91 - MONEY CORE  (assets/js/balance-core.js)
   --------------------------------------------------------------------------
   Har balance change (bet ka minus, win ka plus, refund) SIRF yahan se hota
   hai. Teen purani problems permanently khatam:

     1) "bet lagaya par raqam wapas credit ho gayi"
        pehle: GET -> +delta -> PUT absolute (atomic nahi -> write ud jata tha)
        ab   : ETag + if-match (compare-and-swap); conflict par 412 -> retry
               => lost update possible nahi.

     2) "kabhi kabhi paisa double badh jata tha"
        pehle: koi unique id nahi thi, do writers dono credit kar dete the
        ab   : har change ki unique txId ("WIN:<betId>") USERS/<uid>/BALANCE/
               A me record hoti hai; wahi txId dobara aaye to SKIP
               => double credit possible nahi.

     3) "kabhi balance add nahi hua"
        pehle: time-window guards expire ho jate the
        ab   : outbox localStorage me rehta hai, net aane par / page dobara
               khulne par retry hota hai - retry se bhi double nahi.

   FIREBASE SHAPE
     USERS/<uid>/BALANCE/MAIN-BALANCE = balance  (asli value; admin yahin se
                                                  increase/decrease kar sakta hai)
     USERS/<uid>/BALANCE/S            = write-seq (stale value rok)
     USERS/<uid>/BALANCE/A            = { txId: seq } (double credit rok)

   Teeno fields EK HI node (BALANCE) me hain aur EK HI PATCH me likhe jate
   hain (with ETag/if-match => CAS). Isi liye na adhoora write hota hai, na
   double credit. `PATCH` use hota hai (PUT nahi) taaki BALANCE ke andar
   koi bhi doosri key (agar aage add ho) na ude.

   API (window.RSBalCore): value, ready, apply, refresh, flush, on, setUid,
                           uid, state, format, normalize, reset
   ========================================================================== */
(function () {
  'use strict';

  if (window.RSBalCore) return;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var TX_KEEP = 250;                 /* per-user applied-tx memory (BALANCE/A) */
  var MAX_TRY = 8;                   /* CAS attempts before backing off */
  var RETRY = [150, 400, 900, 1800, 3500, 6000];
  var POLL_MS = 4000;
  var SNAP = 'rs_balsnap_v2_';        /* local snapshot: {mb,S,A,out} */

  /* ---------------- helpers ---------------- */
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } }
  function jget(k, d) {
    var v = sget(k);
    if (v === null || v === undefined) return d;
    try { return JSON.parse(v); } catch (e) { return d; }
  }
  function jset(k, v) { try { sset(k, JSON.stringify(v)); } catch (e) { } }

  function r2(v) { return Math.round(Number(v) * 100) / 100; }
  function num(v) {
    if (v === null || v === undefined || v === '' ||
        v === 'null' || v === 'undefined') return 0;
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function normalize(v) { return r2(num(v)); }

  /* ---- user id: explicit (WINGO ?uid=) pehle, phir logged-in user ---- */
  var _want = '';
  function uid() {
    if (_want) return _want;
    var u = sget('rsclub_uid');
    u = (u === null || u === undefined) ? '' : String(u).trim();
    return (u && u !== 'null' && u !== 'undefined') ? u : '';
  }
  /* BALANCE node (asli balance + S + A sab ek hi jagah) */
  function stateUrl(u) { return FB + '/USERS/' + encodeURIComponent(u) + '/BALANCE.json'; }

  /* ---------------- state: server truth + pending local changes ------------ */
  var V = 0;                 /* authoritative server balance (BALANCE/MAIN-BALANCE) */
  var S = 0;                 /* server write sequence of V (monotonic) */
  var A = {};                /* txId -> S : applied transaction memory */
  var loaded = false;        /* real value known? */
  var out = [];              /* outbox: [{id,d,t}] not yet on the server */
  var busy = false;
  var tries = 0;
  var retryTimer = null;
  var pollTimer = null;
  var started = false;
  var subs = [];

  function pruneA(map) {
    var src = map || {}, keys = Object.keys(src);
    if (keys.length <= TX_KEEP) return src;
    keys.sort(function (a, b) { return num(src[b]) - num(src[a]); });
    var o = {};
    for (var i = 0; i < TX_KEEP; i++) o[keys[i]] = num(src[keys[i]]);
    return o;
  }
  function mergeA(a, b) {
    var o = {}, k;
    for (k in (a || {})) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = num(a[k]);
    for (k in (b || {})) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) continue;
      if (b[k] === null || b[k] === undefined) { delete o[k]; continue; }
      var v = Math.max(num(o[k]), num(b[k]));
      o[k] = v > 0 ? v : 1;                     /* always truthy */
    }
    return o;
  }

  /* MB = Firebase field ka naam (`USERS/<uid>/BALANCE/MAIN-BALANCE`) */
  var MB = 'MAIN-BALANCE';

  function persist() {
    var u = uid();
    if (!u) return;
    jset(SNAP + u, { mb: r2(V), S: S, A: pruneA(A), out: out });
  }
  function restore() {
    var u = uid();
    if (!u) return false;
    var s = jget(SNAP + u, null);
    if (!s || typeof s !== 'object') return false;
    /* mb = naya; V = purane (v1) snapshot se — dono support */
    var bal = (s.mb !== undefined && s.mb !== null) ? s.mb : s.V;
    V = r2(num(bal));
    S = num(s.S);
    A = (s.A && typeof s.A === 'object') ? s.A : {};
    out = [];
    if (s.out && s.out.length) {
      for (var i = 0; i < s.out.length; i++) {
        var t = s.out[i];
        if (t && t.id && isFinite(num(t.d)) && num(t.d) !== 0) {
          out.push({ id: String(t.id), d: r2(num(t.d)), t: num(t.t) || Date.now() });
        }
      }
    }
    loaded = true;              /* best-known value -> instant paint */
    return true;
  }

  /* UI value = server balance + changes not yet on the server */
  function value() {
    var v = V;
    for (var i = 0; i < out.length; i++) v += out[i].d;
    return r2(v);
  }
  function ready() { return loaded; }
  /* V alias sirf read/debug ke liye - Firebase me sirf MAIN-BALANCE jata hai */
  function state() { return { 'MAIN-BALANCE': r2(V), S: S, A: A, V: r2(V) }; }
  function _outbox() { return out.slice(); }

  function emit() {
    var v = value();
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](v); } catch (e) { }
    }
  }
/* ---------------- HTTP (Firebase REST) ---------------- */
  function req(url, init, cb) {
    var f = (typeof fetch === 'function') ? fetch : null;
    if (!f) { cb(new Error('no-fetch')); return; }
    var p;
    try { p = f(url, init); } catch (e) { cb(e); return; }
    if (!p || typeof p.then !== 'function') { cb(new Error('bad-fetch')); return; }
    p.then(function (res) {
      if (!res || !res.ok) {
        var e = new Error('HTTP ' + (res ? res.status : 0));
        e.status = res ? res.status : 0;
        e.conflict = !!(res && res.status === 412);
        cb(e, res);
        return;
      }
      var t = (typeof res.text === 'function') ? res.text() : '';
      if (t && typeof t.then === 'function') {
        t.then(
          function (txt) { cb(null, res, (txt === null || txt === undefined) ? '' : String(txt)); },
          function () { cb(null, res, ''); }
        );
      } else {
        cb(null, res, t ? String(t) : '');
      }
    }, function (err) {
      var e = err || new Error('network');
      e.network = true;
      cb(e);
    });
  }

  function etagOf(res) {
    try {
      if (!res || !res.headers || typeof res.headers.get !== 'function') return null;
      return res.headers.get('ETag') || res.headers.get('etag') || null;
    } catch (e) { return null; }
  }

  /* GET authoritative BALANCE node (ETag next CAS write ke liye).
     Yahan purane shapes bhi normalize ho jate hain:
       1) { MAIN-BALANCE: 5000 }             -> naya shape (S/A default)
       2) { STATE: { V, S, A }, MAIN-BALANCE } -> STATE se utha kar upar
       3) { STATE: { 'MAIN-BALANCE', S, A } }  -> wahi
     Isse kisi user ka balance migrate karte waqt 0 nahi hota. */
  function getState(u, cb) {
    req(stateUrl(u), {
      method: 'GET',
      cache: 'no-store',
      headers: { 'X-Firebase-ETag': 'true' }
    }, function (err, res, txt) {
      if (err) { cb(err); return; }
      var node = null;
      try { node = JSON.parse(txt); } catch (e) { node = null; }
      if (!node || typeof node !== 'object') { cb(null, null, etagOf(res)); return; }

      var st = null;
      if (node.STATE && typeof node.STATE === 'object') st = node.STATE;

      var direct = (node[MB] !== undefined && node[MB] !== null) ? node[MB] : undefined;
      var bal = direct !== undefined ? direct : (st ? st[MB] : undefined);
      if (bal === undefined && st) bal = st.V;                 /* purana v1 shape */
      if (bal === undefined && node.V !== undefined) bal = node.V;

      var seq = num(node.S !== undefined ? node.S : (st ? st.S : 0));
      var ap = (node.A && typeof node.A === 'object') ? node.A
             : (st && st.A && typeof st.A === 'object') ? st.A : {};

      /* MIGRATION chahiye? (purana shape ya khaali node) */
      var needMig = (isFinite(num(bal))) && (
        direct === undefined ||                       /* balance upar nahi hai */
        node.S === undefined ||                       /* seq upar nahi hai */
        node.A === undefined ||                       /* applied-tx upar nahi */
        st !== null                                   /* STATE folder padi hai */
      );

      /* khaali/missing node -> null, par ye bhi batao ki node THA ya nahi.
         (`stated` = node par koi bhi nishaan tha — isse "account reset"
         aur "naya user" me farq pata chalta hai.) */
      var hasAny = (bal !== undefined) || !!st ||
                   node.A !== undefined || node.S !== undefined || node.V !== undefined;
      if (!hasAny) {
        cb(null, null, etagOf(res));
        return;
      }
      cb(null, { MB: r2(num(bal)), S: seq, A: ap, mig: needMig }, etagOf(res));
    });
  }

  /* CAS write: ek hi PUT me teeno fields, if-match (ETag) ke saath.
     NOTE: Firebase RTDB me `if-match` sirf PUT ke saath chalta hai — PATCH ke
     saath 400 error deta hai ("if-match not supported with PATCH"), isliye
     yahan PUT hai. Isliye BALANCE node me sirf yahi 3 key rakhni chahiye
     (MAIN-BALANCE, S, A) — jo humara shape hai. */
  function putState(u, nV, nS, nA, etag, cb) {
    var body = {};
    body[MB] = r2(nV);
    body.S = nS;
    /* Firebase me khaali object `{}` likhne par key DELETE ho jati hai!
       Isliye A khaali ho to ek placeholder daal dete hain (warna A node gayab
       ho jayega aur agla bet/win bina idempotency ke chala jayega). */
    var A2 = pruneA(nA);
    if (!A2 || !Object.keys(A2).length) A2 = { 'INIT': 1 };
    body.A = A2;
    var headers = { 'Content-Type': 'application/json' };
    if (etag) headers['if-match'] = etag;
    req(stateUrl(u), {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(body)
    }, function (err) {
      if (err) { cb(false, !!err.conflict); return; }
      cb(true, false);
    });
  }

  function adopt(srv) {
    if (srv) {
      V = r2(num(srv.MB));
      S = num(srv.S);
      A = mergeA(A, srv.A);
    }
    loaded = true;
    /* pending tx jo server par already apply ho chuki hai -> outbox se hatao */
    var keep = [];
    for (var i = 0; i < out.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(A, out[i].id)) keep.push(out[i]);
    }
    if (keep.length !== out.length) out = keep;
    persist();
    emit();
  }

  /* ---------------- outbox flush (the only writer) ---------------- */
  function schedule() {
    if (retryTimer) return;
    var ms = RETRY[Math.min(tries, RETRY.length - 1)];
    tries++;
    retryTimer = setTimeout(function () { retryTimer = null; flush(); }, ms);
  }

  function flush() {
    if (busy) return;
    var u = uid();
    if (!u) return;
    if (!out.length) { emit(); return; }
    busy = true;
    step(0);
  }

  function step(tryNo) {
    var u = uid();
    if (!u) { busy = false; return; }
    if (!out.length) { busy = false; tries = 0; emit(); return; }

    var tx = out[0];

    /* idempotency: server par already applied -> sirf drop karo */
    if (Object.prototype.hasOwnProperty.call(A, tx.id)) {
      out.shift();
      persist();
      emit();
      busy = false;
      flush();
      return;
    }

    getState(u, function (err, srv, etag) {
      if (err) { busy = false; schedule(); return; }

      if (!srv) {
        /* Node hi nahi hai = account reset / node delete.
           Purane local balance ke upar delta lagana GALAT hai (purana balance
           wapas server par chala jata tha + purane pending bets bhi). Isliye
           cache + outbox discard karke node 0 se shuru karte hain — aur jo tx
           abhi process ho raha tha usko bhi chhod dete hain. */
        V = 0;
        S = 0;
        A = {};
        out = [];
        loaded = true;                 /* ab hum jaante hain: 0 hai */
        persist();
        emit();
        busy = false;
        /* server par fresh node (0) likh do */
        putState(u, 0, 1, {}, etag, function () { tries = 0; });
        return;
      }
      if (loaded && num(srv.S) < S) {
        /* stale replica / restored DB: UI ko peeche mat kheencho */
        srv = { MB: V, S: S, A: mergeA(A, srv.A) };
      }

      var srvA = (srv.A && typeof srv.A === 'object') ? srv.A : {};

      /* dusra tab (ya hamari purani attempt jiska ack kho gaya) already
         ye tx apply kar chuka hai -> adopt karo, dobara apply mat karo */
      if (Object.prototype.hasOwnProperty.call(srvA, tx.id)) {
        adopt({ MB: srv.MB, S: srv.S, A: mergeA(srvA, A) });
        if (out.length && out[0].id === tx.id) out.shift();
        persist();
        busy = false;
        flush();
        return;
      }

      var nS = num(srv.S) + 1;
      var nV = r2(num(srv.MB) + tx.d);
      var nA = mergeA(mergeA(A, srvA), {});
      nA[tx.id] = nS;

      putState(u, nV, nS, nA, etag, function (ok, conflict) {
        if (ok) {
          V = nV;
          S = nS;
          A = nA;
          loaded = true;
          if (out.length && out[0].id === tx.id) out.shift();
          persist();
          emit();
          tries = 0;
          busy = false;
          flush();                        /* next pending change */
          return;
        }
        if (conflict && tryNo < MAX_TRY) { step(tryNo + 1); return; }
        busy = false;
        schedule();
      });
    });
  }
/* ---------------- read / refresh ---------------- */
  function refresh(cb) {
    var u = uid();
    if (!u) { if (cb) cb(null); return; }
    getState(u, function (err, srv, etag) {
      if (err) { if (cb) cb(null); return; }

      var needMigrate = !!(srv && srv.mig);
      if (!srv) {
        /* Node hi nahi hai (BALANCE delete / naya account).
           ------------------------------------------------
           Zaroori: yahan apna purana cached balance WAPAS NAHI likhna.
           Pehle aisa hota tha -> node delete karne ke baad bhi purana
           balance UI me dikhta tha aur us se bet lag jati thi (local
           snapshot `restore()` se aata tha). Ab:
             * cached balance + pending outbox discard,
             * UI turant 0,
             * server par fresh node { MAIN-BALANCE: 0, S: 1, A: {} }. */
        V = 0;
        S = 0;
        A = {};
        out = [];
        loaded = false;
        persist();                 /* local snapshot bhi saaf */
        emit();                    /* UI turant 0 (purana nahi) */
        putState(u, 0, 1, {}, etag, function (ok, conflict) {
          if (ok) {
            S = 1; loaded = true;
            persist();
            emit();
          } else if (conflict) {
            refresh(cb);           /* kisi ne bana diya -> dobara padho */
            return;
          }
          flush();
          if (cb) cb(value());
        });
        return;
      }

      /* MIGRATION: purane shape (STATE folder / sirf MAIN-BALANCE number) se
         aaye data ko naye shape me likh do — balance aur applied-tx dono safe.
         `S` ko ek badha kar likhte hain taaki record "taaza" maana jaye. */
      if (needMigrate) {
        var mA = mergeA(A, srv.A);
        var mBal = r2(num(srv.MB));
        var mS = num(srv.S) + 1;
        putState(u, mBal, mS, mA, etag, function (ok) {
          if (ok) {
            V = mBal; S = mS; A = mA;
            loaded = true;
            persist();
            emit();
            flush();
            if (cb) cb(value());
          } else {
            /* koi aur likh raha tha -> agli poll par phir try */
            adopt(srv);
            if (cb) cb(value());
          }
        });
        return;
      }

      if (loaded && num(srv.S) < S) {
        /* STALE snapshot (slow replica / DB restore): UI ko peeche mat kheencho,
           apna authoritative state CAS ke saath wapas likho */
        var nA = mergeA(A, srv.A);
        putState(u, V, S + 1, nA, etag, function (ok) {
          if (ok) { S = S + 1; A = nA; persist(); }
          emit();
          if (cb) cb(value());
        });
        return;
      }

      adopt(srv);
      if (cb) cb(value());
      flush();                 /* pending changes fresh server value ke upar */
    });
  }

  /* ---------------- apply (bet -, win +, refund +) ---------------- */
  function apply(txId, delta) {
    var id = String(txId === null || txId === undefined ? '' : txId);
    var d = r2(num(delta));
    var u = uid();
    if (!id || !u || !isFinite(d) || d === 0) return value();

    if (Object.prototype.hasOwnProperty.call(A, id)) return value();   /* applied */
    for (var i = 0; i < out.length; i++) if (out[i].id === id) return value();  /* queued */

    out.push({ id: id, d: d, t: Date.now() });
    persist();
    emit();                    /* INSTANT: minus/plus turant dikhta hai */
    flush();                   /* phir Firebase par atomically likhta hai */
    return value();
  }

  /* ---------------- boot / polling ---------------- */
  function poll() {
    if (!uid()) { emit(); return; }
    if (out.length) flush(); else refresh();
  }

  function start() {
    if (started) return;
    started = true;
    restore();
    emit();
    refresh();
    flush();
    try {
      if (typeof setInterval === 'function') pollTimer = setInterval(poll, POLL_MS);
    } catch (e) { }
  }

  function setUid(u) {
    var n = (u === null || u === undefined) ? '' : String(u).trim();
    if (n === 'null' || n === 'undefined') n = '';
    if (n === _want) return;
    /* Agar core pehle se kisi uid par chal raha hai aur wahi uid aa rahi hai
       (jo localStorage se aati hai), to kuch mat karo - warna A/S/outbox
       reset ho jate hain aur chalte hue bet/win ka hisaab bigad jata hai. */
    var cur = uid();
    if (n === cur) { _want = n; return; }
    _want = n;
    /* naya user -> purana state bhool jao, uska snapshot uthao */
    V = 0; S = 0; A = {}; out = []; loaded = false; busy = false; tries = 0;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (!_want) { emit(); return; }
    restore();
    emit();
    refresh();
    flush();
  }

  function reset() {
    var u = uid();
    if (u) { try { localStorage.removeItem(SNAP + u); } catch (e) { } }
    V = 0; S = 0; A = {}; out = []; loaded = false; busy = false; tries = 0;
    emit();
  }

  /* cross-tab / reconnect */
  try {
    if (window && typeof window.addEventListener === 'function') {
      window.addEventListener('online', function () { tries = 0; flush(); refresh(); });
      window.addEventListener('storage', function (e) {
        if (!e || !e.key || String(e.key).indexOf(SNAP) !== 0) return;
        var keep = out;
        if (restore()) { out = keep; emit(); flush(); }
      });
    }
  } catch (e) { }

  /* ---------------- public API ---------------- */
  window.RSBalCore = {
    value: value,
    ready: ready,
    state: state,
    apply: apply,
    flush: flush,
    refresh: refresh,
    on: function (cb) {
      subs.push(cb);
      if (!started) start();
      if (loaded || out.length) { try { cb(value()); } catch (e) { } }
      flush();
      return function () {
        var i = subs.indexOf(cb);
        if (i >= 0) subs.splice(i, 1);
      };
    },
    uid: uid,
    setUid: setUid,
    normalize: normalize,
    format: function (v) {
      return '\u20B9' + normalize(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    reset: reset,
    _outbox: _outbox
  };

  /* already logged in -> turant boot (har page par balance available) */
  if (uid()) start();
})();