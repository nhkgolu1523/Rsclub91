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
    + 'align-items:center;justify-content:center;padding:.5rem;opacity:0;transition:opacity .18s}'
    + '.rs-overlay.show{opacity:1}'
    + '.rs-modal{width:100%;max-width:8.4rem;box-sizing:border-box;background:#1b1c23;color:#fff;'
    + 'border:1px solid rgba(255,255,255,.08);border-radius:.28rem;padding:.44rem .4rem .36rem;'
    + 'box-shadow:0 .2rem .8rem rgba(0,0,0,.55);transform:translateY(.2rem) scale(.98);transition:transform .18s}'
    + '.rs-overlay.show .rs-modal{transform:none}'
    + '.rs-modal h3{font-size:.42rem;font-weight:700;margin:0 0 .26rem;text-align:center;color:#fff}'
    + '.rs-modal p{font-size:.31rem;line-height:1.6;color:#b9bbc6;margin:.12rem 0}'
    + '.rs-modal b{color:#fff;font-weight:700}'
    + '.rs-modal .muted{color:#8b8e9b;font-size:.27rem}'
    + '.rs-input{width:100%;box-sizing:border-box;height:.92rem;margin:.26rem 0 .1rem;border-radius:.16rem;'
    + 'border:1px solid rgba(255,255,255,.16);background:#111217;color:#fff;font-size:.36rem;padding:0 .28rem;outline:none}'
    + '.rs-input:focus{border-color:#3ddc84}'
    + '.rs-btns{display:flex;gap:.24rem;margin-top:.36rem}'
    + '.rs-btns button{flex:1;height:.92rem;border:0;border-radius:.16rem;font-size:.36rem;font-weight:700;'
    + 'background:#2a2c35;color:#e8e9ee;cursor:pointer}'
    + '.rs-btns button.primary{background:linear-gradient(90deg,#b6f000,#22c55e);color:#10130d}'
    + '.rs-empty{padding:.5rem 0 .3rem;text-align:center;color:#8b8e9b;font-size:.32rem}'
    + '.rs-qr{width:3.2rem;height:3.2rem;margin:.3rem auto .1rem;border-radius:.2rem;'
    + 'background:#fff url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNyAyNyIgc2hhcGUtcmVuZGVyaW5nPSJjcmlzcEVkZ2VzIj48cmVjdCB3aWR0aD0iMjciIGhlaWdodD0iMjciIGZpbGw9IiNmZmYiLz48ZyBmaWxsPSIjMTExIj48cmVjdCB4PSIxMCIgeT0iMSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEyIiB5PSIxIiB3aWR0aD0iNCIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjciIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEzIiB5PSIyIiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTgiIHk9IjIiIHdpZHRoPSI3IiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iOCIgeT0iMyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjExIiB5PSIzIiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTYiIHk9IjMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxOCIgeT0iMyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjI0IiB5PSIzIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMiIgeT0iNCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI4IiB5PSI0IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTAiIHk9IjQiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNSIgeT0iNCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE4IiB5PSI0IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMjAiIHk9IjQiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyNCIgeT0iNCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIiIHk9IjUiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI0IiB5PSI1IiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iOCIgeT0iNSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjExIiB5PSI1IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTUiIHk9IjUiIHdpZHRoPSI0IiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMCIgeT0iNSIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjI0IiB5PSI1IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMiIgeT0iNiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjQiIHk9IjYiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI4IiB5PSI2IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTAiIHk9IjYiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNCIgeT0iNiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE2IiB5PSI2IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTgiIHk9IjYiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMCIgeT0iNiIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjI0IiB5PSI2IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMiIgeT0iNyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjgiIHk9IjciIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNiIgeT0iNyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE4IiB5PSI3IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMjQiIHk9IjciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyIiB5PSI4IiB3aWR0aD0iNyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTEiIHk9IjgiIHdpZHRoPSI2IiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxOCIgeT0iOCIgd2lkdGg9IjciIGhlaWdodD0iMSIvPjxyZWN0IHg9IjciIHk9IjkiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxMiIgeT0iOSIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE1IiB5PSI5IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNiIgeT0iMTAiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxMyIgeT0iMTAiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNSIgeT0iMTAiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNyIgeT0iMTAiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxOSIgeT0iMTAiIHdpZHRoPSIyIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIzIiB5PSIxMSIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjciIHk9IjExIiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTIiIHk9IjExIiB3aWR0aD0iMiIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTUiIHk9IjExIiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMjIiIHk9IjExIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMjQiIHk9IjExIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNSIgeT0iMTIiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI3IiB5PSIxMiIgd2lkdGg9IjQiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE4IiB5PSIxMiIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIxIiB5PSIxMiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIzIiB5PSIxMiIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjMiIHk9IjEzIiB3aWR0aD0iMiIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNiIgeT0iMTMiIHdpZHRoPSIyIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNCIgeT0iMTMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMCIgeT0iMTMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMiIgeT0iMTMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyNCIgeT0iMTMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxIiB5PSIxNCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjYiIHk9IjE0IiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTEiIHk9IjE0IiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTciIHk9IjE0IiB3aWR0aD0iNyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNCIgeT0iMTUiIHdpZHRoPSI1IiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxMCIgeT0iMTUiIHdpZHRoPSIyIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNyIgeT0iMTUiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMCIgeT0iMTUiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyNSIgeT0iMTUiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxIiB5PSIxNiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjQiIHk9IjE2IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNiIgeT0iMTYiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNiIgeT0iMTYiIHdpZHRoPSIyIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMiIgeT0iMTYiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyNCIgeT0iMTYiIHdpZHRoPSIyIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyIiB5PSIxNyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjQiIHk9IjE3IiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNiIgeT0iMTciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI4IiB5PSIxNyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEwIiB5PSIxNyIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE5IiB5PSIxNyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIyIiB5PSIxNyIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIiIHk9IjE4IiB3aWR0aD0iNyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTIiIHk9IjE4IiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMTYiIHk9IjE4IiB3aWR0aD0iNCIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMjIiIHk9IjE4IiB3aWR0aD0iMyIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iMiIgeT0iMTkiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI4IiB5PSIxOSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEwIiB5PSIxOSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEyIiB5PSIxOSIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE2IiB5PSIxOSIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIwIiB5PSIxOSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIyIiB5PSIxOSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjI0IiB5PSIxOSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIiIHk9IjIwIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNCIgeT0iMjAiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI4IiB5PSIyMCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEwIiB5PSIyMCIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE0IiB5PSIyMCIgd2lkdGg9IjciIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIyIiB5PSIyMCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjI0IiB5PSIyMCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIiIHk9IjIxIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNCIgeT0iMjEiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI4IiB5PSIyMSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEwIiB5PSIyMSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE2IiB5PSIyMSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjI1IiB5PSIyMSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIiIHk9IjIyIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iNCIgeT0iMjIiIHdpZHRoPSIzIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSI4IiB5PSIyMiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEwIiB5PSIyMiIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE2IiB5PSIyMiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE5IiB5PSIyMiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIyIiB5PSIyMiIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjI1IiB5PSIyMiIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIiIHk9IjIzIiB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+PHJlY3QgeD0iOCIgeT0iMjMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxMCIgeT0iMjMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxMiIgeT0iMjMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNCIgeT0iMjMiIHdpZHRoPSIyIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIxNyIgeT0iMjMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMCIgeT0iMjMiIHdpZHRoPSIyIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyMyIgeT0iMjMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyNSIgeT0iMjMiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48cmVjdCB4PSIyIiB5PSIyNCIgd2lkdGg9IjciIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEwIiB5PSIyNCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE1IiB5PSIyNCIgd2lkdGg9IjIiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE4IiB5PSIyNCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIxIiB5PSIyNCIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIzIiB5PSIyNCIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjEwIiB5PSIyNSIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjE0IiB5PSIyNSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIxIiB5PSIyNSIgd2lkdGg9IjEiIGhlaWdodD0iMSIvPjxyZWN0IHg9IjIzIiB5PSIyNSIgd2lkdGg9IjMiIGhlaWdodD0iMSIvPjwvZz48L3N2Zz4=") center/86% 86% no-repeat;'
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
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    return { el: m, close: close };
  };

  window.RS = RS;
  injectCSS();
})();
