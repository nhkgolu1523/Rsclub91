(function () {
  'use strict';

  function toast(message) {
    var old = document.getElementById('rsGiftToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsGiftToast';
    el.className = 'rs-toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('rs-toast--show'); });
    window.setTimeout(function () {
      el.classList.remove('rs-toast--show');
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    }, 1800);
  }

  var title = document.querySelector('.redeem-container .navbar__content-title');
  if (title) title.textContent = 'Gift';

  var name = '';
  try { name = localStorage.getItem('rsclub_username') || ''; } catch (e) {}
  var greeting = document.querySelector('.redeem-container-header-greet h3');
  if (greeting && name) greeting.textContent = 'Hi, ' + name;

  var input = document.querySelector('.redeem-container-receive input');
  var receive = document.querySelector('.redeem-container-receive button');
  if (receive) {
    receive.addEventListener('click', function (event) {
      event.preventDefault();
      var code = input ? input.value.replace(/\s+/g, '') : '';
      if (!code) {
        toast('Please enter the gift code.');
        if (input) input.focus();
        return;
      }
      if (code.length < 4) {
        toast('Please enter a valid gift code.');
        if (input) input.focus();
        return;
      }
      if (input) input.value = '';
      toast('Gift code submitted successfully.');
    });
  }

  var customer = document.getElementById('customerId');
  if (customer) {
    customer.addEventListener('click', function () {
      toast('Customer service will be available soon.');
    });
  }
})();
