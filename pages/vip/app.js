/* VIP page interactions (static UI, backend hook-up later). */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var back = document.querySelector('.navbar__content-left');
  if (back) {
    back.style.cursor = 'pointer';
    back.addEventListener('click', function () { RS.back('../account/index.html'); });
  }

  /* Logged-in display name */
  var nameEl = document.querySelector('.vip-header-wrapper-name-nickName h3');
  if (nameEl) {
    RS.username(function (name) { nameEl.textContent = name; });
  }

  /* Level cards: make the swiper row scrollable (original swiper JS is gone) */
  var style = document.createElement('style');
  style.setAttribute('data-vip-swipe', '1');
  style.textContent = ''
    + '.vip-content-card-item .swiper{overflow-x:auto!important;overflow-y:hidden!important;'
    + '-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;touch-action:pan-y;'
    + 'cursor:grab;user-select:none;-webkit-user-select:none}'
    + '.vip-content-card-item .swiper.is-dragging{cursor:grabbing;scroll-snap-type:none}'
    + '.vip-content-card-item .swiper::-webkit-scrollbar{height:0;display:none}'
    + '.vip-content-card-item .swiper-wrapper{transform:none!important;transition:none!important;display:flex!important}'
    + '.vip-content-card-item .swiper-wrapper::before,.vip-content-card-item .swiper-wrapper::after{'
    + 'content:"";flex:0 0 calc((100% - 7.62667rem)/2);pointer-events:none}'
    + '.vip-content-card-item .swiper-slide{flex:0 0 auto;scroll-snap-align:center!important;'
    + 'scroll-snap-stop:always}'
    + '.vip-content-weal-con.vip-benefits-fade{animation:vipBenefitsFadeIn .5s ease both}'
    + '@keyframes vipBenefitsFadeIn{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(style);

  var benefitData = {
    1: { levelUp: '60', monthly: '3', rebate: '0.04%' },
    2: { levelUp: '180', monthly: '9', rebate: '0.04%' },
    3: { levelUp: '690', monthly: '29', rebate: '0.1%' },
    4: { levelUp: '1,690', monthly: '690', rebate: '0.1%' },
    5: { levelUp: '6,900', monthly: '1,690', rebate: '0.1%' },
    6: { levelUp: '16,900', monthly: '6,900', rebate: '0.15%' },
    7: { levelUp: '69,000', monthly: '16,900', rebate: '0.15%' },
    8: { levelUp: '169,000', monthly: '69,000', rebate: '0.15%' },
    9: { levelUp: '690,000', monthly: '169,000', rebate: '0.2%' },
    10: { levelUp: '1,690,000', monthly: '690,000', rebate: '0.3%' }
  };

  function setTrailingText(el, value) {
    if (!el) return;
    var node = el.lastChild;
    while (node && node.nodeType !== 3) node = node.previousSibling;
    if (node) node.nodeValue = ' ' + value;
    else el.appendChild(document.createTextNode(' ' + value));
  }

  function animateBenefits() {
    var rows = document.querySelectorAll('.vip-content-weal-con');
    if (!rows.length) return;
    Array.prototype.forEach.call(rows, function (row) {
      row.classList.remove('vip-benefits-fade');
    });
    rows[0].getBoundingClientRect();
    Array.prototype.forEach.call(rows, function (row) {
      row.classList.add('vip-benefits-fade');
    });
  }

  function applyBenefits(index) {
    var level = index + 1;
    var data = benefitData[level];
    var weal = document.querySelector('.vip-content-weal');
    if (!data || !weal) return;
    var title = weal.querySelector('.vip-content-weal-head h1');
    if (title) title.textContent = 'VIP' + level + ' Benefits level';
    var rows = weal.querySelectorAll('.vip-content-weal-con');
    if (rows[0]) setTrailingText(rows[0].querySelectorAll('p')[0], data.levelUp);
    if (rows[1]) setTrailingText(rows[1].querySelectorAll('p')[0], data.monthly);
    if (rows[2]) setTrailingText(rows[2].querySelector('p'), data.rebate);
    animateBenefits();
  }

  var swiper = document.querySelector('.vip-content-card-item .swiper');
  if (swiper) {
    var slides = Array.prototype.slice.call(swiper.querySelectorAll('.swiper-slide'));
    var down = false, moved = false, startX = 0, startY = 0, startLeft = 0, pointerId = null;

    function containerCenter() {
      var rect = swiper.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }

    function slideCenter(slide) {
      var rect = slide.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }

    function maxScroll() {
      return Math.max(0, swiper.scrollWidth - swiper.clientWidth);
    }

    function targetFor(slide) {
      var left = swiper.scrollLeft + slideCenter(slide) - containerCenter();
      return Math.max(0, Math.min(left, maxScroll()));
    }

    function nearestIndex() {
      var center = containerCenter();
      var best = 0;
      var bestDistance = Infinity;
      for (var i = 0; i < slides.length; i++) {
        var distance = Math.abs(slideCenter(slides[i]) - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      }
      return best;
    }

    function snapTo(index, smooth) {
      var slide = slides[index];
      if (!slide) return;
      var left = targetFor(slide);
      if (smooth && typeof swiper.scrollTo === 'function') {
        swiper.scrollTo({ left: left, behavior: 'smooth' });
      } else {
        swiper.scrollLeft = left;
      }
    }

    function endDrag(snap) {
      if (!down) return;
      down = false;
      swiper.classList.remove('is-dragging');
      if (pointerId !== null) {
        try { swiper.releasePointerCapture(pointerId); } catch (e) { /* harmless */ }
      }
      pointerId = null;
      if (snap && moved) snapTo(nearestIndex(), true);
    }

    swiper.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('a,button,input,textarea,select')) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = swiper.scrollLeft;
      pointerId = e.pointerId;
      swiper.classList.add('is-dragging');
      try { swiper.setPointerCapture(e.pointerId); } catch (err) { /* harmless */ }
    });

    swiper.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!moved) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          endDrag(false);
          return;
        }
        moved = true;
      }
      e.preventDefault();
      swiper.scrollLeft = startLeft - dx;
    });

    swiper.addEventListener('pointerup', function (e) {
      if (e.pointerId === pointerId) endDrag(true);
    });
    swiper.addEventListener('pointercancel', function (e) {
      if (e.pointerId === pointerId) endDrag(true);
    });
    swiper.addEventListener('dragstart', function (e) { e.preventDefault(); });

    var benefitFrame = 0;
    var benefitIndex = -1;

    function updateBenefits() {
      benefitFrame = 0;
      var index = nearestIndex();
      if (index === benefitIndex) return;
      benefitIndex = index;
      applyBenefits(index);
    }

    swiper.addEventListener('scroll', function () {
      if (benefitFrame) return;
      var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
      benefitFrame = raf(updateBenefits);
    });

    snapTo(nearestIndex(), false);
    updateBenefits();

    /* expose so the backend hook can auto-slide to the user's level */
    window.__vipCardScrollTo = function (index, smooth) {
      if (typeof index !== 'number' || !isFinite(index)) return;
      var max = slides.length - 1;
      var i = Math.max(0, Math.min(index, max));
      snapTo(i, !!smooth);
      updateBenefits();
    };
  }

  /* History / Rules tabs */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.vip-content-recordVsrule-head button'));
  var con = document.querySelector('.vip-content-recordVsrule-con');
  var rulesTemplate = document.getElementById('vip-rules-template');
  var rulesHTML = rulesTemplate ? rulesTemplate.innerHTML : '';
  var historyHTML = ''
    + '<div data-v-f84b843f="" data-v-eaa4a307="" class="empty__container">'
    + '<svg data-v-f84b843f="" class="svg-icon icon-empty"><use xlink:href="#icon-empty"></use></svg>'
    + '<p data-v-f84b843f="">No data</p>'
    + '</div>'
    + '<button data-v-eaa4a307="">View All</button>';
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      if (!con) return;
      con.innerHTML = i === 1 ? rulesHTML : historyHTML;
    });
  });

  if (con) {
    con.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (b) RS.toast('No more records.');
    });
  }
})();
