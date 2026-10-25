(function () {
  'use strict';

  if (window.__RSCommissionBooted) return;
  window.__RSCommissionBooted = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------------------------------------------------------------
   * CSS: sheet apna hai (body ke andar, position:fixed), isliye page ke
   * layout (flex body / #app / sticky) ko touch hi nahi karta.
   * --------------------------------------------------------------- */
  function injectCss() {
    if (document.getElementById('rs-commission-css')) return;
    var st = document.createElement('style');
    st.id = 'rs-commission-css';
    st.textContent =
      /* purana / original dropdown kabhi na dikhe */
      '.ar-searchbar__selector-dropdown{display:none!important}' +
      '.ar-searchbar__selector{cursor:pointer}' +

      /* overlay + sheet: dono fixed, page flow me koi jagah nahi lete */
      '.rs-dp-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:3000;' +
      'background:rgba(0,0,0,.7);display:none}' +
      '.rs-dp-wrap{position:fixed;left:0;right:0;bottom:0;z-index:3001;display:none;' +
      'justify-content:center;pointer-events:none}' +
      '.rs-dp-sheet{width:100%;max-width:100%;pointer-events:auto;overflow:hidden;' +
      'border-radius:16px 16px 0 0;animation:rsDpUp .25s cubic-bezier(.23,1,.68,1)}' +
      '@keyframes rsDpUp{from{transform:translate3d(0,100%,0)}to{transform:translate3d(0,0,0)}}' +

      /* picker */
      '.rs-dp-sheet .van-picker__columns{touch-action:none;overscroll-behavior:contain}' +
      '.rs-dp-sheet .van-picker-column{touch-action:none;-webkit-user-select:none;user-select:none}' +
      '.rs-dp-sheet .van-picker-column__wrapper{margin:0;padding:0;list-style:none;' +
      'will-change:transform;transition-property:transform;' +
      'transition-timing-function:cubic-bezier(.23,1,.68,1)}' +
      '.rs-dp-sheet .van-picker-column__item{cursor:pointer;box-sizing:border-box;list-style:none}' +
      '.rs-dp-sheet .van-picker-column__item--selected{font-weight:600}' +
      '.rs-dp-sheet button{cursor:pointer}';
    document.head.appendChild(st);
  }

  /* ---------- ek picker column (Vant jaisa math: offset - index*h) ---------- */
  function Column(el) {
    this.el = el;
    this.ul = el.querySelector('.van-picker-column__wrapper');
    this.index = 0;
    this.h = 44;
    this.offset = 110;
    this.y = 0;
  }
  Column.prototype.measure = function (columnsEl) {
    var first = this.ul.children[0];
    var h = first ? (parseFloat(first.style.height) || first.offsetHeight) : 0;
    this.h = h || 44;
    var total = columnsEl.clientHeight || parseFloat(columnsEl.style.height) || 264;
    this.offset = (total - this.h) / 2;
  };
  Column.prototype.count = function () { return this.ul.children.length; };
  Column.prototype.translate = function (y, animate) {
    this.y = y;
    this.ul.style.transitionDuration = animate ? '220ms' : '0ms';
    this.ul.style.transform = 'translate3d(0px, ' + y + 'px, 0px)';
  };
  Column.prototype.setIndex = function (i, animate) {
    var n = this.count();
    if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    this.index = i;
    for (var k = 0; k < n; k++) {
      this.ul.children[k].classList.toggle('van-picker-column__item--selected', k === i);
    }
    this.translate(this.offset - i * this.h, animate);
  };
  Column.prototype.value = function () {
    var it = this.ul.children[this.index];
    return it ? it.textContent.trim() : '';
  };
  Column.prototype.setOptions = function (list, keepText) {
    var html = '';
    for (var k = 0; k < list.length; k++) {
      html += '<li role="button" tabindex="0" class="van-picker-column__item" style="height: ' +
        this.h + 'px;"><div class="van-ellipsis">' + list[k] + '</div></li>';
    }
    this.ul.innerHTML = html;
    var idx = 0;
    if (keepText != null) {
      for (var j = 0; j < list.length; j++) {
        if (String(list[j]) === String(keepText)) { idx = j; break; }
        if (String(list[j]) < String(keepText)) idx = j; /* nearest chhota */
      }
    }
    this.setIndex(idx, false);
  };

  /* ---------- drag / tap / wheel ---------- */
  function bindColumns(columnsEl, cols, onChange) {
    var drag = null;

    function colOf(target) {
      var el = target.closest ? target.closest('.van-picker-column') : null;
      if (!el) return null;
      for (var i = 0; i < cols.length; i++) if (cols[i].el === el) return cols[i];
      return null;
    }

    columnsEl.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button > 0) return;
      var col = colOf(e.target);
      if (!col) return;
      drag = {
        col: col, id: e.pointerId, item: e.target.closest('.van-picker-column__item'),
        startY: e.clientY, startTy: col.y,
        lastY: e.clientY, lastT: Date.now(), v: 0, moved: false
      };
      col.ul.style.transitionDuration = '0ms';
      try { columnsEl.setPointerCapture(e.pointerId); } catch (err) {}
    });

    columnsEl.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dy) < 5) return;
      drag.moved = true;
      e.preventDefault();
      var col = drag.col;
      var minY = col.offset - (col.count() - 1) * col.h - col.h * 0.6;
      var maxY = col.offset + col.h * 0.6;
      col.translate(Math.max(minY, Math.min(maxY, drag.startTy + dy)), false);
      var now = Date.now();
      var dt = now - drag.lastT;
      if (dt > 0) drag.v = (e.clientY - drag.lastY) / dt;
      drag.lastY = e.clientY;
      drag.lastT = now;
    });

    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      try { columnsEl.releasePointerCapture(e.pointerId); } catch (err) {}
      var col = d.col;
      if (!d.moved) {
        if (d.item) {
          var idx = Array.prototype.indexOf.call(col.ul.children, d.item);
          if (idx >= 0) { col.setIndex(idx, true); onChange(col); }
        }
        return;
      }
      var stale = Date.now() - d.lastT > 120;
      var target = col.y + (stale ? 0 : d.v * 160);
      col.setIndex(Math.round((col.offset - target) / col.h), true);
      onChange(col);
    }
    columnsEl.addEventListener('pointerup', end);
    columnsEl.addEventListener('pointercancel', end);

    var lastWheel = 0;
    columnsEl.addEventListener('wheel', function (e) {
      var col = colOf(e.target);
      if (!col) return;
      e.preventDefault();
      var now = Date.now();
      if (now - lastWheel < 60) return;
      lastWheel = now;
      col.setIndex(col.index + (e.deltaY > 0 ? 1 : -1), true);
      onChange(col);
    }, { passive: false });
  }

  /* ---------- helpers ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function range(a, b) { var r = []; for (var k = a; k <= b; k++) r.push(k); return r; }
  function padAll(arr) { return arr.map(pad); }

  /* ---------------------------------------------------------------
   * main
   * --------------------------------------------------------------- */
  ready(function () {
    var selector = document.querySelector('.ar-searchbar__selector');
    if (!selector) return;
    if (selector.__rsWired) return;
    selector.__rsWired = true;

    injectCss();

    function labelSpan() {
      return selector.querySelector('.ar-searchbar__selector-default') ||
             selector.querySelector('span');
    }

    /* purane static popup/overlay (Vue ka static HTML) ko hamesha band rakho */
    var oldPopups = document.querySelectorAll('.van-popup.van-popup--bottom');
    for (var i = 0; i < oldPopups.length; i++) {
      if (/Choose a date/i.test(oldPopups[i].innerHTML)) {
        oldPopups[i].setAttribute('data-rs-old', '1');
        oldPopups[i].style.setProperty('display', 'none', 'important');
        var prev = oldPopups[i].previousElementSibling;
        if (prev && prev.classList.contains('van-overlay')) prev.style.setProperty('display', 'none', 'important');
      }
    }

    /* min year purane popup se, warna 2022 */
    var minY = 2022;
    var oldYear = document.querySelector('[data-rs-old] .van-picker-column .van-picker-column__item');
    if (oldYear && /^\d{4}$/.test(oldYear.textContent.trim())) minY = parseInt(oldYear.textContent, 10);

    function committed() {
      var sp = labelSpan();
      var m = sp ? sp.textContent.match(/(\d{4})-(\d{1,2})-(\d{1,2})/) : null;
      var now = new Date();
      return m ? { y: +m[1], m: +m[2], d: +m[3] }
               : { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
    }

    /* ---------- apna popup banao (body me, fixed) ---------- */
    var overlay = document.createElement('div');
    overlay.className = 'rs-dp-overlay';

    var wrap = document.createElement('div');
    wrap.className = 'rs-dp-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.innerHTML =
      '<div class="rs-dp-sheet"><div class="van-picker">' +
        '<div class="van-picker__toolbar">' +
          '<button type="button" class="van-picker__cancel van-haptics-feedback">Cancel</button>' +
          '<div class="van-picker__title van-ellipsis">Choose a date</div>' +
          '<button type="button" class="van-picker__confirm van-haptics-feedback">Confirm</button>' +
        '</div>' +
        '<div class="van-picker__columns" style="height: 264px;">' +
          '<div class="van-picker-column"><ul class="van-picker-column__wrapper"></ul></div>' +
          '<div class="van-picker-column"><ul class="van-picker-column__wrapper"></ul></div>' +
          '<div class="van-picker-column"><ul class="van-picker-column__wrapper"></ul></div>' +
          '<div class="van-picker__mask" style="background-size: 100% 110px;"></div>' +
          '<div class="van-hairline-unset--top-bottom van-picker__frame" style="height: 44px;"></div>' +
        '</div>' +
      '</div></div>';

    document.body.appendChild(overlay);
    document.body.appendChild(wrap);

    var columnsEl = wrap.querySelector('.van-picker__columns');
    var colEls = wrap.querySelectorAll('.van-picker-column');
    var cols = [new Column(colEls[0]), new Column(colEls[1]), new Column(colEls[2])];
    var sheet = wrap.querySelector('.rs-dp-sheet');

    function maxYear() {
      return Math.max(new Date().getFullYear(), committed().y);
    }

    /* from: 'init' | 'year' | 'month' */
    function refresh(from, want) {
      if (from === 'init') cols[0].setOptions(range(minY, maxYear()), want.y);
      var y = parseInt(cols[0].value(), 10);

      if (from === 'init' || from === 'year') {
        var keepM = from === 'init' ? pad(want.m) : cols[1].value();
        cols[1].setOptions(padAll(range(1, 12)), keepM);          /* hamesha 01-12 */
      }
      var m = parseInt(cols[1].value(), 10);

      var keepD = from === 'init' ? pad(want.d) : cols[2].value();
      var dMax = new Date(y, m, 0).getDate();                      /* 28/29/30/31 */
      cols[2].setOptions(padAll(range(1, dMax)), keepD);
    }

    bindColumns(columnsEl, cols, function (col) {
      var idx = cols.indexOf(col);
      if (idx === 0) refresh('year');
      else if (idx === 1) refresh('month');
    });

    var isOpen = false;

    /* sheet ko hamesha #app ke andar rakho (app ki width/left se match) */
    function fit() {
      var app = document.getElementById('app') || document.querySelector('.myCommission__container');
      var vw = document.documentElement.clientWidth || window.innerWidth;
      var left = 0, right = 0;
      if (app) {
        var r = app.getBoundingClientRect();
        if (r.width > 0 && r.width < vw) {
          left = Math.max(0, Math.round(r.left));
          right = Math.max(0, Math.round(vw - r.right));
        }
      }
      wrap.style.left = left + 'px';
      wrap.style.right = right + 'px';
    }
    window.addEventListener('resize', function () { if (isOpen) fit(); });

    function open() {
      if (isOpen) return;
      isOpen = true;
      overlay.style.display = 'block';
      wrap.style.display = 'flex';
      fit();
      for (var k = 0; k < cols.length; k++) cols[k].measure(columnsEl);
      refresh('init', committed());
      /* animation dobara chalane ke liye */
      sheet.style.animation = 'none';
      void sheet.offsetWidth;
      sheet.style.animation = '';
    }
    function close() {
      isOpen = false;
      overlay.style.display = 'none';
      wrap.style.display = 'none';
    }

    wrap.querySelector('.van-picker__cancel').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation(); close();
    });
    wrap.querySelector('.van-picker__confirm').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var val = cols[0].value() + '-' + cols[1].value() + '-' + cols[2].value();
      var sp = labelSpan();
      if (sp) {
        sp.textContent = val;
        sp.classList.remove('ar-searchbar__selector-default');
      }
      close();
      try {
        document.dispatchEvent(new CustomEvent('rs:commission-date', { detail: { date: val } }));
      } catch (err) {}
    });
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) close(); });

    /* ---------- trigger ----------
     * capture phase me document par pakdo, taaki page ka original Vue handler
     * (jo apna alag dropdown kholta / layout todta hai) chale hi nahi.
     * Poora selector clickable hai (sirf text nahi, arrow bhi). */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var hit = t.closest('.ar-searchbar__selector');
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      hit.classList.remove('active'); /* original dropdown ka open state hatao */
      open();
    }, true);
  });
})();