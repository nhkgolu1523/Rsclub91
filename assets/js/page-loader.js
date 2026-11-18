/* ============================================================================
   PAGE LOADER  (assets/js/page-loader.js)
   ----------------------------------------------------------------------------
   Har page par:
     * page khulte hi (jab tak content ready na ho) loader dikhata hai
     * kisi internal link / back button par click karte hi TURANT loader
       dikhata hai (user ko "stuck" feel nahi hota)
     * naya page load hote hi loader hat jata hai

   Visual: wahi popup jo feedback submit par dikhta hai (logo + spinner).
   UI / design me koi change nahi — sirf overlay.
   ========================================================================== */
(function () {
  'use strict';
  if (window.RSPageLoader) return;

  var ROOT_ID = 'rsLoaderOverlay';
  var STYLE_ID = 'rs-loader-style';
  var MIN_SHOW = 350;      /* itne ms se kam dikha to jerk lagega -> itna dikhao */
  var shownAt = 0;
  var hideTimer = null;

  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = ''
      + '#' + ROOT_ID + '{position:fixed;inset:0;z-index:100002;display:none;align-items:center;justify-content:center;background:rgba(10,10,14,.72);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);}'
      + '#' + ROOT_ID + '.rs-loader--show{display:flex;}'
      + '#' + ROOT_ID + ' .rs-loader-container{position:relative;width:110px;height:110px;display:flex;align-items:center;justify-content:center;}'
      + '#' + ROOT_ID + ' .rs-loader-spinner{position:absolute;width:100%;height:100%;animation:rs-loader-spin 1.2s linear infinite;}'
      + '#' + ROOT_ID + ' .rs-loader-circle{fill:none;stroke:#8a8a8a;stroke-width:3;stroke-linecap:round;stroke-dasharray:210 90;stroke-dashoffset:0;}'
      + '#' + ROOT_ID + ' .rs-loader-logo{z-index:10;width:85%;height:85%;object-fit:contain;}'
      + '#' + ROOT_ID + ' .rs-loader-text{position:absolute;left:50%;top:calc(100% + .22rem);transform:translateX(-50%);color:#e8e9ee;font-size:.34rem;font-weight:600;white-space:nowrap;text-align:center;}'
      + '@keyframes rs-loader-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function logoPath() {
    var s = document.querySelector('script[src*="page-loader.js"]') || document.querySelector('script[src*="loader.js"]');
    if (s) {
      var src = s.getAttribute('src') || '';
      var base = src.replace(/[^/]*$/, '');
      if (base) return base.replace(/js\/$/, 'images/') + 'logo-rsclub91.png';
    }
    return '/assets/images/logo-rsclub91.png';
  }

  function ensure() {
    var el = document.getElementById(ROOT_ID);
    if (el) return el;
    injectCSS();
    var host = document.body || document.documentElement;
    if (!host) return null;
    el = document.createElement('div');
    el.id = ROOT_ID;
    el.innerHTML = ''
      + '<div class="rs-loader-container">'
      + '  <svg class="rs-loader-spinner" viewBox="0 0 100 100">'
      + '    <circle cx="50" cy="50" r="48" class="rs-loader-circle"></circle>'
      + '  </svg>'
      + '  <img class="rs-loader-logo" alt="Rsclub91 Logo" src="' + logoPath() + '">'
      + '  <div class="rs-loader-text"></div>'
      + '</div>';
    host.appendChild(el);
    return el;
  }

  function show(text) {
    var el = ensure();
    if (!el) {
      /* body abhi nahi -> DOMContentLoaded par dobara try */
      document.addEventListener('DOMContentLoaded', function () { show(text); });
      return;
    }
    var t = el.querySelector('.rs-loader-text');
    if (t) t.textContent = text ? String(text) : '';
    el.classList.add('rs-loader--show');
    shownAt = Date.now();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function hide() {
    var el = document.getElementById(ROOT_ID);
    if (!el) return;
    var wait = Math.max(0, MIN_SHOW - (Date.now() - shownAt));
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { el.classList.remove('rs-loader--show'); hideTimer = null; }, wait);
  }

  /* shared RSLoader object (jo feedback/deposit use karte hain) — same visual */
  window.RSLoader = window.RSLoader || {};
  if (!window.RSLoader.show) window.RSLoader.show = show;
  if (!window.RSLoader.hide) window.RSLoader.hide = hide;

  /* ---------- navigation loader: kisi bhi internal link/back par turant ---------- */
  var SKIP = 'a[target="_blank"],[download],[data-no-loader],.no-loader';

  function sameInternal(href) {
    if (!href) return false;
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) return false;
    try {
      var u = new URL(href, location.href);
      return u.origin === location.origin;
    } catch (e) { return false; }
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
    if (t.closest(SKIP)) return;

    var a = t.closest('a[href]');
    if (a && sameInternal(a.getAttribute('href'))) {
      var href = a.getAttribute('href');
      var u; try { u = new URL(href, location.href); } catch (err) { u = null; }
      /* in-page anchor (same path + hash) -> loader nahi */
      if (u && u.pathname === location.pathname && u.search === location.search && u.hash) return;
      show('');
      return;
    }

    /* back buttons (design navbar arrows) */
    if (t.closest('.van-icon-arrow-left') || t.closest('.navbar__content-left')) {
      show('');
    }
  }, false);

  /* ---------- page ready hone par loader hatao ---------- */
  function ready() { setTimeout(hide, 60); }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready);
  document.addEventListener('DOMContentLoaded', function () { setTimeout(hide, 400); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) hide(); });

  window.RSPageLoader = { show: show, hide: hide };

  /* ---------- initial page load: turant loader dikhao (content ready tak) ----------
     Design pages me content (JS/CSS render) thoda late aata hai -> user ko
     blank/"stuck" feel na ho. Loader content ready hone par hide ho jata hai. */
  try {
    if (document.readyState !== 'complete') {
      show('');
      /* safety: 8 sec baad har haal me hata do (kabhi atka na rahe) */
      setTimeout(function () { var el = document.getElementById(ROOT_ID); if (el) el.classList.remove('rs-loader--show'); }, 8000);
    }
  } catch (e) {}
})();
