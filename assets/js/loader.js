(function () {
  'use strict';

  if (window.RSLoader) return;

  var STYLE_ID = 'rs-loader-style';
  var ROOT_ID = 'rsLoaderOverlay';

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
      + '@keyframes rs-loader-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function logoPath() {
    var s = document.querySelector('script[src*="loader.js"]');
    if (s) {
      var src = s.getAttribute('src') || '';
      var base = src.replace(/[^/]*$/, '');   /* e.g. ../../assets/js/ */
      if (base) return base.replace(/js\/$/, 'images/') + 'logo-rsclub91.png';
    }
    return '/assets/images/logo-rsclub91.png';
  }

  function ensure() {
    var el = document.getElementById(ROOT_ID);
    if (el) return el;
    injectCSS();
    el = document.createElement('div');
    el.id = ROOT_ID;
    el.innerHTML = ''
      + '<div class="rs-loader-container">'
      + '  <svg class="rs-loader-spinner" viewBox="0 0 100 100">'
      + '    <circle cx="50" cy="50" r="48" class="rs-loader-circle"></circle>'
      + '  </svg>'
      + '  <img class="rs-loader-logo" alt="Rsclub91 Logo" src="' + logoPath() + '">'
      + '</div>';
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  window.RSLoader = {
    show: function () { ensure().classList.add('rs-loader--show'); },
    hide: function () {
      var el = document.getElementById(ROOT_ID);
      if (el) el.classList.remove('rs-loader--show');
    }
  };
})();
