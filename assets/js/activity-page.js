/* Activity page (logged-in design) interactions. */
(function () {
  'use strict';

  function stored(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  if (!stored('rsclub_uid')) {
    window.location.replace('/pages/activity/guest.html');
    return;
  }

  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function text(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function toast(message) {
    var old = document.getElementById('rsActivityToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsActivityToast';
    el.className = 'rs-toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('rs-toast--show'); });
    window.setTimeout(function () {
      el.classList.remove('rs-toast--show');
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 1600);
  }
  function go(url) {
    window.location.href = url;
  }
  function bind(el, fn) {
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }

  var headerLinks = {
    'invitation bonus': '../invitation-bonus/index.html',
    'betting rebate': '../betting-rebate/index.html'
  };
  qa('.activity-panel-header .header-item').forEach(function (item) {
    var key = text(item).toLowerCase();
    bind(item, function () {
      if (headerLinks[key]) go(headerLinks[key]);
      else if (key === 'activity award') go('../bonus-details/index.html');
      else toast(text(item) + ' is coming soon.');
    });
  });

  qa('.activity-panel-content .content-title').forEach(function (item) {
    var key = text(item).toLowerCase();
    bind(item, function () {
      if (key.indexOf('gifts') === 0) go('../gift/index.html');
      else if (key.indexOf('attendance bonus') === 0) go('../bonus-details/index.html');
      else toast('This activity is coming soon.');
    });
  });

  qa('.activitySection__container .box').forEach(function (item) {
    var key = text(item).toLowerCase();
    bind(item, function () {
      if (key.indexOf('refer friends') === 0) go('../invitation-bonus/index.html');
      else if (key.indexOf('check in') === 0 || key.indexOf('welcome bonus') === 0 || key.indexOf('daily') === 0) go('../bonus-details/index.html');
      else if (key.indexOf('ar wallet') === 0) go('../wallet/index.html');
      else toast('This activity is coming soon.');
    });
  });

  bind(document.querySelector('.activity-banner .bonus-button'), function () {
    go('../bonus-details/index.html');
  });

  var tabs = qa('.tabbar__items-tab');
  tabs.forEach(function (tab) {
    var label = (tab.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    tab.classList.toggle('active', label === 'activity');
    if (label === 'home') bind(tab, function () { go('../home/index.html'); });
    else if (label === 'promotion') bind(tab, function () { go('../promotion/logged-in/index.html'); });
    else if (label === 'account') bind(tab, function () { go('/pages/account/index.html'); });
  });
  bind(document.querySelector('.tabbar__center'), function () {
    go('../deposit/index.html');
  });
})();
