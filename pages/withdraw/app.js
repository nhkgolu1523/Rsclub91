/* Withdraw page interactions, rebuilt from the original Veer.Game flow. */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var back = document.querySelector('.navbar__content-left');
  if (back) {
    back.style.cursor = 'pointer';
    back.addEventListener('click', function () { RS.back('../account/index.html'); });
  }

  var histLink = document.querySelector('.navbar__content-right');
  if (histLink) {
    histLink.style.cursor = 'pointer';
    histLink.addEventListener('click', function () {
      var sec = document.querySelector('.rechargeh__container');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else toast('No withdrawal history yet.');
    });
  }

  var allHist = document.querySelector('.rechargeh__container-footer button');
  if (allHist) allHist.addEventListener('click', function () { toast('No withdrawal history yet.'); });

  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k) || '';
      localStorage.setItem(k, v);
    } catch (e) {}
    return v;
  }

  function readJson(key) {
    var raw = store(key);
    if (!raw) return null;
    try {
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : null;
    } catch (e) {
      return null;
    }
  }

  function toast(msg) {
    if (window.VUI) VUI.toast(msg, 2400);
    else RS.toast(msg);
  }

  /* ---------------------------------------------------------- sections */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.withdrawWay > div')).filter(function (el) {
    return !el.classList.contains('c2c');
  });
  var defaultExplain = document.querySelector('.explain:not(.usdt)');
  var usdtExplain = document.querySelector('.explain.usdt');
  var upiBox = document.querySelector('.c2cUpi');
  var addType = document.querySelector('.addWithdrawType');
  var addTypeLabel = addType ? addType.querySelector('.addWithdrawType-top span') : null;
  var addTypeWarn = addType ? addType.querySelector('.addWithdrawType-text') : null;
  var withdrawWrap = document.querySelector('.withdraw__container-content');
  var intro = document.querySelector('.Recharge__container-intro .br');
  var selected = 'UPI';
  var MINIMUM = { 'BANK CARD': 110, UPI: 1001, USDT: 1000 };

  var savedInfo = null;
  if (withdrawWrap) {
    savedInfo = document.createElement('div');
    savedInfo.className = 'bankInfo';
    savedInfo.setAttribute('data-v-80a607a5', '');
    savedInfo.style.display = 'none';
    if (addType && addType.parentNode === withdrawWrap) withdrawWrap.insertBefore(savedInfo, addType);
    else withdrawWrap.appendChild(savedInfo);
  }

  function tabByName(name) {
    for (var i = 0; i < tabs.length; i++) {
      if ((tabs[i].textContent || '').replace(/\s+/g, ' ').trim() === name) return tabs[i];
    }
    return null;
  }

  function accountFor(name) {
    if (name === 'USDT') return readJson('rsclub_usdt_address');
    if (name === 'BANK CARD') return readJson('rsclub_bank');
    return readJson('rsclub_upi');
  }

  /* USDT section: restore its title + second (USDT amount) input. */
  var usdtIcon = null;
  if (tabs[2]) {
    var ti = tabs[2].querySelector('img');
    if (ti) usdtIcon = ti.getAttribute('src');
  }
  if (usdtExplain) {
    var head = usdtExplain.querySelector('.head');
    if (head) {
      var headImg = head.querySelector('img');
      if (headImg && usdtIcon) headImg.setAttribute('src', usdtIcon);
      if (!head.querySelector('h1')) {
        var h1 = document.createElement('h1');
        h1.setAttribute('data-v-cb5583fe', '');
        h1.textContent = 'Select amount of USDT';
        head.appendChild(h1);
      }
    }
    var firstWrap = usdtExplain.querySelector('.input');
    if (firstWrap && !usdtExplain.querySelectorAll('.input')[1]) {
      var wrap = document.createElement('div');
      wrap.className = 'input';
      wrap.setAttribute('data-v-cb5583fe', '');
      wrap.innerHTML = '<input class="inp" data-v-cb5583fe="" type="number" placeholder="Please enter USDT amount" autocomplete="off">'
        + '<div class="place-div" data-v-cb5583fe=""><div class="place-icon" data-v-cb5583fe="">'
        + (usdtIcon ? '<img data-v-cb5583fe="" src="' + usdtIcon + '">' : 'USDT')
        + '</div></div>';
      firstWrap.parentNode.insertBefore(wrap, firstWrap.nextSibling);
    }
  }
  var usdtInputs = usdtExplain ? Array.prototype.slice.call(usdtExplain.querySelectorAll('.inp')) : [];
  var usdtWithdrawInput = usdtInputs[0] || null;
  var usdtAmountInput = usdtInputs[1] || null;
  var usdtAll = usdtExplain ? usdtExplain.querySelector('.balance.usdt input[type="button"]') : null;

  /* ---------------------------------------------------------- amount */
  var input = document.querySelector('.explain:not(.usdt) .input .inp');
  var btn = document.querySelector('.recycleBtnD .recycleBtn') || document.querySelector('.recycleBtn');
  var amountInputs = [input, usdtWithdrawInput, usdtAmountInput];

  amountInputs.forEach(function (el, i) {
    if (!el) return;
    el.setAttribute('name', i === 0 ? 'withdrawAmount' : i === 1 ? 'usdtWithdrawAmount' : 'usdtAmount');
    el.setAttribute('inputmode', 'decimal');
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('data-lpignore', 'true');
    el.setAttribute('data-1p-ignore', 'true');
    el.setAttribute('data-form-type', 'other');
    if (i === 0) {
      el.setAttribute('type', 'number');
      el.setAttribute('min', '0');
      el.setAttribute('step', '0.01');
    }
  });

  function clearAmounts() {
    if (input) input.value = '';
    if (usdtWithdrawInput) usdtWithdrawInput.value = '';
    if (usdtAmountInput) usdtAmountInput.value = '';
  }

  function clearAutofilledPrefix() {
    var cleared = false;
    amountInputs.forEach(function (el) {
      if (el && /^\s*\+/.test(String(el.value || ''))) {
        el.value = '';
        cleared = true;
      }
    });
    if (cleared) refresh();
  }

  var lastAmountGesture = 0;
  var lastKeyboardGesture = 0;

  document.addEventListener('keydown', function () { lastKeyboardGesture = Date.now(); }, true);

  function noteAmountGesture() { lastAmountGesture = Date.now(); }

  function amountGestureIsRecent() {
    var now = Date.now();
    return now - lastAmountGesture < 800 || now - lastKeyboardGesture < 800;
  }

  function dismissRestoredAutofill() {
    if (amountGestureIsRecent()) return;
    amountInputs.forEach(function (el) {
      if (el && document.activeElement === el) el.blur();
    });
    clearAutofilledPrefix();
  }

  var amountTouched = false;
  var restoreWatch = null;

  function markAmountTouched() {
    amountTouched = true;
    if (restoreWatch) {
      clearInterval(restoreWatch);
      restoreWatch = null;
    }
  }

  function clearRestoredAmounts() {
    if (amountTouched) return;
    if (!(input && input.value) && !(usdtWithdrawInput && usdtWithdrawInput.value) && !(usdtAmountInput && usdtAmountInput.value)) return;
    clearAmounts();
    refresh();
  }

  function watchRestoredAmounts() {
    amountTouched = false;
    if (restoreWatch) clearInterval(restoreWatch);
    clearRestoredAmounts();
    var started = Date.now();
    restoreWatch = setInterval(function () {
      if (amountTouched || Date.now() - started >= 3000) {
        clearInterval(restoreWatch);
        restoreWatch = null;
        return;
      }
      clearRestoredAmounts();
    }, 100);
  }

  amountInputs.forEach(function (el) {
    if (!el) return;
    el.addEventListener('beforeinput', markAmountTouched);
    el.addEventListener('paste', markAmountTouched);
    el.addEventListener('keydown', function (e) {
      noteAmountGesture();
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key.length === 1) markAmountTouched();
    });
    el.addEventListener('pointerdown', noteAmountGesture, { passive: true });
    el.addEventListener('touchstart', noteAmountGesture, { passive: true });
    ['focus', 'pointerdown', 'click'].forEach(function (evt) {
      el.addEventListener(evt, function () {
        setTimeout(clearAutofilledPrefix, 0);
        setTimeout(clearAutofilledPrefix, 150);
      });
    });
    el.addEventListener('focus', function () {
      if (amountGestureIsRecent()) return;
      setTimeout(function () {
        if (!amountGestureIsRecent() && document.activeElement === el) el.blur();
        clearAutofilledPrefix();
      }, 0);
    });
  });

  function currentInput() { return selected === 'USDT' ? usdtWithdrawInput : input; }
  function amount() {
    var el = currentInput();
    return el ? Number(String(el.value).replace(/[^0-9.]/g, '')) || 0 : 0;
  }
  function refresh() {
    if (!btn) return;
    btn.classList.toggle('active', amount() > 0);
  }
  function sanitize(el) {
    if (/^\s*\+/.test(String(el.value || ''))) {
      el.value = '';
      return;
    }
    var cleaned = String(el.value).replace(/[^0-9.]/g, '');
    var parts = cleaned.split('.');
    if (parts.length > 2) cleaned = parts[0] + '.' + parts.slice(1).join('');
    if (cleaned.indexOf('.') !== -1) {
      var p = cleaned.split('.');
      cleaned = p[0] + '.' + p[1].slice(0, 2);
    }
    if (cleaned !== el.value) el.value = cleaned;
  }

  if (input) input.addEventListener('input', function () { sanitize(input); refresh(); });
  if (usdtWithdrawInput) {
    usdtWithdrawInput.addEventListener('input', function () {
      sanitize(usdtWithdrawInput);
      if (usdtAmountInput) usdtAmountInput.value = usdtWithdrawInput.value;
      refresh();
    });
  }
  if (usdtAmountInput) {
    usdtAmountInput.addEventListener('input', function () {
      sanitize(usdtAmountInput);
      if (usdtWithdrawInput) usdtWithdrawInput.value = usdtAmountInput.value;
      refresh();
    });
  }

  var allBtn = document.querySelector('.explain:not(.usdt) .balance.bank input[type="button"]');
  if (allBtn) {
    allBtn.addEventListener('click', function () {
      markAmountTouched();
      var maxEl = document.querySelector('.explain:not(.usdt) .balance.bank .yellow');
      var max = maxEl ? Number(String(maxEl.textContent).replace(/[^0-9.]/g, '')) || 0 : 0;
      if (input) input.value = max > 0 ? String(max) : '0.00';
      refresh();
    });
  }
  if (usdtAll) {
    usdtAll.addEventListener('click', function () {
      markAmountTouched();
      var maxEl = usdtExplain.querySelector('.balance.usdt .yellow');
      var max = maxEl ? Number(String(maxEl.textContent).replace(/[^0-9.]/g, '')) || 0 : 0;
      var v = max > 0 ? String(max) : '0.00';
      if (usdtWithdrawInput) usdtWithdrawInput.value = v;
      if (usdtAmountInput) usdtAmountInput.value = v;
      refresh();
    });
  }

  /* ------------------------------------------------ saved beneficiary */
  function renderSavedInfo(name) {
    if (!savedInfo) return;
    var acc = accountFor(name);
    savedInfo.innerHTML = '';
    savedInfo.style.display = 'none';
    if (!acc || name === 'UPI') return;

    var row = document.createElement('div');
    row.setAttribute('data-v-80a607a5', '');
    if (name === 'BANK CARD') {
      row.className = 'bankInfoItem type1';
      row.innerHTML = '<div data-v-80a607a5=""><svg class="svg-icon" data-v-80a607a5=""><use href="#icon-1"></use></svg>'
        + '<span data-v-80a607a5=""></span></div>'
        + '<div data-v-80a607a5=""><span data-v-80a607a5=""></span><span data-v-80a607a5=""></span></div>'
        + '<i class="van-badge__wrapper van-icon van-icon-arrow" data-v-80a607a5=""></i>';
      var spans = row.querySelectorAll('span');
      spans[0].textContent = acc.bankName || 'Bank';
      spans[1].textContent = acc.beneficiaryName || '';
      spans[2].textContent = acc.accountNo || '';
    } else {
      row.className = 'bankInfoItem usdt';
      row.innerHTML = '<div data-v-80a607a5=""><svg class="svg-icon" data-v-80a607a5=""><use href="#icon-usdt1"></use></svg>'
        + '<span data-v-80a607a5=""></span></div>'
        + '<div data-v-80a607a5=""><span data-v-80a607a5=""></span>'
        + '<i class="van-badge__wrapper van-icon van-icon-arrow" data-v-80a607a5=""></i></div>'
        + '<div data-v-80a607a5=""><span data-v-80a607a5=""></span></div>';
      var us = row.querySelectorAll('span');
      us[0].textContent = acc.usdtRemarkName || acc.bankName || 'USDT';
      us[1].textContent = acc.accountNo || '';
      us[2].textContent = acc.usdtRemarkName || '';
    }

    row.style.cursor = 'pointer';
    row.addEventListener('click', function () { openAdd(name); });
    savedInfo.appendChild(row);
    savedInfo.style.display = '';
  }

  function renderIntro(name) {
    if (!intro) return;
    var time = name === 'UPI' ? '00:00-23:59' : '00:10-23:50';
    var range = name === 'UPI' ? '\u20b91,001.00-\u20b950,000.00' : name === 'USDT' ? '\u20b91,000.00-\u20b91,000,000.00' : '\u20b9110.00-\u20b950,000.00';
    var extra = name === 'USDT'
      ? '<p data-v-76eb7f31="">After withdraw, you need to confirm the blockchain main network 3 times before it arrives at your account.</p><p data-v-76eb7f31="">Please confirm that the operating environment is safe to avoid information being tampered with or leaked.</p>'
      : '';
    intro.innerHTML = '<p data-v-76eb7f31="">Need to bet <span data-v-470caa86="" class="red">\u20b90.00</span> to be able to withdraw</p>'
      + '<p data-v-76eb7f31="">Withdraw time <span data-v-76eb7f31="" class="red">' + time + '</span></p>'
      + '<p data-v-76eb7f31="">Inday Remaining Withdrawal Times<span data-v-76eb7f31="" class="red">3</span></p>'
      + '<p data-v-76eb7f31="">Withdrawal amount range <span data-v-76eb7f31="" class="red">' + range + '</span></p>'
      + extra
      + '<p data-v-76eb7f31="">Please check your registered bank information again before making a withdrawal. If your registered bank information is incorrect, our company will not be responsible for any losses you may incur.</p>'
      + '<p data-v-76eb7f31="">If your registered bank information is incorrect, please contact customer service.</p>';
  }

  /* ---------------------------------------------------- method switch */
  function setMethod(name, tab) {
    selected = name;
    clearAmounts();
    if (tab) tabs.forEach(function (x) { x.classList.toggle('select', x === tab); });
    store('rsclub_withdraw_method', name);
    renderIntro(name);

    var isUpi = name === 'UPI';
    if (upiBox) upiBox.style.display = isUpi ? '' : 'none';
    var acc = isUpi ? null : accountFor(name);
    if (addType) {
      addType.style.display = isUpi || acc ? 'none' : '';
      if (!isUpi) {
        if (addTypeLabel) addTypeLabel.textContent = name === 'USDT' ? 'Add address' : 'Add a bank account number';
        if (addTypeWarn) addTypeWarn.style.display = '';
      }
    }
    renderSavedInfo(name);
    if (defaultExplain) defaultExplain.style.display = name === 'USDT' ? 'none' : '';
    if (usdtExplain) usdtExplain.style.display = name === 'USDT' ? '' : 'none';
    refresh();
  }

  function openAdd(name) {
    store('rsclub_withdraw_method', name);
    if (name === 'USDT') location.href = '../withdraw-add-usdt/index.html';
    else if (name === 'BANK CARD') location.href = '../withdraw-add-bank/index.html';
    else location.href = '../payment-method/index.html';
  }

  tabs.forEach(function (tab) {
    tab.style.cursor = 'pointer';
    tab.addEventListener('click', function () {
      var name = (tab.textContent || '').replace(/\s+/g, ' ').trim();
      setMethod(name, tab);
    });
  });

  if (addType) {
    addType.style.cursor = 'pointer';
    addType.addEventListener('click', function () {
      if (selected === 'UPI') return;
      openAdd(selected);
    });
  }

  /* UPI beneficiary */
  function renderUpi() {
    if (!upiBox) return;
    var acc = accountFor('UPI');
    if (!acc) {
      upiBox.className = 'c2cUpi noUpi';
      upiBox.textContent = 'Add UPI';
      return;
    }
    upiBox.className = 'c2cUpi';
    upiBox.innerHTML = '<div class="title" data-v-fe54ed07=""><svg class="svg-icon" data-v-fe54ed07=""><use href="#icon-upi"></use></svg>'
      + '<span data-v-fe54ed07="">UPI</span></div>'
      + '<div class="name" data-v-fe54ed07=""></div>'
      + '<i class="van-badge__wrapper van-icon van-icon-arrow right-icon" data-v-fe54ed07="" style="font-size:12px"></i>';
    upiBox.querySelector('.name').textContent = acc.accountNo || '';
  }
  renderUpi();
  if (upiBox) {
    upiBox.style.cursor = 'pointer';
    upiBox.addEventListener('click', function () { openAdd('UPI'); });
  }

  /* ------------------------------------------------------ password flow */
  var pwdOverlay = document.getElementById('pwdOverlay');
  var pwdPopup = document.getElementById('pwdPopup');
  var pwdInput = document.getElementById('withdrawPwd');
  var pwdCancel = document.getElementById('pwdCancel');
  var pwdConfirm = document.getElementById('pwdConfirm');
  var okOverlay = document.getElementById('okOverlay');
  var okDialog = document.getElementById('okDialog');
  var okConfirm = document.getElementById('okConfirm');

  function openPwd() {
    if (!pwdPopup) return;
    pwdOverlay.style.display = '';
    pwdPopup.style.display = '';
    pwdInput.value = '';
    setTimeout(function () { pwdInput.focus(); }, 60);
  }
  function closePwd() {
    if (!pwdPopup) return;
    pwdOverlay.style.display = 'none';
    pwdPopup.style.display = 'none';
  }
  function openOk() {
    okOverlay.style.display = '';
    okDialog.style.display = '';
  }
  function closeOk() {
    okOverlay.style.display = 'none';
    okDialog.style.display = 'none';
  }

  if (pwdCancel) pwdCancel.addEventListener('click', closePwd);
  if (pwdOverlay) pwdOverlay.addEventListener('click', closePwd);
  if (okOverlay) okOverlay.addEventListener('click', closeOk);
  if (okConfirm) okConfirm.addEventListener('click', closeOk);

  var eye = document.getElementById('pwdEye');
  if (eye) {
    eye.style.cursor = 'pointer';
    eye.addEventListener('click', function () {
      pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
    });
  }
  var forgot = document.getElementById('forgotPwd');
  if (forgot) forgot.addEventListener('click', function () { toast('Please contact customer service to reset your password.'); });
  var contact = document.getElementById('contactService');
  if (contact) contact.addEventListener('click', function () { toast('Please contact customer service.'); });

  if (pwdConfirm) {
    pwdConfirm.addEventListener('click', function () {
      if (!pwdInput.value) return toast('Please enter your login password');
      closePwd();
      openOk();
      if (input) input.value = '';
      if (usdtWithdrawInput) usdtWithdrawInput.value = '';
      if (usdtAmountInput) usdtAmountInput.value = '';
      refresh();
    });
  }

  if (btn) {
    btn.addEventListener('click', function () {
      var v = amount();
      if (!v) return toast('Please enter withdrawal amount');
      var min = MINIMUM[selected] || 100;
      if (v < min) return toast('Minimum withdrawal amount is ' + min);
      if (selected === 'UPI' && !accountFor('UPI')) return openAdd('UPI');
      openPwd();
    });
  }

  /* ------------------------------------------------ restore last state */
  var last = store('rsclub_withdraw_method') || 'UPI';
  if (last !== 'UPI' && last !== 'USDT' && last !== 'BANK CARD') last = 'UPI';
  setMethod(last, tabByName(last));
  watchRestoredAmounts();
  window.addEventListener('pageshow', function () {
    watchRestoredAmounts();
    clearAutofilledPrefix();
  });
  window.addEventListener('focus', clearAutofilledPrefix);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) clearAutofilledPrefix();
  });
  setInterval(clearAutofilledPrefix, 200);
  setTimeout(dismissRestoredAutofill, 80);
  setTimeout(dismissRestoredAutofill, 600);

  if (window.VUI) {
    var flash = VUI.takeFlash();
    if (flash) setTimeout(function () { VUI.toast(flash, 2200); }, 120);
  }
})();
