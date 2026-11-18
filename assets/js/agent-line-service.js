(function () {
  'use strict';

  var TELEGRAM_URL = 'https://t.me/trinomal';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    document.addEventListener('click', function (e) {
      var item = e.target && e.target.closest ? e.target.closest('.content-item') : null;
      if (!item) return;
      var title = item.querySelector('.content-item-title span');
      var text = title ? (title.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() : '';
      if (text === 'telegram') {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = TELEGRAM_URL;
      }
    }, true);
  });
})();
