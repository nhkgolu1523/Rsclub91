/* Notification Center page - navigation + tab wiring.
   The page markup is a pre-rendered snapshot, so we just add behaviour. */
(function () {
  'use strict';

  // Home page ka path (pages/notification-center/ se 2 level upar -> pages/home/)
  var HOME_PAGE = '../home/index.html';

  function goHome() {
    // History hai to back (browser ka natural back), warna home par jao
    if (window.history && window.history.length > 1 && document.referrer) {
      window.history.back();
    } else {
      window.location.href = HOME_PAGE;
    }
  }

  // 1. Navbar ka back arrow -> home
  var backArrow = document.querySelector('.navbar__content-left .van-icon-arrow-left');
  if (backArrow) {
    backArrow.style.cursor = 'pointer';
    backArrow.addEventListener('click', function (e) {
      e.preventDefault();
      goHome();
    });
  }

  // 2. Tabs (Notification / Information) - pre-rendered panels ko switch karo
  //    Active tab ka underline (Vant bottom-bar) design me nahi chahiye -> DOM se hata do
  var tabLines = document.querySelectorAll('.van-tabs__line');
  for (var k = 0; k < tabLines.length; k++) {
    if (tabLines[k] && tabLines[k].parentNode) {
      tabLines[k].parentNode.removeChild(tabLines[k]);
    }
  }
  // extra safety: agar kahin aur line/bottom-bar render ho jaye
  var bottomBars = document.querySelectorAll('.van-tabs__nav--line .van-tabs__line, .van-tabs__bottom-bar');
  for (var b = 0; b < bottomBars.length; b++) {
    if (bottomBars[b] && bottomBars[b].parentNode) {
      bottomBars[b].parentNode.removeChild(bottomBars[b]);
    }
  }

  function activateTab(index) {
    var tabs = document.querySelectorAll('.van-tabs__nav .van-tab');
    var panels = document.querySelectorAll('.van-tabs__content .van-tab__panel');
    if (!tabs.length || !panels.length) return;

    for (var i = 0; i < tabs.length; i++) {
      var on = i === index;
      tabs[i].classList.toggle('van-tab--active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].style.color = on ? 'var(--text_color_L4)' : 'var(--text_color_L2)';
      if (panels[i]) panels[i].style.display = on ? '' : 'none';
    }

    // NOTE: Vant ka bottom-bar / underline ('.van-tabs__line') deliberately
    // use nahi kiya - design me active tab ka underline nahi chahiye.
  }

  var tabEls = document.querySelectorAll('.van-tabs__nav .van-tab');
  for (var i = 0; i < tabEls.length; i++) {
    (function (idx) {
      tabEls[idx].style.cursor = 'pointer';
      tabEls[idx].addEventListener('click', function () { activateTab(idx); });
    })(i);
  }

  // 3. Pehle se jo tab active hai usko sahi set karo (underline position)
  var initial = 0;
  for (var j = 0; j < tabEls.length; j++) {
    if (tabEls[j].classList.contains('van-tab--active')) { initial = j; break; }
  }
  activateTab(initial);

  // 4. Browser back/forward support (optional deep-link: ?tab=information)
  try {
    var params = new URLSearchParams(window.location.search || '');
    var want = (params.get('tab') || '').toLowerCase();
    if (want === 'information' || want === 'info') activateTab(1);
    if (want === 'notification') activateTab(0);
  } catch (e) { /* ignore */ }

  // 5. Notifications are fully driven by Firebase (per logged-in user).
  //    USERS/<uid>/NOTIFICATIONS/NOTIFICATION/<id> = { TITLE, MESSAGE, TIME, DELETED }
  //    USERS/<uid>/NOTIFICATIONS/INFORMATION/<id>  = { TITLE, MESSAGE, TIME, DELETED }
  var FB = 'https://rsclub91-62526-default-rtdb.firebaseio.com';

  function currentUid() {
    try {
      var uid = localStorage.getItem('rsclub_uid');
      uid = uid == null ? '' : String(uid).trim();
      if (!uid || uid === 'null' || uid === 'undefined') return '';
      return uid;
    } catch (e) { return ''; }
  }

  function nowStamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
      + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function toast(msg) {
    var old = document.getElementById('rsNotifToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div');
    el.id = 'rsNotifToast';
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);'
      + 'z-index:99999;background:rgba(30,30,36,.94);color:#fff;font-size:.32rem;'
      + 'padding:.2rem .4rem;border-radius:.4rem;opacity:0;transition:opacity .2s;'
      + 'pointer-events:none;';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; });
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 1400);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var notifUid = currentUid();

  /* Hide all notification rows until Firebase data has rendered, so stale
     snapshot rows (or deleted ones) never flash on load. */
  (function hideUntilReady() {
    var st = document.createElement('style');
    st.id = 'rs-notif-hide';
    st.textContent = 'html:not(.rs-notif-ready) .personal-message-list__item,'
      + 'html:not(.rs-notif-ready) .site-message-list__item{display:none!important;}';
    (document.head || document.documentElement).appendChild(st);
  })();

  function markReady() {
    document.documentElement.classList.add('rs-notif-ready');
  }

  var deletedLocal = {};

  function panelHost(panelId, itemClass) {
    return { panelId: panelId, itemClass: itemClass };
  }

  function resolveHost(target) {
    var panel = document.getElementById(target.panelId);
    if (!panel) return null;
    return panel.querySelector('.infiniteScroll') || panel.querySelector('.messages__content');
  }

  /* Capture one static snapshot item of each type (before we clear them) so the
     rendered items keep the exact original classes + SVG scope + styling. */
  var notifTemplate = null;
  var infoTemplate = null;
  (function captureTemplates() {
    var n = document.querySelector('.personal-message-list__item');
    if (n) notifTemplate = n.cloneNode(true);
    var f = document.querySelector('.site-message-list__item');
    if (f) infoTemplate = f.cloneNode(true);
  })();

  function countRenderable(bucket) {
    if (!bucket || typeof bucket !== 'object') return 0;
    var n = 0;
    var ids = Object.keys(bucket);
    for (var i = 0; i < ids.length; i++) {
      var it = bucket[ids[i]];
      if (!it || typeof it !== 'object') continue;
      if (String(it.DELETED || '').toUpperCase() === 'YES') continue;
      n++;
    }
    return n;
  }

  function setText(el, value) {
    if (el) el.textContent = value == null ? '' : String(value);
  }

  function buildFromTemplate(template, e, isInfo) {
    var item;
    if (template) {
      item = template.cloneNode(true);
    } else {
      item = document.createElement('div');
      item.className = isInfo ? 'site-message-list__item' : 'personal-message-list__item';
      if (isInfo) {
        item.innerHTML = '<div class="site-message-list__item-title"><span></span></div>'
          + '<div class="site-message-list__item-desc"></div><h5></h5>';
      } else {
        item.innerHTML = '<div class="personal-message-list__item-title"><div><span></span></div></div>'
          + '<div class="personal-message-list__item-time"></div>'
          + '<div class="personal-message-list__item-content"></div>';
      }
    }
    item.setAttribute('data-notif-id', e.id);

    if (isInfo) {
      var t = item.querySelector('.site-message-list__item-title span');
      if (t) { t.textContent = e.item.TITLE == null ? '' : String(e.item.TITLE); }
      setText(item.querySelector('.site-message-list__item-desc'), e.item.MESSAGE);
      setText(item.querySelector('h5'), e.item.TIME);
    } else {
      var ts = item.querySelector('.personal-message-list__item-title span');
      if (ts) {
        ts.textContent = e.item.TITLE == null ? '' : String(e.item.TITLE);
        ts.setAttribute('title', e.item.TITLE == null ? '' : String(e.item.TITLE));
      }
      setText(item.querySelector('.personal-message-list__item-time'), e.item.TIME);
      setText(item.querySelector('.personal-message-list__item-content'), e.item.MESSAGE);
    }
    return item;
  }

  function renderList(target, map) {
    var host = resolveHost(target);
    if (!host) return;
    var itemClass = target.itemClass;
    var isInfo = itemClass === 'site-message-list__item';

    var old = host.querySelectorAll('.' + itemClass);
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }

    var entries = [];
    if (map && typeof map === 'object') {
      var ids = Object.keys(map);
      for (var j = 0; j < ids.length; j++) {
        var n = map[ids[j]];
        if (!n || typeof n !== 'object') continue;
        if (String(n.DELETED || '').toUpperCase() === 'YES') continue;
        if (deletedLocal[itemClass + ':' + ids[j]]) continue;
        entries.push({ id: ids[j], item: n });
      }
    }

    entries.sort(function (a, b) {
      return String(b.item.TIME || '').localeCompare(String(a.item.TIME || ''));
    });

    var anchor = host.querySelector('.infiniteScroll__loading');
    var template = isInfo ? infoTemplate : notifTemplate;

    for (var k = 0; k < entries.length; k++) {
      var item = buildFromTemplate(template, entries[k], isInfo);
      if (anchor) host.insertBefore(item, anchor);
      else host.appendChild(item);
    }
  }

  function fillTimes(bucket, bucketName) {
    if (!bucket || typeof bucket !== 'object' || !notifUid) return;
    var ids = Object.keys(bucket);
    var stamp = nowStamp();
    for (var i = 0; i < ids.length; i++) {
      var n = bucket[ids[i]];
      if (!n || typeof n !== 'object') continue;
      if (!n.TIME || String(n.TIME).trim() === '') {
        n.TIME = stamp;
        var turl = FB + '/USERS/' + encodeURIComponent(notifUid)
          + '/NOTIFICATIONS/' + bucketName + '/' + encodeURIComponent(ids[i]) + '/TIME.json';
        fetch(turl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stamp)
        }).catch(function () {});
      }
    }
  }

  var notifTarget = panelHost('van-tab-10', 'personal-message-list__item');
  var infoTarget = panelHost('van-tab-11', 'site-message-list__item');

  var lastData = null;

  function renderAll() {
    if (lastData) {
      renderList(notifTarget, lastData.NOTIFICATION);
      renderList(infoTarget, lastData.INFORMATION);
    } else {
      renderList(notifTarget, null);
      renderList(infoTarget, null);
    }
    markReady();
  }

  function scheduleRender() {
    renderAll();
    setTimeout(renderAll, 60);
    setTimeout(renderAll, 300);
    setTimeout(renderAll, 1000);
  }

  function loadNotifications() {
    if (!notifUid) {
      lastData = null;
      renderAll();
      return;
    }
    var url = FB + '/USERS/' + encodeURIComponent(notifUid) + '/NOTIFICATIONS.json';
    var cacheKey = 'rs_notif_cache_' + notifUid;
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          lastData = parsed;
          renderAll();
        }
      }
    } catch (e) {}
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        lastData = (data && typeof data === 'object') ? data : null;
        try { sessionStorage.setItem(cacheKey, JSON.stringify(lastData)); } catch (e) {}
        scheduleRender();
        if (lastData) {
          fillTimes(lastData.NOTIFICATION, 'NOTIFICATION');
          fillTimes(lastData.INFORMATION, 'INFORMATION');
          /* Vant may hydrate/re-render the tab panels after we inject. Re-apply
             only if our items disappeared, to avoid a render loop. */
          var host = resolveHost(notifTarget);
          if (host && typeof MutationObserver === 'function') {
            var reflowing = false;
            new MutationObserver(function () {
              if (reflowing) return;
              var expected = countRenderable(lastData.NOTIFICATION);
              var have = host.querySelectorAll('.personal-message-list__item').length;
              if (have >= expected && expected > 0) return;
              reflowing = true;
              setTimeout(function () { reflowing = false; renderAll(); }, 30);
            }).observe(host, { childList: true });
          }
        }
      })
      .catch(function () { lastData = null; renderAll(); });
  }

  /* Delegated: survives Vant/Vue re-render; works for rendered + static items. */
  document.addEventListener('click', function (e) {
    var icon = e.target && e.target.closest ? e.target.closest('.icon-messageGarbage') : null;
    if (!icon) return;
    var item = icon.closest('.personal-message-list__item, .site-message-list__item');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();

    var id = item.getAttribute('data-notif-id');
    var isInfo = item.classList.contains('site-message-list__item');
    var bucketName = isInfo ? 'INFORMATION' : 'NOTIFICATION';

    /* Instant hide: remove the row now; never render it again this session. */
    if (id) deletedLocal[(isInfo ? 'site-message-list__item' : 'personal-message-list__item') + ':' + id] = true;
    if (item.parentNode) item.parentNode.removeChild(item);

    if (!notifUid || !id) return;
    var url = FB + '/USERS/' + encodeURIComponent(notifUid)
      + '/NOTIFICATIONS/' + bucketName + '/' + encodeURIComponent(id) + '/DELETED.json';
    /* keep the session cache in sync so a reload does not bring it back */
    try {
      var ck = 'rs_notif_cache_' + notifUid;
      var cached = sessionStorage.getItem(ck);
      if (cached) {
        var obj = JSON.parse(cached);
        if (obj && obj[bucketName] && obj[bucketName][id]) {
          obj[bucketName][id].DELETED = 'YES';
          sessionStorage.setItem(ck, JSON.stringify(obj));
        }
      }
    } catch (e) {}
    fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify('YES')
    }).then(function (r) { if (r.ok) toast('Notification deleted'); }).catch(function () {});
  }, true);

  loadNotifications();
  window.addEventListener('load', function () { setTimeout(renderAll, 200); });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.van-tab')) setTimeout(renderAll, 50);
  }, true);
})();
