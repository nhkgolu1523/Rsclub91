/* Wallet page interactions (static UI, backend hook-up later). */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var back = document.querySelector('.navbar__content-left');
  if (back) {
    back.style.cursor = 'pointer';
    back.addEventListener('click', function () { RS.back('../account/index.html'); });
  }

  function go(url) { location.href = url; }

  /* Main wallet transfer: original shows a 5s "Recalling" countdown. */
  var transfer = document.querySelector('.recycleBtnD .recycleBtn');
  var countdown = null;
  var timeDelay = 0;
  if (transfer) {
    transfer.addEventListener('click', function () {
      if (timeDelay > 0 || countdown) return;
      timeDelay = 5;
      transfer.classList.add('disable');
      transfer.textContent = 'Recalling ' + timeDelay;
      countdown = setInterval(function () {
        timeDelay -= 1;
        if (timeDelay <= 0) {
          clearInterval(countdown);
          countdown = null;
          timeDelay = 0;
          transfer.classList.remove('disable');
          transfer.textContent = 'Main wallet transfer';
        } else {
          transfer.textContent = 'Recalling ' + timeDelay;
        }
      }, 1000);
    });
  }

  /* Deposit / Withdraw / histories */
  Array.prototype.forEach.call(document.querySelectorAll('.userDetail > div'), function (item) {
    var t = (item.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    item.style.cursor = 'pointer';
    item.addEventListener('click', function () {
      if (t.indexOf('deposit history') === 0) {
        RS.modal({ title: 'Deposit history', body: '<div class="rs-empty">No data</div>', okText: 'Close', cancel: false });
      } else if (t.indexOf('withdraw') === 0 && t.indexOf('history') >= 0) {
        RS.modal({ title: 'Withdrawal history', body: '<div class="rs-empty">No data</div>', okText: 'Close', cancel: false });
      } else if (t.indexOf('deposit') === 0) {
        go('../deposit/index.html');
      } else if (t.indexOf('withdraw') === 0) {
        go('../withdraw/index.html');
      }
    });
  });

  /* Bottom tabbar */
  var routes = {
    home: '../home/index.html',
    activity: '../activity/index.html',
    promotion: '../promotion/index.html',
    account: '../account/index.html'
  };
  Array.prototype.forEach.call(document.querySelectorAll('.tabbar__items-tab'), function (tab) {
    if (tab.classList.contains('placeholder')) return;
    var label = (tab.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    var href = routes[label];
    if (!href) return;
    tab.style.cursor = 'pointer';
    tab.addEventListener('click', function () { go(href); });
  });
})();
