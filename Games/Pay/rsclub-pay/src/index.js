/* ============================================================
   RSClub91 PAYMENT WORKER  (Cloudflare Worker)  --  rsclub-pay
   ------------------------------------------------------------
   Real UPI deposits through FamGateway (https://famgateway.in).

   FLOW
     1. POST /deposit/order   -> gateway se order; QR + UPI intent
     2. GET  /deposit/status  -> authoritative check; credit EXACTLY ONCE
     3. POST /payment/webhook -> gateway HMAC callback (fast path)

   MONEY SAFETY (zero double-credit)
     - USERS/<uid>/DEPOSIT-CREDIT/<orderId> = amount  (keyed -> idempotent)
     - BALANCE/MAIN-BALANCE ek CAS PATCH se badhta hai
     - PAYMENT-ORDERS/<orderId>.status = success  (dobara credit nahi)
     - UTR-INDEX/<utr> = orderId   (ek bank-ref sirf ek order)
     - webhook + poll + retry parallel chalein -> paisa ek hi baar

   API key SIRF secret me:
     npx wrangler secret put FAMGATEWAY_API_KEY --name rsclub-pay
   ============================================================ */

'use strict';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const FAM_BASE = 'https://famgateway.in';

/* ---------------- small helpers ---------------- */
function pad(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }
function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }

function nowIst() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, da: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), d: d
  };
}
function stamp() {
  const t = nowIst();
  return t.y + '-' + pad(t.mo, 2) + '-' + pad(t.da, 2) + ' ' +
    pad(t.h, 2) + ':' + pad(t.mi, 2) + ':' + pad(t.s, 2);
}
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
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

/* ---------------- firebase REST ---------------- */
function fbUrl(env, path) {
  const base = String(env.FB_BASE || '').replace(/\/+$/, '');
  return base + path + '.json';
}
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
async function fbPatch(env, path, value) {
  const r = await fetch(fbUrl(env, path), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
  });
  if (!r.ok) throw new Error('FB PATCH ' + r.status + ' ' + path);
  return true;
}

/* ---------------- gateway (FamGateway) ---------------- */
function famKey(env) { return String(env.FAMGATEWAY_API_KEY || '').trim(); }
function famConfigured(env) { return famKey(env).length > 0; }
function famBase(env) { return String(env.FAMGATEWAY_BASE || FAM_BASE).replace(/\/+$/, ''); }

function form(obj) {
  const p = [];
  for (const k in obj) {
    if (obj[k] === undefined || obj[k] === null) continue;
    p.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(obj[k])));
  }
  return p.join('&');
}

/* POST /api/create-order -> { order_id, qr_url, upi_intent, payable_amount, ... } */
async function famCreateOrder(env, opts) {
  const body = form({
    api_key: famKey(env),
    amount: opts.amount,
    name: opts.name || '',
    email: opts.email || '',
    phone: opts.phone || '',
    webhook_url: opts.webhookUrl || '',
    redirect_url: opts.redirectUrl || '',
    remarks: opts.remarks || ''
  });
  let r, txt, data;
  try {
    r = await fetch(famBase(env) + '/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body
    });
    txt = await r.text();
    data = txt ? JSON.parse(txt) : {};
  } catch (e) {
    return { ok: false, error: 'Gateway se baat nahi ho payi. Dobara try karein.', code: 'gateway-error', status: 502 };
  }
  const okFlag = data && (String(data.status || '').toLowerCase() === 'success' || data.status === true || data.success === true);
  if (!r.ok || !data || !okFlag) {
    const msg = (data && (data.message || data.error)) || 'Gateway ne order reject kiya.';
    return { ok: false, error: String(msg), code: 'gateway-reject', status: 400, raw: data };
  }
  /* gateway fields nested under "data" */
  const d = (data.data && typeof data.data === 'object') ? data.data : data;
  const orderId = String(d.order_id || d.orderId || '');
  if (!orderId) return { ok: false, error: 'Gateway se order id nahi mili.', code: 'no-order-id', status: 502, raw: data };
  /* gateway apna real expiry "expires_at_ist" (DD-MM-YYYY HH:MM:SS) deta hai.
     Usse secondsLeft nikaal lo taaki hamara timer bilkul match kare. */
  const alsoAt = String(d.expires_at_ist || d.expiresAtIst || '');
  const created = String(d.created_at_ist || d.createdAtIst || '');
  function parseIst(s) {
    var m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(String(s || '').trim());
    if (!m) return 0;
    return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) - (5.5 * 60 * 60 * 1000);
  }
  var expMs = parseIst(alsoAt);
  var createdMs = parseIst(created);
  var windowSec = 0;
  if (expMs > 0) windowSec = Math.max(60, Math.round((expMs - Date.now()) / 1000));
  else if (expMs > 0 && createdMs > 0) windowSec = Math.max(60, Math.round((expMs - createdMs) / 1000));
  return {
    ok: true,
    data: {
      orderId: orderId,
      qrUrl: String(d.qr_url || d.qrUrl || d.qr || ''),
      checkoutUrl: String(d.checkout_url || d.checkoutUrl || ''),
      upiIntent: String(d.upi_intent || d.upiIntent || ''),
      upiId: String(d.upi_id || d.upiId || ''),
      payableAmount: num(d.payable_amount || d.payableAmount || opts.amount) || opts.amount,
      expiresAtIst: alsoAt,
      expiresInSeconds: windowSec   /* 0 = unknown */
    }
  };
}

/* GET /api/verify-order.php?api_key=..&order_id=.. -> { status, utr, ... } */
async function famVerifyOrder(env, orderId) {
  let r, txt, data;
  try {
    r = await fetch(famBase(env) + '/api/verify-order.php?' + form({ api_key: famKey(env), order_id: orderId }), {
      method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store'
    });
    txt = await r.text();
    data = txt ? JSON.parse(txt) : {};
  } catch (e) {
    return { ok: false, status: 'unknown', error: 'verify-failed' };
  }
  if (!r.ok || !data) return { ok: false, status: 'unknown', error: 'verify-' + (r ? r.status : 0) };
  const st = String(data.status || data.order_status || '').toLowerCase();
  const success = st === 'success' || st === 'paid' || st === 'completed' || data.paid === true || data.paid === 1;
  const expired = st === 'expired' || st === 'failed' || st === 'cancelled' || st === 'canceled';
  return {
    ok: true,
    status: success ? 'success' : expired ? 'expired' : 'pending',
    utr: String(data.utr || data.bank_utr || data.rrn || ''),
    senderName: String(data.sender_name || data.senderName || ''),
    amount: num(data.amount || data.paid_amount || 0),
    paidAt: String(data.payment_time_ist || data.paid_at || '')
  };
}

/* gateway webhook signature (HMAC-SHA256 of the raw body, hex) */
async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const b = new Uint8Array(sig);
  let out = '';
  for (let i = 0; i < b.length; i++) out += pad(b[i].toString(16), 2);
  return out;
}
function timingSafe(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
async function verifyFamSignature(env, rawBody, headerSig) {
  const secret = famKey(env);
  if (!secret || !headerSig) return false;
  const expect = await hmacHex(secret, rawBody);
  return timingSafe(String(headerSig).trim().toLowerCase(), expect.toLowerCase());
}

/* ---------------- payment order store ---------------- */
const ORDER_TTL_MS = 60 * 60 * 1000;             /* order record cleanup after 1h */
function orderPath(orderId) { return '/PAYMENT-ORDERS/' + encodeURIComponent(orderId); }

async function getOrder(env, orderId) {
  if (!orderId) return null;
  const o = await fbGet(env, orderPath(orderId));
  return (o && typeof o === 'object') ? o : null;
}
async function saveOrder(env, order) {
  await fbSet(env, orderPath(order.orderId), order);
}

/* ---------------- BALANCE credit (CAS, idempotent) ---------------- */
/* Hamare shape: USERS/<uid>/BALANCE = { MAIN-BALANCE, S, A:{txId:seq} }
   - txId = "DEP:<orderId>"  -> dobara credit impossible
   - CAS (ETag + if-match) -> lost update impossible
   - DEPOSIT-CREDIT/<orderId> marker bhi likhte hain (belt + suspenders) */
async function creditBalanceOnce(env, uid, amount, orderId) {
  amount = r2(amount);
  if (!uid || !(amount > 0)) return { credited: false, reason: 'bad-args' };

  const markPath = '/USERS/' + encodeURIComponent(uid) + '/DEPOSIT-CREDIT/' + encodeURIComponent(orderId);
  const already = await fbGet(env, markPath);
  if (already) return { credited: false, reason: 'already-settled' };

  const balPath = '/USERS/' + encodeURIComponent(uid) + '/BALANCE';
  const txId = 'DEP:' + orderId;
  const base = String(env.FB_BASE || '').replace(/\/+$/, '');

  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(base + balPath + '.json', {
      method: 'GET', headers: { 'X-Firebase-ETag': 'true', 'cache-control': 'no-store' }
    });
    if (!r.ok) return { credited: false, reason: 'read-failed' };
    const etag = r.headers.get('ETag');
    const txt = await r.text();
    let cur = null;
    try { cur = txt && txt !== 'null' ? JSON.parse(txt) : null; } catch (e) { cur = null; }

    const bal = (cur && typeof cur === 'object') ? cur : {};
    const A = (bal.A && typeof bal.A === 'object') ? bal.A : {};
    if (A[txId]) return { credited: false, reason: 'already-settled' };

    const S = (num(bal.S) || 0) + 1;
    const newBal = r2(num(bal['MAIN-BALANCE']) + amount);
    const newA = Object.assign({}, A); newA[txId] = S;

    const headers = { 'Content-Type': 'application/json' };
    if (etag) headers['if-match'] = etag;
    const put = await fetch(base + balPath + '.json', {
      method: 'PUT', headers: headers,
      body: JSON.stringify({ 'MAIN-BALANCE': newBal, S: S, A: newA })
    });
    if (put.ok) {
      try { await fbSet(env, markPath, { AMOUNT: amount, TIME: stamp(), TX: txId }); } catch (e) {}
      return { credited: true, reason: 'settled', balance: newBal };
    }
    if (put.status === 412) continue;
    return { credited: false, reason: 'write-failed' };
  }
  return { credited: false, reason: 'busy' };
}

/* ---------------- settle (webhook + poll dono ise call karte hain) ---------------- */
async function settlePayment(env, opts) {
  const order = await getOrder(env, opts.orderId);
  if (!order) return { credited: false, reason: 'not-found' };

  if (order.status === 'duplicate') return { credited: false, reason: 'duplicate' };
  if (order.status === 'success') return { credited: false, reason: 'already-settled' };

  const utr = String(opts.utr || '').trim();
  const amount = r2(num(opts.paidAmount) > 0 ? num(opts.paidAmount) : num(order.amount));

  if (utr) {
    const used = await fbGet(env, '/UTR-INDEX/' + encodeURIComponent(utr));
    if (used && String(used) !== String(order.orderId)) {
      await fbPatch(env, orderPath(order.orderId), { status: 'duplicate', utr: utr, blockedBy: String(used) });
      return { credited: false, reason: 'duplicate' };
    }
  }

  const claimed = await claimOrder(env, order.orderId);
  if (!claimed) {
    const again = await getOrder(env, order.orderId);
    return { credited: false, reason: (again && again.status === 'success') ? 'already-settled' : 'busy' };
  }

  const credit = await creditBalanceOnce(env, order.uid, amount, order.orderId);

  const patch = {
    status: 'success',
    utr: utr,
    senderName: String(opts.senderName || ''),
    paidAt: String(opts.paidAt || ''),
    paidAmount: amount,
    creditedAmount: (credit.credited || credit.reason === 'already-settled') ? amount : 0,
    credited: credit.credited || credit.reason === 'already-settled',
    creditedAt: stamp()
  };
  try { await fbPatch(env, orderPath(order.orderId), patch); } catch (e) {}

  if (utr) { try { await fbSet(env, '/UTR-INDEX/' + encodeURIComponent(utr), order.orderId); } catch (e) {} }

  if (credit.credited) {
    await afterCredit(env, order, amount, utr);
  }
  return {
    credited: credit.credited,
    reason: credit.credited ? 'settled' : credit.reason,
    uid: order.uid,
    amount: amount
  };
}

/* order ko ETag se 'claim' karo - concurrent settle me ek hi jeetega */
async function claimOrder(env, orderId) {
  const base = String(env.FB_BASE || '').replace(/\/+$/, '');
  const path = orderPath(orderId);
  const r = await fetch(base + path + '.json', { method: 'GET', headers: { 'X-Firebase-ETag': 'true', 'cache-control': 'no-store' } });
  if (!r.ok) return false;
  const etag = r.headers.get('ETag');
  const txt = await r.text();
  let cur = null;
  try { cur = txt && txt !== 'null' ? JSON.parse(txt) : null; } catch (e) { cur = null; }
  if (!cur) return false;
  if (cur.status === 'success' || cur.status === 'duplicate') return false;
  if (cur.claim) return false;
  const next = Object.assign({}, cur, { claim: stamp() });
  const headers = { 'Content-Type': 'application/json' };
  if (etag) headers['if-match'] = etag;
  const put = await fetch(base + path + '.json', {
    method: 'PUT', headers: headers, body: JSON.stringify(next)
  });
  return put.ok;
}

/* success ke baad: transaction-history + deposit-history + invite commission */
async function afterCredit(env, order, amount, utr) {
  const uid = order.uid;
  const txId = order.txId || newId('D');
  try {
    await fbSet(env, '/USERS/' + encodeURIComponent(uid) + '/TRANSECTION-HISTORY/' + encodeURIComponent(txId), {
      TYPE: 'Deposit', AMOUNT: r2(amount), STATUS: 'Success', TIME: stamp(),
      NOTE: 'UPI' + (utr ? ' UTR:' + utr : ''), 'ORDER-ID': order.orderId
    });
  } catch (e) {}
  try {
    await fbSet(env, '/USERS/' + encodeURIComponent(uid) + '/DEPOSIT-HISTORY/' + encodeURIComponent(txId), {
      AMOUNT: r2(amount), STATUS: 'Success', TIME: stamp(), METHOD: 'UPI QR',
      UTR: utr || '', 'ORDER-ID': order.orderId
    });
  } catch (e) {}
  try {
    const api = String(env['INVITE-API'] || '').replace(/\/+$/, '');
    if (api) {
      fetch(api + '/deposit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uid, amount: r2(amount), turnover: r2(amount) })
      }).catch(function () {});
    }
  } catch (e) {}
}

/* ---------------- endpoints ---------------- */
/* min = Firebase DEPOSIT-AMOUNT/1ST (admin-controlled), warna env fallback */
function parseAmtVal(v) {
  if (v == null || v === '') return 0;
  var s = String(v).replace(/[^0-9.Kk]/g, '');
  var mult = /[kK]/.test(s) ? 1000 : 1;
  var n = parseFloat(s.replace(/[kK]/g, '')) || 0;
  return Math.round(n * mult);
}
async function depositLimits(env) {
  let min = Math.max(1, Math.floor(num(env['DEPOSIT-MIN']) || 500));
  let max = Math.max(min, Math.floor(num(env['DEPOSIT-MAX']) || 50000));
  try {
    const one = await fbGet(env, '/DEPOSIT-AMOUNT/1ST');
    const v = parseAmtVal(one);
    if (v > 0) min = v;
  } catch (e) {}
  if (max < min) max = min;
  return { min: min, max: max };
}

/* POST /deposit/order  { uid, amount, name?, email?, phone? } */
async function handleOrder(env, body, req) {
  const uid = String(body.uid || '').trim();
  const amount = Math.floor(num(body.amount));
  if (!uid) return json({ ok: false, error: 'uid required' }, 400);

  const lim = await depositLimits(env);
  if (amount < lim.min) return json({ ok: false, error: 'Minimum deposit is Rs.' + lim.min, code: 'min-deposit' }, 400);
  if (amount > lim.max) return json({ ok: false, error: 'Maximum deposit is Rs.' + lim.max, code: 'max-deposit' }, 400);

  if (!famConfigured(env)) {
    return json({ ok: false, error: 'Payment gateway is not configured yet.', code: 'gateway-missing' }, 503);
  }

  const origin = new URL(req.url).origin;
  const created = await famCreateOrder(env, {
    amount: amount,
    name: String(body.name || ''),
    email: String(body.email || ''),
    phone: String(body.phone || ''),
    webhookUrl: origin + '/payment/webhook',
    redirectUrl: origin + '/deposit/done'
  });
  if (!created.ok) return json({ ok: false, error: created.error, code: created.code, raw: created.raw }, created.status || 400);

  const d = created.data;
  const txId = newId('D');
  const now = Date.now();
  /* gateway ka real window use karo (agar mila), warna config fallback */
  const cfgSec = Math.max(60, Math.floor(num(env['PAYMENT-WINDOW-SECONDS']) || 300));
  const windowSec = (num(d.expiresInSeconds) > 0) ? Math.floor(num(d.expiresInSeconds)) : cfgSec;
  const expiresAt = now + windowSec * 1000;

  const order = {
    orderId: d.orderId, uid: uid, txId: txId,
    amount: amount, payable: d.payableAmount || amount,
    status: 'pending', provider: 'famgateway', method: 'UPI',
    createdAt: now, expiresAt: expiresAt,
    qrUrl: d.qrUrl, upiIntent: d.upiIntent, upiId: d.upiId   /* reload/resume ke liye */
  };
  try { await saveOrder(env, order); } catch (e) {}
  try {
    await fbSet(env, '/USERS/' + encodeURIComponent(uid) + '/TRANSECTION-HISTORY/' + encodeURIComponent(txId), {
      TYPE: 'Deposit', AMOUNT: amount, STATUS: 'Pending', TIME: stamp(), NOTE: 'UPI QR', 'ORDER-ID': d.orderId
    });
  } catch (e) {}

  return json({
    ok: true, txId: txId, orderId: d.orderId,
    qrUrl: d.qrUrl, checkoutUrl: d.checkoutUrl, upiIntent: d.upiIntent, upiId: d.upiId,
    amount: amount, payableAmount: order.payable,
    expiresAt: expiresAt, secondsLeft: windowSec
  });
}

/* GET /deposit/status?uid=..&order_id=.. */
async function handleStatus(env, url) {
  const uid = String(url.searchParams.get('uid') || '').trim();
  const orderId = String(url.searchParams.get('order_id') || '').trim();
  if (!orderId) return json({ ok: false, error: 'order_id required' }, 400);

  const order = await getOrder(env, orderId);
  if (!order) return json({ ok: false, error: 'order not found', code: 'not-found' }, 404);
  if (uid && String(order.uid) !== uid) return json({ ok: false, error: 'forbidden' }, 403);

  if (order.status === 'success') {
    return json({ ok: true, status: 'success', credited: true, amount: order.creditedAmount || order.amount, utr: order.utr || '', payableAmount: order.payable });
  }
  if (order.status === 'duplicate') return json({ ok: true, status: 'duplicate', payableAmount: order.payable });

  const live = await famVerifyOrder(env, order.orderId);
  if (live.status === 'success') {
    const settled = await settlePayment(env, {
      orderId: order.orderId, utr: live.utr, senderName: live.senderName,
      paidAmount: live.amount || order.amount, paidAt: live.paidAt
    });
    return json({
      ok: true, status: 'success',
      credited: settled.reason === 'settled' || settled.reason === 'already-settled',
      pendingApproval: false,
      amount: settled.amount || order.amount, utr: live.utr || ''
    });
  }

  const gracePassed = num(order.expiresAt) > 0 && Date.now() > num(order.expiresAt) + 5 * 60 * 1000;
  if (live.status === 'expired' || gracePassed) {
    try { await fbPatch(env, orderPath(order.orderId), { status: 'expired' }); } catch (e) {}
    return json({ ok: true, status: 'expired', payableAmount: order.payable });
  }

  return json({
    ok: true, status: 'pending', checked: live.status !== 'unknown',
    payableAmount: order.payable, amount: order.amount,
    qrUrl: order.qrUrl || '', upiId: order.upiId || '', upiIntent: order.upiIntent || '',
    expiresAt: order.expiresAt,
    secondsLeft: Math.max(0, Math.round((num(order.expiresAt) - Date.now()) / 1000))
  });
}

/* POST /deposit/cancel  { order_id } */
async function handleCancel(env, body) {
  const orderId = String(body.order_id || '').trim();
  const order = await getOrder(env, orderId);
  if (!order) return json({ ok: false, error: 'not found' }, 404);
  if (order.status === 'pending') {
    try { await fbPatch(env, orderPath(orderId), { status: 'expired' }); } catch (e) {}
    try {
      if (order.txId) {
        await fbPatch(env, '/USERS/' + encodeURIComponent(order.uid) + '/TRANSECTION-HISTORY/' + encodeURIComponent(order.txId), { STATUS: 'Cancelled' });
      }
    } catch (e) {}
  }
  return json({ ok: true });
}

/* POST /payment/webhook (gateway callback) */
async function handleWebhook(env, req) {
  const raw = await req.text();
  const sig = req.headers.get('x-famgateway-signature');
  if (!(await verifyFamSignature(env, raw, sig))) return json({ error: 'invalid signature' }, 401);

  let event = {};
  try { event = raw ? JSON.parse(raw) : {}; } catch (e) { return json({ error: 'invalid payload' }, 400); }

  const orderId = String(event.order_id || event.orderId || '');
  if (!orderId) return json({ error: 'order_id missing' }, 400);

  const paid = String(event.status || '').toLowerCase() === 'success' ||
    String(event.event || '') === 'payment.success' || event.paid === true;
  if (!paid) return json({ ok: true, ignored: true });

  const settled = await settlePayment(env, {
    orderId: orderId,
    utr: event.utr || event.bank_utr,
    senderName: event.sender_name || event.senderName,
    paidAmount: num(event.amount || event.paid_amount) || 0,
    paidAt: event.payment_time_ist || event.paid_at
  });
  return json({ ok: true, credited: settled.credited, reason: settled.reason });
}

/* ---------------- router ---------------- */
async function handleFetch(request, env) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (request.method === 'OPTIONS') return cors();
  try {
    if (p === '/' || p === '/health') return json({ ok: true, service: 'rsclub-pay', gateway: famConfigured(env) });
    if (p === '/config') {
      const lim = await depositLimits(env);
      return json({ ok: true, payments: { configured: famConfigured(env), min: lim.min, max: lim.max } });
    }
    if (p === '/deposit/order' && request.method === 'POST') return await handleOrder(env, await request.json(), request);
    if (p === '/deposit/status' && request.method === 'GET') return await handleStatus(env, url);
    if (p === '/deposit/cancel' && request.method === 'POST') return await handleCancel(env, await request.json());
    if (p === '/payment/webhook' && request.method === 'POST') return await handleWebhook(env, request);
    return json({ ok: false, error: 'not found: ' + p }, 404);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 500);
  }
}

export default {
  async fetch(request, env, ctx) { return handleFetch(request, env); }
};
