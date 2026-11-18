/* ============================================================================
   subpage.js --- shared helpers for the account sub-pages
   (wallet / deposit / withdraw / vip). The original Veer.Game bundle is not
   part of the scrape, so these pages get their interactions from here.
   Provides: session guard, back navigation, centred toast, and a modal built
   in the site's own dark + green style.
   ========================================================================== */
(function () {
  'use strict';
  if (window.RS) return;

  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var RS = {};

  function store(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  RS.get = store;
  RS.uid = function () { return store('rsclub_uid') || ''; };
  RS.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* Redirect to the given page when there is no logged-in UID. */
  RS.guard = function (fallback) {
    if (!RS.uid()) { location.replace(fallback || '../home/index.html'); return false; }
    return true;
  };

  RS.back = function (fallback) {
    var ref = '';
    try { ref = document.referrer || ''; } catch (e) {}
    if (ref && ref.indexOf(location.origin + '/') === 0 && history.length > 1) history.back();
    else location.href = fallback || '../account/index.html';
  };

  /* Display name = cached profile name, else Firebase USERS/<uid>/PROFILE/USERNAME,
     else MEMBER+first4. A locally edited nickname must win over the remote copy. */
  RS.username = function (cb) {
    var uid = RS.uid();
    var fallback = 'MEMBER' + String(uid).slice(0, 4);
    var cached = store('rsclub_username');
    if (cached) { cb(cached); return; }
    if (!uid) { cb(fallback); return; }
    fetch(FB + '/USERS/' + uid + '/PROFILE/USERNAME.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (name) {
        var v = name ? String(name) : fallback;
        try { localStorage.setItem('rsclub_username', v); } catch (e) {}
        cb(v);
      })
      .catch(function () { cb(fallback); });
  };

  /* ------------------------------------------------------------------ CSS */
  var css = ''
    + '.rs-toast{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100001;'
    + 'background:rgba(24,25,31,.96);color:#fff;font-size:.34rem;line-height:1.45;padding:.26rem .46rem;'
    + 'border-radius:.4rem;max-width:78%;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none;'
    + 'box-shadow:0 .08rem .5rem rgba(0,0,0,.45)}'
    + '.rs-toast.show{opacity:1}'
    + '.rs-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.6);display:flex;'
    + 'align-items:center;justify-content:center;padding:.28rem;opacity:0;transition:opacity .18s}'
    + '.rs-overlay.show{opacity:1}'
    + '.rs-modal{width:100%;max-width:9.2rem;box-sizing:border-box;background:#1b1c23;color:#fff;'
    + 'border:1px solid rgba(255,255,255,.08);border-radius:.32rem;padding:.5rem .46rem .42rem;'
    + 'box-shadow:0 .2rem .8rem rgba(0,0,0,.55);transform:translateY(.2rem) scale(.98);transition:transform .18s;'
    + 'max-height:calc(100vh - .56rem);overflow-y:auto}'
    + '.rs-overlay.show .rs-modal{transform:none}'
    + '.rs-modal h3{font-size:.46rem;font-weight:700;margin:0 0 .3rem;text-align:center;color:#fff}'
    + '.rs-modal p{font-size:.32rem;line-height:1.6;color:#b9bbc6;margin:.12rem 0}'
    + '.rs-modal b{color:#fff;font-weight:700}'
    + '.rs-modal .muted{color:#8b8e9b;font-size:.28rem}'
    + '.rs-input{width:100%;box-sizing:border-box;height:.92rem;margin:.26rem 0 .1rem;border-radius:.16rem;'
    + 'border:1px solid rgba(255,255,255,.16);background:#111217;color:#fff;font-size:.36rem;padding:0 .28rem;outline:none}'
    + '.rs-input:focus{border-color:#3ddc84}'
    + '.rs-btns{display:flex;gap:.24rem;margin-top:.4rem}'
    + '.rs-btns button{flex:1;height:1rem;border:0;border-radius:.2rem;font-size:.38rem;font-weight:700;'
    + 'background:#2a2c35;color:#e8e9ee;cursor:pointer}'
    + '.rs-btns button.primary{background:linear-gradient(90deg,#b6f000,#22c55e);color:#10130d}'
    + '.rs-empty{padding:.5rem 0 .3rem;text-align:center;color:#8b8e9b;font-size:.32rem}'
    + '.rs-qr{width:3.2rem;height:3.2rem;margin:.3rem auto .1rem;border-radius:.2rem;'
    + 'background:#fff;'
    + 'border:.12rem solid #fff;box-shadow:0 0 .2rem rgba(0,0,0,.35)}'
    + '.rs-rules{padding:.1rem 0}'
    + '.rs-rule{position:relative;padding-left:.34rem;margin:.22rem 0;font-size:.32rem;line-height:1.6;color:#c7c9d2}'
    + '.rs-rule:before{content:"";position:absolute;left:.06rem;top:.17rem;width:.12rem;height:.12rem;'
    + 'border-radius:50%;background:#22c55e}'
    + '.rs-chip-active{border-color:#22c55e!important;color:#22c55e!important}'
    + '.rs-deposit-active{background:linear-gradient(90deg,#b6f000,#22c55e)!important;'
    + 'color:#10130d!important;cursor:pointer!important}';

  function injectCSS() {
    if (document.getElementById('rs-ui-style')) return;
    var st = document.createElement('style');
    st.id = 'rs-ui-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  RS.injectCSS = injectCSS;

  var toastEl = null, toastTimer = null;
  RS.toast = function (msg) {
    injectCSS();
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'rs-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  };

  RS.modal = function (opt) {
    opt = opt || {};
    injectCSS();
    var ov = document.createElement('div');
    ov.className = 'rs-overlay';
    var m = document.createElement('div');
    m.className = 'rs-modal';
    var html = '';
    if (opt.title) html += '<h3>' + RS.esc(opt.title) + '</h3>';
    html += opt.body || '';
    html += '<div class="rs-btns">';
    if (opt.cancel !== false) html += '<button class="rs-cancel">' + RS.esc(opt.cancelText || 'Cancel') + '</button>';
    html += '<button class="primary rs-ok">' + RS.esc(opt.okText || 'Confirm') + '</button>';
    html += '</div>';
    m.innerHTML = html;
    ov.appendChild(m);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });

    function close() {
      ov.classList.remove('show');
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 200);
    }
    var ok = m.querySelector('.rs-ok');
    var cancel = m.querySelector('.rs-cancel');
    if (ok) ok.addEventListener('click', function () {
      if (opt.onOk && opt.onOk(m) === false) return;
      close();
    });
    if (cancel) cancel.addEventListener('click', function () {
      if (opt.onCancel) opt.onCancel();
      close();
    });
    ov.addEventListener('click', function (e) {
      /* overlay (bahar) click par band — sirf jab dismissable ho.
         Payment popup me dismissable:false -> bahar click se band nahi hoga. */
      if (opt.dismissable === false) return;
      if (e.target === ov) close();
    });
    return { el: m, close: close };
  };

  window.RS = RS;
  injectCSS();
})();
