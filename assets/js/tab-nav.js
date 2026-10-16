/* ============================================================================
   tab-nav.js  ---  instant, app-like tab navigation (no page reload feel)
   ----------------------------------------------------------------------------
   Problem: bottom-nav tabs used to do  window.location.href = '...' , so every
   tap caused a full page load: white flash, scroll jumps to top, everything
   re-paints. It looked like the app was "reloading" over and over.

   Fix: fetch the target page in the background, then swap only the <body>
   content in ONE synchronous step. The browser stays on the same document, so
   there is no white flash and no loading blink - the switch is instantaneous,
   exactly like clicking a tab in a native app. There is NO fade animation.

   Safety: if fetch() is unavailable (opening the file directly with file://),
   the network fails, or the target 404s, we fall back to a normal
   location.href navigation - exactly the old behaviour, so nothing can break.
   ========================================================================== */
(function () {
  'use strict';

  var FADE_MS = 0;            /* no animation - tab switches feel instant */
  var CACHE = {};             /* url -> { body, title } for instant back-nav */
  var SCROLL = {};            /* url -> scrollY, so returning restores position */
  var CURRENT = null;         /* absolute url of the page currently in the body */

  function canFetch(url) {
    if (typeof window.fetch !== 'function') return false;
    /* file:// pages cannot be fetched in most browsers -> allow normal nav */
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return false;
    try { return new URL(url, location.href).origin === location.origin; }
    catch (e) { return false; }
  }

  function abs(url) {
    try { return new URL(url, location.href).href; } catch (e) { return url; }
  }


  /* --------------------------------------------------------------------------
     Lazy images: the snapshot pages ship <img data-origin="..."> with no src.
     After a body swap those images are brand new DOM nodes, so they need to be
     observed again - otherwise they would stay blank.
     ------------------------------------------------------------------------ */
  var lazyObserver = null;
  if (typeof window.IntersectionObserver === 'function') {
    lazyObserver = new IntersectionObserver(function (entries, obs) {
      for (var i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (!en.isIntersecting) continue;
        var el = en.target;
        if (el.dataset && el.dataset.origin) el.src = el.dataset.origin;
        obs.unobserve(el);
      }
    }, { rootMargin: '200px 0px' });
  }

  function armLazyImages(root) {
    var nodes = (root || document).querySelectorAll('img[data-origin]');
    for (var i = 0; i < nodes.length; i++) {
      var img = nodes[i];
      if (lazyObserver) {
        lazyObserver.observe(img);
      } else if (!img.src) {
        img.src = img.dataset.origin;   /* no observer support: just load it */
      }
    }
  }

  /* --------------------------------------------------------------------------
     Re-run the swapped-in page's own inline scripts. innerHTML never executes
     <script> tags, so we recreate them - that is what makes the new page's
     sliders, popups and countdowns actually work after a swap.
     ------------------------------------------------------------------------ */
  function runScripts(root) {
    var scripts = root.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      var old = scripts[i];
      /* leave our own wiring script alone - it is already running */
      if (old.getAttribute('data-skip')) continue;
      var fresh = document.createElement('script');
      for (var a = 0; a < old.attributes.length; a++) {
        var at = old.attributes[a];
        fresh.setAttribute(at.name, at.value);
      }
      if (old.src) fresh.src = old.src; else fresh.textContent = old.textContent;
      old.parentNode.replaceChild(fresh, old);
    }
  }


  /* Keep the same <link rel=stylesheet> elements between pages. If the target
     page uses the same CSS files (our activity/category pages all do) we do not
     have to touch the head at all, which avoids any style flash. */
  function sheetKey(node) {
    return node.getAttribute('href') || '';
  }

  /* Inline <style> blocks carry page-specific rules that the shared sheets do
     not have - most importantly the "active tab is green" filter that lives in
     home's own inline style, and the per-page navbar colour rule the builder
     injects. swapIn() replaces <body> and re-runs inline scripts, but nothing
     re-applies the incoming page's <style> tags, so those rules vanished on the
     first tab tap and the green highlight was lost. Reconcile them here the
     same way as the <link> sheets. */
  function styleKey(node) {
    /* our own injected/marker styles are managed elsewhere - skip them */
    if (node.hasAttribute('data-tab-nav-bg')) return null;
    return (node.getAttribute('data-navbar') || 'inline') + '|' + node.textContent;
  }

  function syncStyles(doc) {
    var current = document.head.querySelectorAll('style');
    var incoming = doc.head.querySelectorAll('style');

    var nowKeys = {};
    for (var i = 0; i < current.length; i++) {
      var kc = styleKey(current[i]);
      if (kc) nowKeys[kc] = current[i];
    }

    var wantKeys = {};
    var toAdd = [];
    for (var j = 0; j < incoming.length; j++) {
      var ki = styleKey(incoming[j]);
      if (!ki) continue;
      wantKeys[ki] = true;
      if (!nowKeys[ki]) toAdd.push(incoming[j]);
    }

    /* bring in rules this page needs that we do not have yet */
    for (var m = 0; m < toAdd.length; m++) {
      var s = document.createElement('style');
      var attrs = toAdd[m].attributes;
      for (var a = 0; a < attrs.length; a++) s.setAttribute(attrs[a].name, attrs[a].value);
      s.setAttribute('data-tab-nav-style', '1');
      s.textContent = toAdd[m].textContent;
      document.head.appendChild(s);
    }

    /* drop the ones we added for a previous page that this page does not want */
    var mine = document.head.querySelectorAll('style[data-tab-nav-style="1"]');
    for (var n = mine.length - 1; n >= 0; n--) {
      var el = mine[n];
      var key = styleKey(el);
      if (!key || !wantKeys[key]) el.parentNode.removeChild(el);
    }
  }

  function syncHead(doc) {
    var current = document.head.querySelectorAll('link[rel="stylesheet"]');
    var incoming = doc.head.querySelectorAll('link[rel="stylesheet"]');

    var nowKeys = {};
    for (var i = 0; i < current.length; i++) nowKeys[sheetKey(current[i])] = true;

    var wantKeys = {};
    var toAdd = [];
    for (var j = 0; j < incoming.length; j++) {
      var k = sheetKey(incoming[j]);
      wantKeys[k] = true;
      if (!nowKeys[k]) toAdd.push(incoming[j]);
    }

    /* add anything the new page needs that we do not have yet */
    for (var m = 0; m < toAdd.length; m++) {
      var l = toAdd[m].cloneNode(true);
      l.setAttribute('data-tab-nav', '1');
      document.head.appendChild(l);
    }

    /* drop sheets we added for a previous page that this page does not want */
    var mine = document.head.querySelectorAll('link[data-tab-nav="1"]');
    for (var n = 0; n < mine.length; n++) {
      var el = mine[n];
      if (!wantKeys[sheetKey(el)]) el.parentNode.removeChild(el);
    }
  }

  /* --------------------------------------------------------------------------
     No animation at all - the tab switch must feel INSTANT (like a native
     app), just without the white flash / reload you get from location.href.
     The old page stays on screen until the new markup is parsed and ready,
     then we replace it in a single paint. Because <html>/<body> keep their
     background colour, nothing flashes white in between.
     ------------------------------------------------------------------------ */

  /* Lock the page background so a one-frame gap can never show white. */
  (function lockBackground() {
    try {
      var cs = window.getComputedStyle(document.documentElement);
      var bg = cs.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
        var bcs = document.body ? window.getComputedStyle(document.body).backgroundColor : '';
        bg = (bcs && bcs !== 'rgba(0, 0, 0, 0)') ? bcs : '#9195a3';
      }
      var s = document.createElement('style');
      s.setAttribute('data-tab-nav-bg', '1');
      s.textContent = 'html{background-color:' + bg + ' !important}';
      document.head.appendChild(s);
    } catch (e) { /* harmless */ }
  })();


  /* --------------------------------------------------------------------------
     The actual swap. Parses the fetched HTML and replaces everything inside
     <body>, then re-runs the page's scripts and re-arms lazy images.
     ------------------------------------------------------------------------ */
  function swapIn(html, url, title, activeLabel) {
    var doc = new DOMParser().parseFromString(html, 'text/html');

    syncHead(doc);
    syncStyles(doc);

    var incomingBody = doc.body;
    var newBody = document.body;

    /* copy class / style the new page wants on <body> (theme + root font size) */
    newBody.className = incomingBody.className;
    if (incomingBody.getAttribute('style') !== null) {
      newBody.setAttribute('style', incomingBody.getAttribute('style'));
    } else {
      newBody.removeAttribute('style');
    }

    /* replace the whole body content in one go - no flash, no reflow storm */
    while (newBody.firstChild) newBody.removeChild(newBody.firstChild);
    var kids = incomingBody.childNodes;
    for (var i = 0; i < kids.length; i++) {
      newBody.appendChild(document.importNode(kids[i], true));
    }

    if (title) document.title = title;

    runScripts(newBody);
    armLazyImages(newBody);

    /* remember what is actually mounted, so a later tap on the same route
       is a no-op instead of a pointless re-swap */
    CURRENT = url;

    /* Keep the address bar in step with what is mounted. Without this,
       location.href still points at the ORIGINAL page after a swap, so a
       second tap re-navigates (double-click / double-tap felt like it fired
       the same tab twice). */
    syncUrl(url);

    /* The body was replaced, so the tab node we cached for "this page's own
       tab" is detached now. The incoming page carries its own server-rendered
       `active` class, which is the authoritative answer for the page that is
       about to be on screen - re-read it here, BEFORE markActive() below
       overrides the highlight with the tapped tab. Without this, a later
       Account tap on the new page would "revert" the pill onto the tab of the
       page we just left. */
    captureOwnTab(true);

    /* After the swap the incoming page may mark a different tab as active
       (e.g. going from Activity to Home marks "Home"). We override that with
       the tab the user actually tapped, so the green highlight always lands
       on the tapped tab - the same feel the pages had before. */
    if (activeLabel) markActive(activeLabel);

    /* let late bootstrappers know a new page was mounted */
    try {
      document.dispatchEvent(new Event('tabnav:page', { bubbles: true }));
    } catch (e) { /* very old browser, harmless */ }

    /* After the swapped-in page's own scripts have had their turn (they run
       async when they are external <script src>), re-assert the tapped tab so
       nothing can leave the bar without a green highlight. */
    if (activeLabel) {
      window.setTimeout(function () { markActive(activeLabel); }, 0);
    }

    SCROLL[url] = 0;
  }

  /* Keep the address bar in step with the body we have mounted. A body swap
     does not change location.href on its own, and any code that reads the URL
     (or the browser's own back/forward bookkeeping) would otherwise disagree
     with what the user sees. pushState keeps this a same-document change, so
     there is still no reload. */
  function syncUrl(url) {
    if (!url || url === abs(location.href)) return;
    try {
      history.pushState({ tabnav: url }, '', url);
    } catch (e) { /* file:// or blocked history API - harmless */ }
  }

  /* Put the green/active state on exactly one bottom-nav tab. */
  function markActive(label) {
    var want = String(label || '').toLowerCase();
    var tabs = document.querySelectorAll('.tabbar__items-tab');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t.classList.contains('placeholder')) continue;
      var l = (t.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (l === want) t.classList.add('active');
      else t.classList.remove('active');
    }
  }

  /* Many snapshot pages register work on DOMContentLoaded / load. After a swap
     those events have already fired, so give late bootstrappers a second
     chance with a synthetic ready event. */
  function nudgeReady() {
    try {
      var ev;
      try { ev = new Event('DOMContentLoaded', { bubbles: true }); }
      catch (e) {
        ev = document.createEvent('Event');
        ev.initEvent('DOMContentLoaded', true, true);
      }
      document.dispatchEvent(ev);
    } catch (e) { /* ignore */ }
  }


  /* -------------------------------------------------------------------------- */
  /* Public: navigate to a page instantly, falling back to a normal load.       */
  /* -------------------------------------------------------------------------- */
  var busy = false;

  function smoothGo(url, activeLabel) {
    var target = abs(url);

    if (busy) return;

    /* Tapping a tab whose target IS the page already in the body (e.g.
       Promotion or Account while on Home) must not re-fetch and re-swap - that
       would wipe the green highlight the page's own listener just added.
       NOTE: we compare against CURRENT (what we actually mounted), not
       location.href - the URL can be out of sync with the body. */
    if (target === CURRENT) return;

    if (!canFetch(target)) { location.href = url; return; }

    busy = true;

    /* remember where the user was on the page they are leaving */
    SCROLL[abs(location.href)] =
      window.pageYOffset || document.documentElement.scrollTop || 0;

    function finish(html, title) {
      /* one synchronous frame: parse -> swap -> restore scroll -> done.
         No fade, no timeout, so it feels instant and nothing flashes. */
      swapIn(html, target, title, activeLabel);
      nudgeReady();
      var y = SCROLL[target] || 0;
      window.scrollTo(0, y);
      busy = false;
    }

    function fallback() {
      busy = false;
      location.href = url;          /* identical to the old behaviour */
    }

    /* already fetched once? swap instantly, zero wait */
    if (CACHE[target]) {
      finish(CACHE[target].body, CACHE[target].title);
      return;
    }

    fetch(target, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        CACHE[target] = { body: html, title: doc.title || '' };
        finish(html, doc.title || '');
      })
      .catch(fallback);
  }


  /* -------------------------------------------------------------------------- */
  /* -------------------------------------------------------------------------- */
  /* FLAT tabbar helper: put the green highlight on exactly ONE tab, and let a  */
  /* page pin it to its own tab after the Account popup opens/closes.           */
  /* -------------------------------------------------------------------------- */
  /* The tab bar is flat (Home, Activity, Get 500, Promotion, Account) and the
     Account tab is NOT routed - it opens a popup without navigating. That
     means a tap on Account would otherwise leave the green pill sitting on
     Account even though the page on screen never changed.

     Two things make the naive fix ("loop the tabs and look for my label")
     fragile:
       1. Label lookups are ORDER-DEPENDENT. An unqualified
          `if (l === 'account' || l === '<mine>')` matches Account first when
          Account comes before the page's own tab, and then `current === tab`
          so the revert is skipped and the pill never moves back.
       2. A deferred restore that early-returns on
          `if (!tab.classList.contains('active'))` can bail out entirely,
          leaving the pill wherever the last mutation put it.

     pinToPageTab() avoids both: the page's own tab is captured ONCE from the
     server-rendered `active` markup (that is the page's identity, not a
     guess), and the reset is unconditional - every other tab is cleared and
     only the page's tab is marked. Running it twice is a no-op. */
  /* The tab this page owns, captured ONCE at script-eval time.

     Why capture so early: pages that keep a generic
     `document.addEventListener('click', ...)` "mark the tapped tab active"
     listener (Home, Promotion) register it BEFORE the Account handler. Both
     live on `document`, so on an Account tap the generic listener runs FIRST
     and moves `active` onto Account. Anything that then asks the live DOM
     "which tab is active?" gets Account - not this page - and a revert based
     on that answer is a no-op. That is exactly how the pill ended up stuck on
     Account while the page on screen never changed.

     Reading it once, before any click can happen, makes the answer immune to
     that ordering. The URL is the authoritative signal; the server-rendered
     `active` class is only a fallback for paths that do not name a page. */
  var OWN_TAB = null;

  /* The tab whose label matches the page the browser is showing, derived from
     the URL path (/pages/<name>/...). This is the only signal that stays
     correct no matter which click listener has moved the highlight - the live
     `active` class does NOT, because a "mark the tapped tab active" listener
     registered earlier has already moved it onto Account by then. */
  function urlPageLabel() {
    var seg = (location.pathname || '').toLowerCase().split('/');
    for (var s = seg.length - 2; s >= 0; s--) {
      if (!seg[s] || seg[s] === 'pages' || seg[s] === 'logged-in') continue;
      return seg[s].replace(/\.html$/, '');
    }
    return null;
  }

  function tabByLabel(want) {
    if (!want) return null;
    var all = document.querySelectorAll('.tabbar__items-tab:not(.placeholder)');
    for (var i = 0; i < all.length; i++) {
      var l = (all[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (l === want) return all[i];
    }
    return null;
  }

  function captureOwnTab(force) {
    /* `force` re-reads the DOM even if the cached node is still connected -
       needed after a body swap, where a different page is now on screen. */
    if (!force && OWN_TAB && OWN_TAB.isConnected) return OWN_TAB;

    /* 1. authoritative: the page named by the URL */
    OWN_TAB = tabByLabel(urlPageLabel());
    if (OWN_TAB) return OWN_TAB;

    /* 2. fall back to the server-rendered mark (file:// opens, odd paths) */
    var marked = document.querySelector('.tabbar__items-tab.active:not(.placeholder)');
    if (marked && (marked.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() !== 'account') {
      OWN_TAB = marked;
      return OWN_TAB;
    }

    OWN_TAB = document.querySelector('.tabbar__items-tab:not(.placeholder)');
    return OWN_TAB;
  }

  /* The page's own tab. The cached node is only trusted while it is still in
     the document - TabNav replaces the body wholesale, and swapIn() calls
     captureOwnTab() to refresh it for the incoming page. */
  function pageTab() {
    if (OWN_TAB && OWN_TAB.isConnected) return OWN_TAB;
    return captureOwnTab();
  }

  /* Force the highlight onto `tab` (defaults to this page's own tab).

     A candidate node is rejected when it is detached, or when it disagrees
     with the page the browser is actually showing. That second guard is what
     makes this safe across TabNav body swaps: the Account handler of the page
     we just LEFT is still registered on `document` (the document never
     reloads), so it can fire while a different page is on screen. Its
     captured tab would then drag the pill back to the old page's tab. */
  function pinToPageTab(tab) {
    var want = tab;
    if (!want || !want.isConnected || !looksLikeCurrentPage(want)) {
      want = captureOwnTab(true);
    }
    var all = document.querySelectorAll('.tabbar__items-tab');
    for (var i = 0; i < all.length; i++) {
      var t = all[i];
      if (t.classList.contains('placeholder') || t === want) continue;
      t.classList.remove('active');
    }
    if (want && !want.classList.contains('active')) want.classList.add('active');
    return want;
  }

  /* Does `tab` belong to the page the browser is showing? Compared against
     the URL, which swapIn() keeps in step via history.pushState. Returns true
     when there is nothing to compare against, so a page whose URL is not
     under /pages/<name>/ (a plain file:// open, say) still works. */
  function looksLikeCurrentPage(tab) {
    var want = urlPageLabel();
    if (!want) return true;
    var l = (tab.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return l === want;
  }

  /* Capture immediately so no click listener registered later can poison it. */
  captureOwnTab();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', captureOwnTab);
  }

  /* Wire the bottom nav on any page that has it.                               */
  /* -------------------------------------------------------------------------- */
  function wireTabs(routes) {
    var tabs = document.querySelectorAll('.tabbar__items-tab:not(.placeholder)');
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        var label = (tab.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var href = routes[label];
        if (!href) return;
        tab.style.cursor = 'pointer';
        tab.addEventListener('click', function (e) {
          e.preventDefault();
          /* NOTE: no stopPropagation() here on purpose - the page's own
             "mark the tapped tab active/green" listener must still run. */
          smoothGo(href, label);
        });
      })(tabs[i]);
    }
  }

  /* Any element can opt in with  data-smooth-go="path"  (used for back arrows). */
  function wireSmoothLinks() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-smooth-go]');
      if (!el) return;
      var href = el.getAttribute('data-smooth-go');
      if (!href) return;
      e.preventDefault();
      smoothGo(href);
    });
  }

  window.TabNav = {
    go: smoothGo,
    wireTabs: wireTabs,
    armLazyImages: armLazyImages,
    pinToPageTab: pinToPageTab,
    pageTab: pageTab,
    instant: FADE_MS === 0
  };

  /* boot: arm whatever is already on this page */
  function boot() {
    /* the page the browser loaded is what is currently mounted */
    if (CURRENT === null) CURRENT = abs(location.href);
    armLazyImages(document);
    wireSmoothLinks();

    /* Back/forward: the URL changed without a reload, so re-mount whichever
       page the browser moved to. Keeps the address bar, the body and the
       green tab all telling the same story. */
    window.addEventListener('popstate', function () {
      var here = abs(location.href);
      if (here === CURRENT) return;
      /* a route we already fetched swaps instantly; anything else does a
         normal load, so history can never leave the page blank. */
      if (CACHE[here]) {
        var doc = new DOMParser().parseFromString(CACHE[here].body, 'text/html');
        swapIn(CACHE[here].body, here, CACHE[here].title || doc.title || '');
      } else {
        location.reload();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
