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
  var UPI_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/;

  function toast(msg) {
    if (window.VUI) VUI.toast(msg, 2400);
    else RS.toast(msg);
  }

  function valid() {
    return name.value.trim() && /^[0-9]{10}$/.test(phone.value)
      && UPI_RE.test(upi.value.trim()) && UPI_RE.test(confirm.value.trim())
      && upi.value.trim() === confirm.value.trim();
  }

  function refresh() {
    saveBtn.classList.toggle('disable', !valid());
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
      if (!phone.value) return toast('Please enter the phone number');
      if (!/^[0-9]{10}$/.test(phone.value)) return toast('Invalid phone number. Please enter a valid number.');
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
