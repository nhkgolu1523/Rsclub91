/* ============================================================
   RSClub91 INVITATION SYSTEM  (Cloudflare Worker)
   ------------------------------------------------------------
   Original VeerGame jaisa invitation/commission/rebate system,
   hamare Firebase par. Saara paisa/commission ka hisaab SERVER
   (yahan) hota hai - browser sirf GET karta hai.

   FIREBASE LAYOUT (simple)
   ------------------------
   INVITE-CODES/<code>            = "<uid>"            (lookup: code -> inviter)
   INVITE-CONFIG                  = { LEVELS, REFERRAL-VALID-DAYS,
                                      FIRST-DEPOSIT-BONUS[], INVITE-COUNT-BONUS[],
                                      REBATE-TIERS[], COMMISSION-RATE }

   USERS/<uid>/INVITATION-RECORD  = {
        CODE, INVITE-CODE, LINK, INVITED-BY, INVITED-AT, REFERRAL-DEADLINE, LEVEL,
        DIRECT: { COUNT, DEPOSIT-COUNT, DEPOSIT-AMOUNT, FIRST-DEPOSIT-COUNT },
        TEAM:   { COUNT, DEPOSIT-COUNT, DEPOSIT-AMOUNT, FIRST-DEPOSIT-COUNT },
        SUBORDINATES/<childUid>: { LV, JOINED, USERNAME, DEPOSIT-AMOUNT, FIRST-DEPOSIT, BONUS },
        RECORDS/<childUid>:      { USERNAME, UID, REGISTER-TIME, DEPOSIT-AMOUNT },
        TASKS/<taskId>:          { BONUS, INVITEES, PER-RECHARGE,
                                   DONE-INVITEES, DONE-RECHARGE, FINISHED, RECEIVED },
        FIRST-DEPOSIT-BONUS/<id>: { FROM, DEPOSIT, TURNOVER, BONUS, TIME, STATUS },
        COMMISSIONS/<id>:        { AMOUNT, LV, FROM, DAY, TIME },
        BONUSES/<id>:            { AMOUNT, TYPE, TIME, STATUS, NOTE }
   }
   ============================================================ */

'use strict';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MAX_LEVELS = 6;

/* ---------------- helpers ---------------- */
function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

function nowIstParts() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, da: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), d: d
  };
}
function stamp() {
  const t = nowIstParts();
  return t.y + '-' + pad(t.mo, 2) + '-' + pad(t.da, 2) + ' ' +
    pad(t.h, 2) + ':' + pad(t.mi, 2) + ':' + pad(t.s, 2);
}
function dayStamp() { const t = nowIstParts(); return t.y + '-' + pad(t.mo, 2) + '-' + pad(t.da, 2); }
function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function json(obj, status) {
  return new Response(JSON.stringify(obj == null ? {} : obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  });
}
function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Key'
    }
  });
}

/* ---------------- firebase REST ---------------- */
function fbUrl(env, path) { return env.FB_BASE + path + '.json'; }

async function fbGet(env, path) {
  const r = await fetch(fbUrl(env, path), { method: 'GET', headers: { 'cache-control': 'no-store' } });
  if (!r.ok) throw new Error('FB GET ' + r.status + ' ' + path);
  const t = await r.text();
  if (!t || t === 'null') return null;
  try { return JSON.parse(t); } catch (e) { return null; }
}
async function fbSet(env, path, value) {
  const r = await fetch(fbUrl(env, path), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
  });
  if (!r.ok) throw new Error('FB PUT ' + r.status + ' ' + path);
  return true;
}
async function fbPatch(env, path, obj) {
  const r = await fetch(fbUrl(env, path), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj)
  });
  if (!r.ok) throw new Error('FB PATCH ' + r.status + ' ' + path);
  return true;
}

/* ---------------- config ---------------- */
async function getConfig(env) {
  const cfg = await fbGet(env, '/INVITE-CONFIG');
  return cfg || {
    LEVELS: MAX_LEVELS,
    'REFERRAL-VALID-DAYS': 7,
    'FIRST-DEPOSIT-BONUS': [],
    'INVITE-COUNT-BONUS': [],
    'REBATE-TIERS': [],
    'COMMISSION-RATE': {}
  };
}

/* uid se INVITATION-RECORD lao (record + direct + team) */
async function getRecord(env, uid) {
  if (!uid) return null;
  return await fbGet(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD');
}

/* ---------------- balance credit (server-trusted) ----------------
   Firebase me BALANCE = { MAIN-BALANCE, S, A }. Yahan hum server se
   credit karte hain (read-modify-write). Har credit ka own txId. */
async function creditBalance(env, uid, amount, txId) {
  if (!uid || !(amount > 0)) return false;
  const path = '/USERS/' + encodeURIComponent(uid) + '/BALANCE';
  const bal = await fbGet(env, path) || {};
  const cur = Number(bal['MAIN-BALANCE']) || 0;
  const S = (Number(bal['S']) || 0) + 1;
  const A = (bal['A'] && typeof bal['A'] === 'object') ? bal['A'] : {};
  if (txId && A[txId]) return false;            /* already applied */
  if (txId) A[txId] = S;
  await fbPatch(env, path, {
    'MAIN-BALANCE': r2(cur + amount),
    'S': S,
    'A': A
  });
  return true;
}

/* ---------------- REBATE TIER (L0..L10) ----------------
   Team Number / Team Betting / Team Deposit thresholds.
   Jo bhi L0 se upar sabse zyada tier meet kare, wahi level. */
function tierFor(cfg, teamNum, teamBet, teamDeposit) {
  const tiers = cfg['REBATE-TIERS'] || [];
  let lv = 'L0';
  for (const t of tiers) {
    const ok = teamNum >= (t['TEAM-NUM'] || 0) &&
      teamBet >= (t['TEAM-BET'] || 0) &&
      teamDeposit >= (t['TEAM-DEPOSIT'] || 0);
    if (ok) lv = t['LV'];
  }
  return lv;
}

/* ---------------- INVITE-COUNT task bonus ----------------
   Given how many invitees + how many of them reached per-recharge, find the
   highest bonus tier that is FINISHED. Returns merged task list (original UI). */
function buildTasks(cfg, efficientPeople, rechargePeople) {
  const list = cfg['INVITE-COUNT-BONUS'] || [];
  return list.map((t, i) => {
    const needP = Number(t['INVITEES']) || 0;
    const needR = Number(t['PER-RECHARGE']) || 0;
    const bonus = Number(t['BONUS']) || 0;
    const finished = (efficientPeople >= needP) && (rechargePeople >= needP);
    return {
      ID: 'T' + (i + 1),
      BONUS: bonus,
      INVITEES: needP,
      'PER-RECHARGE': needR,
      'DONE-INVITEES': Math.min(efficientPeople, needP),
      'DONE-RECHARGE': Math.min(rechargePeople, needP),
      FINISHED: finished,
      RECEIVED: 0
    };
  });
}

/* ---------------- FIRST-DEPOSIT bonus (partner rewards) ----------------
   Invitee ka 1st deposit (7 din ke andar) -> inviter ko bonus. */
function firstDepositBonus(cfg, deposit, turnover) {
  const list = (cfg['FIRST-DEPOSIT-BONUS'] || []).slice();
  let best = 0;
  for (const t of list) {
    if (deposit >= (t['DEPOSIT'] || 0) && turnover >= (t['TURNOVER'] || 0)) {
      best = Math.max(best, Number(t['BONUS']) || 0);
    }
  }
  return r2(best);
}

/* ================= endpoints ================= */

/* POST /register  { uid, refCode }  -> inviter link + node banana */
async function handleRegister(env, body) {
  const cfg = await getConfig(env);
  const uid = String(body.uid || '').trim();
  const refCode = String(body.refCode || '').trim();
  if (!uid) return json({ ok: false, error: 'uid required' }, 400);

  const record = await fbGet(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD') || {};
  if (record['INVITED-BY']) return json({ ok: true, already: true });

  let inviterUid = '';
  if (refCode && refCode !== 'NONE') {
    inviterUid = String(await fbGet(env, '/INVITE-CODES/' + encodeURIComponent(refCode)) || '');
  }
  if (!inviterUid || inviterUid === uid) {
    return json({ ok: true, linked: false });
  }

  const days = Number(cfg['REFERRAL-VALID-DAYS']) || 7;
  const now = new Date();
  const dl = new Date(now.getTime() + days * 86400000);

  await fbPatch(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD', {
    'INVITED-BY': inviterUid,
    'INVITED-AT': stamp(),
    'REFERRAL-DEADLINE': dl.toISOString()
  });

  /* inviter ke SUBORDINATES me lv1 entry */
  const uname = String((await fbGet(env, '/USERS/' + encodeURIComponent(uid) + '/PROFILE/USERNAME')) || '');
  await fbSet(env, '/USERS/' + encodeURIComponent(inviterUid) + '/INVITATION-RECORD/SUBORDINATES/' + encodeURIComponent(uid), {
    LV: 1,
    JOINED: stamp(),
    USERNAME: uname,
    'DEPOSIT-AMOUNT': 0,
    'FIRST-DEPOSIT': 0,
    BONUS: ''
  });

  /* chain ke saare level par COUNT +1 (L1 = DIRECT, L2+ = TEAM) */
  let c = uid, lv = 0;
  while (lv < MAX_LEVELS) {
    const cRec = await getRecord(env, c) || {};
    const pUid = String(cRec['INVITED-BY'] || '');
    if (!pUid) break;
    lv++;
    const pPath = '/USERS/' + encodeURIComponent(pUid) + '/INVITATION-RECORD';
    const par = await fbGet(env, pPath) || {};
    const bucket = (lv === 1) ? 'DIRECT' : 'TEAM';
    const b = par[bucket] || {};
    const p = {};
    p[bucket] = {
      COUNT: (Number(b.COUNT) || 0) + 1,
      'DEPOSIT-COUNT': Number(b['DEPOSIT-COUNT']) || 0,
      'DEPOSIT-AMOUNT': Number(b['DEPOSIT-AMOUNT']) || 0,
      'FIRST-DEPOSIT-COUNT': Number(b['FIRST-DEPOSIT-COUNT']) || 0
    };
    await fbPatch(env, pPath, p);
    /* nested SUBORDINATES entry bhi (multi-level chain ke liye) */
    if (lv > 1) {
      const sub2 = await fbGet(env, pPath + '/SUBORDINATES/' + encodeURIComponent(uid)) || {};
      if (!sub2.LV) {
        await fbSet(env, pPath + '/SUBORDINATES/' + encodeURIComponent(uid), {
          LV: lv, JOINED: stamp(), USERNAME: uname, 'DEPOSIT-AMOUNT': 0, 'FIRST-DEPOSIT': 0, BONUS: ''
        });
      }
    }
    c = pUid;
  }

  return json({ ok: true, linked: true, inviter: inviterUid });
}

/* POST /deposit  { uid, amount, turnover }  -> inviter ko bonus + commission + team */
async function handleDeposit(env, body) {
  const cfg = await getConfig(env);
  const uid = String(body.uid || '').trim();
  const amount = Number(body.amount) || 0;
  const turnover = Number(body.turnover) || 0;
  if (!uid || amount <= 0) return json({ ok: false, error: 'uid and amount required' }, 400);

  /* is user ka INVITATION-RECORD (uska inviter kaun) */
  const me = await getRecord(env, uid) || {};
  const firstDeposit = !((Number(me['HAS-DEPOSITED']) || 0) > 0);
  await fbPatch(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD', {
    'HAS-DEPOSITED': 1,
    'TOTAL-DEPOSIT': r2((Number(me['TOTAL-DEPOSIT']) || 0) + amount)
  });

  /* chain: up to MAX_LEVELS upar tak (L1..L6) */
  let childUid = uid;
  let level = 0;
  while (level < MAX_LEVELS) {
    const childRec = await getRecord(env, childUid) || {};
    const parentUid = String(childRec['INVITED-BY'] || '');
    if (!parentUid) break;
    level++;

    const parentPath = '/USERS/' + encodeURIComponent(parentUid) + '/INVITATION-RECORD';
    const parent = await fbGet(env, parentPath) || {};

    /* DIRECT vs TEAM: level 1 = DIRECT, level>1 = TEAM */
    const bucket = (level === 1) ? 'DIRECT' : 'TEAM';
    const b = parent[bucket] || {};
    const patch = {};
    /* COUNT register par badhta hai (handleRegister), yahan sirf deposit stats */
    patch[bucket] = {
      COUNT: Number(b.COUNT) || 0,
      'DEPOSIT-COUNT': (Number(b['DEPOSIT-COUNT']) || 0) + 1,
      'DEPOSIT-AMOUNT': r2((Number(b['DEPOSIT-AMOUNT']) || 0) + amount),
      'FIRST-DEPOSIT-COUNT': (Number(b['FIRST-DEPOSIT-COUNT']) || 0) + (firstDeposit ? 1 : 0)
    };
    await fbPatch(env, parentPath, patch);

    /* subordinate entry update (deposit total) */
    const subPath = parentPath + '/SUBORDINATES/' + encodeURIComponent(childUid);
    const sub = await fbGet(env, subPath) || {};
    await fbPatch(env, subPath, {
      LV: level,
      'DEPOSIT-AMOUNT': r2((Number(sub['DEPOSIT-AMOUNT']) || 0) + amount),
      'FIRST-DEPOSIT': firstDeposit ? 1 : 0
    });

    /* RECORDS (invitee list) — sirf level 1 ke liye (direct invitees) */
    if (level === 1) {
      const rpath = parentPath + '/RECORDS/' + encodeURIComponent(childUid);
      const rec = await fbGet(env, rpath) || {};
      await fbPatch(env, rpath, {
        USERNAME: sub.USERNAME || '',
        UID: childUid,
        'REGISTER-TIME': sub.JOINED || stamp(),
        'DEPOSIT-AMOUNT': r2((Number(rec['DEPOSIT-AMOUNT']) || 0) + amount)
      });
    }

    /* level-1 inviter ko FIRST-DEPOSIT bonus (7 din ke andar) */
    if (level === 1 && firstDeposit) {
      const bonus = firstDepositBonus(cfg, amount, turnover);
      if (bonus > 0) {
        const txId = 'FDB:' + uid;
        const credited = await creditBalance(env, parentUid, bonus, txId);
        if (credited) {
          await fbSet(env, parentPath + '/FIRST-DEPOSIT-BONUS/' + encodeURIComponent(txId), {
            FROM: childUid, DEPOSIT: r2(amount), TURNOVER: r2(turnover),
            BONUS: bonus, TIME: stamp(), STATUS: 'CREDITED'
          });
        }
      }
    }

    /* per-level COMMISSION: inviter ke AGENT-LEVEL (L0..L10) par, down-level = 'level' */
    const agentLv = (parent.LEVEL || 'L0');
    const rate = commissionRate(cfg, agentLv, level);
    const comm = r2(amount * rate);
    if (comm > 0) {
      const cid = newId('C');
      await fbSet(env, parentPath + '/COMMISSIONS/' + encodeURIComponent(cid), {
        AMOUNT: comm, LV: level, 'AGENT-LV': agentLv, FROM: childUid, DAY: dayStamp(), TIME: stamp()
      });
      const tx = 'CMM:' + cid;
      await creditBalance(env, parentUid, comm, tx);
    }

    childUid = parentUid;
  }

  return json({ ok: true });
}

/* commission % = inviter ke agent-level (L0..L10) par, aur down-level (1..6).
   Table original rebate-ratio page se (config: COMMISSION-RATE-BYLEVEL). */
function commissionRate(cfg, agentLevel, downLevel) {
  const tbl = cfg['COMMISSION-RATE-BYLEVEL'] || {};
  const lv = 'L' + (Number(agentLevel) || 0);
  const row = tbl[lv] || tbl['L0'] || [0];
  const pct = Number(row[Math.max(0, (Number(downLevel) || 1) - 1)]) || 0;
  return pct / 100;                 /* percent -> fraction */
}

/* POST /bet  { uid, stake }  -> team-betting + tier recompute */
async function handleBet(env, body) {
  const cfg = await getConfig(env);
  const uid = String(body.uid || '').trim();
  const stake = Number(body.stake) || 0;
  if (!uid || stake <= 0) return json({ ok: false, error: 'uid and stake required' }, 400);

  let childUid = uid, level = 0;
  while (level < MAX_LEVELS) {
    const childRec = await getRecord(env, childUid) || {};
    const parentUid = String(childRec['INVITED-BY'] || '');
    if (!parentUid) break;
    level++;

    const parentPath = '/USERS/' + encodeURIComponent(parentUid) + '/INVITATION-RECORD';
    const parent = await fbGet(env, parentPath) || {};

    /* team betting accumulate (team = neeche ke sab levels ka total bet) */
    const teamBet = r2((Number(parent['TEAM-BET']) || 0) + stake);
    const teamNum = Number((parent.TEAM && parent.TEAM.COUNT) || 0) + Number((parent.DIRECT && parent.DIRECT.COUNT) || 0);
    const teamDeposit = Number((parent.TEAM && parent.TEAM['DEPOSIT-AMOUNT']) || 0) +
      Number((parent.DIRECT && parent.DIRECT['DEPOSIT-AMOUNT']) || 0);
    const lv = tierFor(cfg, teamNum, teamBet, teamDeposit);
    await fbPatch(env, parentPath, { 'TEAM-BET': teamBet, LEVEL: lv });

    childUid = parentUid;
  }
  return json({ ok: true });
}

/* GET /subordinates?uid=&lv=&day=&q=  -> subordinate page data */
async function handleSubordinates(env, url) {
  const uid = String(url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ ok: false, error: 'uid required' }, 400);
  const lv = String(url.searchParams.get('lv') || '').trim();        /* '' / 'All' / 1..6 */
  const day = String(url.searchParams.get('day') || '').trim();      /* YYYY-MM-DD or '' */
  const q = String(url.searchParams.get('q') || '').trim();

  const rec = await getRecord(env, uid) || {};
  const subs = rec['SUBORDINATES'] || {};
  const list = [];
  let lv1 = 0, lvN = 0;
  for (const cid in subs) {
    const s = subs[cid] || {};
    if (Number(s.LV) === 1) lv1++; else lvN++;
    if (lv && lv !== 'All' && String(s.LV) !== String(lv)) continue;
    if (q && String(cid).indexOf(q) < 0 && String(s.USERNAME || '').toLowerCase().indexOf(q.toLowerCase()) < 0) continue;
    list.push({ uid: cid, LV: s.LV || 0, USERNAME: s.USERNAME || '', JOINED: s.JOINED || '',
      'DEPOSIT-AMOUNT': s['DEPOSIT-AMOUNT'] || 0, 'FIRST-DEPOSIT': s['FIRST-DEPOSIT'] || 0 });
  }
  /* summary/team: stored values ko SUBORDINATES se reconcile karo (COUNT hamesha sahi) */
  const d = rec.DIRECT || {};
  const t = rec.TEAM || {};
  const summary = {
    COUNT: Math.max(Number(d.COUNT) || 0, lv1),
    'DEPOSIT-COUNT': Number(d['DEPOSIT-COUNT']) || 0,
    'DEPOSIT-AMOUNT': Number(d['DEPOSIT-AMOUNT']) || 0,
    'FIRST-DEPOSIT-COUNT': Number(d['FIRST-DEPOSIT-COUNT']) || 0
  };
  const team = {
    COUNT: Math.max(Number(t.COUNT) || 0, lvN),
    'DEPOSIT-COUNT': Number(t['DEPOSIT-COUNT']) || 0,
    'DEPOSIT-AMOUNT': Number(t['DEPOSIT-AMOUNT']) || 0,
    'FIRST-DEPOSIT-COUNT': Number(t['FIRST-DEPOSIT-COUNT']) || 0
  };
  return json({ ok: true, summary: summary, team: team, list: list });
}

/* GET /commissions?uid=  -> commission detail page */
async function handleCommissions(env, url) {
  const uid = String(url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ ok: false, error: 'uid required' }, 400);
  const rec = await getRecord(env, uid) || {};
  const cm = rec['COMMISSIONS'] || {};
  const list = [];
  for (const id in cm) { const c = cm[id] || {}; c.id = id; list.push(c); }
  list.sort((a, b) => String(b.TIME).localeCompare(String(a.TIME)));
  return json({ ok: true, list: list });
}

/* GET /bonus?uid=  -> invitation-bonus page (tasks + progress + records) */
async function handleBonus(env, url) {
  const uid = String(url.searchParams.get('uid') || '').trim();
  if (!uid) return json({ ok: false, error: 'uid required' }, 400);
  const cfg = await getConfig(env);
  const rec = await getRecord(env, uid) || {};

  /* efficientPeople = invitees jinhone per-recharge meet kiya; rechargePeople = jinhone deposit kiya */
  const subs = rec['SUBORDINATES'] || {};
  let efficientPeople = 0, rechargePeople = 0;
  const tasksCfg = cfg['INVITE-COUNT-BONUS'] || [];
  for (const cid in subs) {
    const s = subs[cid] || {};
    if ((Number(s['DEPOSIT-AMOUNT']) || 0) > 0) rechargePeople++;
    /* efficient = kam se kam sabse chhoti tier ki per-recharge meet ki ho */
    const minPer = tasksCfg.length ? (Number(tasksCfg[0]['PER-RECHARGE']) || 0) : 0;
    if ((Number(s['DEPOSIT-AMOUNT']) || 0) >= minPer && minPer > 0) efficientPeople++;
  }
  const tasks = buildTasks(cfg, efficientPeople, rechargePeople);

  const rmap = rec['RECORDS'] || {};
  const records = [];
  for (const id in rmap) { const r = rmap[id] || {}; records.push(r); }

  return json({ ok: true, tasks: tasks, records: records,
    efficientPeople: efficientPeople, rechargePeople: rechargePeople });
}

/* POST /claim  { uid, taskId }  -> task bonus claim (wallet) */
async function handleClaim(env, body) {
  const cfg = await getConfig(env);
  const uid = String(body.uid || '').trim();
  const taskId = String(body.taskId || '').trim();
  if (!uid || !taskId) return json({ ok: false, error: 'uid and taskId required' }, 400);

  const rec = await getRecord(env, uid) || {};
  /* live task compute (GET /bonus jaisa) */
  const subs = rec['SUBORDINATES'] || {};
  const tasksCfg = cfg['INVITE-COUNT-BONUS'] || [];
  let efficientPeople = 0, rechargePeople = 0;
  for (const cid in subs) {
    const s = subs[cid] || {};
    if ((Number(s['DEPOSIT-AMOUNT']) || 0) > 0) rechargePeople++;
    const minPer = tasksCfg.length ? (Number(tasksCfg[0]['PER-RECHARGE']) || 0) : 0;
    if (minPer > 0 && (Number(s['DEPOSIT-AMOUNT']) || 0) >= minPer) efficientPeople++;
  }
  const tasks = buildTasks(cfg, efficientPeople, rechargePeople);
  const t = tasks.find(function (x) { return x.ID === taskId; });
  if (!t) return json({ ok: false, error: 'task not found' }, 404);

  /* already claimed? (BONUSES me TASK:<id> check) */
  const claimed = await fbGet(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD/BONUSES/TASK:' + encodeURIComponent(taskId));
  if (claimed) return json({ ok: false, error: 'already claimed' }, 409);
  if (!t.FINISHED) return json({ ok: false, error: 'task not finished' }, 409);

  const bonus = Number(t.BONUS) || 0;
  const txId = 'TASK:' + taskId;
  await creditBalance(env, uid, bonus, txId);
  await fbSet(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD/BONUSES/' + encodeURIComponent(txId), {
    AMOUNT: bonus, TYPE: 'INVITE-COUNT', TIME: stamp(), STATUS: 'CREDITED', NOTE: taskId
  });
  return json({ ok: true, bonus: bonus });
}

/* POST /admin-reward  { uid, amount, note }  (header X-Admin-Key) */
async function handleAdminReward(env, body, req) {
  const key = req.headers.get('X-Admin-Key') || '';
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) return json({ ok: false, error: 'unauthorized' }, 401);
  const uid = String(body.uid || '').trim();
  const amount = Number(body.amount) || 0;
  const note = String(body.note || '');
  if (!uid || amount === 0) return json({ ok: false, error: 'uid and amount required' }, 400);
  const id = newId('M');
  await creditBalance(env, uid, amount, 'MANUAL:' + id);
  await fbSet(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD/BONUSES/' + encodeURIComponent(id), {
    AMOUNT: r2(amount), TYPE: 'MANUAL', TIME: stamp(), STATUS: 'CREDITED', NOTE: note
  });
  return json({ ok: true, id: id });
}

/* ---------------- daily cron: commission calc note ----------------
   Commission ab deposit-event par real-time milti hai (handleDeposit).
   Cron sirf daily rollover ke liye rakha hai (LEVEL recompute sabke liye),
   taaki "R" (yesterday) values original jaisi consistent rahein. */
async function handleCron(env) {
  const cfg = await getConfig(env);
  const users = await fbGet(env, '/USERS') || {};
  let n = 0;
  for (const uid in users) {
    try {
      const rec = await getRecord(env, uid);
      if (!rec) continue;
      const teamNum = Number((rec.TEAM && rec.TEAM.COUNT) || 0) + Number((rec.DIRECT && rec.DIRECT.COUNT) || 0);
      const teamBet = Number(rec['TEAM-BET']) || 0;
      const teamDeposit = Number((rec.TEAM && rec.TEAM['DEPOSIT-AMOUNT']) || 0) + Number((rec.DIRECT && rec.DIRECT['DEPOSIT-AMOUNT']) || 0);
      const lv = tierFor(cfg, teamNum, teamBet, teamDeposit);
      await fbPatch(env, '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD', { LEVEL: lv });
      n++;
    } catch (e) { /* skip */ }
  }
  return n;
}

/* ================= router ================= */
async function handleFetch(request, env) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (request.method === 'OPTIONS') return cors();

  try {
    if (p === '/' || p === '/health') return json({ ok: true, service: 'rsclub-invite' });

    if (p === '/register' && request.method === 'POST') return await handleRegister(env, await request.json());
    if (p === '/deposit' && request.method === 'POST') return await handleDeposit(env, await request.json());
    if (p === '/bet' && request.method === 'POST') return await handleBet(env, await request.json());
    if (p === '/claim' && request.method === 'POST') return await handleClaim(env, await request.json());
    if (p === '/admin-reward' && request.method === 'POST') return await handleAdminReward(env, await request.json(), request);

    if (p === '/subordinates' && request.method === 'GET') return await handleSubordinates(env, url);
    if (p === '/commissions' && request.method === 'GET') return await handleCommissions(env, url);
    if (p === '/bonus' && request.method === 'GET') return await handleBonus(env, url);

    return json({ ok: false, error: 'not found: ' + p }, 404);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

export default {
  async fetch(request, env, ctx) { return handleFetch(request, env); },
  async scheduled(event, env, ctx) { ctx.waitUntil(handleCron(env)); }
};
