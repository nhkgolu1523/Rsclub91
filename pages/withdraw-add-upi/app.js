/* Add UPI page, rebuilt from the original Veer.Game flow. */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var name = document.getElementById('upiName');
  var phone = document.getElementById('upiPhone');
  var upi = document.getElementById('upiId');
  var confirm = document.getElementById('upiConfirm');
  var saveBtn = document.getElementById('saveBtn');
  var fromList = /[?&]from=payment-method(?:&|$)/.test(window.location.search);
  var UPI_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$/;

  function toast(msg) {
    if (window.VUI) VUI.toast(msg, 2400);
    else RS.toast(msg);
  }

  function valid() {
    var n = name.value.trim();
    var ph = phone.value.trim();
    var u = upi.value.trim();
    var c = confirm.value.trim();
    return n.length >= 2 && /^[0-9]{10}$/.test(ph) && UPI_RE.test(u) && UPI_RE.test(c) && u === c;
  }

  function refresh() {
    saveBtn.classList.toggle('disable', !valid());
  }

  function bind(el) {
    if (!el) return;
    ['input', 'keyup', 'change', 'paste', 'blur'].forEach(function (ev) {
      el.addEventListener(ev, function () { setTimeout(refresh, 0); });
    });
  }

  name.addEventListener('input', function () {
    name.value = name.value.replace(/[^A-Za-z .'-]/g, '');
    refresh();
  });
  phone.addEventListener('input', function () {
    phone.value = phone.value.replace(/[^0-9]/g, '');
    refresh();
  });
  upi.addEventListener('input', function () {
    upi.value = upi.value.replace(/[^A-Za-z0-9@._-]/g, '');
    refresh();
  });
  confirm.addEventListener('input', function () {
    confirm.value = confirm.value.replace(/[^A-Za-z0-9@._-]/g, '');
    refresh();
  });
  bind(name); bind(phone); bind(upi); bind(confirm);

  document.querySelector('.navbar__content-left').addEventListener('click', function () {
    RS.back(fromList ? '../payment-method/index.html' : '../withdraw/index.html');
  });

  try {
    var saved = JSON.parse(localStorage.getItem('rsclub_upi') || 'null');
    if (saved) {
      name.value = saved.beneficiaryName || '';
      phone.value = saved.mobileNo || '';
      upi.value = saved.accountNo || '';
      confirm.value = saved.accountNo || '';
    }
  } catch (e) {}

  saveBtn.addEventListener('click', function () {
    if (saveBtn.classList.contains('disable')) {
      if (!name.value.trim()) return toast('Please enter UPI name');
      if (!phone.value.trim()) return toast('Please enter the phone number');
      if (!/^[0-9]{10}$/.test(phone.value.trim())) return toast('Invalid phone number. Please enter a valid number.');
      if (!UPI_RE.test(upi.value.trim())) return toast('Please enter correct UPI ID');
      if (!UPI_RE.test(confirm.value.trim())) return toast('Please enter correct UPI ID');
      if (upi.value.trim() !== confirm.value.trim()) return toast('Confirm that UPI ID is inconsistent with UPI ID');
      return;
    }

    try {
      localStorage.setItem('rsclub_upi', JSON.stringify({
        beneficiaryName: name.value.trim(),
        mobileNo: phone.value,
        accountNo: upi.value.trim()
      }));
      localStorage.setItem('rsclub_withdraw_method', 'UPI');
    } catch (e) {}

    if (window.VUI) VUI.flash('Added successfully');
    location.replace('../withdraw/index.html?type=Add');
  });

  refresh();
})();
