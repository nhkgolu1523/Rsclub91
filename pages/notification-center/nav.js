/* Notification Center page - navigation + tab wiring.
   The page markup is a pre-rendered snapshot, so we just add behaviour. */
(function () {
  'use strict';

  // Home page ka path (pages/notification-center/ se 2 level upar -> pages/home/)
  var HOME_PAGE = '../home/index.html';

  function goHome() {
    // History hai to back (browser ka natural back), warna home par jao
    if (window.history && window.history.length > 1 && document.referrer) {
      window.history.back();
    } else {
      window.location.href = HOME_PAGE;
    }
  }

  // 1. Navbar ka back arrow -> home
  var backArrow = document.querySelector('.navbar__content-left .van-icon-arrow-left');
  if (backArrow) {
    backArrow.style.cursor = 'pointer';
    backArrow.addEventListener('click', function (e) {
      e.preventDefault();
      goHome();
    });
  }

  // 2. Tabs (Notification / Information) - pre-rendered panels ko switch karo
  //    Active tab ka underline (Vant bottom-bar) design me nahi chahiye -> DOM se hata do
  var tabLines = document.querySelectorAll('.van-tabs__line');
  for (var k = 0; k < tabLines.length; k++) {
    if (tabLines[k] && tabLines[k].parentNode) {
      tabLines[k].parentNode.removeChild(tabLines[k]);
    }
  }
  // extra safety: agar kahin aur line/bottom-bar render ho jaye
  var bottomBars = document.querySelectorAll('.van-tabs__nav--line .van-tabs__line, .van-tabs__bottom-bar');
  for (var b = 0; b < bottomBars.length; b++) {
    if (bottomBars[b] && bottomBars[b].parentNode) {
      bottomBars[b].parentNode.removeChild(bottomBars[b]);
    }
  }

  function activateTab(index) {
    var tabs = document.querySelectorAll('.van-tabs__nav .van-tab');
    var panels = document.querySelectorAll('.van-tabs__content .van-tab__panel');
    if (!tabs.length || !panels.length) return;

    for (var i = 0; i < tabs.length; i++) {
      var on = i === index;
      tabs[i].classList.toggle('van-tab--active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].style.color = on ? 'var(--text_color_L4)' : 'var(--text_color_L2)';
      if (panels[i]) panels[i].style.display = on ? '' : 'none';
    }

    // NOTE: Vant ka bottom-bar / underline ('.van-tabs__line') deliberately
    // use nahi kiya - design me active tab ka underline nahi chahiye.
  }

  var tabEls = document.querySelectorAll('.van-tabs__nav .van-tab');
  for (var i = 0; i < tabEls.length; i++) {
    (function (idx) {
      tabEls[idx].style.cursor = 'pointer';
      tabEls[idx].addEventListener('click', function () { activateTab(idx); });
    })(i);
  }

  // 3. Pehle se jo tab active hai usko sahi set karo (underline position)
  var initial = 0;
  for (var j = 0; j < tabEls.length; j++) {
    if (tabEls[j].classList.contains('van-tab--active')) { initial = j; break; }
  }
  activateTab(initial);

  // 4. Browser back/forward support (optional deep-link: ?tab=information)
  try {
    var params = new URLSearchParams(window.location.search || '');
    var want = (params.get('tab') || '').toLowerCase();
    if (want === 'information' || want === 'info') activateTab(1);
    if (want === 'notification') activateTab(0);
  } catch (e) { /* ignore */ }
})();
