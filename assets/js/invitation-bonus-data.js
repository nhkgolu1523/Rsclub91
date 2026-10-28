/* ============================================================================
   INVITATION BONUS data (assets/js/invitation-bonus-data.js)
   ----------------------------------------------------------------------------
   Worker (RSInvite /bonus) se task list + invitee records laakar
   page ke .bonus-container me render karta hai (original jaisa).
   Aur "claim" button (Receive) -> worker /claim.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__RSInvBonus) return;
  window.__RSInvBonus = true;

  function money(n) { return '\u20B9' + (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function toast(msg) {
    var old = document.getElementById('rsInvBonusToast'); if (old && old.parentNode) old.parentNode.removeChild(old);
    var el = document.createElement('div'); el.id = 'rsInvBonusToast'; el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99999;'
      + 'background:rgba(30,30,36,.94);color:#fff;font-size:14px;padding:10px 18px;border-radius:8px;pointer-events:none;';
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1500);
  }

  function taskHtml(t, idx) {
    var btnCls = 'btn' + ((t.FINISHED && !t.RECEIVED) ? ' active' : '');
    var btnText = t.RECEIVED ? 'Received' : (t.FINISHED ? 'Receive' : 'Unfinished');
    return ''
      + '<div class="bonus-items">'
      + '<div class="head' + (t.FINISHED ? ' isFinshed' : '') + '">'
      + '<div class="left">Bonus <div>' + (idx + 1) + '</div></div>'
      + '<div class="right">' + money(t.BONUS) + '</div></div>'
      + '<div class="detail"><div class="text">Number of invitees</div><div class="people">' + (t.INVITEES) + '</div></div>'
      + '<div class="detail"><div class="text">Recharge per people</div><div class="num">' + money(t['PER-RECHARGE']) + '</div></div>'
      + '<div class="line"></div>'
      + '<div class="task"><div><div class="peopleval">' + (t['DONE-INVITEES']) + ' / ' + (t.INVITEES) + '</div><div class="text">Number of invitees</div></div>'
      + '<div><div class="rechargeval">' + (t['DONE-RECHARGE']) + ' / ' + (t.INVITEES) + '</div><div class="text">Deposit number</div></div></div>'
      + '<div class="' + btnCls + '" data-task="' + esc(t.ID) + '">' + btnText + '</div>'
      + '</div>';
  }

  function renderTasks(tasks) {
    var box = document.querySelector('.bonus-container');
    if (!box) return;
    var html = '<div class="rs-bonus-tasks">';
    if (!tasks || !tasks.length) {
      html += '<div class="empty__container"><p>No data</p></div>';
    } else {
      for (var i = 0; i < tasks.length; i++) html += taskHtml(tasks[i], i);
    }
    html += '</div>';
    box.innerHTML = html;
    var all = box.querySelectorAll('.rs-bonus-tasks, .rs-bonus-tasks *');
    for (var j = 0; j < all.length; j++) all[j].setAttribute('data-v-b733e3c6', '');
  }

  function load() {
    if (!window.RSInvite) return;
    var u = window.RSInvite.uid();
    if (!u) { renderTasks([]); return; }
    window.RSInvite.bonus({ uid: u }).then(function (res) {
      renderTasks((res && res.ok && res.tasks) ? res.tasks : []);
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.rs-bonus-tasks .btn') : null;
    if (!b) return;
    if (!b.classList.contains('active')) return;
    var id = b.getAttribute('data-task');
    if (!id || !window.RSInvite) return;
    b.classList.remove('active');
    window.RSInvite.claim(id).then(function (r) {
      if (r && r.ok) { toast('Claimed ' + money(r.bonus)); load(); }
      else { toast((r && r.error) || 'Could not claim'); load(); }
    });
  }, true);

  function boot() {
    if (!document.querySelector('.bonus-container')) return;
    load();
    setInterval(load, 12000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
