/* ============================================================
   WINGO GAME LINK
   ------------------------------------------------------------
   Wingo cards pe click karne par seedha Wingo game kholta hai:
     * Home page : Top Games + Lottery banner
     * Category  : Lottery tab ka "Win Go" tile

   Wingo game isi site ke andar hai: Games/Wingo/index.html
   (pages/home/ aur pages/category/ dono se relative path).

   Baaki games pe iska koi asar nahi - unka apna (Coming Soon /
   login popup) behaviour wahi rehta hai.
   ============================================================ */
(function () {
  'use strict';

  /* home page se relative -> /Games/Wingo/index.html */
  var WINGO_URL = '../../Games/Wingo/index.html';

  /* image files jo Wingo ko darshate hain */
  var WINGO_IMG_HINTS = [
    'wingo_30s',
    'wingo',
    'lotterycategory_20260911152746jtnp' /* lottery banner: "Win Go" */
  ];

  function looksLikeWingo(el) {
    if (!el) return false;

    /* 1) Top Games: <img alt="WinGo"> */
    var img = el.tagName === 'IMG' ? el : (el.querySelector ? el.querySelector('img') : null);
    if (img) {
      var alt = String(img.getAttribute('alt') || '').toLowerCase();
      if (alt.indexOf('wingo') !== -1) return true;

      var src = String(img.getAttribute('data-origin') || img.getAttribute('src') || '').toLowerCase();
      for (var i = 0; i < WINGO_IMG_HINTS.length; i++) {
        if (src.indexOf(WINGO_IMG_HINTS[i]) !== -1) return true;
      }
    }

    /* 2) Lottery: koi bhi .b-item ya card jiske andar Wingo image ho */
    var anyImg = el.querySelectorAll ? el.querySelectorAll('img') : [];
    for (var j = 0; j < anyImg.length; j++) {
      var s = String(anyImg[j].getAttribute('data-origin') || anyImg[j].getAttribute('src') || '').toLowerCase();
      for (var k = 0; k < WINGO_IMG_HINTS.length; k++) {
        if (s.indexOf(WINGO_IMG_HINTS[k]) !== -1) return true;
      }
    }

    /* 3) Lottery category page style: title text "Win Go" */
    var t = el.querySelector ? el.querySelector('.name, .tit, span, h4') : null;
    if (t) {
      var txt = String(t.textContent || '').trim().toLowerCase();
      if (txt === 'win go' || txt === 'wingo' || txt.indexOf('win go') === 0) return true;
    }

    return false;
  }

  function openWingo(e) {
    var target = e.target;
    if (!target || !target.closest) return;

    /* in par kabhi interfere na karo */
    if (target.closest('#gamePopup') || target.closest('.partner-logos') ||
        target.closest('.game-section__head') || target.closest('.more')) {
      return;
    }

    /* Wingo card dhoondo - top games item ya lottery b-item */
    var card = target.closest('.top-games__item, .b-item, .lotterySlotItem, .lotterySlotItem__container, .gamesList__container .game-item, .onlineGamesItem');
    if (!card) {
      /* agar seedha WinGo image pe click hua */
      var img = target.tagName === 'IMG' ? target : (target.querySelector ? target.querySelector('img') : null);
      if (img) {
        var alt = String(img.getAttribute('alt') || '').toLowerCase();
        var src = String(img.getAttribute('data-origin') || img.getAttribute('src') || '').toLowerCase();
        if (alt.indexOf('wingo') !== -1 || src.indexOf('wingo') !== -1 || src.indexOf('lotterycategory_20260911152746jtnp') !== -1) {
          card = img;
        }
      }
    }
    if (!card || !looksLikeWingo(card)) return;

    /* Wingo click - baaki saare handlers ko rok do */
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    window.location.href = WINGO_URL;
  }

  /* capture phase: login popup / coming-soon se PEHLE chalega */
  document.addEventListener('click', openWingo, true);

  window.RSWingo = { url: WINGO_URL, isWingo: looksLikeWingo };
})();
