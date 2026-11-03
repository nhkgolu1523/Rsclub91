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

/* Transaction history entry (USERS/<uid>/TRANSECTION-HISTORY/<id>).
   idempotent: agar id pehle se hai to skip (dobara credit par double row nahi). */
async function txWrite(env, uid, type, amount, status, txId, note) {
  if (!uid || !(amount > 0)) return;
  const id = txId ? ('TX' + encodeURIComponent(txId)) : newId('T');
  const path = '/USERS/' + encodeURIComponent(uid) + '/TRANSECTION-HISTORY/' + id;
  if (txId && await fbGet(env, path)) return;      /* already logged */
  await fbSet(env, path, {
    TYPE: String(type || 'Bonus'),
    AMOUNT: r2(amount),
    STATUS: String(status || 'Success'),
    TIME: stamp(),
    NOTE: String(note || '')
  });
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

/* POST /register  { uid, refCode }  -> inviter link + node banana

   IDEMPOTENT / SELF-HEALING:
   Client (pages/login/backend.js linkInviter) apna INVITED-BY kabhi worker se
   PEHLE likh deta hai, isliye yahan "INVITED-BY already hai" dekh kar exit
   karna galat tha - us se chain walk (L2, L3... TEAM counts + nested
   SUBORDINATES) poori tarah SKIP ho jata tha.

   Ab: inviter ko (a) diye gaye refCode se, warna (b) record par pehle se
   likhe INVITED-BY se nikalte hain, aur chain ko phir bhi walk karte hain.
   Har ancestor par SUBORDINATES/<uid> add karte hain aur COUNT sirf tab
   badhaate hain jab wo SUBORDINATES entry pehle se na ho (dobara call par
   double-count nahi). Isse purana adhoora data bhi khud theek ho jata hai. */
async function handleRegister(env, body) {
  const cfg = await getConfig(env);
  const uid = String(body.uid || '').trim();
  const refCode = String(body.refCode || '').trim();
  if (!uid) return json({ ok: false, error: 'uid required' }, 400);

  const myPath = '/USERS/' + encodeURIComponent(uid) + '/INVITATION-RECORD';
  const record = await fbGet(env, myPath) || {};

  /* inviter: pehle refCode se, warna record par pehle se likhi INVITED-BY se */
  let inviterUid = '';
  if (refCode && refCode !== 'NONE') {
    inviterUid = String(await fbGet(env, '/INVITE-CODES/' + encodeURIComponent(refCode)) || '');
  }
  if (!inviterUid) inviterUid = String(record['INVITED-BY'] || '');
  if (!inviterUid || inviterUid === uid) {
    return json({ ok: true, linked: false, already: !!record['INVITED-BY'] });
  }

  /* naye user ka INVITED-BY + deadline (agar pehle se nahi hai to) */
  if (!record['INVITED-BY']) {
    const days = Number(cfg['REFERRAL-VALID-DAYS']) || 7;
    const now = new Date();
    const dl = new Date(now.getTime() + days * 86400000);
    await fbPatch(env, myPath, {
      'INVITED-BY': inviterUid,
      'INVITED-AT': stamp(),
      'REFERRAL-DEADLINE': dl.toISOString()
    });
  }

  const uname = String((await fbGet(env, '/USERS/' + encodeURIComponent(uid) + '/PROFILE/USERNAME')) || '');

  /* chain ke saare level par COUNT +1 (L1 = DIRECT, L2+ = TEAM).
     COUNT sirf tab +1 jab us ancestor ke SUBORDINATES me ye uid pehle se na ho
     -> idempotent (retry / self-heal par double-count nahi). */
  let c = uid, lv = 0;
  while (lv < MAX_LEVELS) {
    const cRec = await getRecord(env, c) || {};
    const pUid = String(cRec['INVITED-BY'] || '');
    if (!pUid) break;
    lv++;
    const pPath = '/USERS/' + encodeURIComponent(pUid) + '/INVITATION-RECORD';

    /* pehle se linked? (SUBORDINATES me entry) -> COUNT ko haath na lagao */
    const existing = await fbGet(env, pPath + '/SUBORDINATES/' + encodeURIComponent(uid));
    if (existing && existing.LV) { c = pUid; continue; }

    /* SUBORDINATES entry banao (nested, multi-level chain ke liye) */
    await fbSet(env, pPath + '/SUBORDINATES/' + encodeURIComponent(uid), {
      LV: lv, JOINED: stamp(), USERNAME: uname, 'DEPOSIT-AMOUNT': 0, 'FIRST-DEPOSIT': 0, BONUS: ''
    });

    /* ab bucket COUNT +1 (L1 = DIRECT, L2+ = TEAM) */
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

    c = pUid;
  }

  return json({ ok: true, linked: true, inviter: inviterUid });
}

/* POST /repair-chain  { root? }  -> purana adhoora data theek karo.
   Har user ka INVITED-BY (child -> parent) padh kar INVITATION-RECORD ke
   DIRECT/TEAM COUNT + nested SUBORDINATES ko dobara derive karta hai.
   root diya ho to sirf usi sub-tree ko (public allowed); warna poora (admin). */
async function handleRepairChain(env, body, req) {
  const key = req.headers.get('X-Admin-Key') || '';
  const root = String((body && body.root) || '').trim();
  const authorized = env.ADMIN_KEY && key === env.ADMIN_KEY;
  if (!authorized && !root) return json({ ok: false, error: 'unauthorized' }, 401);

  const users = await fbGet(env, '/USERS') || {};

  /* child -> parent map */
  const parentOf = {};
  for (const uid in users) {
    const rec = users[uid] && users[uid]['INVITATION-RECORD'];
    const p = rec && rec['INVITED-BY'];
    if (p && String(p) !== String(uid)) parentOf[uid] = String(p);
  }

  /* root diya -> uske saare descendants; warna saare users */
  let targets;
  if (root) {
    const childrenOf = {};
    for (const c in parentOf) { (childrenOf[parentOf[c]] = childrenOf[parentOf[c]] || []).push(c); }
    targets = [root];
    const stack = [root], seen = { root: 1 };
    while (stack.length) {
      const u = stack.pop();
      const kids = childrenOf[u] || [];
      for (const k of kids) { if (!seen[k]) { seen[k] = 1; targets.push(k); stack.push(k); } }
    }
  } else {
    targets = Object.keys(users);
  }

  /* Har target ke har ancestor (L1..L6) par missing SUBORDINATES entry banao */
  for (const uid of targets) {
    const uname = String(((users[uid] && users[uid].PROFILE && users[uid].PROFILE.USERNAME)) || '');
    let childUid = uid, lv = 0;
    while (lv < MAX_LEVELS) {
      const pUid = String(parentOf[childUid] || '');
      if (!pUid) break;
      lv++;
      const pPath = '/USERS/' + encodeURIComponent(pUid) + '/INVITATION-RECORD';
      const existed = await fbGet(env, pPath + '/SUBORDINATES/' + encodeURIComponent(uid));
      if (!existed || !existed.LV) {
        await fbSet(env, pPath + '/SUBORDINATES/' + encodeURIComponent(uid), {
          LV: lv, JOINED: stamp(), USERNAME: uname, 'DEPOSIT-AMOUNT': 0, 'FIRST-DEPOSIT': 0, BONUS: ''
        });
      }
      childUid = pUid;
    }
  }

  /* Ab har affected ancestor ka COUNT = SUBORDINATES key-count (L1 -> DIRECT,
     L2+ -> TEAM). Idempotent: dobara chalane par same result. */
  const recount = {};
  for (const uid of targets) {
    let childUid = uid, lv = 0;
    while (lv < MAX_LEVELS) {
      const pUid = String(parentOf[childUid] || '');
      if (!pUid) break;
      lv++;
      const r = recount[pUid] || (recount[pUid] = { lv1: {}, team: {} });
      if (lv === 1) r.lv1[uid] = 1; else r.team[uid] = 1;
      childUid = pUid;
    }
  }
  let recounts = 0;
  for (const pUid in recount) {
    const pPath = '/USERS/' + encodeURIComponent(pUid) + '/INVITATION-RECORD';
    const par = await fbGet(env, pPath) || {};
    const d = par.DIRECT || {}, t = par.TEAM || {};
    await fbPatch(env, pPath, {
      DIRECT: {
        COUNT: Object.keys(recount[pUid].lv1).length,
        'DEPOSIT-COUNT': Number(d['DEPOSIT-COUNT']) || 0,
        'DEPOSIT-AMOUNT': Number(d['DEPOSIT-AMOUNT']) || 0,
        'FIRST-DEPOSIT-COUNT': Number(d['FIRST-DEPOSIT-COUNT']) || 0
      },
      TEAM: {
        COUNT: Object.keys(recount[pUid].team).length,
        'DEPOSIT-COUNT': Number(t['DEPOSIT-COUNT']) || 0,
        'DEPOSIT-AMOUNT': Number(t['DEPOSIT-AMOUNT']) || 0,
        'FIRST-DEPOSIT-COUNT': Number(t['FIRST-DEPOSIT-COUNT']) || 0
      }
    });
    recounts++;
  }

  return json({ ok: true, scanned: targets.length, recounts: recounts, root: root || null });
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
      'FIRST-DEPOSIT-COUNT': (Number(b['FIRST-DEPOSIT-COUNT']) || 0) + (firstDeposit ? 1 : 0),
      'FIRST-DEPOSIT-AMOUNT': r2((Number(b['FIRST-DEPOSIT-AMOUNT']) || 0) + (firstDeposit ? amount : 0))
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
          await txWrite(env, parentUid, 'First deposit bonus', bonus, 'Success', txId, 'From ' + childUid);
          await fbSet(env, parentPath + '/FIRST-DEPOSIT-BONUS/' + encodeURIComponent(txId), {
            FROM: childUid, DEPOSIT: r2(amount), TURNOVER: r2(turnover),
            BONUS: bonus, TIME: stamp(), STATUS: 'CREDITED'
          });
        }
      }
    }

    /* NOTE: commission deposit par NAHI - game turnover (bet) par milta hai
       (original: "valid bet amount" / "turnover"). Wahi /bet me handle hota hai. */

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
    const patch = { 'TEAM-BET': teamBet, LEVEL: lv };

    /* BETTOR-COUNT: jitne distinct subordinates ne kabhi bet kiya (per ancestor).
       BETTORS/<bettorUid> marker se unique count - dobara bet par +1 nahi. */
    const bettorMark = await fbGet(env, parentPath + '/BETTORS/' + encodeURIComponent(uid));
    if (!bettorMark) {
      await fbSet(env, parentPath + '/BETTORS/' + encodeURIComponent(uid), stamp());
      patch['BETTOR-COUNT'] = (Number(parent['BETTOR-COUNT']) || 0) + 1;
    }
    await fbPatch(env, parentPath, patch);

    /* COMMISSION (original): inviter ke AGENT-LEVEL (L0..L10) par, down-level = 'level',
       hisaab = game TURNOVER (stake) ka %. deposit par nahi. */
    const agentLv = (parent.LEVEL || 'L0');
    const rate = commissionRate(cfg, agentLv, level);
    const comm = r2(stake * rate);
    if (comm > 0) {
      const cid = newId('C');
      /* original detail page fields: Agent level, Bet amount, Number of bettors,
         Commission payout, Date (+ FROM user, stake that generated it). */
      const fromName = String((parent.SUBORDINATES && parent.SUBORDINATES[childUid] && parent.SUBORDINATES[childUid].USERNAME) || '');
      await fbSet(env, parentPath + '/COMMISSIONS/' + encodeURIComponent(cid), {
        AMOUNT: comm, LV: level, 'AGENT-LV': agentLv, FROM: childUid, 'FROM-NAME': fromName,
        'BET-AMOUNT': r2(stake), RATE: rate, DAY: dayStamp(), TIME: stamp()
      });
      await creditBalance(env, parentUid, comm, 'CMM:' + cid);
      await txWrite(env, parentUid, 'Agent commission', comm, 'Success', 'CMM:' + cid, 'L' + level + ' bet');
    }

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
  let subsLv1 = 0, subsLvN = 0;
  for (const cid in subs) {
    const s = subs[cid] || {};
    if (Number(s.LV) === 1) subsLv1++; else subsLvN++;
    if (lv && lv !== 'All' && String(s.LV) !== String(lv)) continue;
    if (q && String(cid).indexOf(q) < 0 && String(s.USERNAME || '').toLowerCase().indexOf(q.toLowerCase()) < 0) continue;
    list.push({ uid: cid, LV: s.LV || 0, USERNAME: s.USERNAME || '', JOINED: s.JOINED || '',
      'DEPOSIT-AMOUNT': s['DEPOSIT-AMOUNT'] || 0, 'FIRST-DEPOSIT': s['FIRST-DEPOSIT'] || 0 });
  }
  /* summary/team: stored values ko SUBORDINATES se reconcile karo (COUNT hamesha sahi) */
  const d = rec.DIRECT || {};
  const t = rec.TEAM || {};
  const teamBet = r2(Number(rec['TEAM-BET']) || 0);
  /* bettor count = jitne subordinates ne kam se kam ek baar bet kiya (LV1+LVN) */
  const summary = {
    COUNT: Math.max(Number(d.COUNT) || 0, subsLv1),
    'DEPOSIT-COUNT': Number(d['DEPOSIT-COUNT']) || 0,
    'DEPOSIT-AMOUNT': Number(d['DEPOSIT-AMOUNT']) || 0,
    'FIRST-DEPOSIT-COUNT': Number(d['FIRST-DEPOSIT-COUNT']) || 0,
    'FIRST-DEPOSIT-AMOUNT': Number(d['FIRST-DEPOSIT-AMOUNT']) || 0
  };
  /* original: "Team" = poora downline (direct + indirect) -> DIRECT + TEAM sum.
     COUNT = saare subordinates (koi bhi level). */
  const team = {
    COUNT: Math.max((Number(d.COUNT) || 0) + (Number(t.COUNT) || 0), subsLv1 + subsLvN),
    'DEPOSIT-COUNT': (Number(d['DEPOSIT-COUNT']) || 0) + (Number(t['DEPOSIT-COUNT']) || 0),
    'DEPOSIT-AMOUNT': r2((Number(d['DEPOSIT-AMOUNT']) || 0) + (Number(t['DEPOSIT-AMOUNT']) || 0)),
    'FIRST-DEPOSIT-COUNT': (Number(d['FIRST-DEPOSIT-COUNT']) || 0) + (Number(t['FIRST-DEPOSIT-COUNT']) || 0),
    'TEAM-BET': teamBet,
    'BETTOR-COUNT': Number(rec['BETTOR-COUNT']) || 0
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

  /* ---------------------------------------------------------------
     Bonus details page ke liye poori (normalized) list:
       FIRST-DEPOSIT-BONUS  -> type "Deposit Gift"
       BONUSES(TYPE=...)    -> "Invitation bonus" / "Bonus" / "VIP level up reward"
     Har row: { TYPE, AMOUNT, TIME, STATUS, NOTE, FROM }
     STATUS page me "Received"/"To be collected"/"Expired" se match kare.
     --------------------------------------------------------------- */
  function normStatus(s) {
    var v = String(s || '').toUpperCase();
    if (v === 'CREDITED' || v === 'RECEIVED' || v === 'DONE') return 'Received';
    if (v === 'EXPIRED') return 'Expired';
    return 'To be collected';
  }
  var bonusList = [];
  const fdbAll = rec['FIRST-DEPOSIT-BONUS'] || {};
  for (const fid in fdbAll) {
    const f = fdbAll[fid] || {};
    bonusList.push({
      ID: fid, TYPE: 'Deposit Gift', AMOUNT: Number(f.BONUS) || 0,
      TIME: f.TIME || '', STATUS: normStatus(f.STATUS || 'CREDITED'),
      NOTE: '', FROM: f.FROM || ''
    });
  }
  const bAll = rec['BONUSES'] || {};
  for (const bid in bAll) {
    const b = bAll[bid] || {};
    var t = String(b.TYPE || '').toUpperCase();
    var label = t === 'INVITE-COUNT' ? 'Invitation bonus'
      : t === 'MANUAL' ? 'Bonus'
      : t === 'VIP' ? 'VIP level up reward' : 'Bonus';
    bonusList.push({
      ID: bid, TYPE: label, AMOUNT: Number(b.AMOUNT) || 0,
      TIME: b.TIME || '', STATUS: normStatus(b.STATUS || 'CREDITED'),
      NOTE: b.NOTE || '', FROM: ''
    });
  }
  /* naya pehle */
  bonusList.sort(function (a, b) { return String(b.TIME).localeCompare(String(a.TIME)); });

  /* Partner rewards page ke 3 counters:
     - inviteCount   = total direct invitees (SUBORDINATES LV1)
     - effectiveCount = invitees jinhone deposit kiya (effective)
     - totalBonus    = ab tak mila total invite bonus
                       (FIRST-DEPOSIT-BONUS + task/manual BONUSES ka sum) */
  let inviteCount = 0;
  for (const cid in subs) { if (Number((subs[cid] || {}).LV) === 1) inviteCount++; }
  let totalBonus = 0;
  const fdbMap = rec['FIRST-DEPOSIT-BONUS'] || {};
  for (const fid in fdbMap) {
    const f = fdbMap[fid] || {};
    if (String(f.STATUS || 'CREDITED').toUpperCase() === 'CREDITED') totalBonus += Number(f.BONUS) || 0;
  }
  const bmap = rec['BONUSES'] || {};
  for (const bid in bmap) {
    const b = bmap[bid] || {};
    if (String(b.STATUS || '').toUpperCase() === 'CREDITED') totalBonus += Number(b.AMOUNT) || 0;
  }
  totalBonus = Math.round(totalBonus * 100) / 100;

  return json({ ok: true, tasks: tasks, records: records, list: bonusList,
    efficientPeople: efficientPeople, rechargePeople: rechargePeople,
    inviteCount: inviteCount, effectiveCount: rechargePeople, totalBonus: totalBonus });
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
  await txWrite(env, uid, 'Invite bonus', bonus, 'Success', txId, taskId);
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
  await txWrite(env, uid, 'Bonus', amount, 'Success', 'MANUAL:' + id, note);
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
    if (p === '/repair-chain' && request.method === 'POST') return await handleRepairChain(env, await request.json(), request);
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
