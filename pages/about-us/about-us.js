(function () {
  'use strict';

  var content = window.ABOUT_CONTENT || {};
  var host = document.querySelector('.about-container');
  if (!host) return;

  var items = Array.prototype.slice.call(host.querySelectorAll('.about-container-content-item'));
  var config = {};

  items.forEach(function (item) {
    var label = item.querySelector('span');
    var name = label ? label.textContent.replace(/\s+/g, ' ').trim() : '';
    if (name === 'Confidentiality Agreement') config.confidentiality = item;
    if (name === 'Risk Disclosure Agreement') config.risk = item;
  });

  var overlay = document.createElement('div');
  overlay.className = 'about-detail';
  overlay.innerHTML = '<div class="navbar main about-detail-navbar" data-v-12a80a3e="">'
    + '<div class="navbar-fixed" data-v-12a80a3e="">'
    + '<div class="navbar__content" data-v-12a80a3e="">'
    + '<div class="navbar__content-left" data-v-12a80a3e=""><i class="van-badge__wrapper van-icon van-icon-arrow-left" data-v-12a80a3e=""></i></div>'
    + '<div class="navbar__content-center" data-v-12a80a3e=""><div class="navbar__content-title" data-v-12a80a3e=""></div></div>'
    + '<div class="navbar__content-right" data-v-12a80a3e=""></div>'
    + '</div></div></div>'
    + '<div class="about-detail-scroll"><div class="about-container-content" data-v-19d4c048=""></div></div>';
  document.body.appendChild(overlay);

  var title = overlay.querySelector('.navbar__content-title');
  var body = overlay.querySelector('.about-container-content');
  var scroll = overlay.querySelector('.about-detail-scroll');
  var back = overlay.querySelector('.navbar__content-left');

  function hide() {
    overlay.classList.remove('open');
    document.body.classList.remove('about-detail-open');
    body.innerHTML = '';
  }

  function open(name, heading) {
    body.innerHTML = content[name] || '';
    title.textContent = heading;
    scroll.scrollTop = 0;
    overlay.classList.add('open');
    document.body.classList.add('about-detail-open');
    if (!history.state || history.state.aboutDetail !== name) {
      history.pushState({ aboutDetail: name }, '', location.href);
    }
  }

  function openFromItem(name, heading) {
    open(name, heading);
  }

  back.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (history.state && history.state.aboutDetail) history.back();
    else hide();
  });

  window.addEventListener('popstate', function () {
    if (overlay.classList.contains('open')) hide();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && overlay.classList.contains('open')) {
      if (history.state && history.state.aboutDetail) history.back();
      else hide();
    }
  });

  if (config.confidentiality) {
    config.confidentiality.style.cursor = 'pointer';
    config.confidentiality.addEventListener('click', function () {
      openFromItem('confidentiality', 'Confidentiality Agreement');
    });
  }

  if (config.risk) {
    config.risk.style.cursor = 'pointer';
    config.risk.addEventListener('click', function () {
      openFromItem('risk', 'Risk Disclosure Agreement');
    });
  }
})();
