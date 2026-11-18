/* ============================================================================
   WITHDRAW BALANCE  --  assets/js/withdraw-balance.js
   ----------------------------------------------------------------------------
   Withdraw page par balance har jagah live dikhata hai (RSBalCore se):
     * .balanceAssets__main > p            (Available balance)
     * h6.yellow                           (Withdrawable balance)
     * span.yellow                         (Withdrawal amount received)
     * input[value="All"]                  (max -> amount input)
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSWdBal) return;
  window.__RSWdBal = true;

  function money(n) { return '\u20B9' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function fill() {
    var v = 0;
    try { if (window.RSBalCore && RSBalCore.value) v = RSBalCore.value(); } catch (e) {}
    var txt = money(v);

    var p = document.querySelector('.balanceAssets__main p');
    if (p) p.textContent = txt;

    var h6 = document.querySelector('h6.yellow');
    if (h6) h6.textContent = txt;

    var all = document.querySelectorAll('span.yellow');
    for (var i = 0; i < all.length; i++) all[i].textContent = txt;

    /* "All" button ko live balance se bandho (agar page script ne na kiya ho) */
    var allBtn = document.querySelector('input[type="button"][value="All"]');
    if (allBtn && !allBtn.__rsBound) {
      allBtn.__rsBound = true;
      allBtn.addEventListener('click', function () {
        var input = document.querySelector('.explain:not(.usdt) .input .inp')
          || document.querySelector('.Recharge__content-paymoney .van-field__control');
        if (input) {
          input.value = String(Math.floor(v));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
  }

  /* balance refresh par "Refresh successfully" popup (original app jaisa).
     VUI.toast -> RS.toast -> apna fallback toast. */
  function refreshToast() {
    var msg = 'Refresh successfully';
    try { if (window.VUI && VUI.toast) { VUI.toast(msg, 2000); return; } } catch (e) {}
    try { if (window.RS && RS.toast) { RS.toast(msg); return; } } catch (e) {}
    var id = 'rsBalToast';
    var old = document.getElementById(id);
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!document.getElementById('rsBalToastCss')) {
      var st = document.createElement('style');
      st.id = 'rsBalToastCss';
      st.textContent = '#' + id + '{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100001;'
        + 'background:rgba(30,30,36,.92);color:#fff;font-size:.34rem;padding:.22rem .4rem;border-radius:.34rem;'
        + 'max-width:78%;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none}'
        + '#' + id + '.show{opacity:1}';
      (document.head || document.documentElement).appendChild(st);
    }
    var el = document.createElement('div');
    el.id = id;
    el.textContent = msg;
    document.body.appendChild(el);
    var raf = window.requestAnimationFrame || function (fn) { setTimeout(fn, 16); };
    raf(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 2000);
  }

  function bindRefreshIcon() {
    var img = document.querySelector('.balanceAssets__main img[src*="27c21640bdff"]');
    if (!img || img.__rsRefreshBound) return;
    img.__rsRefreshBound = true;
    img.style.cursor = 'pointer';
    img.addEventListener('click', function () {
      try { if (window.RSBalCore && RSBalCore.refresh) RSBalCore.refresh(); } catch (e) {}
      fill();
      refreshToast();
    });
  }

  function boot() {
    fill();
    bindRefreshIcon();
    if (window.RSBalCore && RSBalCore.on) {
      try { RSBalCore.on(fill); } catch (e) {}
    }
    if (window.RSBalCore && RSBalCore.refresh) { try { RSBalCore.refresh(); } catch (e) {} }
    setTimeout(fill, 800);
    setTimeout(fill, 2000);
    setInterval(fill, 3000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.RSWdBal = { fill: fill, bindRefreshIcon: bindRefreshIcon };
})();
