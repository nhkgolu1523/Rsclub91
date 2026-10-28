/* Deposit page interactions (static UI, backend hook-up later). */
(function () {
  'use strict';
  if (!window.RS || !RS.guard('../home/index.html')) return;

  var back = document.querySelector('.navbar__content-left');
  if (back) {
    back.style.cursor = 'pointer';
    back.addEventListener('click', function () { RS.back('../account/index.html'); });
  }

  function history() {
    var sec = document.querySelector('.record__main');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var histLink = document.querySelector('.navbar__content-right');
  if (histLink) { histLink.style.cursor = 'pointer'; histLink.addEventListener('click', history); }

  var methodLabel = document.querySelector('.Recharge__content-fixed-box h2');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.Recharge__container-tabcard__items'));
  function currentMethod() { return methodLabel ? (methodLabel.textContent || '').trim() : 'UPI-QR'; }
  cards.forEach(function (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function () {
      cards.forEach(function (c) { c.classList.remove('active'); });
      card.classList.add('active');
      var bot = card.querySelector('.Recharge__container-tabcard__bot');
      if (methodLabel && bot) methodLabel.textContent = (bot.textContent || '').replace(/\s+/g, ' ').trim();
    });
  });

  var input = document.querySelector('.Recharge__content-paymoney .van-field__control');
  var btn = document.querySelector('.Recharge__content-fixed-box .Recharge__container-rechageBtn')
    || document.querySelector('.Recharge__container-rechageBtn');
  function amount() {
    var n = input ? Number(String(input.value).replace(/[^0-9.]/g, '')) || 0 : 0;
    return Math.round(n);
  }
  function money(n) {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function refresh() {
    var v = amount();
    if (btn) {
      if (v >= 100) {
        btn.classList.add('rechage_active');
        btn.textContent = 'Deposit ₹' + money(v);
      } else {
        btn.classList.remove('rechage_active');
        btn.textContent = 'Deposit';
      }
    }
  }
  function setInput(v) {
    if (!input) return;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  var chips = Array.prototype.slice.call(document.querySelectorAll('.Recharge__content-paymoney__money-list__item'));
  function parseChip(t) {
    t = String(t).replace(/[^0-9.Kk]/g, '');
    var mult = /[kK]/.test(t) ? 1000 : 1;
    var n = parseFloat(t.replace(/[kK]/g, '')) || 0;
    return Math.round(n * mult);
  }
  function markChip() {
    var v = amount();
    chips.forEach(function (c) {
      if (v && parseChip(c.textContent) === v) c.classList.add('active');
      else c.classList.remove('active');
    });
  }
  chips.forEach(function (chip) {
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', function () {
      var v = parseChip(chip.textContent);
      if (v) { setInput(v); markChip(); refresh(); }
    });
  });

  if (input) {
    input.addEventListener('input', function () {
      var cleaned = String(input.value).replace(/[^0-9]/g, '');
      if (cleaned !== input.value) input.value = cleaned;
      markChip();
      refresh();
    });
    input.addEventListener('blur', function () {
      if (amount() > 50000) setInput(50000);
      markChip();
      refresh();
    });
  }

  var clearBtn = document.querySelector('.Recharge__content-paymoney__money-input .place-right');
  if (clearBtn) {
    clearBtn.style.cursor = 'pointer';
    clearBtn.addEventListener('click', function () {
      setInput('');
      chips.forEach(function (c) { c.classList.remove('active'); });
      refresh();
    });
  }

  if (btn) {
    btn.addEventListener('click', function () {
      var v = amount();
      if (!v) return RS.toast('Please enter the deposit amount.');
      if (v < 100) return RS.toast('Minimum deposit amount is ₹100.');
      if (v > 50000) return RS.toast('Maximum deposit amount is ₹50,000.');
      var method = currentMethod();
      RS.modal({
        title: 'Deposit',
        body: '<p>Amount: <b>₹' + money(v) + '</b></p>'
          + '<p>Method: <b>' + RS.esc(method) + '</b></p>'
          + '<div class="rs-qr"></div>'
          + '<p class="muted" style="text-align:center">Scan the QR with any UPI app and transfer the exact amount.</p>',
        okText: 'I have paid',
        onOk: function () {
          RS.toast('Deposit request submitted. Awaiting confirmation.');
          /* invitation worker ko deposit event (commission/bonus/team stats).
             NOTE: real deposit confirm hone par hi credit hona chahiye; abhi
             ye UI-test keen liye bheja ja raha hai. */
          try {
            var u = localStorage.getItem('rsclub_uid') || '';
            if (u) {
              fetch('https://rsclub-invite.99infinity.workers.dev/deposit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: u, amount: v, turnover: v })
              }).catch(function () {});
            }
          } catch (e) {}
        }
      });
    });
  }

  refresh();
})();
