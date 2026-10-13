// Snapshot pages ship <img data-origin="..."> with no src, so off-screen images never paint.
const lazyObserver = new IntersectionObserver((entries, obs) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.src = entry.target.dataset.origin;
    obs.unobserve(entry.target);
  }
}, { rootMargin: '200px 0px' });

document.querySelectorAll('img[data-origin]').forEach((img) => lazyObserver.observe(img));
