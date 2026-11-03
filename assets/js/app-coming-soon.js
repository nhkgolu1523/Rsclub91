/* ============================================================================
   APP COMING SOON popup  --  assets/js/app-coming-soon.js
   ----------------------------------------------------------------------------
   Home page ke header ke "app / download" icon (.icon-btn jisme data:svg img
   hai) par click karne se "Mobile App Coming Soon" popup dikhata hai.
   Close (X) / overlay / Escape se band. Backend hooks: window.showComingSoon()
   / window.hideComingSoon().
   ========================================================================== */
(function () {
  'use strict';
  if (window.__rsAppComingSoon) return;
  window.__rsAppComingSoon = true;

  var CSS = [
    '.rs-cs-host{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:100002;padding:.3rem;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.rs-cs-host.rs-cs-open{display:flex}',
    '.rs-cs-overlay{position:absolute;inset:0;background:rgba(0,0,0,.72)}',
    '.rs-cs-content{position:relative;z-index:1;width:100%;max-width:10rem;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '.rs-cs-card{position:relative;width:min(8.6rem,100vw - .6rem);background:#25272A;border-radius:.4rem;padding:.55rem .48rem .48rem;text-align:center;overflow-x:hidden;overflow-y:auto;max-height:calc(100vh - 1.8rem);border:.01333rem solid rgba(32,211,116,.18);box-shadow:0 .3rem 1rem rgba(0,0,0,.5);animation:rsCsFade .28s ease-out}',
    '@keyframes rsCsFade{from{opacity:0}to{opacity:1}}',
    '.rs-cs-card::before{content:"";position:absolute;left:0;top:0;width:100%;height:2.6rem;background:linear-gradient(130deg,#C5BC0C 0%,#94B20B 33%,#20D374 66%,#0CBAC5 100%);opacity:.14;-webkit-mask-image:linear-gradient(180deg,#fff 0%,transparent 100%);mask-image:linear-gradient(180deg,#fff 0%,transparent 100%);pointer-events:none;z-index:0}',
    '.rs-cs-hero{position:relative;z-index:1;width:2.2rem;height:2.2rem;margin:0 auto .4rem;display:flex;align-items:center;justify-content:center}',
    '.rs-cs-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(circle,rgba(32,211,116,.2) 0%,transparent 65%);border-radius:50%;pointer-events:none}',
    '.rs-cs-phone{position:relative;z-index:2;width:1.4rem;height:1.95rem}',
    '.rs-cs-eyebrow{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:.22rem;margin-bottom:.24rem}',
    '.rs-cs-eyebrow-line{flex:1;height:.01333rem;max-width:.9rem;background:linear-gradient(90deg,transparent 0%,rgba(32,211,116,.6) 100%)}',
    '.rs-cs-eyebrow-line--r{background:linear-gradient(270deg,transparent 0%,rgba(32,211,116,.6) 100%)}',
    '.rs-cs-eyebrow-text{font-size:.26rem;font-weight:700;letter-spacing:.18rem;text-transform:uppercase;color:#20D374;padding-left:.18rem;white-space:nowrap}',
    '.rs-cs-title{position:relative;z-index:1;font-size:.5rem;font-weight:700;color:#FFFFFF;margin-bottom:.16rem;line-height:1.2}',
    '.rs-cs-desc{position:relative;z-index:1;font-size:.31rem;line-height:1.55;color:#D7D7D7;margin-bottom:.42rem;padding:0 .2rem}',
    '.rs-cs-desc strong{color:#20D374;font-weight:600}',
    '.rs-cs-cta{position:relative;z-index:1;display:block;width:100%;height:1.05rem;border:0;border-radius:.6rem;background:linear-gradient(130deg,#C5BC0C 0%,#94B20B 33%,#20D374 66%,#0CBAC5 100%);color:#1A1A2C;font-family:inherit;font-size:.4rem;font-weight:700;cursor:pointer;transition:transform .15s,opacity .2s;box-shadow:0 .08rem .4rem rgba(32,211,116,.24);margin-bottom:.28rem}',
    '.rs-cs-cta:active{transform:scale(.98)}',
    '.rs-cs-cta:disabled{opacity:.7;cursor:default;transform:none}',
    '.rs-cs-footer{position:relative;z-index:1;font-size:.27rem;color:#93939D;line-height:1.5;padding:0 .3rem}',
    '.rs-cs-footer strong{color:#D7D7D7;font-weight:600}',
    '.rs-cs-close{margin-top:.45rem;width:.85rem;height:.85rem;border-radius:50%;background:rgba(255,255,255,.08);border:.01333rem solid rgba(255,255,255,.18);color:#FFFFFF;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .15s;flex-shrink:0}',
    '.rs-cs-close:active{background:rgba(255,255,255,.2);transform:scale(.9)}',
    '.rs-cs-close svg{width:.38rem;height:.38rem}'
  ].join('');

  var PHONE_SVG = '<svg class="rs-cs-phone" viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><linearGradient id="rsCsPh" x1="50" y1="0" x2="50" y2="140" gradientUnits="userSpaceOnUse">'
    + '<stop stop-color="#C5BC0C"/><stop offset=".33" stop-color="#94B20B"/><stop offset=".66" stop-color="#20D374"/><stop offset="1" stop-color="#0CBAC5"/>'
    + '</linearGradient></defs>'
    + '<rect x="6" y="2" width="88" height="136" rx="14" fill="url(#rsCsPh)"/>'
    + '<rect x="12" y="10" width="76" height="120" rx="8" fill="#25272A"/>'
    + '<rect x="38" y="6" width="24" height="4" rx="2" fill="#25272A"/>'
    + '<circle cx="50" cy="62" r="16" fill="url(#rsCsPh)"/>'
    + '<path d="M45 62l4 4 8-8" stroke="#111217" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<rect x="26" y="88" width="48" height="5" rx="2.5" fill="#374963"/>'
    + '<rect x="32" y="98" width="36" height="5" rx="2.5" fill="#374963" opacity=".7"/>'
    + '<rect x="40" y="122" width="20" height="3" rx="1.5" fill="#374963"/></svg>';


  var HTML = '<div id="rsComingPopup" class="rs-cs-host" role="alertdialog" aria-modal="true">'
    + '<div class="rs-cs-overlay" id="rsComingOverlay"></div>'
    + '<div class="rs-cs-content">'
    + '<div class="rs-cs-card" role="document">'
    + '<div class="rs-cs-hero" aria-hidden="true">' + PHONE_SVG + '</div>'
    + '<div class="rs-cs-eyebrow" aria-hidden="true">'
    + '<span class="rs-cs-eyebrow-line"></span><span class="rs-cs-eyebrow-text">Coming Soon</span>'
    + '<span class="rs-cs-eyebrow-line rs-cs-eyebrow-line--r"></span></div>'
    + '<h2 class="rs-cs-title" id="rsComingTitle">Our Mobile App is on the Way</h2>'
    + '<p class="rs-cs-desc">Something big is coming. A faster, smarter and smoother way to play &mdash; <strong>right in your pocket.</strong> Stay tuned!</p>'
    + '<button type="button" class="rs-cs-cta" id="rsComingNotify">Notify Me When It Launches</button>'
    + '<p class="rs-cs-footer">Thanks for your patience. <strong>Great things take time.</strong></p>'
    + '</div>'
    + '<button type="button" class="rs-cs-close" id="rsComingClose" aria-label="Close">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
    + '</button></div></div>';

  function inject() {
    if (document.getElementById('rsComingPopup')) return;
    if (!document.getElementById('rs-cs-css')) {
      var style = document.createElement('style');
      style.id = 'rs-cs-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    document.body.appendChild(wrap.firstChild);

    var popup = document.getElementById('rsComingPopup');
    var overlay = document.getElementById('rsComingOverlay');
    var notifyBtn = document.getElementById('rsComingNotify');
    var closeBtn = document.getElementById('rsComingClose');

    function close() { popup.classList.remove('rs-cs-open'); }
    window.showComingSoon = function () { popup.classList.add('rs-cs-open'); };
    window.hideComingSoon = close;

    if (notifyBtn) notifyBtn.addEventListener('click', function () {
      notifyBtn.disabled = true;
      notifyBtn.textContent = '\u2713 You will be notified';
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* header ke "app / download" icon par click -> popup.
     NOTE: header me ek DOOSRA icon (customer chat/support) bhi hai jisme bhi
     base64 svg hai - usse chhodna hai. Download icon ko pehchan: uski svg me
     'clipPath' / '40.214' hota hai; chat icon me '#003B2C' / '25.9336' hota hai. */
  function isAppIcon(btn) {
    if (!btn || btn.classList.contains('rs-cs-bound')) return false;
    var img = btn.querySelector('img');
    if (!img) return false;
    var src = img.getAttribute('src') || '';
    if (!/data:image\/svg\+xml;base64/i.test(src)) return false;

    /* base64 decode karke svg content dekho (chat icon filter karne ke liye) */
    var b64 = src.replace(/^data:image\/svg\+xml;base64,/i, '').replace(/[\s\r\n]+/g, '');
    var svg = '';
    try { svg = atob(b64); } catch (e) { svg = ''; }
    if (svg) {
      /* download/app icon -> bind (clipPath / 40.214 = uske unique markers) */
      if (svg.indexOf('clipPath') >= 0 || svg.indexOf('40.214') >= 0) return true;
      /* customer chat/support icon -> skip (25.9336 = chat ke 3 dots) */
      if (svg.indexOf('25.9336') >= 0) return false;
    }
    /* decode na hua to purana behaviour: bind kar do */
    return true;
  }

  function bind() {
    var btns = document.querySelectorAll('.icon-btn');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!isAppIcon(b)) continue;
      b.classList.add('rs-cs-bound');
      b.style.cursor = 'pointer';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        inject();
        if (window.showComingSoon) window.showComingSoon();
      }, true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  bind();
  window.addEventListener('load', bind);
})();
