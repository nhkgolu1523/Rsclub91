/* =====================================================================
   Behaviour for the Account sub-pages copied from the supplied designs.
   All data is local (no backend) so every click flow can be tested.
   ===================================================================== */
(function () {
  'use strict';

  var page = document.body.getAttribute('data-rs-page') || '';
  var ACCOUNT = '../account/index.html';

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function stored(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  function toast(message) {
    var old = document.getElementById('rsPageToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsPageToast';
    el.className = 'rs-toast';
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('rs-toast--show'); });
    window.setTimeout(function () {
      el.classList.remove('rs-toast--show');
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 1600);
  }

  function back() {
    if (window.history.length > 1) window.history.back();
    else window.location.href = ACCOUNT;
  }

  function bind(el, fn) {
    if (el) el.addEventListener('click', function (e) { e.preventDefault(); fn(e); });
  }

  function onlyText(selector, text) {
    var want = String(text).toLowerCase();
    return qa(selector).filter(function (el) {
      return (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === want;
    })[0];
  }

  function username() {
    return stored('rsclub_username') || ('MEMBER' + stored('rsclub_uid').slice(0, 4));
  }

  function paintProfile() {
    var user = username();
    var uid = stored('rsclub_uid');
    var avatar = stored('rsclub_avatar');

    qa('.userInfo__container-content-nickname').forEach(function (el) { el.textContent = user; });

    qa('.userInfo__container-setting-center-content').forEach(function (row) {
      var h = q('h5', row);
      var value = q('span', row);
      if (!h || !value) return;
      if (/^nickname$/i.test((h.textContent || '').trim())) value.textContent = user;
      if (/^uid$/i.test((h.textContent || '').trim()) && uid) value.textContent = uid;
    });

    qa('.userInfo__container-content-uid span,.userInfo__container-content-uid').forEach(function (el) {
      if (uid && !q('svg', el)) el.textContent = uid;
    });

    if (avatar) {
      qa('.userInfo__container-content__avatar img,.userAvatar,.avatar-container-content img').forEach(function (img) {
        if (!img.closest('.van-grid-item')) img.src = avatar;
      });
    }

    var mail = stored('rsclub_email');
    if (mail) {
      qa('.emailright div').forEach(function (el) { el.textContent = mail; });
    }
  }

  function wireBack() {
    qa('.navbar__content-left,.van-icon-arrow-left').forEach(function (el) {
      if (el.closest && el.closest('.navbar__content-left') && el.tagName === 'I') return;
      el.style.cursor = 'pointer';
      bind(el, back);
    });
  }

  function copyUid() {
    var uid = stored('rsclub_uid');
    if (!uid) return;
    function done(ok) { toast(ok ? 'UID copied' : 'Copy failed'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(uid).then(function () { done(true); }, function () { done(false); });
    } else {
      try {
        var ta = document.createElement('textarea');
        ta.value = uid;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        done(ok);
      } catch (e) { done(false); }
    }
  }

  /* ------------------------------------------------------------- Settings */
  function wireSettings() {
    var avatarHeader = q('.userInfo__container-setting-center-header');
    if (avatarHeader) {
      avatarHeader.style.cursor = 'pointer';
      bind(avatarHeader, function () { window.location.href = '../change-avatar/index.html'; });
    }

    qa('.userInfo__container-setting-center-content').forEach(function (row) {
      var h = q('h5', row);
      var name = h ? (h.textContent || '').trim().toLowerCase() : '';
      if (name === 'nickname') {
        row.style.cursor = 'pointer';
        bind(row, function () { window.location.href = '../change-nickname/index.html'; });
      } else if (name === 'uid') {
        row.style.cursor = 'pointer';
        bind(row, copyUid);
      }
    });

    qa('.phone_container-item,.setting_container_item').forEach(function (item) {
      var name = (item.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      item.style.cursor = 'pointer';
      if (name.indexOf('login password') === 0) {
        bind(item, function () { window.location.href = '../change-password/index.html'; });
      } else if (name.indexOf('bind mailbox') === 0) {
        bind(item, function () { window.location.href = '../bind-mailbox/index.html'; });
      } else if (name.indexOf('google verification') === 0) {
        bind(item, function () { toast('Google verification is not available yet.'); });
      } else if (name.indexOf('updated version') === 0) {
        bind(item, function () { toast('You are using the latest version.'); });
      }
    });
  }

  /* --------------------------------------------------------- Change avatar */
  function wireAvatar() {
    var items = qa('.avatar-container-content .van-grid-item');
    items.forEach(function (item, index) {
      var avatarId = index + 1;
      item.setAttribute('data-avatar-id', String(avatarId));
      item.style.cursor = 'pointer';
      bind(item, function () {
        var img = q('img', item);
        if (!img) return;
        qa('.avatar-container-content img').forEach(function (other) {
          other.classList.toggle('active', other === img);
        });
        qa('.avatar-container-content .van-checkbox__icon').forEach(function (icon) {
          icon.classList.toggle('van-checkbox__icon--checked', icon.closest('.van-grid-item') === item);
        });

        var profile = window.RSProfile;
        if (profile && profile.setAvatar) {
          profile.setAvatar(avatarId).catch(function (err) {
            toast(err && err.message ? err.message : 'Could not update avatar.');
            profile.apply();
          });
          toast('Avatar updated');
          window.setTimeout(function () { window.location.href = '../settings/index.html'; }, 180);
          return;
        }

        save('rsclub_avatar', img.src);
        save('rsclub_avatar_id', String(avatarId));
        toast('Avatar updated');
        window.setTimeout(function () { window.location.href = '../settings/index.html'; }, 700);
      });
    });
  }

  /* -------------------------------------------------------- Change nickname */
  function wireNickname() {
    var input = q('input[name="username"]');
    var error = q('.info-dialog-content h4');
    if (input) input.value = username();

    var confirm = q('.van-dialog__confirm');
    if (confirm) {
      bind(confirm, function () {
        var value = input ? input.value.trim() : '';
        if (!value || value.length > 12) {
          if (error) error.style.display = '';
          if (!value) toast('Please enter a nickname.');
          return;
        }
        if (error) error.style.display = 'none';
        save('rsclub_username', value);
        var uid = stored('rsclub_uid');
        if (uid) {
          fetch('https://rsclub91-62526-default-rtdb.firebaseio.com/USERS/' + uid + '/PROFILE/USERNAME.json', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
          }).catch(function () {});
        }
        toast('Nickname updated');
        window.setTimeout(function () { window.location.href = '../settings/index.html'; }, 700);
      });
    }
  }

  /* ---------------------------------------------------------- Bind mailbox */
  function wireMailbox() {
    var mail = q('input[name="userEmail"]');
    var code = q('input[placeholder*="confirmation code" i]');
    var send = onlyText('button', 'send');
    var bindBtn = onlyText('button', 'bind');

    if (send) {
      bind(send, function () {
        var value = mail ? mail.value.trim() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          toast('Please enter a valid email address.');
          return;
        }
        toast('Verification code sent');
      });
    }

    if (bindBtn) {
      bind(bindBtn, function () {
        var mailValue = mail ? mail.value.trim() : '';
        var codeValue = code ? code.value.trim() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailValue)) {
          toast('Please enter a valid email address.');
          return;
        }
        if (!/^\d{4,6}$/.test(codeValue)) {
          toast('Please enter the verification code.');
          return;
        }
        save('rsclub_email', mailValue);
        var dlg = q('.dialog.inactive');
        if (dlg) {
          dlg.classList.remove('inactive');
          dlg.classList.add('active');
        } else {
          toast('Mailbox bound');
          window.setTimeout(back, 700);
        }
      });
    }

    var ok = q('.dialog .dialog__container-footer button');
    if (ok && /confirm/i.test(ok.textContent || '')) {
      bind(ok, function () { window.location.href = '../settings/index.html'; });
    }
  }

  /* -------------------------------------------------------- Change password */
  function wirePassword() {
    var inputs = qa('input');
    var saveBtn = onlyText('button', 'save changes');
    if (!saveBtn) return;
    bind(saveBtn, function () {
      var oldPwd = inputs[0] ? inputs[0].value : '';
      var newPwd = inputs[1] ? inputs[1].value : '';
      var confirmPwd = inputs[2] ? inputs[2].value : '';
      if (!oldPwd) return toast('Please enter your login password.');
      if (!newPwd || newPwd.length < 6) return toast('New password must be at least 6 characters.');
      if (newPwd !== confirmPwd) return toast('Passwords do not match.');
      save('rsclub_password', newPwd);
      toast('Password updated');
      window.setTimeout(function () { window.location.href = '../settings/index.html'; }, 700);
    });
  }

  /* --------------------------------------------------------------- Feedback */
  function wireFeedback() {
    var area = q('textarea');
    var submit = onlyText('button', 'submit');
    if (!submit) return;
    bind(submit, function () {
      var value = area ? area.value.trim() : '';
      if (!value) return toast('Please describe your feedback.');
      try {
        var list = JSON.parse(localStorage.getItem('rsclub_feedback') || '[]');
        list.push({ text: value, at: new Date().toISOString() });
        localStorage.setItem('rsclub_feedback', JSON.stringify(list));
      } catch (e) {}
      if (area) area.value = '';
      toast('Feedback submitted');
      window.setTimeout(back, 700);
    });
  }

  /* --------------------------------------------------------------- Language */
  function wireLanguage() {
    var items = qa('.list .item');
    items.forEach(function (item) {
      item.style.cursor = 'pointer';
      bind(item, function () {
        items.forEach(function (other) {
          other.classList.toggle('checked', other === item);
          var radio = q('.van-radio', other);
          var icon = q('.van-radio__icon', other);
          if (radio) radio.setAttribute('aria-checked', other === item ? 'true' : 'false');
          if (icon) icon.classList.toggle('van-radio__icon--checked', other === item);
        });
        var value = (item.textContent || '').replace(/\s+/g, ' ').trim();
        var profile = window.RSProfile;
        var selected = profile && profile.normalizeLanguage
          ? (profile.normalizeLanguage(value) || value)
          : value;

        if (profile && profile.setLanguage) {
          profile.setLanguage(selected).catch(function (err) {
            toast(err && err.message ? err.message : 'Could not save language.');
            profile.apply();
          });
          toast('Language changed to ' + selected);
          window.setTimeout(back, 180);
          return;
        }

        save('rsclub_language', selected);
        toast('Language changed to ' + selected);
        window.setTimeout(back, 600);
      });
    });
  }

  /* ---------------------------------------------------------- Top-up coupons */
  function wireCoupons() {
    var tabs = qa('.coupon-container-tabs__item');
    var panels = qa('.coupon-container-list > .infiniteScroll');
    if (!tabs.length) return;
    tabs.forEach(function (tab, index) {
      bind(tab, function () {
        tabs.forEach(function (other) {
          other.classList.toggle('active', other === tab);
        });
        panels.forEach(function (panel, panelIndex) {
          panel.style.display = panelIndex === index ? '' : 'none';
        });
      });
    });
  }

  function textOf(el) {
    return (el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function uniqueTexts(items) {
    var seen = {};
    var out = [];
    items.forEach(function (el) {
      var value = textOf(el);
      if (value && !seen[value]) {
        seen[value] = true;
        out.push(value);
      }
    });
    return out;
  }

  function pickerOptions() {
    var popups = qa('.van-popup');
    for (var i = 0; i < popups.length; i++) {
      var picker = q('.van-picker', popups[i]);
      if (!picker || q('.van-picker__title', picker)) continue;
      var values = uniqueTexts(qa('.van-picker-column:first-child .van-picker-column__item .van-ellipsis', picker));
      if (values.length) return values;
    }
    return [];
  }

  function filterOptions(pageName, index) {
    if (index > 0) return [];
    if (pageName === 'transaction-history' || pageName === 'bonus-details') {
      var values = pickerOptions();
      if (values.length) return values;
    }
    if (pageName === 'game-history') {
      return ['All games', 'Win Go', 'K3', '5D', 'TRX Win', 'MotoRace'];
    }
    var tabs = uniqueTexts(qa('.fun-tabs .tab_item, .van-tabs .van-tab__text'));
    if (tabs.length) return tabs;
    return ['All'];
  }

  function filterTitle(pageName) {
    if (pageName === 'transaction-history') return 'Transaction type';
    if (pageName === 'bonus-details') return 'Bonus type';
    if (pageName === 'game-history') return 'Select game';
    if (pageName === 'deposit-history') return 'Payment method';
    if (pageName === 'withdrawal-history') return 'Payment method';
    return 'Select option';
  }

  var activeSheet = null;

  function closeSheet() {
    if (!activeSheet) return;
    var sheet = activeSheet;
    activeSheet = null;
    sheet.classList.remove('rs-sheet--open');
    document.body.classList.remove('rs-sheet-open');
    if (sheet.rsSource) sheet.rsSource.classList.remove('is-rs-open');
    window.setTimeout(function () {
      if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
    }, 260);
  }

  function makeSheet(title, hint) {
    closeSheet();
    var sheet = document.createElement('div');
    sheet.className = 'rs-sheet';

    var mask = document.createElement('div');
    mask.className = 'rs-sheet__mask';
    mask.addEventListener('click', closeSheet);

    var panel = document.createElement('div');
    panel.className = 'rs-sheet__panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    var handle = document.createElement('div');
    handle.className = 'rs-sheet__handle';
    panel.appendChild(handle);

    var heading = document.createElement('h3');
    heading.className = 'rs-sheet__title';
    heading.textContent = title;
    panel.appendChild(heading);

    if (hint) {
      var note = document.createElement('p');
      note.className = 'rs-sheet__hint';
      note.textContent = hint;
      panel.appendChild(note);
    }

    var list = document.createElement('div');
    list.className = 'rs-sheet__list';
    panel.appendChild(list);

    sheet.appendChild(mask);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);
    document.body.classList.add('rs-sheet-open');
    activeSheet = sheet;
    requestAnimationFrame(function () { sheet.classList.add('rs-sheet--open'); });
    return sheet;
  }

  function syncTabWithOption(value) {
    var items = qa('.funtab_item, .van-tab');
    for (var i = 0; i < items.length; i++) {
      if (textOf(items[i]) === value) {
        items[i].click();
        return;
      }
    }
  }

  function openChoiceSheet(selector, labelEl, options, title) {
    var sheet = makeSheet(title, 'Choose an option');
    sheet.rsSource = selector;
    selector.classList.add('is-rs-open');
    var list = q('.rs-sheet__list', sheet);
    var current = textOf(labelEl);

    options.forEach(function (value) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'rs-sheet__option' + (value === current ? ' rs-sheet__option--active' : '');
      option.textContent = value;
      option.addEventListener('click', function () {
        labelEl.textContent = value;
        syncTabWithOption(value);
        closeSheet();
      });
      list.appendChild(option);
    });
  }

  function openDateSheet(selector, labelEl) {
    var sheet = makeSheet('Choose a date', 'Select a period or pick a date');
    sheet.rsSource = selector;
    selector.classList.add('is-rs-open');
    var list = q('.rs-sheet__list', sheet);
    var current = textOf(labelEl);

    ['All dates', 'Today', 'Yesterday', 'Last 7 days'].forEach(function (value) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'rs-sheet__option' + (value === current || (value === 'All dates' && current === 'Choose a date') ? ' rs-sheet__option--active' : '');
      option.textContent = value;
      option.addEventListener('click', function () {
        labelEl.textContent = value === 'All dates' ? 'Choose a date' : value;
        closeSheet();
      });
      list.appendChild(option);
    });

    var input = document.createElement('input');
    input.type = 'date';
    input.className = 'rs-sheet__date';
    input.max = new Date().toISOString().slice(0, 10);
    list.appendChild(input);

    var actions = document.createElement('div');
    actions.className = 'rs-sheet__actions';

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'rs-sheet__button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', closeSheet);

    var apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'rs-sheet__button rs-sheet__button--primary';
    apply.textContent = 'Apply';
    apply.addEventListener('click', function () {
      if (!input.value) {
        toast('Please choose a date.');
        return;
      }
      var parts = input.value.split('-');
      var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      labelEl.textContent = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      closeSheet();
    });

    actions.appendChild(cancel);
    actions.appendChild(apply);
    list.appendChild(actions);
  }

  function scrollTabIntoView(tabs, item) {
    var list = q('.fun-tabs__tab-list', tabs) || q('.van-tabs__nav', tabs);
    var scroller = tabs;
    if (tabs.classList.contains('fun-tabs') && tabs.scrollWidth <= tabs.clientWidth) {
      scroller = list;
    } else if (tabs.classList.contains('van-tabs')) {
      scroller = q('.van-tabs__nav', tabs) || tabs;
    }
    if (!scroller || !item) return;
    var listRect = scroller.getBoundingClientRect();
    var itemRect = item.getBoundingClientRect();
    if (itemRect.left < listRect.left || itemRect.right > listRect.right) {
      scroller.scrollLeft += itemRect.left - listRect.left - (scroller.clientWidth - itemRect.width) / 2;
    }
  }

  function activateFunTab(tabs, activeItem) {
    var items = qa('.funtab_item', tabs);
    var activeInner = q('.tab_item', activeItem);
    items.forEach(function (item) {
      var inner = q('.tab_item', item);
      var on = item === activeItem;
      item.classList.toggle('rs-tab-active', on);
      item.style.color = on ? 'rgb(22, 119, 255)' : '';
      item.setAttribute('aria-selected', on ? 'true' : 'false');
      if (inner) {
        inner.classList.toggle('tab_active', on);
        inner.setAttribute('aria-selected', on ? 'true' : 'false');
      }
    });

    var line = q('.fun-tabs__active-line', tabs);
    var list = q('.fun-tabs__tab-list', tabs);
    if (line && list && activeInner) {
      var listRect = list.getBoundingClientRect();
      var tabRect = activeInner.getBoundingClientRect();
      line.style.width = tabRect.width + 'px';
      line.style.transform = 'translate3d(' + (tabRect.left - listRect.left + list.scrollLeft) + 'px, 0, 0)';
    }
    scrollTabIntoView(tabs, activeItem);
  }

  function activateVanTab(tabs, index) {
    var items = qa('.van-tab', tabs);
    var panels = qa('.van-tabs__content > .van-tab__panel', tabs);
    items.forEach(function (item, itemIndex) {
      var on = itemIndex === index;
      item.classList.toggle('van-tab--active', on);
      item.setAttribute('aria-selected', on ? 'true' : 'false');
      item.setAttribute('tabindex', on ? '0' : '-1');
    });
    if (panels.length === items.length) {
      panels.forEach(function (panel, panelIndex) {
        panel.style.display = panelIndex === index ? '' : 'none';
      });
    }
    scrollTabIntoView(tabs, items[index]);
  }

  function wireTabGroups() {
    qa('.fun-tabs').forEach(function (tabs) {
      var items = qa('.funtab_item', tabs);
      items.forEach(function (item) {
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', q('.tab_active', item) ? 'true' : 'false');
        bind(item, function () { activateFunTab(tabs, item); });
      });
    });

    qa('.van-tabs').forEach(function (tabs) {
      if (tabs.classList.contains('notification-center-tabs')) return;
      var items = qa('.van-tab', tabs);
      items.forEach(function (item, index) {
        item.setAttribute('role', 'tab');
        bind(item, function () { activateVanTab(tabs, index); });
      });
    });

    qa('.bonus__container-tabs').forEach(function (tabs) {
      var items = qa('li', tabs);
      items.forEach(function (item) {
        bind(item, function () {
          items.forEach(function (other) { other.classList.toggle('active', other === item); });
        });
      });
    });
  }

  function wireFilters() {
    qa('.ar-searchbar__selector').forEach(function (selector, index) {
      var labelEl = q('span', selector);
      if (!labelEl) return;
      selector.setAttribute('role', 'button');
      selector.setAttribute('tabindex', '0');

      function open() {
        if (index === 0) {
          var options = filterOptions(page, index);
          openChoiceSheet(selector, labelEl, options, filterTitle(page));
        } else {
          openDateSheet(selector, labelEl);
        }
      }

      bind(selector, open);
      selector.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function openInfoSheet(title, message) {
    var sheet = makeSheet(title, '');
    var list = q('.rs-sheet__list', sheet);
    var empty = document.createElement('div');
    empty.className = 'rs-sheet__empty';
    empty.textContent = message;
    list.appendChild(empty);
  }

  function wireRebateActions() {
    if (page !== 'betting-rebate') return;
    var claim = onlyText('button', 'one-click rebate');
    var history = onlyText('button', 'all history');
    bind(claim, function () { toast('No rebate available to claim.'); });
    bind(history, function () { openInfoSheet('Rebate history', 'No rebate history yet.'); });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && activeSheet) closeSheet();
  });

  function boot() {
    var uid = stored('rsclub_uid');
    if (!uid && !/[?&]preview=1(?:&|$)/.test(window.location.search)) {
      window.location.replace('../home/index.html');
      return;
    }

    wireBack();
    paintProfile();
    wireTabGroups();
    wireFilters();
    wireRebateActions();

    if (page === 'settings') wireSettings();
    else if (page === 'change-avatar') wireAvatar();
    else if (page === 'change-nickname') wireNickname();
    else if (page === 'bind-mailbox') wireMailbox();
    else if (page === 'change-password') wirePassword();
    else if (page === 'feedback') wireFeedback();
    else if (page === 'language') wireLanguage();
    else if (page === 'topup-coupons') wireCoupons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
