(function () {
  'use strict';

  if (window.__RSSubordinateBooted) return;
  window.__RSSubordinateBooted = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------- picker ke liye zaroori CSS (styles.css me change ki zarurat nahi) ---------- */
  function injectCss() {
    if (document.getElementById('rs-picker-fix')) return;
    var st = document.createElement('style');
    st.id = 'rs-picker-fix';
    st.textContent =
      '.van-picker__columns{touch-action:none;overscroll-behavior:contain}' +
      '.van-picker-column{touch-action:none;-webkit-user-select:none;user-select:none}' +
      '.van-picker-column__wrapper{margin:0;padding:0;list-style:none;will-change:transform;' +
      'transition-property:transform;transition-timing-function:cubic-bezier(.23,1,.68,1)}' +
      '.van-picker-column__item{cursor:pointer;box-sizing:border-box;list-style:none}' +
      '.van-picker-column__item--selected{font-weight:600}' +
      '.van-popup--bottom[role="dialog"]{outline:none}';
    document.head.appendChild(st);
  }

  /* ---------- ek picker column (Vant jaisa hi math) ---------- */
  function Column(el) {
    this.el = el;
    this.ul = el.querySelector('.van-picker-column__wrapper');
    this.index = 0;
    this.h = 44;       /* item height */
    this.offset = 110; /* (columns height - item height) / 2 */
    this.y = 0;        /* current translateY */
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
    this.ul.style.transitionProperty = 'transform';
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

  Column.prototype.setValue = function (text, animate) {
    for (var k = 0; k < this.count(); k++) {
      if (this.ul.children[k].textContent.trim() === String(text)) {
        this.setIndex(k, animate);
        return true;
      }
    }
    return false;
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

    function snapFrom(col, y, animate) {
      var i = Math.round((col.offset - y) / col.h);
      col.setIndex(i, animate);
      onChange(col);
    }

    columnsEl.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button > 0) return;
      var col = colOf(e.target);
      if (!col) return;
      var item = e.target.closest('.van-picker-column__item');
      drag = {
        col: col, id: e.pointerId, item: item,
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
      var y = Math.max(minY, Math.min(maxY, drag.startTy + dy));
      col.translate(y, false);
      var now = Date.now();
      var dt = now - drag.lastT;
      if (dt > 0) drag.v = (e.clientY - drag.lastY) / dt; /* px per ms */
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
      snapFrom(col, target, true);
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

  /* ---------- main ---------- */
  ready(function () {
    injectCss();

    var head = document.querySelector('.TeamReport__C-head-line2');
    if (!head) return;

    var triggers = head.querySelectorAll(':scope > div');
    var typeTrigger = triggers[0] || null;
    var dateTrigger = triggers[1] || null;

    var popups = document.querySelectorAll('.van-popup.van-popup--bottom');
    var overlays = document.querySelectorAll('.van-overlay');
    var typePopup = null, datePopup = null;

    for (var i = 0; i < popups.length; i++) {
      if (/Choose a date/i.test(popups[i].innerHTML)) datePopup = popups[i];
      else if (popups[i].querySelector('.van-picker')) typePopup = typePopup || popups[i];
    }

    function overlayFor(popup) {
      var prev = popup.previousElementSibling;
      if (prev && prev.classList.contains('van-overlay')) return prev;
      var z = (popup.getAttribute('style') || '').match(/z-index:\s*(\d+)/);
      if (z) {
        for (var k = 0; k < overlays.length; k++) {
          if ((overlays[k].getAttribute('style') || '').indexOf(z[1]) >= 0) return overlays[k];
        }
      }
      return null;
    }

    function triggerSpan(trigger) { return trigger ? trigger.querySelector('span') : null; }

    function fire(name, detail) {
      try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
    }

    /* generic popup banane wala helper */
    function makePopup(popup, trigger, hooks) {
      if (!popup || !trigger) return;

      var columnsEl = popup.querySelector('.van-picker__columns');
      var cols = [];
      var colEls = popup.querySelectorAll('.van-picker-column');
      for (var c = 0; c < colEls.length; c++) cols.push(new Column(colEls[c]));

      var ov = overlayFor(popup);
      var confirmBtn = popup.querySelector('.van-picker__confirm');
      var cancelBtn = popup.querySelector('.van-picker__cancel');

      function open() {
        if (ov) ov.style.display = '';
        popup.style.display = '';
        for (var k = 0; k < cols.length; k++) cols[k].measure(columnsEl);
        hooks.onOpen(cols);
      }
      function close() {
        popup.style.display = 'none';
        if (ov) ov.style.display = 'none';
      }

      bindColumns(columnsEl, cols, function (col) { if (hooks.onChange) hooks.onChange(cols, col); });

      trigger.style.cursor = 'pointer';
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        open();
      });

      if (confirmBtn) confirmBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        hooks.onConfirm(cols);
        close();
      });
      if (cancelBtn) cancelBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        close();
      });
      if (ov) ov.addEventListener('click', close);

      close(); /* shuru me band */
    }

    /* ---------- TYPE (All / Tier 1..6) ---------- */
    makePopup(typePopup, typeTrigger, {
      onOpen: function (cols) {
        var span = triggerSpan(typeTrigger);
        var cur = span ? span.textContent.trim() : 'All';
        if (!cols[0].setValue(cur, false)) cols[0].setIndex(0, false);
      },
      onConfirm: function (cols) {
        var val = cols[0].value();
        var span = triggerSpan(typeTrigger);
        if (span && val) {
          span.textContent = val;
          span.classList.remove('default');
        }
        fire('rs:subordinate-filter', { type: val, date: dateTrigger && triggerSpan(dateTrigger) ? triggerSpan(dateTrigger).textContent.trim() : '' });
      }
    });

    /* ---------- DATE (year / month / day) ---------- */
    (function () {
      if (!datePopup || !dateTrigger) return;

      function pad(n) { return (n < 10 ? '0' : '') + n; }
      function range(a, b) { var r = []; for (var k = a; k <= b; k++) r.push(k); return r; }
      function padAll(arr) { return arr.map(pad); }

      var span = triggerSpan(dateTrigger);
      function committed() {
        var m = span ? span.textContent.match(/(\d{4})-(\d{1,2})-(\d{1,2})/) : null;
        var now = new Date();
        return m ? { y: +m[1], m: +m[2], d: +m[3] } : { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
      }

      /* static HTML se min year nikaalo */
      var yearItems = datePopup.querySelectorAll('.van-picker-column:first-of-type .van-picker-column__item');
      var minY = yearItems.length ? parseInt(yearItems[0].textContent, 10) : 2022;
      var staticMaxY = yearItems.length ? parseInt(yearItems[yearItems.length - 1].textContent, 10) : new Date().getFullYear();

      function maxDate() {
        var now = new Date();
        var c = committed();
        var t = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
        /* jo bhi badi ho: aaj ya already selected */
        var a = t.y * 10000 + t.m * 100 + t.d;
        var b = c.y * 10000 + c.m * 100 + c.d;
        var mx = a >= b ? t : c;
        if (mx.y < staticMaxY) mx = { y: staticMaxY, m: 12, d: 31 };
        return mx;
      }

      function refresh(cols, from, want) {
        var mx = maxDate();
        /* year */
        if (from === 'init') {
          cols[0].setOptions(range(minY, mx.y), want.y);
        }
        var y = parseInt(cols[0].value(), 10);
        /* month */
        if (from === 'init' || from === 'year') {
          var keepM = from === 'init' ? pad(want.m) : cols[1].value();
          var mMax = 12;
          cols[1].setOptions(padAll(range(1, mMax)), keepM);
        }
        var m = parseInt(cols[1].value(), 10);
        /* day */
        if (from === 'init' || from === 'year' || from === 'month') {
          var keepD = from === 'init' ? pad(want.d) : cols[2].value();
          var dMax = new Date(y, m, 0).getDate();
          cols[2].setOptions(padAll(range(1, dMax)), keepD);
        }
      }

      makePopup(datePopup, dateTrigger, {
        onOpen: function (cols) {
          refresh(cols, 'init', committed());
        },
        onChange: function (cols, col) {
          var idx = cols.indexOf(col);
          if (idx === 0) refresh(cols, 'year');
          else if (idx === 1) refresh(cols, 'month');
        },
        onConfirm: function (cols) {
          var val = cols[0].value() + '-' + cols[1].value() + '-' + cols[2].value();
          if (span) span.textContent = val;
          var tspan = triggerSpan(typeTrigger);
          fire('rs:subordinate-filter', { type: tspan ? tspan.textContent.trim() : '', date: val });
        }
      });
    })();
  });
})();