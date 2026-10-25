/* Add USDT address page, rebuilt from the original Veer.Game flow. */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var NETWORKS = [
    { bankID: 3, bankName: 'TRC', max: 36 },
    { bankID: 4, bankName: 'BEP', max: 42 },
    { bankID: 5, bankName: 'ERC', max: 46 }
  ];

  var ITEM_HEIGHT = 44;
  var PICKER_HEIGHT = 264;
  var PICKER_PADDING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

  var select = document.getElementById('networkSelect');
  var networkName = document.getElementById('networkName');
  var address = document.getElementById('usdtAddress');
  var alias = document.getElementById('usdtAlias');
  var saveBtn = document.getElementById('saveBtn');
  var overlay = document.getElementById('networkOverlay');
  var popup = document.getElementById('networkPopup');
  var pickerWrapper = document.getElementById('networkPickerWrapper');
  var cancelBtn = document.getElementById('networkCancel');
  var confirmBtn = document.getElementById('networkConfirm');
  var current = NETWORKS[0];
  var pickerIndex = 0;
  var pickerOffset = PICKER_PADDING;
  var drag = null;
  var dragMoved = false;
  var closeTimer = null;

  function toast(msg) {
    if (window.VUI) VUI.toast(msg, 2200);
    else RS.toast(msg);
  }

  function refresh() {
    var ok = current && current.bankID && address.value.trim() && alias.value.trim();
    saveBtn.classList.toggle('active', !!ok);
  }

  function offsetFor(index) {
    return PICKER_PADDING - index * ITEM_HEIGHT;
  }

  function clampOffset(offset) {
    var min = offsetFor(NETWORKS.length - 1);
    return Math.max(min, Math.min(PICKER_PADDING, offset));
  }

  function setOffset(offset, animate) {
    pickerOffset = offset;
    pickerWrapper.style.transitionDuration = animate ? '300ms' : '0ms';
    pickerWrapper.style.transitionProperty = animate ? 'transform' : 'none';
    pickerWrapper.style.transform = 'translate3d(0px, ' + offset + 'px, 0px)';
  }

  function setSelected(index, animate) {
    pickerIndex = Math.max(0, Math.min(NETWORKS.length - 1, index));
    Array.prototype.forEach.call(pickerWrapper.children, function (li, i) {
      li.classList.toggle('van-picker-column__item--selected', i === pickerIndex);
    });
    setOffset(offsetFor(pickerIndex), animate);
  }

  function renderPicker() {
    pickerWrapper.innerHTML = '';
    NETWORKS.forEach(function (n, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.className = 'van-picker-column__item';
      li.style.height = ITEM_HEIGHT + 'px';
      var label = document.createElement('div');
      label.className = 'van-ellipsis';
      label.textContent = n.bankName;
      li.appendChild(label);
      li.addEventListener('click', function () {
        if (dragMoved) {
          dragMoved = false;
          return;
        }
        setSelected(i, true);
      });
      pickerWrapper.appendChild(li);
    });
    setSelected(Math.max(0, NETWORKS.indexOf(current)), false);
  }

  function openPicker() {
    clearTimeout(closeTimer);
    renderPicker();

    overlay.style.display = 'block';
    overlay.classList.remove('van-fade-leave-active');
    overlay.classList.add('van-fade-enter-active');

    popup.style.display = 'block';
    popup.classList.remove('van-popup-slide-bottom-leave-active');
    popup.classList.add('van-popup-slide-bottom-enter-active', 'van-popup-slide-bottom-enter-from');
    void popup.offsetWidth;
    popup.classList.remove('van-popup-slide-bottom-enter-from');
  }

  function closePicker(apply) {
    if (apply) {
      current = NETWORKS[pickerIndex];
      networkName.textContent = current.bankName;
      address.maxLength = current.max;
      refresh();
    }

    popup.classList.remove('van-popup-slide-bottom-enter-active', 'van-popup-slide-bottom-enter-from');
    popup.classList.add('van-popup-slide-bottom-leave-active');
    overlay.classList.remove('van-fade-enter-active');
    overlay.classList.add('van-fade-leave-active');

    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      popup.style.display = 'none';
      overlay.style.display = 'none';
      popup.classList.remove('van-popup-slide-bottom-leave-active');
      overlay.classList.remove('van-fade-leave-active');
    }, 300);
  }

  pickerWrapper.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    dragMoved = false;
    drag = { y: e.clientY, offset: pickerOffset, id: e.pointerId };
    pickerWrapper.style.transitionDuration = '0ms';
    pickerWrapper.style.transitionProperty = 'none';
    try {
      pickerWrapper.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  pickerWrapper.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var delta = e.clientY - drag.y;
    if (Math.abs(delta) > 3) dragMoved = true;
    setOffset(clampOffset(drag.offset + delta), false);
  });

  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    setSelected(Math.round((PICKER_PADDING - pickerOffset) / ITEM_HEIGHT), true);
  }

  pickerWrapper.addEventListener('pointerup', endDrag);
  pickerWrapper.addEventListener('pointercancel', endDrag);

  pickerWrapper.addEventListener('wheel', function (e) {
    e.preventDefault();
    var index = Math.round((PICKER_PADDING - pickerOffset) / ITEM_HEIGHT);
    setSelected(index + (e.deltaY > 0 ? 1 : -1), true);
  }, { passive: false });

  select.addEventListener('click', openPicker);
  cancelBtn.addEventListener('click', function () { closePicker(false); });
  confirmBtn.addEventListener('click', function () { closePicker(true); });
  overlay.addEventListener('click', function () { closePicker(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && popup.style.display === 'block') closePicker(false);
  });

  address.addEventListener('input', function () {
    address.value = address.value.replace(/[^\w\/]/g, '');
    refresh();
  });
  alias.addEventListener('input', refresh);

  document.querySelector('.navbar__content-left').addEventListener('click', function () {
    RS.back('../withdraw/index.html');
  });

  saveBtn.addEventListener('click', function () {
    var addr = address.value.trim();
    var name = current.bankName.toUpperCase();
    if (!current || !current.bankID) return toast('Select main network');
    if (!addr) return toast('Please enter the USDT address');
    if (!alias.value.trim()) return toast('Please enter alias address');
    if (name.indexOf('BEP') !== -1) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return toast('USDT address format is incorrect');
    } else if (name.indexOf('TRC') !== -1) {
      if (addr.length < 30) return toast('USDT address length must not exceed 36 characters');
      if (addr.slice(0, 1) !== 'T' || addr.length > 36) return toast('USDT address format is incorrect');
    } else if (name.indexOf('ERC') !== -1) {
      if (addr.length < 30) return toast('USDT address length must not exceed 36 characters');
      if (addr.slice(0, 2) !== '0x' || addr.length > 46) return toast('USDT address format is incorrect');
    }

    try {
      localStorage.setItem('rsclub_usdt_address', JSON.stringify({
        bankid: current.bankID,
        bankName: current.bankName,
        accountNo: addr,
        usdtRemarkName: alias.value.trim()
      }));
      localStorage.setItem('rsclub_withdraw_method', 'USDT');
    } catch (e) {}

    if (window.VUI) VUI.flash('Added successfully');
    location.replace('../withdraw/index.html?type=Add');
  });

  address.maxLength = current.max;
  refresh();
})();
