/* =========================================================================
   Rsclub91 — Auth UI controller (UI only, no backend)
   Handles: view switching (login / register / forgot password),
            phone<->email tabs, country dropdown, show/hide password (eye),
            checkbox toggles and button enabled/disabled states.
   The backend is intentionally NOT wired yet — only the UI is real.
   ========================================================================= */
(function () {
  'use strict';

  var doc = document;

  function qs(sel, root) { return (root || doc).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ---------------------------------------------------------------------
     1. View switching  (login view / register view / forgot-password view)
     --------------------------------------------------------------------- */
  var VIEWS = {
    login: '.js-view-login',
    register: '.js-view-register',
    forgot: '.js-view-forgot'
  };

  function showView(name) {
    Object.keys(VIEWS).forEach(function (key) {
      var el = qs(VIEWS[key]);
      if (!el) return;
      el.style.display = (key === name) ? '' : 'none';
    });
    if (window.scrollTo) window.scrollTo(0, 0);
  }

  /* ---------------------------------------------------------------------
     2. Login: phone / email tab switching
     --------------------------------------------------------------------- */
  function initLoginTabs() {
    var tabs = qsa('.js-login-tab');
    var panels = qsa('.js-login-panel');
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('activecontent'); });
        tab.classList.add('active');
        if (panels[index]) panels[index].classList.add('activecontent');
      });
    });
  }

  /* ---------------------------------------------------------------------
     3. Country code dropdown (+91 / India) — open & close
     --------------------------------------------------------------------- */
  function initDropdowns() {
    qsa('.js-dropdown').forEach(function (root) {
      var value = qs('.dropdown__value', root);
      var list = qs('.dropdown__list', root);
      var arrow = qs('.van-icon-arrow-down', root);
      if (!value || !list) return;

      function close() {
        list.classList.remove('active');
        if (arrow) arrow.classList.remove('arrowActive');
      }
      function open() {
        list.classList.add('active');
        if (arrow) arrow.classList.add('arrowActive');
      }

      value.addEventListener('click', function (e) {
        e.stopPropagation();
        if (list.classList.contains('active')) { close(); } else { open(); }
      });

      qsa('.dropdown__list-item', list).forEach(function (item) {
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          var code = qs('span', item);
          var input = qs('input', value);
          if (code && input) input.value = code.textContent.trim();
          qsa('.dropdown__list-item', list).forEach(function (i) { i.classList.remove('active'); });
          item.classList.add('active');
          close();
        });
      });

      doc.addEventListener('click', close);
    });
  }

  /* ---------------------------------------------------------------------
     4. Show / hide password (eye icon)
     --------------------------------------------------------------------- */
  function initEyes() {
    qsa('.passwordInput__container .eye').forEach(function (eye) {
      var input = eye.parentNode ? qs('input', eye.parentNode) : null;
      if (!input) return;
      eye.addEventListener('click', function () {
        var isPwd = input.getAttribute('type') === 'password';
        input.setAttribute('type', isPwd ? 'text' : 'password');
        eye.classList.toggle('eye-open', isPwd);
      });
    });
  }

  /* ---------------------------------------------------------------------
     5. Checkbox toggles (Remember password / Privacy agreement)
     --------------------------------------------------------------------- */
  function initCheckboxes() {
    qsa('.van-checkbox').forEach(function (box) {
      var icon = qs('.van-checkbox__icon', box);
      if (!icon) return;
      box.addEventListener('click', function () {
        var checked = icon.classList.toggle('van-checkbox__icon--checked');
        box.setAttribute('aria-checked', checked ? 'true' : 'false');
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); box.click(); }
      });
    });
  }

  /* ---------------------------------------------------------------------
     6. Buttons become "active" (gradient) only when the form is filled
     --------------------------------------------------------------------- */
  function bindEnableState(scopeSel, buttonSel, fields, mode) {
    var scope = qs(scopeSel);
    if (!scope) return;
    var button = qs(buttonSel, scope);
    if (!button) return;
    var inputs = fields.map(function (sel) { return qs(sel, scope); }).filter(Boolean);

    function refresh() {
      var filled = inputs.map(function (i) {
        return !!(i.value && i.value.trim().length > 0);
      });
      // mode 'any': button active as soon as any field has text (login).
      // default   : button active only when every field is filled.
      var ok = inputs.length > 0 && (mode === 'any' ? filled.some(Boolean) : filled.every(Boolean));
      button.classList.toggle('active', ok);
    }
    inputs.forEach(function (i) {
      i.addEventListener('input', refresh);
      i.addEventListener('change', refresh);
    });
    refresh();
  }

  /* ---------------------------------------------------------------------
     7. Wire the navigation buttons
     --------------------------------------------------------------------- */
  function initNavigation() {
    // Login -> Forgot password
    qsa('.signIn__container-forget').forEach(function (el) {
      el.addEventListener('click', function () { showView('forgot'); });
    });

    // Login -> Register  (both phone-tab and email-tab register buttons)
    qsa('.signIn__container-button button.register').forEach(function (el) {
      el.addEventListener('click', function () { showView('register'); });
    });

    // Register -> back to Login ("I have an account / Login")
    qsa('.register__container-button button.login').forEach(function (el) {
      el.addEventListener('click', function () { showView('login'); });
    });

    /* Back arrow in the navbar.
       It always leaves the page (back in history, or the home page when
       there is nothing to go back to). The login/register/forgot views
       are switched by their own in-page links ("Register", "Login",
       "Forgot password?"), so a browser-back style action is expected
       here instead of stepping through the views. */
    qsa('.navbar__content-left .van-icon-arrow-left').forEach(function (el) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        if (window.history.length > 1) { window.history.back(); }
        else { window.location.href = '../home/index.html'; }
      });
    });
  }

  /* ---------------------------------------------------------------------
     8. Boot
     --------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------
      8a. Which view should open first?
     ---------------------------------------------------------------------
     A deep link can request a specific view so other pages can send the user
     straight to it, e.g. the home-page "Register" button:

         ../login/index.html?view=register      (query string)
         ../login/index.html#register           (hash)

     Anything unrecognised (or no hint at all) falls back to the login view.
     --------------------------------------------------------------------- */
  function initialView() {
    var hint = '';
    try {
      var params = new URLSearchParams(window.location.search || '');
      hint = params.get('view') || params.get('tab') || params.get('page') || '';
    } catch (e) { /* URLSearchParams unavailable — fall through to hash */ }
    if (!hint && window.location.hash) hint = window.location.hash.replace(/^#\/?/, '');
    hint = String(hint).toLowerCase();

    if (hint === 'register' || hint === 'signup' || hint === 'sign-up') return 'register';
    if (hint === 'forgot' || hint === 'forget' || hint === 'reset' || hint === 'rpwd') return 'forgot';
    return 'login';
  }

  function boot() {
    showView(initialView());
    initLoginTabs();
    initDropdowns();
    initEyes();
    initCheckboxes();
    initNavigation();

    // "Log in" enabled as soon as the user starts typing (phone variant)
    bindEnableState('.js-view-login .js-login-panel.activecontent .signIn__container',
      '.signIn__container-button button:not(.register)',
      ['input[name="userNumber"]', '.passwordInput__container-input input'],
      'any');
    bindEnableState('.js-view-login .js-login-panel:not(.activecontent) .signIn__container',
      '.signIn__container-button button:not(.register)',
      ['input[name="userEmail"]', '.passwordInput__container-input input'],
      'any');

    // Register enabled when phone + both passwords are filled
    bindEnableState('.js-view-register .register__container',
      '.register__container-button button:not(.login)',
      ['input[name="userNumber"]', '.passwordInput__container-input input']);

    // Reset enabled when phone + both passwords + verification code are filled
    bindEnableState('.js-view-forgot .register__container',
      '.register__container-button button',
      ['input[name="userNumber"]', '.passwordInput__container-input input',
       '.verifyInput__container-input input']);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
