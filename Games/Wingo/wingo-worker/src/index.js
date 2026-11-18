/* ============================================================
   WINGO RESULTS GENERATOR       (Cloudflare Worker)
   ------------------------------------------------------------
   Roz 4:00 AM IST pe chalta hai aur poore din ke saare
   modes (30sec, 1min, 3min, 5min) ke results pehle se
   generate karke Firebase me likh deta hai.

   CONFLICT-FREE GUARANTEE
   -----------------------
   1. Generation RUNNING period se AAGE se shuru hoti hai
      -> jo period chal raha hai uska result kabhi chhua
         nahi jata (na overwrite, na skip).
   2. Har period likhne se pehle GET-check karte hain:
      agar value pehle se maujood hai to SKIP.
      -> ek period ka result ek baar likhne ke baad
         KABHI change nahi hota.
   3. Period index time se derive hota hai (din ke start
      se seconds / interval). Isliye numbering apne aap
      continuous rehti hai - kal ka aakhri index N tha to
      aaj N+1, N+2... Banane ke liye kuch "yaad" rakhne
      ki zaroorat nahi.
   4. Daily 4 AM batch ka pehla period = 4 AM wala period.
      Us se pehle ke (raat 3:59 tak) periods pichle din ke
      batch me already likhe hote hain -> koi overlap nahi.

   FIREBASE STRUCTURE
   ------------------
   GAME-RESULTS/WINGO/<MODE>/<period>   = number 0-9
   GAME-RESULTS/WINGO/_meta/lastGen_<MODE> = last generated index
   ============================================================ */

'use strict';

/* ================= config (wingo-engine.js se match) ================= */
var TYPES = {
    '30SEC': { iv: 30, seq: '10030', len: 4, name: 'Win Go 30s' },
    '1MIN': { iv: 60, seq: '10001', len: 4, name: 'Win Go 1Min' },
    '3MIN': { iv: 180, seq: '100020', len: 3, name: 'Win Go 3Min' },
    '5MIN': { iv: 300, seq: '10101', len: 4, name: 'Win Go 5Min' }
};
var MODE_ORDER = ['30SEC', '1MIN', '3MIN', '5MIN'];

/* Har mode me itne FINISHED periods Firebase me rakhenge.
   (App history me 500 rows / 50 pages dikhata hai.)
   Isse purane periods period-wise auto-delete ho jate hain. */
var KEEP_ROWS = 500;

/* ================= helpers ================= */
function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }

/* crypto-random 0-9 (same approach as the web engine) */
function rnd10() {
    var a = new Uint32Array(1);
    var max = Math.floor(4294967296 / 10) * 10;
    do { crypto.getRandomValues(a); } while (a[0] >= max);
    return a[0] % 10;
}

/* ---- period logic: EXACT copy of wingo-engine.js issueFor/periodAt ----
   IMPORTANT: wingo-engine.js browser LOCAL time use karta hai. Users IST
   (UTC+5:30) me hain, aur ye worker UTC pe chalta hai. Isliye hum har
   timestamp ko IST me shift karke compute karte hain, taaki period ID
   app ke banaye period ID se 100% match kare. */
var IST_OFFSET_MS = 5.5 * 3600 * 1000;

function issueFor(mode, startMs) {
    var c = TYPES[mode];
    var d = new Date(startMs + IST_OFFSET_MS);           /* IST wall-clock */
    var dayStartIst = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    var istWallMs = startMs + IST_OFFSET_MS;             /* ms since epoch in IST frame */
    var idx = Math.floor((istWallMs - dayStartIst) / (c.iv * 1000)) + 1;
    return '' + d.getUTCFullYear() + pad(d.getUTCMonth() + 1, 2) + pad(d.getUTCDate(), 2) +
        c.seq + pad(idx, c.len);
}
function periodAt(mode, ms) {
    var iv = TYPES[mode].iv * 1000, start = Math.floor(ms / iv) * iv;
    return { start: start, end: start + iv, issue: issueFor(mode, start) };
}
function periodFromIssue(mode, issue) {
    var c = TYPES[mode], s = String(issue), need = 8 + c.seq.length + c.len;
    if (s.length < need) return null;
    var y = +s.substr(0, 4), mo = +s.substr(4, 2) - 1, da = +s.substr(6, 2);
    var idx = parseInt(s.substr(8 + c.seq.length), 10);
    if (!y || isNaN(idx) || idx < 1) return null;
    var startIst = Date.UTC(y, mo, da) + (idx - 1) * c.iv * 1000;
    var start = startIst - IST_OFFSET_MS;                /* back to UTC epoch */
    return { start: start, end: start + c.iv * 1000, issue: s };
}

/* ================= firebase REST ================= */
function fbURL(env, path) { return env.FB_BASE + path; }

async function fbGet(env, path) {
    var r = await fetch(fbURL(env, path) + '.json', { method: 'GET' });
    if (!r.ok) throw new Error('FB GET ' + r.status + ' ' + path);
    var t = await r.text();
    if (!t || t === 'null') return null;
    try { return JSON.parse(t); } catch (e) { return null; }
}

async function fbPatch(env, path, obj) {
    var r = await fetch(fbURL(env, path) + '.json', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj)
    });
    if (!r.ok) throw new Error('FB PATCH ' + r.status + ' ' + path);
    return true;
}

async function fbDelete(env, path) {
    var r = await fetch(fbURL(env, path) + '.json', { method: 'DELETE' });
    if (!r.ok) throw new Error('FB DELETE ' + r.status + ' ' + path);
    return true;
}

/* ================= generation =================
   Ek mode ke liye: aaj 4AM se kal 4AM tak ke saare periods
   ka number banao, but sirf wo jo pehle se maujood nahi.
   ============================================ */
async function generateMode(env, mode, nowMs, report) {
    var c = TYPES[mode];
    var ivMs = c.iv * 1000;

    /* RUNNING period -> generation isse AAGE se shuru hogi.
       Is period ka result kabhi chhua nahi jayega. */
    var running = periodAt(mode, nowMs);

    var runningIdx = parseInt(String(running.issue).substr(8 + c.seq.length), 10);
    /* pehla index jo generate karenge = running ke turant baad */
    var firstIdx = runningIdx + 1;

    /* Window: aaj 4:00 AM IST se kal 4:00 AM IST tak.
       nowMs abhi hai (4AM cron ke waqt). Window end = agle din 4AM IST. */
    var d = new Date(nowMs + IST_OFFSET_MS);
    var today4amIst = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4, 0, 0) - IST_OFFSET_MS;
    /* agar abhi 4AM se pehle aaye (manual run), to aaj ka window start kal hoga */
    var windowStart = (nowMs >= today4amIst) ? today4amIst : today4amIst - 86400000;
    var windowEnd = windowStart + 86400000;              /* agla 4AM IST */

    /* dayStart (IST) for firstIdx timestamp */
    var baseDay = Date.UTC(
        new Date(windowStart + IST_OFFSET_MS).getUTCFullYear(),
        new Date(windowStart + IST_OFFSET_MS).getUTCMonth(),
        new Date(windowStart + IST_OFFSET_MS).getUTCDate()
    );
    var firstStart = baseDay + (firstIdx - 1) * ivMs - IST_OFFSET_MS;
    if (firstStart < running.start + ivMs) firstStart = running.start + ivMs;

    /* Cleanup window: pichhle din (4AM) se ab tak ke koi bhi MISSING
       finished periods bhi bhar do, taaki history me koi gap na rahe.
       running period kabhi touch nahi hota. */
    var catchStart = windowStart - 86400000;   /* ek din pehle se */
    var catchCursor = catchStart, cguard = 0, ccount = 0;
    var cwant = {};
    while (catchCursor <= running.start && cguard++ < 60000) {
        var cp = periodAt(mode, catchCursor);
        if (cp.start < running.start) {          /* finished only (past) */
            cwant[cp.issue] = rnd10();
            ccount++;
        }
        catchCursor += ivMs;
    }

    /* POORA DIN generate karo (running ke baad se windowEnd tak) -
       taaki poore din ka result Firebase me PEHLE SE bana rahe. */
    var want = {};
    var count = 0, guard = 0;
    var cursor = firstStart;
    while (cursor < windowEnd && guard++ < 30000) {
        var p = periodAt(mode, cursor);
        if (p.start >= running.end) {                     /* running ke baad hi */
            want[p.issue] = rnd10();
            count++;
        }
        cursor += ivMs;
    }
    /* merge catch-up (missing past) into want */
    for (var ck in cwant) if (want[ck] === undefined) want[ck] = cwant[ck];
    count += ccount;

    if (!count) {
        /* kuch naya generate karne ko nahi - par prune phir bhi chalna chahiye */
        var pruned0 = 0;
        try { pruned0 = await pruneMode(env, mode, nowMs); } catch (e) {}
        report.push({ mode: mode, created: 0, skipped: 'already-complete', pruned: pruned0, running: running.issue });
        return;
    }

    /* EXISTING keys nikalo -> check-before-write. Jo pehle se
       maujood hai usko kabhi overwrite nahi karenge. */
    var existing = {};
    try { existing = (await fbGet(env, '/' + mode)) || {}; } catch (e) { existing = {}; }

    var patch = {}, made = 0, skipped = 0;
    for (var k in want) {
        if (existing[k] !== undefined && existing[k] !== null) { skipped++; continue; }
        patch[k] = want[k];
        made++;
    }

    if (made > 0) await fbPatch(env, '/' + mode, patch);

    /* lastGen = sabse aage generated index (next run yahin se aage) */
    var lastIdx = runningIdx;
    for (var k2 in want) {
        var idx = parseInt(String(k2).substr(8 + c.seq.length), 10);
        if (idx > lastIdx) lastIdx = idx;
    }
    await fbPatch(env, '/_meta', { ['lastGen_' + mode]: lastIdx });

    /* purane periods period-wise delete karo - latest KEEP_ROWS rakho */
    var pruned = 0;
    try { pruned = await pruneMode(env, mode, nowMs); }
    catch (e) { /* prune fail ho to generation kharab na ho */ }

    report.push({
        mode: mode, running: running.issue, created: made, skipped: skipped, pruned: pruned, lastGen: runningIdx
    });
}

/* ================= prune =================
   Har mode me sirf latest KEEP_ROWS FINISHED periods rakho.
   - Sirf khatam ho chuke periods (p.end <= now) consider karte hain
   - running / future (upcoming) periods KABHI delete nahi hote
     (poore din ka result pehle se bana rehta hai)
   - start time descending sort -> pehle KEEP_ROWS keep, baaki null (delete)
   ============================================ */
async function pruneMode(env, mode, nowMs) {
    if (!nowMs) nowMs = Date.now();
    var c = TYPES[mode];

    var map = {};
    try { map = (await fbGet(env, '/' + mode)) || {}; } catch (e) { return 0; }

    var finished = [];
    for (var k in map) {
        if (map[k] === null || map[k] === undefined) continue;
        var p = periodFromIssue(mode, k);
        if (!p) continue;
        if (p.end <= nowMs) finished.push({ key: k, start: p.start });
    }

    if (finished.length <= KEEP_ROWS) return 0;

    finished.sort(function (a, b) { return b.start - a.start; });   /* newest first */

    var del = {};
    for (var i = KEEP_ROWS; i < finished.length; i++) del[finished[i].key] = null;

    if (Object.keys(del).length === 0) return 0;

    var keys = Object.keys(del), BATCH = 400;
    for (var j = 0; j < keys.length; j += BATCH) {
        var chunk = {};
        for (var m = j; m < j + BATCH && m < keys.length; m++) chunk[keys[m]] = null;
        await fbPatch(env, '/' + mode, chunk);
    }
    return keys.length;
}

/* poore din ka generation (saare modes) */
async function generateAll(env, nowMs) {
    if (!nowMs) nowMs = Date.now();
    var report = [];
    for (var i = 0; i < MODE_ORDER.length; i++) {
        try { await generateMode(env, MODE_ORDER[i], nowMs, report); }
        catch (e) { report.push({ mode: MODE_ORDER[i], error: String(e && e.message || e) }); }
    }
    return report;
}

/* ================= scheduled handler (cron 4AM IST) ================= */
async function scheduled(controller, env, ctx) {
    var t = controller.scheduledTime || Date.now();
    var report = await generateAll(env, t);
    console.log('WINGO daily generation @' + new Date(t).toISOString(), JSON.stringify(report));
}

/* ================= fetch handler (manual / debug) ================= */
async function handleFetch(request, env) {
    var url = new URL(request.url);
    var path = url.pathname.replace(/\/+$/, '') || '/';

    try {
        if (path === '/' || path === '') {
            var now = Date.now();
            var status = {};
            for (var i = 0; i < MODE_ORDER.length; i++) {
                var m = MODE_ORDER[i];
                var running = periodAt(m, now);
                var lastGen = null;
                try { lastGen = await fbGet(env, '/_meta/lastGen_' + m); } catch (e) { }
                var total = null;
                try {
                    var shallow = (await fbGet(env, '/' + m)) || {};
                    total = Object.keys(shallow).length;
                } catch (e) { }
                status[m] = { runningPeriod: running.issue, runningEnd: new Date(running.end).toISOString(), lastGen: lastGen, totalRows: total };
            }
            return json({ ok: true, now: new Date(now).toISOString(), modes: status });
        }

        if (path === '/generate') {
            var t = parseInt(url.searchParams.get('t'), 10);
            var rep = await generateAll(env, isNaN(t) ? Date.now() : t);
            return json({ ok: true, action: 'generate', report: rep });
        }

        if (path === '/repair') {
            var rep2 = await generateAll(env, Date.now());
            return json({ ok: true, action: 'repair', report: rep2 });
        }

        if (path === '/delete') {
            /* purani / specific key delete (manual, guarded) */
            var mode = url.searchParams.get('mode');
            var key = url.searchParams.get('key');
            if (!mode || !key) return json({ ok: false, error: 'mode & key required' }, 400);
            await fbDelete(env, '/' + mode + '/' + key);
            return json({ ok: true, deleted: '/' + mode + '/' + key });
        }

        return json({ ok: false, error: 'not found', paths: ['/', '/generate', '/repair', '/delete?mode=&key='] }, 404);
    } catch (e) {
        return json({ ok: false, error: String(e && e.message || e) }, 500);
    }
}

function json(obj, status) {
    return new Response(JSON.stringify(obj, null, 2), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

/* ================= export (ES module worker) ================= */
export default {
    async scheduled(controller, env, ctx) {
        ctx.waitUntil(scheduled(controller, env, ctx));
    },
    async fetch(request, env, ctx) {
        return handleFetch(request, env);
    }
};
