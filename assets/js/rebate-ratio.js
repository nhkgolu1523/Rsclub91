(function () {
  'use strict';

  if (window.__RSRebateBooted) return;
  window.__RSRebateBooted = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var items = document.querySelectorAll('.fun-tabs .fun-tab-item');
    if (!items.length) return;

    function activate(idx) {
      for (var i = 0; i < items.length; i++) {
        var tab = items[i].querySelector('.tab_item');
        if (!tab) continue;
        tab.classList.toggle('tab_active', i === idx);
      }
    }

    for (var i = 0; i < items.length; i++) {
      (function (index) {
        var target = items[index].querySelector('.tab_item') || items[index];
        target.style.cursor = 'pointer';
        items[index].addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          activate(index);
        });
      })(i);
    }
  });
})();
