/* ============================================================================
   INVITATION BONUS NAV  (assets/js/invitation-bonus-nav.js)
   ----------------------------------------------------------------------------
   pages/invitation-bonus ke do buttons:
       .rule    "Invitation reward rules"  -> ../invitation-rules/index.html
       .record  "Invitation record"        -> ../invitation-record/index.html
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSInviteBonusNav) return;
  window.__RSInviteBonusNav = true;

  function go(href) { try { location.href = href; } catch (e) {} }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var rule = t.closest('.rule');
    if (rule) { e.preventDefault(); e.stopPropagation(); go('../invitation-rules/index.html'); return; }
    var rec = t.closest('.record');
    if (rec) { e.preventDefault(); e.stopPropagation(); go('../invitation-record/index.html'); return; }
  }, true);
})();
