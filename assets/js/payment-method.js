/* Payment Method list page: saved UPI methods + add flow. */
(function () {
  'use strict';

  function stored(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  if (!stored('rsclub_uid')) {
    window.location.replace('../home/index.html');
    return;
  }

  function go(url) { window.location.href = url; }

  var back = document.querySelector('.navbar__content-left');
  if (back) {
    back.style.cursor = 'pointer';
    back.addEventListener('click', function () {
      if (window.history.length > 1) window.history.back();
      else go('../withdraw/index.html');
    });
  }

  var add = document.querySelector('.upi_C-addbtn');
  if (add) {
    add.style.cursor = 'pointer';
    add.addEventListener('click', function () {
      go('../withdraw-add-upi/index.html?from=payment-method');
    });
  }

  var account = null;
  try { account = JSON.parse(stored('rsclub_upi') || 'null'); } catch (e) {}
  var list = document.querySelector('.upi_C-list');
  if (!list || !account || !account.accountNo) return;

  list.innerHTML = '';
  list.style.display = 'block';
  list.style.padding = '.32rem';
  list.style.background = 'var(--bg_color_L2, #25272A)';
  list.style.borderRadius = '.18rem';
  list.style.margin = '.32rem';
  list.style.cursor = 'pointer';

  var title = document.createElement('div');
  title.textContent = 'UPI';
  title.style.fontSize = '.4rem';
  title.style.fontWeight = '700';
  title.style.color = 'var(--main-color, #20D374)';
  title.style.marginBottom = '.16rem';

  var name = document.createElement('div');
  name.textContent = account.beneficiaryName || 'UPI account';
  name.style.fontSize = '.36rem';
  name.style.color = 'var(--text_color_L1, #fff)';
  name.style.marginBottom = '.1rem';

  var id = document.createElement('div');
  id.textContent = account.accountNo;
  id.style.fontSize = '.34rem';
  id.style.color = 'var(--text_color_L2, #D7D7D7)';

  list.appendChild(title);
  list.appendChild(name);
  list.appendChild(id);
  list.addEventListener('click', function () {
    go('../withdraw-add-upi/index.html?from=payment-method');
  });
})();
