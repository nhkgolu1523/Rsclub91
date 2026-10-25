/* Small Vant-compatible UI helpers shared by the rebuilt wallet pages. */
(function () {
  'use strict';
  if (window.VUI) return;

  var VUI = {};

  VUI.toast = function (message, duration) {
    if (!message) return;
    var old = document.querySelector('.vui-toast');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var el = document.createElement('div');
    el.className = 'van-toast van-toast--text van-toast--middle vui-toast';
    el.style.cssText = 'position:fixed;left:50%;top:50%;z-index:30000;'
      + 'transform:translate(-50%,-50%);pointer-events:none;'
      + 'width:auto;min-width:0;min-height:0;max-width:78%;padding:.26rem .46rem;'
      + 'border-radius:.4rem;background:rgba(24,25,31,.96);color:#fff;'
      + 'font-size:.34rem;line-height:1.45;text-align:center;'
      + 'box-shadow:0 .08rem .5rem rgba(0,0,0,.45);';
    el.innerHTML = '<div class="van-toast__text"></div>';
    el.firstChild.textContent = String(message);
    document.body.appendChild(el);

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, duration || 1800);
  };

  VUI.flash = function (message) {
    try { sessionStorage.setItem('rs_flash', message); } catch (e) {}
  };

  VUI.takeFlash = function () {
    var v = '';
    try {
      v = sessionStorage.getItem('rs_flash') || '';
      sessionStorage.removeItem('rs_flash');
    } catch (e) {}
    return v;
  };

  window.VUI = VUI;
})();
