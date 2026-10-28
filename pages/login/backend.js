/* =========================================================================
   Rsclub91 — Auth backend (Firebase Realtime Database, REST)
   -------------------------------------------------------------------------
   Login (phone + email) + Register. Forgot-password is left untouched.

   DB layout:

     USERS
       └── <UID>                 (auto-generated, unique, numeric, 8 digits)
             ├── EMAIL       : "NONE"   (email add-later UI comes later)
             ├── INVITE-CODE : "NONE"   (invite backend comes later)
             ├── PASSWORD    : "<plain text>"
             ├── PHONE-NUMBER: "<phone>"
             └── STATUS      : "ON"     ("OFF" => suspended, cannot log in)

   The UID is claimed ATOMICALLY with a conditional write (If-Match on the
   node's ETag), so two registrations can never get the same UID.

   "Remember me": when the login checkbox is ticked, phone/email + password
   are saved in THIS phone's localStorage and prefilled next time.
   Plain-text passwords for now (Firebase rules to be tightened later).
   ========================================================================= */
(function () {
  'use strict';

  var DB_URL = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var USERS = '/USERS';

  /* localStorage keys used for "Remember me" */
  var R_TYPE = 'rsclub_remember_type';   // 'phone' | 'email'
  var R_ID   = 'rsclub_remember_id';     // the phone number / email
  var R_PWD  = 'rsclub_remember_pwd';    // the password

  function endpoint(path) { return DB_URL + path + '.json'; }

  function nowStamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  var WELCOME_MESSAGE = 'Thank you for becoming a beloved member of this platform. '
    + 'We provide many industry leading games. This is the world\'s leading gaming platform. '
    + 'Try the lottery game developed by us. While enjoying the best gaming experience, '
    + 'you can also join unlimited agents and stay at home to earn money.';

  var SECURITY_MESSAGE = 'Our Rsclub91 Customer Service will never send links directly to members. '
    + 'If you receive any link from someone claiming to be Rsclub91 Customer Service, please do not click it, '
    + 'as it may lead to account hacking or loss of personal information. For your safety, always verify '
    + 'information and access Rsclub91 only through our official website and official channels.';

  var WELCOME_INFO_MESSAGE = 'Welcome to the Rsclub91 Platform! Enjoy an exciting gaming experience with a wide '
    + 'selection of popular games. New players are welcome to register, explore the platform, and join the fun. '
    + 'Thank you for choosing Rsclub91. We wish you a great gaming experience!';

  function putNotif(uid, bucket, id, title, message) {
    return fetch(endpoint(USERS + '/' + uid + '/NOTIFICATIONS/' + bucket + '/' + id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'TITLE': title,
        'MESSAGE': message,
        'TIME': nowStamp(),
        'DELETED': 'NO'
      })
    }).catch(function () {});
  }

  /* BALANCE node: sirf 3 fields (asli balance + S + A).
     DEPOSIT-HISTORY / WITHDRAWL-HISTORY ab alag nodes hain (USERS/<uid>/...).
     NOTE: Firebase me khaali object `{}` likhne par wo key DELETE ho jati hai,
     isliye A me ek placeholder tx daalte hain (warna A node banega hi nahi aur
     pehla bet/win uske bina chala jayega). */
  function createBalanceNode(uid) {
    var seed = {};
    seed['INIT:' + uid] = 1;
    return fetch(endpoint(USERS + '/' + uid + '/BALANCE'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'MAIN-BALANCE': 0,
        'S': 1,
        'A': seed
      })
    }).catch(function () {});
  }

  function createVipNode(uid) {
    return fetch(endpoint(USERS + '/' + uid + '/VIP'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'EXP': 0,
        'LEVEL': 0,
        'CLAIMED-LEVEL': 0,
        'LAST-MONTHLY': ''
      })
    }).catch(function () {});
  }

  function createWelcomeNotification(uid) {
    return Promise.all([
      putNotif(uid, 'NOTIFICATION', 'WELCOME', 'New Member', WELCOME_MESSAGE),
      putNotif(uid, 'INFORMATION', 'SECURITY', 'Important Security Notice', SECURITY_MESSAGE),
      putNotif(uid, 'INFORMATION', 'WELCOME', 'Welcome To The Rsclub91 Platform', WELCOME_INFO_MESSAGE)
    ]).catch(function () {});
  }

  function getJSON(path) {
    return fetch(endpoint(path)).then(function (r) {
      if (!r.ok) throw new Error('GET ' + path + ' -> ' + r.status);
      return r.json();
    });
  }

  /* ----------------------------------------------------------------------
     Tiny toast (dark pill, bottom-centre).  kind: 'error' | 'ok' | undefined
     ---------------------------------------------------------------------- */
  var toastEl = null, toastTimer = null;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText =
        'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);' +
        'z-index:99999;max-width:80%;width:max-content;padding:10px 18px;' +
        'border-radius:22px;font-size:14px;line-height:1.35;text-align:center;' +
        'color:#fff;background:rgba(30,30,36,.94);' +
        'box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:none;' +
        'transition:opacity .2s ease;opacity:0;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.background =
      kind === 'error' ? 'rgba(176,42,42,.96)' :
      kind === 'ok'    ? 'rgba(30,132,74,.96)' :
                         'rgba(30,30,36,.94)';
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, 2600);
  }

  /* ----------------------------------------------------------------------
     Random 8-digit UID  ->  10000000 .. 99999999
     ---------------------------------------------------------------------- */
  function randomUid() {
    var n;
    if (window.crypto && window.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      window.crypto.getRandomValues(a);
      n = a[0] % 90000000;
    } else {
      n = Math.floor(Math.random() * 90000000);
    }
    return String(10000000 + n);
  }

  /* ----------------------------------------------------------------------
     Atomically claim a free UID and write the whole user object under it.
     ---------------------------------------------------------------------- */
  function createUser(userObj) {
    var attempts = 0;

    function tryOnce() {
      if (attempts++ >= 15) {
        return Promise.reject(new Error('Could not generate a unique ID. Please try again.'));
      }
      var uid = randomUid();
      return fetch(endpoint(USERS + '/' + uid), { headers: { 'X-Firebase-ETag': 'true' } })
        .then(function (r) {
          var etag = r.headers.get('ETag');
          return r.text().then(function (body) {
            if (body && body.trim() !== 'null') return tryOnce(); // already taken
            return fetch(endpoint(USERS + '/' + uid), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'if-match': etag },
              body: JSON.stringify(userObj)
            }).then(function (put) {
              if (put.status === 200) return uid;
              if (put.status === 412) return tryOnce(); // lost the race
              throw new Error('Registration failed (' + put.status + ').');
            });
          });
        });
    }
    return tryOnce();
  }

  function normEmail(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  /* Scan USERS for a match. EMAIL "NONE"/empty is ignored for email login. */
  function findUser(by, needle) {
    return getJSON(USERS).then(function (users) {
      var hit = null;
      if (users) {
        Object.keys(users).forEach(function (uid) {
          var u = users[uid];
          if (!u) return;
          if (by === 'email') {
            var e = normEmail(u['EMAIL']);
            if (e && e !== 'none' && e === needle) hit = { uid: uid, user: u };
          } else {
            if (String(u['PHONE-NUMBER']) === String(needle)) hit = { uid: uid, user: u };
          }
        });
      }
      return hit;
    });
  }

  /* ======================================================================
     Public API
     ====================================================================== */
  var api = {};

  function genInviteCode() {
    var code = '';
    for (var i = 0; i < 12; i++) code += Math.floor(Math.random() * 10);
    return code;
  }

  /* INVITATION-RECORD ka default (khaali) shape - register par banta hai.
     Har user ka apna pura invitation data isi ek node me rehta hai. */
  function emptyInvitationRecord(code, inviterUid) {
    var now = nowStamp();
    var rec = {
      'CODE': code || '',
      'INVITE-CODE': code || '',
      'LINK': '',
      'INVITED-BY': inviterUid || '',
      'INVITED-AT': inviterUid ? now : '',
      'REFERRAL-DEADLINE': '',
      'LEVEL': 'L0',
      'DIRECT': { 'COUNT': 0, 'DEPOSIT-COUNT': 0, 'DEPOSIT-AMOUNT': 0, 'FIRST-DEPOSIT-COUNT': 0 },
      'TEAM': { 'COUNT': 0, 'DEPOSIT-COUNT': 0, 'DEPOSIT-AMOUNT': 0, 'FIRST-DEPOSIT-COUNT': 0 },
      'CREATED': now,
      /* placeholder taaki Firebase khaali object delete na kare */
      'INIT': { 'X': 1 }
    };
    return rec;
  }

  function createInvitationRecord(uid, code, inviterUid) {
    return fetch(endpoint(USERS + '/' + uid + '/INVITATION-RECORD'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emptyInvitationRecord(code, inviterUid))
    }).catch(function () {});
  }

  function createInviteCode(uid) {
    function attempt(tries) {
      var code = genInviteCode();
      var indexUrl = DB_URL + '/INVITE-CODES/' + code + '.json';
      return fetch(indexUrl, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (existing) {
          if (existing != null) {
            if (tries > 0) return attempt(tries - 1);
            return null;
          }
          return fetch(indexUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(String(uid))
          }).then(function () {
            return fetch(endpoint(USERS + '/' + uid + '/INVITE-CODE'), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(code)
            }).then(function () {
              return createInvitationRecord(uid, code, '');
            }).then(function () { return code; }).catch(function () { return code; });
          });
        })
        .catch(function () {
          if (tries > 0) return attempt(tries - 1);
          return null;
        });
    }
    return attempt(8);
  }

  api.register = function (phone, password, inviterCode) {
    phone = String(phone || '').trim();
    password = String(password == null ? '' : password);
    inviterCode = String(inviterCode || '').trim();
    var inviterUid = '';
    var lookupInviter = function () {
      if (!inviterCode || inviterCode === 'NONE') return Promise.resolve('');
      return fetch(DB_URL + '/INVITE-CODES/' + encodeURIComponent(inviterCode) + '.json', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) { return v ? String(v) : ''; })
        .catch(function () { return ''; });
    };
    return lookupInviter().then(function (found) {
      inviterUid = found;
    }).then(function () {
      return findUser('phone', phone).then(function (existing) {
        if (existing) throw new Error('This phone number is already registered.');
        return createUser({
          'EMAIL': 'NONE',             // email add-later UI comes later
          'INVITE-CODE': 'NONE',       // createInviteCode() below sets the real one
          'PASSWORD': password,        // plain text for now
          'PHONE-NUMBER': phone,
          'STATUS': 'ON'               // always ON at registration
        });
      });
    }).then(function (uid) {
      // Auto-create the display name: MEMBER + first 4 digits of the UID.
      // Saved once here under USERS/<uid>/PROFILE and shown on the account page.
      var username = 'MEMBER' + String(uid).slice(0, 4);
      return fetch(endpoint(USERS + '/' + uid + '/PROFILE'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'USERNAME': username,
          'SELECTED-LANGUAGE': 'English',
          'AVATAR-ID': 1
        })
      }).catch(function () {}).then(function () {
        return createInviteCode(uid);
      }).then(function () {
        return linkInviter(uid, inviterUid, username, inviterCode);
      }).then(function () {
        return createBalanceNode(uid);
      }).then(function () {
        return createVipNode(uid);
      }).then(function () {
        return createWelcomeNotification(uid);
      }).then(function () { return uid; });
    });
  };

  /* Inviter mila to uska rishta 2 jagah likho:
       1) naye user ke INVITATION-RECORD me  INVITED-BY + 7-day deadline
       2) inviter ke INVITATION-RECORD/SUBORDINATES/<newUid> me entry  */
  function linkInviter(newUid, inviterUid, username, inviterCode) {
    if (!inviterUid || String(inviterUid) === String(newUid)) return Promise.resolve();
    var now = new Date();
    var dl = new Date(now.getTime() + 7 * 86400000);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    function stamp(d) {
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' '
        + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }
    var inviterPatch = {
      'INVITED-BY': String(inviterUid),
      'INVITED-AT': stamp(now),
      'REFERRAL-DEADLINE': stamp(dl)
    };
    var sub = {};
    sub['LV'] = 1;
    sub['JOINED'] = stamp(now);
    sub['USERNAME'] = username || '';
    sub['DEPOSIT-AMOUNT'] = 0;
    sub['FIRST-DEPOSIT'] = 0;
    sub['BONUS'] = '';

    return Promise.all([
      fetch(endpoint(USERS + '/' + newUid + '/INVITATION-RECORD'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviterPatch)
      }).catch(function () {}),
      fetch(endpoint(USERS + '/' + inviterUid + '/INVITATION-RECORD/SUBORDINATES/' + newUid), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      }).catch(function () {}),
      /* server (worker) ko bhi batao - wahi authoritative link/level karta hai */
      fetch('https://rsclub-invite.99infinity.workers.dev/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: String(newUid), refCode: String(inviterCode || '') })
      }).catch(function () {})
    ]);
  }

  api.login = function (phone, password) {
    var needle = String(phone || '').trim();
    var pwd = String(password == null ? '' : password);
    return findUser('phone', needle).then(function (hit) {
      if (!hit) throw new Error('No account found for this phone number.');
      if (String(hit.user['PASSWORD']) !== pwd) throw new Error('Incorrect password.');
      if (String(hit.user['STATUS'] || '').toUpperCase() !== 'ON') throw new Error('This account has been suspended.');
      return hit;
    });
  };

  api.loginEmail = function (email, password) {
    var needle = normEmail(email);
    var pwd = String(password == null ? '' : password);
    return findUser('email', needle).then(function (hit) {
      if (!hit) throw new Error('No account found for this email.');
      if (String(hit.user['PASSWORD']) !== pwd) throw new Error('Incorrect password.');
      if (String(hit.user['STATUS'] || '').toUpperCase() !== 'ON') throw new Error('This account has been suspended.');
      return hit;
    });
  };

  api.toast = toast;
  api.dbUrl = DB_URL;
  window.RSClubAuth = api;

  /* ======================================================================
     UI wiring
     ====================================================================== */
  function val(scope, sel) { var e = scope.querySelector(sel); return e ? e.value : ''; }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) {
      if (!btn.dataset._txt) btn.dataset._txt = btn.textContent;
      btn.textContent = label || 'Please wait...';
      btn.style.opacity = '.7';
      btn.style.pointerEvents = 'none';
    } else {
      if (btn.dataset._txt) btn.textContent = btn.dataset._txt;
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }
  }

  function isChecked(box) {
    var ic = box && box.querySelector('.van-checkbox__icon');
    return !!ic && ic.classList.contains('van-checkbox__icon--checked');
  }
  function setChecked(box, on) {
    if (!box) return;
    var ic = box.querySelector('.van-checkbox__icon');
    if (ic) ic.classList.toggle('van-checkbox__icon--checked', !!on);
    box.setAttribute('aria-checked', on ? 'true' : 'false');
  }

  /* Prefilled values are set programmatically, which fires NO 'input' event,
     so auth.js's enable-state listener would never run and the button stayed
     grey even though the fields were already filled. Fire one after prefill. */
  function fireInput(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }

  /* ---- Remember me (localStorage on this phone) ------------------------- */
  function saveRemember(type, id, pwd) {
    try {
      localStorage.setItem(R_TYPE, type);
      localStorage.setItem(R_ID, id);
      localStorage.setItem(R_PWD, pwd);
    } catch (e) {}
  }
  function clearRemember() {
    try {
      localStorage.removeItem(R_TYPE);
      localStorage.removeItem(R_ID);
      localStorage.removeItem(R_PWD);
    } catch (e) {}
  }
  function getRemember() {
    try {
      var id = localStorage.getItem(R_ID);
      if (!id) return null;
      return { type: localStorage.getItem(R_TYPE) || 'phone', id: id, pwd: localStorage.getItem(R_PWD) || '' };
    } catch (e) { return null; }
  }

  /* ---- login handlers (one per tab: phone + email) ---------------------- */
  function wireLogin(panel, type) {
    var btn = panel.querySelector('.signIn__container-button button:not(.register)');
    if (!btn) return;
    var idSel = type === 'email' ? 'input[name="userEmail"]' : 'input[name="userNumber"]';

    btn.addEventListener('click', function () {
      var ident = val(panel, idSel);
      var pwd = val(panel, '.passwordInput__container-input input');
      var box = panel.querySelector('.van-checkbox');
      if (!ident.trim()) return toast(type === 'email' ? 'Please enter your email.' : 'Please enter your phone number.', 'error');
      if (!pwd) return toast('Please enter your password.', 'error');

      busy(btn, true, 'Logging in...');
      var pr = (type === 'email') ? api.loginEmail(ident, pwd) : api.login(ident, pwd);
      pr.then(function (hit) {
        try {
          localStorage.setItem('rsclub_uid', hit.uid);
          localStorage.removeItem('rsclub_username');
          localStorage.setItem('rsclub_status', String(hit.user['STATUS'] || 'ON'));
          if (type === 'email') localStorage.setItem('rsclub_email', normEmail(hit.user['EMAIL']));
          else localStorage.setItem('rsclub_phone', String(hit.user['PHONE-NUMBER']));
        } catch (e) {}
        if (box && isChecked(box)) saveRemember(type, ident.trim(), pwd);
        else clearRemember();
        try { sessionStorage.setItem('rs_show_welcome_popup', '1'); } catch (e) { try { localStorage.setItem('rs_show_welcome_popup', '1'); } catch (e2) {} }
        toast('Login successful!', 'ok');
        var finishLogin = function () {
          setTimeout(function () { window.location.href = '../home/index.html'; }, 800);
        };
        if (window.RSProfile && window.RSProfile.load) {
          window.RSProfile.load(hit.uid).then(finishLogin, finishLogin);
        } else {
          finishLogin();
        }
      }).catch(function (err) {
        busy(btn, false);
        toast(err && err.message ? err.message : 'Login failed.', 'error');
      });
    });
  }

  /* ---- register handler ------------------------------------------------- */
  function refCode() {
    /* 1) visible "Invite code" field (agar user ne dekha/badla) */
    try {
      var inp = document.querySelector('.js-view-register input[name="userInvite"]');
      if (inp) { var iv = String(inp.value || '').trim(); if (iv) return iv; }
    } catch (e) {}
    /* 2) URL ?ref= (invite link) */
    try {
      var m = /[?&](?:ref|invitationCode|code)=([^&#]+)/.exec(location.search || '');
      if (m) { var v = decodeURIComponent(m[1]).trim(); if (v && v !== 'null') return v; }
    } catch (e) {}
    /* 3) saved from link earlier */
    try { return localStorage.getItem('rs_ref') || ''; } catch (e) { return ''; }
  }
  function wireRegister(regView, loginView) {
    var btn = regView.querySelector('.register__container-button button:not(.login)');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var phone = val(regView, 'input[name="userNumber"]');
      var pwds = regView.querySelectorAll('.passwordInput__container-input input');
      var p1 = pwds[0] ? pwds[0].value : '';
      var p2 = pwds[1] ? pwds[1].value : '';
      var agreeBox = regView.querySelector('.van-checkbox');
      var loginPanel = loginView ? loginView.querySelector('.js-login-panel') : null;

      if (!phone.trim()) return toast('Please enter your phone number.', 'error');
      if (!p1) return toast('Please set a password.', 'error');
      if (p1 !== p2) return toast('Passwords do not match.', 'error');
      if (agreeBox && !isChecked(agreeBox)) return toast('Please agree to the Privacy Agreement.', 'error');

      busy(btn, true, 'Registering...');
      api.register(phone, p1, refCode()).then(function (uid) {
        try { localStorage.removeItem('rs_ref'); } catch (e) {}
        // No UID popup, no login screen — register hone ke baad seedha home.
        try {
          localStorage.setItem('rsclub_uid', uid);
          localStorage.setItem('rsclub_phone', phone.trim());
          localStorage.setItem('rsclub_status', 'ON');
          localStorage.setItem('rsclub_username', 'MEMBER' + String(uid).slice(0, 4));
        } catch (e) {}
        try { sessionStorage.setItem('rs_show_welcome_popup', '1'); } catch (e) { try { localStorage.setItem('rs_show_welcome_popup', '1'); } catch (e2) {} }
        if (window.RSProfile && window.RSProfile.load) {
          window.RSProfile.load(uid).then(function () {
            window.location.href = '../home/index.html';
          }, function () {
            window.location.href = '../home/index.html';
          });
        } else {
          window.location.href = '../home/index.html';
        }
      }).catch(function (err) {
        busy(btn, false);
        toast(err && err.message ? err.message : 'Registration failed.', 'error');
      });
    });
  }

  function wire() {
    var loginView = document.querySelector('.js-view-login');
    var regView = document.querySelector('.js-view-register');

    if (loginView) {
      var panels = qsa('.js-view-login .js-login-panel');
      if (panels[0]) wireLogin(panels[0], 'phone');
      if (panels[1]) wireLogin(panels[1], 'email');
    }
    if (regView && loginView) wireRegister(regView, loginView);
  }

  /* ---- things that need auth.js to have booted first (view/tab switch) -- */
  function afterBoot() {
    var regView = document.querySelector('.js-view-register');
    var loginView = document.querySelector('.js-view-login');

    /* 1. Privacy ("I have read and agree") pre-ticked on the Register view. */
    if (regView) setChecked(regView.querySelector('.van-checkbox'), true);

    /* 1b. Invite link (?ref=/code=) -> "Invite code" field prefill karo */
    (function () {
      var code = '';
      try {
        var rp = new URLSearchParams(location.search || '');
        code = rp.get('ref') || rp.get('invitationCode') || rp.get('code') || '';
      } catch (e) {}
      if (!code) { try { code = localStorage.getItem('rs_ref') || ''; } catch (e) {} }
      if (!code) return;
      var inp = regView ? regView.querySelector('input[name="userInvite"]') : null;
      if (inp) { inp.value = String(code).trim(); fireInput(inp); }
    })();

    /* 2. Restore saved phone/email + password (Remember me). */
    var saved = getRemember();
    if (!saved || !loginView) return;
    var panels = qsa('.js-view-login .js-login-panel');
    var tabs = qsa('.js-view-login .js-login-tab');

    if (saved.type === 'email' && panels[1]) {
      if (tabs[1]) tabs[1].click();               // switch to Email tab
      var em = panels[1].querySelector('input[name="userEmail"]');
      if (em) em.value = saved.id;
      var emp = panels[1].querySelector('.passwordInput__container-input input');
      if (emp) emp.value = saved.pwd;
      setChecked(panels[1].querySelector('.van-checkbox'), true);
      fireInput(em); fireInput(emp);
    } else if (panels[0]) {
      var ph = panels[0].querySelector('input[name="userNumber"]');
      if (ph) ph.value = saved.id;
      var php = panels[0].querySelector('.passwordInput__container-input input');
      if (php) php.value = saved.pwd;
      setChecked(panels[0].querySelector('.van-checkbox'), true);
      fireInput(ph); fireInput(php);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  if (document.readyState === 'complete') {
    setTimeout(afterBoot, 60);
  } else {
    window.addEventListener('load', function () { setTimeout(afterBoot, 60); });
  }
})();
