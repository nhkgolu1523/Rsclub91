/* ============================================================================
   TABBAR CENTER (wheel)  --  assets/js/tabbar-center.js
   ----------------------------------------------------------------------------
   Bottom navbar ke beech wale wheel icon (.tabbar__center) par click karne se
   "Coming soon" popup dikhata hai (jaise activity page me hota hai).
   Har us page par load hota hai jahan tabbar hai (home / account / promotion /
   activity / wallet).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__rsTabbarCenter) return;
  window.__rsTabbarCenter = true;

  /* apna toast CSS inject karo (har page par styled dikhe, chahe us page par
     design-page.css load ho ya na ho). */
  function injectCss() {
    if (document.getElementById('rs-tabbar-center-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-tabbar-center-css';
    st.textContent =
      '#rsTabbarToast{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:100001;'
      + 'background:rgba(30,30,36,.92);color:#fff;font-size:.36rem;padding:.24rem .42rem;border-radius:.4rem;'
      + 'max-width:78%;text-align:center;opacity:0;transition:opacity .2s;pointer-events:none}'
      + '#rsTabbarToast.rs-toast--show,#rsTabbarToast.show{opacity:1}';
    (document.head || document.documentElement).appendChild(st);
  }

  function toast(message) {
    injectCss();
    var old = document.getElementById('rsTabbarToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsTabbarToast';
    el.className = 'rs-toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('rs-toast--show', 'show'); });
    window.setTimeout(function () {
      el.classList.remove('rs-toast--show', 'show');
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 1600);
  }

  function bind() {
    var center = document.querySelector('.tabbar__center');
    if (!center || center.__rsCenterBound) return;
    center.__rsCenterBound = true;
    center.style.cursor = 'pointer';
    center.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toast('Coming soon');
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  /* tab-nav SPA swap ke baad naya tabbar aa sakta hai -> dobara bind.
     Observer sirf thodi der chalega (koi CPU loop nahi). */
  window.addEventListener('load', bind);
  if (typeof MutationObserver === 'function') {
    var scheduled = false;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; bind(); });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 10000);
  }
})();
