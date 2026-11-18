// Snapshot pages ship <img data-origin="..."> with no src, so off-screen images never paint.
const lazyObserver = new IntersectionObserver((entries, obs) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.src = entry.target.dataset.origin;
    obs.unobserve(entry.target);
  }
}, { rootMargin: '200px 0px' });

document.querySelectorAll('img[data-origin]').forEach((img) => lazyObserver.observe(img));

/* ============================================================================
   Vant Swipe rows (the horizontal game carousels on Home)
   ----------------------------------------------------------------------------
   Each game row is a `.van-swipe` whose slides (`.van-swipe-item`) carry a
   FROZEN inline width from the scrape (e.g. width:374px, track width:748px).
   On the live site Vant's JS recomputed those from the container on load and
   resize, so three cards always filled a slide. With the scrape that JS is
   gone, so on a phone narrower than 374px the slide overflows its container
   and the third card is cut off.

   This does exactly what Vant used to: size every slide to the swipe's own
   width (and the track to slides * width) so the 3-column grid fits its
   container at any screen size. Re-runs on resize / rotate and after a
   tab-nav body swap.
   ========================================================================== */
function fitSwipes() {
  var swipes = document.querySelectorAll('.van-swipe');
  for (var i = 0; i < swipes.length; i++) {
    var swipe = swipes[i];
    var w = swipe.clientWidth;
    if (!w) continue;
    var track = swipe.querySelector('.van-swipe__track');
    if (!track) continue;
    var items = track.children;
    var n = 0;
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (!it.classList || !it.classList.contains('van-swipe-item')) continue;
      it.style.width = w + 'px';
      n++;
    }
    if (n) track.style.width = (w * n) + 'px';
  }
}

function bootSwipes() {
  fitSwipes();
  if (window.requestAnimationFrame) window.requestAnimationFrame(fitSwipes);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootSwipes);
} else {
  bootSwipes();
}
window.addEventListener('resize', bootSwipes);
window.addEventListener('orientationchange', bootSwipes);
window.addEventListener('load', fitSwipes);
document.addEventListener('tabnav:page', bootSwipes);
