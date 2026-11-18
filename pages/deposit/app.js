/* Deposit page interactions — REAL UPI gateway (rsclub-pay worker). */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var PAY_API = 'https://rsclub-pay.99infinity.workers.dev';
  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function uid() {
    try {
      var u = localStorage.getItem('rsclub_uid');
      u = u == null ? '' : String(u).trim();
      return (u && u !== 'null' && u !== 'undefined') ? u : '';
    } catch (e) { return ''; }
  }
  function phone() {
    try { return String(localStorage.getItem('rsclub_phone') || ''); } catch (e) { return ''; }
  }
  function userName() {
    try { return String(localStorage.getItem('rsclub_username') || ''); } catch (e) { return ''; }
  }

  var back = document.querySelector('.navbar__content-left');
  if (back) {
    back.style.cursor = 'pointer';
    back.addEventListener('click', function () { RS.back('../account/index.html'); });
  }

  function history() {
    var sec = document.querySelector('.record__main');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var histLink = document.querySelector('.navbar__content-right');
  if (histLink) { histLink.style.cursor = 'pointer'; histLink.addEventListener('click', history); }

  var methodLabel = document.querySelector('.Recharge__content-fixed-box h2');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.Recharge__container-tabcard__items'));
  function currentMethod() { return methodLabel ? (methodLabel.textContent || '').trim() : 'UPI-QR'; }
  cards.forEach(function (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function () {
      cards.forEach(function (c) { c.classList.remove('active'); });
      card.classList.add('active');
      var bot = card.querySelector('.Recharge__container-tabcard__bot');
      if (methodLabel && bot) methodLabel.textContent = (bot.textContent || '').replace(/\s+/g, ' ').trim();
    });
  });

  var input = document.querySelector('.Recharge__content-paymoney .van-field__control');
  var btn = document.querySelector('.Recharge__content-fixed-box .Recharge__container-rechageBtn')
    || document.querySelector('.Recharge__container-rechageBtn');
  function amount() {
    var n = input ? Number(String(input.value).replace(/[^0-9.]/g, '')) || 0 : 0;
    return Math.round(n);
  }
  function money(n) {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function refresh() {
    var v = amount();
    if (btn) {
      if (v >= MIN_AMOUNT) {
        btn.classList.add('rechage_active');
        btn.textContent = 'Deposit ₹' + money(v);
      } else {
        btn.classList.remove('rechage_active');
        btn.textContent = 'Deposit';
      }
    }
  }
  function setInput(v) {
    if (!input) return;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ============================================================
     QUICK AMOUNTS  --  Firebase DEPOSIT-AMOUNT se (koi hardcode nahi)
       { 1ST: 500, 2ND: '1K', 3RD: '2K', ... 12TH: '50K' }
       1ST = MINIMUM deposit (placeholder bhi isse banta hai)
     ============================================================ */
  var MIN_AMOUNT = 500;       /* default; Firebase se override hoga */
  var MAX_AMOUNT = 50000;
  var chips = [];

  function parseChip(t) {
    t = String(t).replace(/[^0-9.Kk]/g, '');
    var mult = /[kK]/.test(t) ? 1000 : 1;
    var n = parseFloat(t.replace(/[kK]/g, '')) || 0;
    return Math.round(n * mult);
  }
  function fmtChip(v) {
    v = Number(v) || 0;
    if (v >= 1000 && v % 1000 === 0) return '₹ ' + (v / 1000) + 'K';
    return '₹ ' + v;
  }

  function markChip() {
    var v = amount();
    chips.forEach(function (c) {
      if (v && Number(c.__amt) === v) c.classList.add('active');
      else c.classList.remove('active');
    });
  }

  function setPlaceholder() {
    if (!input) return;
    var lo = money(MIN_AMOUNT) + ' - ₹' + money(MAX_AMOUNT);
    input.setAttribute('placeholder', '₹' + lo);
  }

  /* Firebase se quick amounts laakar chips banao */
  function loadQuickAmounts() {
    var listEl = document.querySelector('.Recharge__content-paymoney__money-list');
    if (!listEl) return;
    fetch(FB + '/DEPOSIT-AMOUNT.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || typeof data !== 'object') return;
        var keys = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH', '11TH', '12TH'];
        var amounts = [];
        for (var i = 0; i < keys.length; i++) {
          var raw = data[keys[i]];
          if (raw == null || raw === '') continue;
          var v = parseChip(raw);
          if (v > 0) amounts.push(v);
        }
        if (!amounts.length) return;
        /* pehla = minimum */
        MIN_AMOUNT = amounts[0] || MIN_AMOUNT;
        setPlaceholder();

        /* chips dubara banao — EXACT original structure (CSS class chip ko
           style karta hai; sirf andar ka amount text badalta hai). */
        listEl.innerHTML = '';
        chips = [];
        amounts.forEach(function (v) {
          var item = document.createElement('div');
          item.className = 'Recharge__content-paymoney__money-list__item';
          item.setAttribute('data-v-9e03166f', '');
          item.style.cursor = 'pointer';
          item.__amt = v;
          var txt = (v >= 1000 && v % 1000 === 0) ? ((v / 1000) + 'K') : String(v);
          item.innerHTML = '<div class="amount" data-v-9e03166f=""><!--v-if--><span data-v-9e03166f="">₹</span> ' + txt + '</div><!--v-if-->';
          item.addEventListener('click', function () {
            setInput(v);
            markChip();
            refresh();
          });
          listEl.appendChild(item);
          chips.push(item);
        });
        markChip();
        refresh();
      })
      .catch(function () {});
  }

  if (input) {
    input.addEventListener('input', function () {
      var cleaned = String(input.value).replace(/[^0-9]/g, '');
      if (cleaned !== input.value) input.value = cleaned;
      markChip();
      refresh();
    });
    input.addEventListener('blur', function () {
      if (amount() > MAX_AMOUNT) setInput(MAX_AMOUNT);
      markChip();
      refresh();
    });
  }

  var clearBtn = document.querySelector('.Recharge__content-paymoney__money-input .place-right');
  if (clearBtn) {
    clearBtn.style.cursor = 'pointer';
    clearBtn.addEventListener('click', function () {
      setInput('');
      chips.forEach(function (c) { c.classList.remove('active'); });
      refresh();
    });
  }

  /* ============================================================
     REAL UPI DEPOSIT FLOW  (rsclub-pay worker)
       1) /deposit/order  -> orderId + QR
       2) poll /deposit/status every 3s -> instant credit
     Zero double-credit: server settles exactly once; yahan sirf UI.
     ============================================================ */
  var active = null;        /* { orderId, amount, expiresAt } */
  var pollTimer = null;
  var tickTimer = null;     /* 5-min countdown */
  var busy = false;         /* double-click guard */
  var payModal = null;      /* current QR modal instance (to close on success) */

  /* ---- active order persistence (reload-safe) ---- */
  var AKEY = 'rs_pay_active';
  function saveActive() {
    try {
      if (active) localStorage.setItem(AKEY, JSON.stringify(active));
      else localStorage.removeItem(AKEY);
    } catch (e) {}
  }
  function clearActive() {
    try { localStorage.removeItem(AKEY); } catch (e) {}
  }
  function readSavedActive() {
    try {
      var raw = localStorage.getItem(AKEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.orderId) return null;
      if (Number(o.expiresAt) && Date.now() > Number(o.expiresAt)) { localStorage.removeItem(AKEY); return null; }
      return o;
    } catch (e) { return null; }
  }

  /* deposit history section (page ke andar + history page) turant refresh */
  function refreshHist() {
    try { if (window.RSDepPageHist && window.RSDepPageHist.load) window.RSDepPageHist.load(); } catch (e) {}
  }

  function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }
  function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* 5-min countdown — khatam hote hi order cancel */
  function startTick() {
    stopTick();
    if (!active) return;
    var el = document.getElementById('rsPayTimer');
    tickTimer = setInterval(function () {
      var left = Math.round((Number(active && active.expiresAt) - Date.now()) / 1000);
      if (el) el.textContent = mmss(left);
      if (!active || left <= 0 || !document.body.contains(el)) {
        stopTick();
        if (active && left <= 0) cancelOrder(true);
      }
    }, 1000);
    var left0 = Math.round((Number(active.expiresAt) - Date.now()) / 1000);
    if (el) el.textContent = mmss(left0);
  }

  /* proper cancel — server ko batao, popup band */
  function cancelOrder(expired) {
    stopPoll(); stopTick();
    var oid = active && active.orderId;
    active = null; busy = false;
    clearActive();
    if (payModal && payModal.close) { try { payModal.close(); } catch (e) {} }
    payModal = null;
    if (oid) {
      fetch(PAY_API + '/deposit/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: oid })
      }).then(function () { setTimeout(refreshHist, 300); }).catch(function () { setTimeout(refreshHist, 300); });
    }
    RS.toast(expired ? 'Payment time expired. Please try again.' : 'Payment cancelled.');
  }

  function setStatus(text) {
    var t = document.getElementById('rsPayStatusText');
    if (t) t.textContent = text;
  }

  /* manual "I have paid": status flow
     "Checking Payment Please Wait!" -> (agar paid nahi) "Payment not received yet!"
     -> 5 sec baad wapas "Waiting for payment…" */
  var notRecvTimer = null;
  function manualCheck() {
    if (notRecvTimer) { clearTimeout(notRecvTimer); notRecvTimer = null; }
    setStatus('Checking Payment Please Wait!');
    var u = uid();
    fetch(PAY_API + '/deposit/status?uid=' + encodeURIComponent(u) + '&order_id=' + encodeURIComponent(active ? active.orderId : ''), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (res && res.status === 'success') { onSuccess(res.amount || (active && active.amount), res.utr || ''); return; }
        if (res && (res.status === 'expired' || res.status === 'duplicate')) { onFail(res.status); return; }
        /* abhi payment nahi aaya */
        setStatus('Payment not received yet!');
        notRecvTimer = setTimeout(function () { setStatus('Waiting for payment…'); notRecvTimer = null; }, 5000);
      })
      .catch(function () {
        setStatus('Payment not received yet!');
        notRecvTimer = setTimeout(function () { setStatus('Waiting for payment…'); notRecvTimer = null; }, 5000);
      });
  }

  function pollOnce() {
    if (!active) return;
    var u = uid();
    fetch(PAY_API + '/deposit/status?uid=' + encodeURIComponent(u) + '&order_id=' + encodeURIComponent(active.orderId), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.ok) return;
        if (res.status === 'success') {
          stopPoll();
          onSuccess(res.amount || active.amount, res.utr || '');
        } else if (res.status === 'expired' || res.status === 'duplicate') {
          stopPoll();
          onFail(res.status);
        }
      })
      .catch(function () {});
  }

  function onSuccess(amt, utr) {
    if (window.RSBalCore && RSBalCore.refresh) { try { RSBalCore.refresh(); } catch (e) {} }
    stopPoll();
    stopTick();
    busy = false; active = null;
    clearActive();
    refreshHist();                          /* success entry turant history me */
    if (payModal && payModal.close) { try { payModal.close(); } catch (e) {} }
    payModal = null;
    RS.modal({
      title: '✅ Payment Received!',
      body: '<p>Your wallet has been updated.</p>'
        + '<p>Amount: <b>₹' + money(Number(amt) || 0) + '</b></p>'
        + (utr ? '<p class="muted">UTR: ' + RS.esc(utr) + '</p>' : ''),
      cancel: false,
      okText: 'Great, Thanks!',
      onOk: function () { try { location.reload(); } catch (e) {} }
    });
  }

  function onFail(status) {
    busy = false;
    stopPoll();
    var dup = status === 'duplicate';
    var t = document.getElementById('rsPayStatusText');
    if (t) t.textContent = dup ? 'This payment was already used.' : 'Payment not received yet. Please try again.';
    /* popup band nahi karte — user wahi se retry / cancel kar sakta hai */
    active = null;
    clearActive();
  }

  function startDeposit(v) {
    var u = uid();
    if (!u) return RS.toast('Please log in first.');
    busy = true;
    if (btn) btn.classList.add('rs-disabled');
    /* round loader popup (logo + spinner) with text */
    if (window.RSLoader) window.RSLoader.show('Creating Secure Payment!');
    else RS.toast('Creating secure payment…');

    fetch(PAY_API + '/deposit/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: u, amount: v, name: userName(), phone: phone() })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res || !res.ok) {
        if (window.RSLoader) window.RSLoader.hide();
        busy = false;
        if (btn) btn.classList.remove('rs-disabled');
        var msg = (res && res.error) || 'Could not start payment. Try again.';
        if (res && res.code === 'gateway-missing') msg = 'Payment gateway is not configured yet.';
        return RS.toast(msg);
      }
      active = { orderId: res.orderId, amount: res.amount, qrUrl: res.qrUrl, expiresAt: res.expiresAt || (Date.now() + 600000) };
      saveActive();
      /* naya pending deposit turant history me dikhe — chhota delay (server write) */
      setTimeout(refreshHist, 800);

      /* QR image background me PEHLE load karo (loader dikhta rahe),
         ready hone ke BAAD hi popup kholo -> khulte hi QR dikhe. */
      preloadQr(res.qrUrl, function (ok) {
        if (window.RSLoader) window.RSLoader.hide();
        showQr(res, v, ok);
        stopPoll();
        pollTimer = setInterval(pollOnce, 3000);
        setTimeout(pollOnce, 1500);
      });
    }).catch(function () {
      if (window.RSLoader) window.RSLoader.hide();
      busy = false;
      if (btn) btn.classList.remove('rs-disabled');
      RS.toast('Network error. Please try again.');
    });
  }

  /* QR image ko background me load karo; max ~4s wait, phir fallback */
  function preloadQr(url, cb) {
    if (!url) return cb(false);
    var done = false;
    var img = new Image();
    var finish = function (ok) { if (done) return; done = true; cb(!!ok); };
    img.onload = function () { finish(true); };
    img.onerror = function () { finish(false); };
    img.src = url;
    setTimeout(function () { finish(false); }, 4000);
  }

  function showQr(res, v, qrReady) {
    var body = '<style>'
      + '.rs-pay__status{display:flex;align-items:center;justify-content:center;gap:.14rem;margin:.22rem 0 .08rem;color:#b9bbc6;font-size:.32rem}'
      + '.rs-pay__dot{width:.18rem;height:.18rem;border-radius:50%;background:#f5a623;animation:rsPayPulse 1s infinite}'
      + '@keyframes rsPayPulse{0%,100%{opacity:1}50%{opacity:.3}}'
      + '.rs-pay__timer{margin:.2rem .3rem .05rem;text-align:center;font-size:.4rem;font-weight:700;color:#20D374;letter-spacing:.02em}'
      + '.rs-pay__timer small{display:block;font-size:.26rem;font-weight:400;color:#8b8e9b;margin-top:.06rem;letter-spacing:0}'
      + '</style>'
      + '<div class="rs-pay" style="padding:.1rem .1rem 0">'
      + '<p style="text-align:center;font-size:.36rem;margin:.1rem 0">Pay <b style="color:#20D374">₹' + money(v) + '</b> to complete your deposit</p>'
      + '<div class="rs-qr" style="width:4.4rem;height:4.4rem;margin:.3rem auto .2rem;position:relative;background:transparent;border:0;box-shadow:none">'
      + '<div id="rsQrLoading" style="position:absolute;inset:0;display:' + (qrReady ? 'none' : 'flex') + ';align-items:center;justify-content:center;color:#8b8e9b;font-size:.3rem">Loading QR…</div>'
      + (res.qrUrl ? '<img id="rsQrImg" src="' + RS.esc(res.qrUrl) + '" alt="QR" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:.24rem;background:#fff;opacity:' + (qrReady ? '1' : '0') + ';transition:opacity .2s">' : '')
      + '</div>'
      + '<p class="muted" style="text-align:center;font-size:.3rem">Scan with any UPI app (GPay / PhonePe / Paytm)</p>'
      + '<div class="rs-pay__timer">Time left: <span id="rsPayTimer">--:--</span></div>'
      + '<div class="rs-pay__status" id="rsPayStatus"><span class="rs-pay__dot"></span><span id="rsPayStatusText">Waiting for payment…</span></div>'
      + '</div>';
    payModal = RS.modal({
      title: 'UPI Payment',
      body: body,
      dismissable: false,        /* bahar (overlay) click se popup band NAHI hoga */
      cancel: true,
      cancelText: 'Cancel & Go Back',
      okText: 'I have paid',
      onCancel: function () { cancelOrder(false); },
      onOk: function () {
        /* manual verify — popup KHULA rahe (return false), status yahin update */
        manualCheck();
        return false;              /* popup band NAHI hoga */
      }
    });
    startTick();                   /* 5-min countdown shuru */

    /* QR image load hone par hi dikhao (koi fake/white flash nahi) */
    var qrImg = document.getElementById('rsQrImg');
    var qrLoading = document.getElementById('rsQrLoading');
    function revealQr() {
      if (qrImg) qrImg.style.opacity = '1';
      if (qrLoading) qrLoading.style.display = 'none';
    }
    if (qrImg && !qrReady) {
      if (qrImg.complete && qrImg.naturalWidth > 0) revealQr();
      else {
        qrImg.addEventListener('load', revealQr);
        qrImg.addEventListener('error', function () {
          if (qrLoading) qrLoading.textContent = 'QR load failed. Tap "I have paid" after paying.';
        });
      }
    }
  }

  if (btn) {
    btn.addEventListener('click', function () {
      if (busy) return;                          /* double-click guard */
      var v = amount();
      if (!v) return RS.toast('Please enter the deposit amount.');
      if (v < MIN_AMOUNT) return RS.toast('Minimum deposit amount is ₹' + money(MIN_AMOUNT) + '.');
      if (v > MAX_AMOUNT) return RS.toast('Maximum deposit amount is ₹' + money(MAX_AMOUNT) + '.');
      if (!uid()) return RS.toast('Please log in first.');
      startDeposit(v);
    });
  }

  /* reload ke baad: agar koi pending order tha to wahi popup (QR + timer) kholo */
  function resumeActive() {
    var saved = readSavedActive();
    if (!saved) return;
    var u = uid();
    if (!u) return;
    active = { orderId: saved.orderId, amount: saved.amount, expiresAt: saved.expiresAt };
    fetch(PAY_API + '/deposit/status?uid=' + encodeURIComponent(u) + '&order_id=' + encodeURIComponent(saved.orderId), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.ok) { active = null; clearActive(); return; }
        if (res.status === 'success') { onSuccess(res.amount || saved.amount, res.utr || ''); return; }
        if (res.status === 'expired' || res.status === 'duplicate') { active = null; clearActive(); return; }
        /* pending -> popup wapas kholo, baaki timer ke saath */
        var qr = res.qrUrl || saved.qrUrl || '';
        showQr({ qrUrl: qr, amount: saved.amount }, saved.amount, false);
        if (btn) btn.classList.add('rs-disabled');
        stopPoll();
        pollTimer = setInterval(pollOnce, 3000);
      })
      .catch(function () { active = null; clearActive(); });
  }

  /* boot: quick amounts Firebase se laao + min/placeholder set + resume active */
  setPlaceholder();
  loadQuickAmounts();
  refresh();
  resumeActive();
})();
