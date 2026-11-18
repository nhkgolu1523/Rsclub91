var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var TYPES = {
  "30SEC": { iv: 30, seq: "10030", len: 4, name: "Win Go 30s" },
  "1MIN": { iv: 60, seq: "10001", len: 4, name: "Win Go 1Min" },
  "3MIN": { iv: 180, seq: "100020", len: 3, name: "Win Go 3Min" },
  "5MIN": { iv: 300, seq: "10101", len: 4, name: "Win Go 5Min" }
};
var MODE_ORDER = ["30SEC", "1MIN", "3MIN", "5MIN"];
var KEEP_ROWS = 500;
function pad(n, l) {
  n = String(n);
  while (n.length < l) n = "0" + n;
  return n;
}
__name(pad, "pad");
function rnd10() {
  var a = new Uint32Array(1);
  var max = Math.floor(4294967296 / 10) * 10;
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= max);
  return a[0] % 10;
}
__name(rnd10, "rnd10");
var IST_OFFSET_MS = 5.5 * 3600 * 1e3;
function issueFor(mode, startMs) {
  var c = TYPES[mode];
  var d = new Date(startMs + IST_OFFSET_MS);
  var dayStartIst = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  var istWallMs = startMs + IST_OFFSET_MS;
  var idx = Math.floor((istWallMs - dayStartIst) / (c.iv * 1e3)) + 1;
  return "" + d.getUTCFullYear() + pad(d.getUTCMonth() + 1, 2) + pad(d.getUTCDate(), 2) + c.seq + pad(idx, c.len);
}
__name(issueFor, "issueFor");
function periodAt(mode, ms) {
  var iv = TYPES[mode].iv * 1e3, start = Math.floor(ms / iv) * iv;
  return { start, end: start + iv, issue: issueFor(mode, start) };
}
__name(periodAt, "periodAt");
function periodFromIssue(mode, issue) {
  var c = TYPES[mode], s = String(issue), need = 8 + c.seq.length + c.len;
  if (s.length < need) return null;
  var y = +s.substr(0, 4), mo = +s.substr(4, 2) - 1, da = +s.substr(6, 2);
  var idx = parseInt(s.substr(8 + c.seq.length), 10);
  if (!y || isNaN(idx) || idx < 1) return null;
  var startIst = Date.UTC(y, mo, da) + (idx - 1) * c.iv * 1e3;
  var start = startIst - IST_OFFSET_MS;
  return { start, end: start + c.iv * 1e3, issue: s };
}
__name(periodFromIssue, "periodFromIssue");
function fbURL(env, path) {
  return env.FB_BASE + path;
}
__name(fbURL, "fbURL");
async function fbGet(env, path) {
  var r = await fetch(fbURL(env, path) + ".json", { method: "GET" });
  if (!r.ok) throw new Error("FB GET " + r.status + " " + path);
  var t = await r.text();
  if (!t || t === "null") return null;
  try {
    return JSON.parse(t);
  } catch (e) {
    return null;
  }
}
__name(fbGet, "fbGet");
async function fbPatch(env, path, obj) {
  var r = await fetch(fbURL(env, path) + ".json", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  });
  if (!r.ok) throw new Error("FB PATCH " + r.status + " " + path);
  return true;
}
__name(fbPatch, "fbPatch");
async function fbDelete(env, path) {
  var r = await fetch(fbURL(env, path) + ".json", { method: "DELETE" });
  if (!r.ok) throw new Error("FB DELETE " + r.status + " " + path);
  return true;
}
__name(fbDelete, "fbDelete");
async function generateMode(env, mode, nowMs, report) {
  var c = TYPES[mode];
  var ivMs = c.iv * 1e3;
  var running = periodAt(mode, nowMs);
  var meta = null;
  try {
    meta = await fbGet(env, "/_meta/lastGen_" + mode);
  } catch (e) {
    meta = null;
  }
  var lastGen = typeof meta === "number" ? meta : 0;
  var runningIdx = parseInt(String(running.issue).substr(8 + c.seq.length), 10);
  var firstIdx = Math.max(runningIdx + 1, lastGen + 1);
  var d = new Date(nowMs + IST_OFFSET_MS);
  var today4amIst = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4, 0, 0) - IST_OFFSET_MS;
  var windowStart = nowMs >= today4amIst ? today4amIst : today4amIst - 864e5;
  var windowEnd = windowStart + 864e5;
  var baseDay = Date.UTC(
    new Date(windowStart + IST_OFFSET_MS).getUTCFullYear(),
    new Date(windowStart + IST_OFFSET_MS).getUTCMonth(),
    new Date(windowStart + IST_OFFSET_MS).getUTCDate()
  );
  var firstStart = baseDay + (firstIdx - 1) * ivMs - IST_OFFSET_MS;
  if (firstStart < running.start + ivMs) firstStart = running.start + ivMs;
  var cursor = firstStart;
  var want = {};
  var count = 0, guard = 0;
  while (cursor < windowEnd && guard++ < 2e4) {
    var p = periodAt(mode, cursor);
    if (p.start >= running.end) {
      want[p.issue] = rnd10();
      count++;
    }
    cursor += ivMs;
  }
  if (!count) {
    report.push({ mode, created: 0, skipped: "nothing-to-generate", running: running.issue });
    return;
  }
  var existing = {};
  try {
    existing = await fbGet(env, "/" + mode) || {};
  } catch (e) {
    existing = {};
  }
  var patch = {}, made = 0, skipped = 0;
  for (var k in want) {
    if (existing[k] !== void 0 && existing[k] !== null) {
      skipped++;
      continue;
    }
    patch[k] = want[k];
    made++;
  }
  if (made > 0) await fbPatch(env, "/" + mode, patch);
  var lastIdx = lastGen;
  for (var k2 in want) {
    var idx = parseInt(String(k2).substr(8 + c.seq.length), 10);
    if (idx > lastIdx) lastIdx = idx;
  }
  await fbPatch(env, "/_meta", { ["lastGen_" + mode]: lastIdx });
  var pruned = 0;
  try {
    pruned = await pruneMode(env, mode, nowMs);
  } catch (e) {
  }
  report.push({
    mode,
    running: running.issue,
    created: made,
    skipped,
    pruned,
    lastGen: lastIdx
  });
}
__name(generateMode, "generateMode");
async function pruneMode(env, mode, nowMs) {
  if (!nowMs) nowMs = Date.now();
  var c = TYPES[mode];
  var map = {};
  try {
    map = await fbGet(env, "/" + mode) || {};
  } catch (e) {
    return 0;
  }
  var finished = [];
  for (var k in map) {
    if (map[k] === null || map[k] === void 0) continue;
    var p = periodFromIssue(mode, k);
    if (!p) continue;
    if (p.end <= nowMs) finished.push({ key: k, start: p.start });
  }
  if (finished.length <= KEEP_ROWS) return 0;
  finished.sort(function(a, b) {
    return b.start - a.start;
  });
  var del = {};
  for (var i = KEEP_ROWS; i < finished.length; i++) del[finished[i].key] = null;
  if (Object.keys(del).length === 0) return 0;
  var keys = Object.keys(del), BATCH = 400;
  for (var j = 0; j < keys.length; j += BATCH) {
    var chunk = {};
    for (var m = j; m < j + BATCH && m < keys.length; m++) chunk[keys[m]] = null;
    await fbPatch(env, "/" + mode, chunk);
  }
  return keys.length;
}
__name(pruneMode, "pruneMode");
async function generateAll(env, nowMs) {
  if (!nowMs) nowMs = Date.now();
  var report = [];
  for (var i = 0; i < MODE_ORDER.length; i++) {
    try {
      await generateMode(env, MODE_ORDER[i], nowMs, report);
    } catch (e) {
      report.push({ mode: MODE_ORDER[i], error: String(e && e.message || e) });
    }
  }
  return report;
}
__name(generateAll, "generateAll");
async function scheduled(controller, env, ctx) {
  var t = controller.scheduledTime || Date.now();
  var report = await generateAll(env, t);
  console.log("WINGO daily generation @" + new Date(t).toISOString(), JSON.stringify(report));
}
__name(scheduled, "scheduled");
async function handleFetch(request, env) {
  var url = new URL(request.url);
  var path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (path === "/" || path === "") {
      var now = Date.now();
      var status = {};
      for (var i = 0; i < MODE_ORDER.length; i++) {
        var m = MODE_ORDER[i];
        var running = periodAt(m, now);
        var lastGen = null;
        try {
          lastGen = await fbGet(env, "/_meta/lastGen_" + m);
        } catch (e) {
        }
        var total = null;
        try {
          var shallow = await fbGet(env, "/" + m) || {};
          total = Object.keys(shallow).length;
        } catch (e) {
        }
        status[m] = { runningPeriod: running.issue, runningEnd: new Date(running.end).toISOString(), lastGen, totalRows: total };
      }
      return json({ ok: true, now: new Date(now).toISOString(), modes: status });
    }
    if (path === "/generate") {
      var t = parseInt(url.searchParams.get("t"), 10);
      var rep = await generateAll(env, isNaN(t) ? Date.now() : t);
      return json({ ok: true, action: "generate", report: rep });
    }
    if (path === "/repair") {
      var rep2 = await generateAll(env, Date.now());
      return json({ ok: true, action: "repair", report: rep2 });
    }
    if (path === "/delete") {
      var mode = url.searchParams.get("mode");
      var key = url.searchParams.get("key");
      if (!mode || !key) return json({ ok: false, error: "mode & key required" }, 400);
      await fbDelete(env, "/" + mode + "/" + key);
      return json({ ok: true, deleted: "/" + mode + "/" + key });
    }
    return json({ ok: false, error: "not found", paths: ["/", "/generate", "/repair", "/delete?mode=&key="] }, 404);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
}
__name(handleFetch, "handleFetch");
function json(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");
var index_default = {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(scheduled(controller, env, ctx));
  },
  async fetch(request, env, ctx) {
    return handleFetch(request, env);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
