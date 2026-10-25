/* ============================================================================
   rem.js --- responsive rem base (the mobile layout scale)
   ----------------------------------------------------------------------------
   The whole site is laid out on a fixed-width mobile design: every page uses
   rem units and #app is 10rem wide, and each snapshot ships
   <html style="font-size:54px"> (a 540px design width baked in at capture
   time). On a real phone that guess is far too large - 10rem stays 540px wide
   while the screen is only ~375px, so the UI overflows and looks broken.

   flexible.js did this on the live site but it was dropped in the scrape.
   This is the same idea: set the root font-size from the live viewport so
   10rem === screen width, capped at 540px so desktop keeps the centred column
   it already rendered correctly.
   ========================================================================== */
(function () {
  'use strict';

  var DESIGN_WIDTH = 540;   /* 10rem * 54px - the desktop column width */

  function apply() {
    var doc = document.documentElement;
    var w = doc.clientWidth || window.innerWidth || DESIGN_WIDTH;
    if (w > DESIGN_WIDTH) w = DESIGN_WIDTH;
    if (w < 1) return;
    doc.style.fontSize = (w / 10) + 'px';
  }

  apply();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, false);
  }
  window.addEventListener('load', apply, false);
  window.addEventListener('resize', apply, false);
  window.addEventListener('orientationchange', apply, false);
  window.addEventListener('pageshow', apply, false);

  /* tab-nav.js swaps <body> without a reload. The root font-size lives on
     <html> so it survives a swap, but re-applying on its event is cheap
     insurance for swapped-in pages that carry their own layout quirks. */
  document.addEventListener('tabnav:page', apply, false);
})();
