/* ============================================================================
   profile-prefs.js --- Firebase-backed language + avatar preferences
   ----------------------------------------------------------------------------
   Firebase layout used by this module:

     USERS/<uid>/PROFILE/SELECTED-LANGUAGE : "English" | "Hindi" | "Telugu" | "Tamil"
     USERS/<uid>/PROFILE/AVATAR-ID         : 1 .. 20

   The selected values are cached in localStorage only for the logged-in UID,
   so guests always keep the defaults (English / avatar 1). Every account page
   reads the Firebase values on boot and applies them to every avatar and
   language control it can find.
   ========================================================================== */
(function () {
  'use strict';

  var MODULE_SRC = (document.currentScript && document.currentScript.src) || '';
  var AVATAR_BASE = (function () {
    try { return new URL('../images/avatars/', MODULE_SRC || location.href).href; }
    catch (e) { return '/assets/images/avatars/'; }
  })();
  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';
  var LANG_KEY = 'rsclub_language';
  var AVATAR_KEY = 'rsclub_avatar_id';
  var AVATAR_SRC_KEY = 'rsclub_avatar';
  var CACHE_UID_KEY = 'rsclub_profile_uid';
  var PENDING_KEY = 'rsclub_profile_pending';
  var PENDING_MAX_AGE = 20000;
  var MAX_AVATAR = 20;

  var LANGUAGES = [
    { key: 'English', code: 'EN', label: 'English', html: 'en', aliases: ['english', 'en', 'eng'] },
    { key: 'Hindi',   code: 'HD', label: 'हिंदी',  html: 'hi', aliases: ['hindi', 'हिंदी', 'hd'] },
    { key: 'Tamil',   code: 'TA', label: 'தமிழ்', html: 'ta', aliases: ['tamil', 'தமிழ்', 'ta'] },
    { key: 'Telugu',  code: 'TE', label: 'తెలుగు', html: 'te', aliases: ['telugu', 'తెలుగు', 'te'] }
  ];

  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function store(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function drop(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function uid() { return store('rsclub_uid'); }
  function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  function normalizeLanguage(value) {
    var needle = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
    if (!needle) return null;
    for (var i = 0; i < LANGUAGES.length; i++) {
      var lang = LANGUAGES[i];
      if (lang.key.toLowerCase() === needle || lang.label.toLowerCase() === needle ||
          lang.code.toLowerCase() === needle || lang.aliases.indexOf(needle) >= 0) return lang;
    }
    return null;
  }

  function languageByCode(code) {
    code = String(code || '').trim().toUpperCase();
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return null;
  }

  function normalizeAvatar(value) {
    var n = parseInt(value, 10);
    if (!isFinite(n) || n < 1 || n > MAX_AVATAR) return 1;
    return n;
  }

  function avatarSrc(id) { return AVATAR_BASE + normalizeAvatar(id) + '.png'; }

  function apiError(message) {
    var err = new Error(message || 'Could not save your profile. Please try again.');
    err.rsProfile = true;
    return err;
  }

  function profileUrl(userId) {
    return FB + '/USERS/' + encodeURIComponent(userId) + '/PROFILE.json';
  }

  function getProfile(userId) {
    return fetch(profileUrl(userId), { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw apiError('Could not load your profile (' + res.status + ').');
      return res.json();
    });
  }

  function restPatch(userId, changes) {
    return fetch(profileUrl(userId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
      keepalive: true
    }).then(function (res) {
      if (!res.ok) throw apiError('Could not save your profile (' + res.status + ').');
      return null;
    });
  }

  function patchProfile(userId, changes) {
    return restPatch(userId, changes);
  }

  function readProfileValue(profile, keys) {
    if (!profile || typeof profile !== 'object') return undefined;
    for (var i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(profile, keys[i])) return profile[keys[i]];
    }
    return undefined;
  }

  var state = {
    language: normalizeLanguage('English'),
    avatarId: 1,
    loaded: false,
    uid: '',
    writeVersion: 0,
    refreshToken: 0
  };

  function readCache(userId) {
    if (!userId || store(CACHE_UID_KEY) !== String(userId)) return null;
    var lang = normalizeLanguage(store(LANG_KEY));
    var avatar = normalizeAvatar(store(AVATAR_KEY));
    return {
      language: lang || normalizeLanguage('English'),
      avatarId: avatar
    };
  }

  function writeCache(userId, lang, avatarId) {
    if (!userId) return;
    save(CACHE_UID_KEY, String(userId));
    save(LANG_KEY, lang.key);
    save(AVATAR_KEY, String(avatarId));
    save(AVATAR_SRC_KEY, avatarSrc(avatarId));
  }

  function clearCache() {
    drop(CACHE_UID_KEY);
    drop(LANG_KEY);
    drop(AVATAR_KEY);
    drop(AVATAR_SRC_KEY);
    drop(PENDING_KEY);
  }

  function readPending(userId) {
    if (!userId) return null;
    try {
      var pending = JSON.parse(store(PENDING_KEY) || 'null');
      if (!pending || String(pending.uid) !== String(userId)) return null;
      if (Date.now() - Number(pending.at || 0) > PENDING_MAX_AGE) return null;
      var lang = normalizeLanguage(pending.language);
      if (!lang) return null;
      var changes = {};
      if (pending.changes && typeof pending.changes === 'object') {
        if (pending.changes['SELECTED-LANGUAGE']) changes['SELECTED-LANGUAGE'] = lang.key;
        if (pending.changes['AVATAR-ID']) changes['AVATAR-ID'] = normalizeAvatar(pending.avatarId);
      }
      return {
        language: lang,
        avatarId: normalizeAvatar(pending.avatarId),
        changes: Object.keys(changes).length ? changes : {
          'SELECTED-LANGUAGE': lang.key,
          'AVATAR-ID': normalizeAvatar(pending.avatarId)
        }
      };
    } catch (e) {
      return null;
    }
  }

  function writePending(userId, lang, avatarId, changes) {
    if (!userId) return;
    var previous = readPending(userId);
    var merged = {};
    if (previous) {
      Object.keys(previous.changes).forEach(function (key) { merged[key] = previous.changes[key]; });
    }
    Object.keys(changes || {}).forEach(function (key) { merged[key] = changes[key]; });
    save(PENDING_KEY, JSON.stringify({
      uid: String(userId),
      language: lang.key,
      avatarId: normalizeAvatar(avatarId),
      changes: merged,
      at: Date.now()
    }));
  }

  function clearPending(userId) {
    if (!userId) return drop(PENDING_KEY);
    try {
      var pending = JSON.parse(store(PENDING_KEY) || 'null');
      if (!pending || String(pending.uid) === String(userId)) drop(PENDING_KEY);
    } catch (e) {
      drop(PENDING_KEY);
    }
  }

  function profilePrefs(profile) {
    var langValue = readProfileValue(profile, ['SELECTED-LANGUAGE', 'SELCTED-LANGUAGE', 'selectedLanguage', 'LANGUAGE', 'language']);
    var avatarValue = readProfileValue(profile, ['AVATAR-ID', 'AVATAR_ID', 'avatarId', 'AVATAR', 'avatar']);
    return {
      language: normalizeLanguage(langValue) || LANGUAGES[0],
      avatarId: normalizeAvatar(avatarValue),
      hasLanguage: !!normalizeLanguage(langValue),
      hasAvatar: parseInt(avatarValue, 10) >= 1 && parseInt(avatarValue, 10) <= MAX_AVATAR
    };
  }

  function toast(message) {
    var old = document.getElementById('rsProfileToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsProfileToast';
    el.textContent = message;
    el.style.cssText = 'position:fixed;left:50%;bottom:118px;transform:translateX(-50%);' +
      'z-index:99999;max-width:82%;width:max-content;padding:9px 16px;border-radius:20px;' +
      'font-size:13px;line-height:1.4;text-align:center;color:#fff;' +
      'background:rgba(176,42,42,.96);box-shadow:0 6px 24px rgba(0,0,0,.45);' +
      'pointer-events:none;opacity:1;transition:opacity .2s ease;';
    document.body.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }, 2400);
  }

  function setHeaderFlag(fromItem) {
    var bar = document.querySelector('.lang');
    if (!bar) return;
    var src = fromItem ? fromItem.querySelector('.flag') : null;
    if (!src) return;
    var icon = src.cloneNode(true);
    icon.classList.remove('flag');
    icon.classList.add('lang-flag');
    icon.removeAttribute('id');
    var g = icon.querySelector('g[clip-path]');
    if (g) g.removeAttribute('clip-path');
    qa('[id]', icon).forEach(function (el) { el.removeAttribute('id'); });
    var existing = bar.querySelector('svg.lang-flag');
    if (existing) existing.parentNode.replaceChild(icon, existing);
    else {
      var img = bar.querySelector('img');
      if (img) img.parentNode.replaceChild(icon, img);
      else bar.insertBefore(icon, bar.firstChild);
    }
  }

  function applyLanguage(lang) {
    lang = normalizeLanguage(lang && lang.key ? lang.key : lang) || LANGUAGES[0];
    state.language = lang;

    document.documentElement.setAttribute('lang', lang.html);
    document.documentElement.setAttribute('data-rs-language', lang.key);

    qa('.languageName').forEach(function (el) { el.textContent = lang.key; });

    var bar = document.querySelector('.lang');
    if (bar) {
      bar.setAttribute('data-lang', lang.code);
      var label = bar.querySelector('span');
      if (label) label.textContent = lang.code;
    }

    qa('.settingPanel__container-items__item').forEach(function (row) {
      var title = row.querySelector('.settingPanel__container-items__title');
      var name = title ? (title.textContent || '').replace(/\s+/g, ' ').trim() : '';
      if (name.toLowerCase() !== 'language') return;
      var value = row.querySelector('.settingPanel__container-items-right span');
      if (value) value.textContent = lang.key;
      row.setAttribute('data-rs-language', lang.key);
    });

    var popup = document.getElementById('langPopup');
    if (popup) {
      var active = null;
      qa('.lang-item', popup).forEach(function (item) {
        var itemLang = languageByCode(item.getAttribute('data-lang'));
        var on = !!itemLang && itemLang.key === lang.key;
        item.classList.toggle('active', on);
        if (on) active = item;
      });
      if (active) setHeaderFlag(active);
    }

    qa('.list .item').forEach(function (item) {
      var text = (item.textContent || '').replace(/\s+/g, ' ').trim();
      var itemLang = normalizeLanguage(text);
      if (!itemLang) return;
      var on = itemLang.key === lang.key;
      item.classList.toggle('checked', on);
      item.setAttribute('data-rs-language', itemLang.key);
      var radio = item.querySelector('.van-radio');
      if (radio) radio.setAttribute('aria-checked', on ? 'true' : 'false');
      var icon = item.querySelector('.van-radio__icon');
      if (icon) icon.classList.toggle('van-radio__icon--checked', on);
    });
  }

  function applyAvatar(id) {
    id = normalizeAvatar(id);
    state.avatarId = id;
    var src = avatarSrc(id);
    document.documentElement.setAttribute('data-rs-avatar-id', String(id));

    qa('.userInfo__container-content__avatar img,.userAvatar,' +
       '.userInfo__container-setting-center-header img').forEach(function (img) {
      img.src = src;
    });

    var grid = qa('.avatar-container-content .van-grid-item');
    grid.forEach(function (item, index) {
      var avatarId = index + 1;
      item.setAttribute('data-avatar-id', String(avatarId));
      var img = item.querySelector('img');
      if (img) {
        img.src = avatarSrc(avatarId);
        img.classList.toggle('active', avatarId === id);
      }
      var icon = item.querySelector('.van-checkbox__icon');
      if (icon) icon.classList.toggle('van-checkbox__icon--checked', avatarId === id);
    });

    if (uid()) save(AVATAR_SRC_KEY, src);
  }

  function applyAll() {
    applyLanguage(state.language);
    applyAvatar(state.avatarId);
  }

  function setLanguage(value) {
    var lang = normalizeLanguage(value);
    if (!lang) return Promise.reject(apiError('That language is not available.'));

    var userId = uid();
    if (!userId) {
      applyLanguage(lang);
      return Promise.resolve({ guest: true, language: lang.key });
    }

    var previous = state.language;
    var avatarAtWrite = state.avatarId;
    var version = ++state.writeVersion;
    state.language = lang;
    writeCache(userId, lang, avatarAtWrite);
    writePending(userId, lang, avatarAtWrite, { 'SELECTED-LANGUAGE': lang.key });
    applyLanguage(lang);

    return patchProfile(userId, { 'SELECTED-LANGUAGE': lang.key }).then(function () {
      if (version === state.writeVersion) {
        clearPending(userId);
        writeCache(userId, lang, avatarAtWrite);
      }
      return { guest: false, language: lang.key };
    }).catch(function (err) {
      if (version === state.writeVersion) {
        clearPending(userId);
        state.language = previous;
        writeCache(userId, previous, state.avatarId);
        applyLanguage(previous);
      }
      throw err;
    });
  }

  function setAvatar(value) {
    var id = normalizeAvatar(value);
    var userId = uid();
    if (!userId) {
      applyAvatar(id);
      return Promise.resolve({ guest: true, avatarId: id });
    }

    var previous = state.avatarId;
    var langAtWrite = state.language;
    var version = ++state.writeVersion;
    state.avatarId = id;
    writeCache(userId, langAtWrite, id);
    writePending(userId, langAtWrite, id, { 'AVATAR-ID': id });
    applyAvatar(id);

    return patchProfile(userId, { 'AVATAR-ID': id }).then(function () {
      if (version === state.writeVersion) {
        clearPending(userId);
        writeCache(userId, langAtWrite, id);
      }
      return { guest: false, avatarId: id };
    }).catch(function (err) {
      if (version === state.writeVersion) {
        clearPending(userId);
        state.avatarId = previous;
        writeCache(userId, state.language, previous);
        applyAvatar(previous);
      }
      throw err;
    });
  }

  function confirmPending(userId, pending, token, versionAtStart, attempt) {
    return delay(attempt ? 700 : 0).then(function () {
      if (token !== state.refreshToken || uid() !== userId || state.writeVersion !== versionAtStart) return null;
      if (attempt === 2 || attempt === 5 || attempt === 8) {
        return patchProfile(userId, pending.changes).catch(function () {}).then(function () { return getProfile(userId); });
      }
      return getProfile(userId);
    }).then(function (profile) {
      if (!profile) return state;
      if (token !== state.refreshToken || uid() !== userId || state.writeVersion !== versionAtStart) return state;

      var prefs = profilePrefs(profile);
      var languageSaved = !pending.changes['SELECTED-LANGUAGE'] || prefs.language.key === pending.language.key;
      var avatarSaved = !pending.changes['AVATAR-ID'] || prefs.avatarId === pending.avatarId;
      if (languageSaved && avatarSaved) {
        clearPending(userId);
        state.language = prefs.language;
        state.avatarId = prefs.avatarId;
        state.loaded = true;
        writeCache(userId, prefs.language, prefs.avatarId);
        applyAll();
        return state;
      }

      if (attempt < 10) return confirmPending(userId, pending, token, versionAtStart, attempt + 1);

      clearPending(userId);
      state.language = prefs.language;
      state.avatarId = prefs.avatarId;
      state.loaded = true;
      writeCache(userId, prefs.language, prefs.avatarId);
      applyAll();
      return state;
    }).catch(function (err) {
      if (token !== state.refreshToken || uid() !== userId || state.writeVersion !== versionAtStart) return state;
      if (attempt < 10) return confirmPending(userId, pending, token, versionAtStart, attempt + 1);
      clearPending(userId);
      try { console.warn('[RSProfile]', err && err.message ? err.message : err); } catch (e) {}
      return state;
    });
  }

  function refresh() {
    var userId = uid();
    state.uid = userId;
    var token = ++state.refreshToken;

    if (!userId) {
      clearCache();
      state.language = normalizeLanguage('English');
      state.avatarId = 1;
      state.loaded = false;
      applyAll();
      return Promise.resolve(state);
    }

    var cached = readCache(userId);
    var pending = readPending(userId);
    var versionAtStart = state.writeVersion;

    if (pending) {
      state.language = pending.language;
      state.avatarId = pending.avatarId;
      writeCache(userId, pending.language, pending.avatarId);
      applyAll();
      return confirmPending(userId, pending, token, versionAtStart, 0);
    }

    if (cached) {
      state.language = cached.language;
      state.avatarId = cached.avatarId;
      applyAll();
    }

    return getProfile(userId).then(function (profile) {
      if (token !== state.refreshToken || uid() !== userId || state.writeVersion !== versionAtStart) return state;
      var prefs = profilePrefs(profile);
      var changes = {};
      if (!prefs.hasLanguage) changes['SELECTED-LANGUAGE'] = prefs.language.key;
      if (!prefs.hasAvatar) changes['AVATAR-ID'] = prefs.avatarId;
      if (Object.keys(changes).length) patchProfile(userId, changes).catch(function () {});

      clearPending(userId);
      state.language = prefs.language;
      state.avatarId = prefs.avatarId;
      state.loaded = true;
      writeCache(userId, prefs.language, prefs.avatarId);
      applyAll();
      return state;
    }).catch(function (err) {
      if (token !== state.refreshToken) return state;
      if (!cached) {
        state.language = normalizeLanguage('English');
        state.avatarId = 1;
        applyAll();
      }
      try { console.warn('[RSProfile]', err && err.message ? err.message : err); } catch (e) {}
      return state;
    });
  }

  function load(userId) {
    if (userId) save('rsclub_uid', String(userId));
    return refresh();
  }

  function onDocumentClick(e) {
    var item = e.target && e.target.closest ? e.target.closest('.lang-item[data-lang]') : null;
    if (!item) return;
    if (!uid()) {
      applyLanguage(state.language);
      return;
    }
    var lang = languageByCode(item.getAttribute('data-lang'));
    if (!lang) return;
    setLanguage(lang.key).catch(function (err) {
      toast(err && err.message ? err.message : 'Could not save language.');
    });
  }

  var api = {
    languages: LANGUAGES,
    maxAvatar: MAX_AVATAR,
    avatarSrc: avatarSrc,
    normalizeLanguage: function (value) {
      var lang = normalizeLanguage(value);
      return lang ? lang.key : '';
    },
    getLanguage: function () { return state.language.key; },
    getAvatarId: function () { return state.avatarId; },
    refresh: refresh,
    load: load,
    setLanguage: setLanguage,
    setAvatar: setAvatar,
    apply: applyAll,
    mount: refresh,
    clearCache: clearCache
  };

  var firstLoad = !window.RSProfile;
  window.RSProfile = api;

  if (firstLoad) {
    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('storage', function (e) {
      if (!e.key || [LANG_KEY, AVATAR_KEY, CACHE_UID_KEY, 'rsclub_uid'].indexOf(e.key) >= 0) refresh();
    });
    document.addEventListener('tabnav:page', function () { refresh(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();
})();
