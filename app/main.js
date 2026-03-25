/* ========================================
   Design Kanban — Main Entry Point
   ======================================== */

import { state, loadState, saveState } from './state.js';
import { applyTheme, setAccentColor, initThemeListeners } from './theme.js';
import { renderBoard } from './render.js';
import { renderProjectsView, renderProjectsTopbarNav } from './projects.js';
import { renderCalendarView, renderCalendarTopbarNav } from './calendar.js';
import { renderMyWorkView, renderMyWorkTopbarNav, getMyWorkProjectCount } from './mywork.js';
import { renderReviewsView, renderReviewsTopbarNav } from './reviews.js';
import { initModal, openModal } from './modal.js';
import { initSettings, updateProfile } from './settings.js';
import { initShortcuts } from './shortcuts.js';
import { initDetailPanel } from './detail-panel.js';
import { initTemplates } from './templates.js';
import { startRecurringEngine } from './recurring.js';
import { logTaskMoved, logUnarchived } from './activity.js';
import { initTeam } from './team.js';
import { renderProfileView } from './profile.js';
import { renderTrendsView, renderTrendsTopbarNav } from './trends.js';
import { initAuth, signInWithGoogle, signOutUser } from './auth.js';
import { initSync, loadFromFirestore } from './sync.js';
import { initNotifications } from './notifications.js';
import { renderHomeView, getWorkspaceMemberIds, isSuperAdmin } from './home.js';
import { updateAvatarStrip } from './team.js';
import { renderAdminView } from './admin.js';

// Expose references needed by render.js for callbacks
window._kanban = {
  openModal,
  logTaskMoved,
  logUnarchived,
  renderBoard: () => {
    // Only re-render the board if the board container is actually visible.
    // Firestore onSnapshot can fire at any time (e.g. while on Trends or Calendar),
    // and calling renderBoard() there would make boardContainer visible again.
    if (document.getElementById('boardContainer')?.style.display === 'none') return;
    renderBoard();
    updateMyWorkBadge();
  },
  updateMyWorkBadge: () => updateMyWorkBadge(),
  refreshHomeView: () => {}, // filled in after auth
};

// ── Auth Guard — wrap all init in auth check ──
initAuth().then(async (user) => {
  if (!user) {
    // Hide loading, show login
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'flex';
    const signInBtn = document.getElementById('googleSignInBtn');
    if (signInBtn) {
      signInBtn.addEventListener('click', async () => {
        signInBtn.disabled = true;
        signInBtn.textContent = 'Signing in...';
        try {
          await signInWithGoogle();
          // onAuthStateChanged will re-fire; reload to re-run auth flow
          window.location.reload();
        } catch (err) {
          signInBtn.disabled = false;
          signInBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.36 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.86-13.47-9.41l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg> Sign in with Google`;
        }
      });
    }
    return;
  }

  // Hide login screen (loading screen is already visible by default)
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen) loginScreen.style.display = 'none';
  const loadingScreen = document.getElementById('loadingScreen');

  // Populate signed-in user footer in settings panel
  const settingsFooter = document.getElementById('settingsUserFooter');
  if (settingsFooter) {
    settingsFooter.style.display = 'flex';
    const footerPhoto = document.getElementById('settingsUserPhoto');
    const footerName  = document.getElementById('settingsUserName');
    const footerEmail = document.getElementById('settingsUserEmail');
    const signOutBtn  = document.getElementById('signOutBtn');
    if (footerPhoto && user.photo) footerPhoto.src = user.photo;
    if (footerName)  footerName.textContent  = user.name  || '';
    if (footerEmail) footerEmail.textContent = user.email || '';
    if (signOutBtn)  signOutBtn.addEventListener('click', signOutUser);
  }

  // Eagerly restore currentBoard from localStorage before any async work
  // so Firestore snapshot renders use the correct workspace, not the default
  try {
    const _snap = JSON.parse(localStorage.getItem('designKanban') || '{}');
    if (_snap.currentBoard) state.currentBoard = _snap.currentBoard;
  } catch(e) {}

  // Load Firestore data first (falls back to localStorage on error)
  await loadFromFirestore();

  // Wire up Firestore sync
  initSync();

  // ── Initialize app ──
  loadState();

  // ── Stamp Google auth data into profile ──
  // Always trust the live Google identity over stale localStorage values
  if (user.name)  state.profile.name  = user.name;
  if (user.photo) state.profile.photo = user.photo;
  if (user.email) state.profile.email = user.email;
  if (user.role)  state.profile.authRole = user.role;
  saveState();

  applyTheme();
  setAccentColor(state.accentColor);
  updateProfile();
  initThemeListeners();
  initModal();
  initSettings();
  initTeam();
  initDetailPanel();
  initNotifications(user);
  initShortcuts();
  initTemplates();
  startRecurringEngine();

// ── Sidebar Navigation ──
const NAV_PLACEHOLDERS = { trends: 'Trends', calendar: 'Calendar' };

const viewSwitcher = document.querySelector('.view-switcher');


function showProjectsTopbar(viewContainer) {
  viewSwitcher.style.display = 'none';

  // ── Filter tabs ──────────────────────────
  let pn = document.getElementById('projectsTopbarNav');
  if (!pn) {
    pn = document.createElement('div');
    pn.id = 'projectsTopbarNav';
    pn.className = 'view-switcher';
    viewSwitcher.parentNode.insertBefore(pn, viewSwitcher);
  }
  renderProjectsTopbarNav(pn, viewContainer);

}

function showMyWorkTopbar(viewContainer) {
  viewSwitcher.style.display = 'none';
  let mn = document.getElementById('myWorkTopbarNav');
  if (!mn) {
    mn = document.createElement('div');
    mn.id = 'myWorkTopbarNav';
    mn.className = 'view-switcher';
    viewSwitcher.parentNode.insertBefore(mn, viewSwitcher);
  }
  renderMyWorkTopbarNav(mn, viewContainer);
}

function showReviewsTopbar(viewContainer) {
  viewSwitcher.style.display = 'none';
  let rn = document.getElementById('reviewsTopbarNav');
  if (!rn) {
    rn = document.createElement('div');
    rn.id = 'reviewsTopbarNav';
    rn.className = 'view-switcher';
    viewSwitcher.parentNode.insertBefore(rn, viewSwitcher);
  }
  renderReviewsTopbarNav(rn, viewContainer);
}

function showCalendarTopbar(viewContainer) {
  viewSwitcher.style.display = 'none';
  let cn = document.getElementById('calendarTopbarNav');
  if (!cn) {
    cn = document.createElement('div');
    cn.id = 'calendarTopbarNav';
    cn.className = 'view-switcher';
    viewSwitcher.parentNode.insertBefore(cn, viewSwitcher);
  }
  renderCalendarTopbarNav(cn, viewContainer);
}

function showTrendsTopbar() {
  viewSwitcher.style.display = 'none';
  let tn = document.getElementById('trendsTopbarNav');
  if (!tn) {
    tn = document.createElement('div');
    tn.id = 'trendsTopbarNav';
    tn.className = 'view-switcher';
    viewSwitcher.parentNode.insertBefore(tn, viewSwitcher);
  }
  renderTrendsTopbarNav(tn);
}

function restoreTopbar() {
  viewSwitcher.style.display = '';
  document.getElementById('projectsTopbarNav')?.remove();
  document.getElementById('calendarTopbarNav')?.remove();
  document.getElementById('myWorkTopbarNav')?.remove();
  document.getElementById('reviewsTopbarNav')?.remove();
  document.getElementById('trendsTopbarNav')?.remove();
}

function hideAllViews() {
  document.getElementById('boardContainer').style.display = 'none';
  document.getElementById('viewContainer').style.display = 'none';
  const ph = document.getElementById('navPlaceholder');
  if (ph) ph.remove();
  const pv = document.getElementById('projectsView');
  if (pv) pv.remove();
  const cv = document.getElementById('calendarView');
  if (cv) cv.remove();
  const mw = document.getElementById('myWorkView');
  if (mw) mw.remove();
  const rv = document.getElementById('reviewsView');
  if (rv) rv.remove();
  const profileV = document.getElementById('profileView');
  if (profileV) profileV.remove();
  const trendsV = document.getElementById('trendsView');
  if (trendsV) trendsV.remove();
  restoreTopbar();
  viewSwitcher.style.display = '';
  // Restore topbar title elements
  const badge = document.getElementById('boardBadge');
  if (badge) badge.style.display = '';
  document.getElementById('boardActionsBtn').style.display = '';
}

// ── Home View ──────────────────────────────────────────────────────────────────
const homeViewEl = document.getElementById('homeView');
const appEl      = document.querySelector('.app');

function showHomeView() {
  state.currentBoard = 'home';
  saveState();
  renderHomeView(homeViewEl, {
    onWorkspaceSelect: (boardId, wsName) => {
      hideHomeView();
      state.currentBoard = boardId;
      state.currentView  = 'board';
      state.currentNav   = 'overview';
      document.querySelectorAll('.sb-icon[data-nav]').forEach(i => i.classList.remove('active'));
      document.querySelector('.sb-icon[data-nav="overview"]').classList.add('active');
      hideAllViews();
      document.getElementById('boardContainer').style.display = '';
      document.getElementById('viewContainer').style.display = 'none';
      const badge = document.getElementById('boardBadge');
      if (badge) badge.style.display = '';
      document.getElementById('boardActionsBtn').style.display = '';
      // Set title immediately so workspaces without a BOARDS entry still show correctly
      const label = wsName || boardId;
      document.getElementById('boardTitle').textContent = label;
      const bc = document.getElementById('breadcrumbBoard');
      if (bc) bc.textContent = label;
      saveState();
      renderBoard();
      updateAvatarStrip();
      updateMyWorkBadge();
    },
    onManageUsers: () => showAdminView(),
  });
  homeViewEl.classList.add('visible');
  appEl.style.display = 'none';
}

function hideHomeView() {
  homeViewEl.classList.remove('visible');
  appEl.style.display = '';
}

// ── Admin View ─────────────────────────────────────────────────────────────────
const adminViewEl = document.getElementById('adminView');

function showAdminView() {
  renderAdminView(adminViewEl, {
    onBack: () => {
      adminViewEl.classList.remove('visible');
      showHomeView();
    },
  });
  adminViewEl.classList.add('visible');
  homeViewEl.classList.remove('visible');
  appEl.style.display = 'none';
}

// ── Breadcrumb "Workspace" → home ─────────────────────────────────────────────
document.getElementById('breadcrumbHomeLink')?.addEventListener('click', showHomeView);

// ── Sidebar logo → home ────────────────────────────────────────────────────────
document.querySelector('.sb-logo')?.addEventListener('click', showHomeView);

document.querySelectorAll('.sb-icon[data-nav]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sb-icon[data-nav]').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const nav = item.dataset.nav;
    state.currentNav = nav;
    saveState();

    if (nav === 'overview') {
      hideAllViews();
      document.getElementById('boardContainer').style.display = '';
      document.getElementById('viewContainer').style.display = 'none';
      state.currentView = state.currentView === 'board' ? 'board' : state.currentView;
      saveState();
      renderBoard();

    } else if (nav === 'projects') {
      hideAllViews();
      // Update topbar title
      document.getElementById('boardTitle').textContent = 'Projects';
      const bc = document.getElementById('breadcrumbBoard');
      if (bc) bc.textContent = 'Projects';
      const badge = document.getElementById('boardBadge');
      if (badge) badge.style.display = 'none';
      document.getElementById('boardActionsBtn').style.display = 'none';
      const pv = document.createElement('div');
      pv.id = 'projectsView';
      document.querySelector('.main').appendChild(pv);
      showProjectsTopbar(pv);
      renderProjectsView(pv);

    } else if (nav === 'calendar') {
      hideAllViews();
      document.getElementById('boardTitle').textContent = 'Calendar';
      const bc = document.getElementById('breadcrumbBoard');
      if (bc) bc.textContent = 'Calendar';
      const badge = document.getElementById('boardBadge');
      if (badge) badge.style.display = 'none';
      document.getElementById('boardActionsBtn').style.display = 'none';
      const cv = document.createElement('div');
      cv.id = 'calendarView';
      document.querySelector('.main').appendChild(cv);
      showCalendarTopbar(cv);
      renderCalendarView(cv);

    } else if (nav === 'people') {
      hideAllViews();
      document.getElementById('boardTitle').textContent = 'My Work';
      const bc = document.getElementById('breadcrumbBoard');
      if (bc) bc.textContent = 'My Work';
      const badge = document.getElementById('boardBadge');
      if (badge) badge.style.display = 'none';
      document.getElementById('boardActionsBtn').style.display = 'none';
      const mw = document.createElement('div');
      mw.id = 'myWorkView';
      document.querySelector('.main').appendChild(mw);
      showMyWorkTopbar(mw);
      renderMyWorkView(mw);
      updateMyWorkBadge();

    } else if (nav === 'reviews') {
      hideAllViews();
      document.getElementById('boardTitle').textContent = 'Reviews';
      const bc = document.getElementById('breadcrumbBoard');
      if (bc) bc.textContent = 'Reviews';
      const badge = document.getElementById('boardBadge');
      if (badge) badge.style.display = 'none';
      document.getElementById('boardActionsBtn').style.display = 'none';
      const rv = document.createElement('div');
      rv.id = 'reviewsView';
      document.querySelector('.main').appendChild(rv);
      showReviewsTopbar(rv);
      renderReviewsView(rv);

    } else if (nav === 'trends') {
      hideAllViews();
      document.getElementById('boardTitle').textContent = 'Trends';
      const bc = document.getElementById('breadcrumbBoard');
      if (bc) bc.textContent = 'Trends';
      const badge = document.getElementById('boardBadge');
      if (badge) badge.style.display = 'none';
      document.getElementById('boardActionsBtn').style.display = 'none';
      const tv = document.createElement('div');
      tv.id = 'trendsView';
      tv.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';
      document.querySelector('.main').appendChild(tv);
      showTrendsTopbar();
      renderTrendsView(tv);
    }
  });
});

// ── All Workspaces → go back to home ──
document.getElementById('allWorkspacesBtn').addEventListener('click', () => {
  document.getElementById('boardActionsDropdown').classList.remove('show');
  showHomeView();
});

// ── Workspace Members Modal ──

const wsMembersOverlay = document.getElementById('wsMembersOverlay');
const wsMembersList    = document.getElementById('wsMembersList');

function openWsMembersModal() {
  const wsId    = state.currentBoard;
  const wsTitle = document.getElementById('boardTitle')?.textContent || wsId;
  const superAdmin = isSuperAdmin();

  document.getElementById('wsMembersTitle').textContent = `${wsTitle} — Members`;
  document.getElementById('wsMembersSub').textContent   = superAdmin
    ? 'Toggle access for each team member'
    : 'Current workspace members';

  // null = no restriction (open workspace), array = explicit member list
  const currentIds = getWorkspaceMemberIds(wsId);
  const adminUid   = window._currentUser?.uid;

  // Super admin sees ALL team members (so they can grant/revoke workspace access).
  // Non-admins only see members who already have access to this workspace.
  const allMembers = state.teamMembers || [];
  const visibleMembers = superAdmin
    ? allMembers
    : allMembers.filter(m => currentIds === null || currentIds.includes(m.id));

  wsMembersList.innerHTML = visibleMembers.map(m => {
    const isSelf    = m.id === adminUid;
    const hasAccess = currentIds === null || currentIds.includes(m.id);
    const inner     = m.photo
      ? `<img src="${m.photo}" alt="${m.name}" />`
      : m.initials || '?';
    return `
      <div class="ws-member-row">
        <div class="ws-member-avatar" style="background:${m.color || '#6366f1'}">${inner}</div>
        <div class="ws-member-info">
          <div class="ws-member-name">${m.name}</div>
          <div class="ws-member-role">${m.role || 'Member'}${isSelf ? ' · Admin' : ''}</div>
        </div>
        ${superAdmin ? `
          <label class="ws-member-toggle" title="${isSelf ? 'Admins always have access' : ''}">
            <input type="checkbox" data-uid="${m.id}" ${hasAccess ? 'checked' : ''} ${isSelf ? 'disabled' : ''} />
            <span class="ws-toggle-slider"></span>
          </label>
        ` : ''}
      </div>
    `;
  }).join('') || '<p style="padding:16px;color:var(--text-secondary);font-size:13px;">No members in this workspace.</p>';

  wsMembersOverlay.style.display = 'flex';

  if (superAdmin) {
    wsMembersList.querySelectorAll('input[type="checkbox"]:not([disabled])').forEach(cb => {
      cb.addEventListener('change', () => {
        const uid = cb.dataset.uid;
        // On first toggle, initialize from the existing list (or all members if open)
        if (!state.workspaceMembers[wsId]) {
          state.workspaceMembers[wsId] = currentIds !== null
            ? [...currentIds]
            : allMembers.map(m => m.id);
        }
        if (cb.checked) {
          if (!state.workspaceMembers[wsId].includes(uid)) state.workspaceMembers[wsId].push(uid);
        } else {
          state.workspaceMembers[wsId] = state.workspaceMembers[wsId].filter(id => id !== uid);
        }
        saveState();
        window._syncSettings?.(); // persist membership changes to Firestore for all users
        updateAvatarStrip();
      });
    });
  }
}

document.getElementById('wsMembersBtn').addEventListener('click', openWsMembersModal);
document.getElementById('wsMembersClose').addEventListener('click', () => { wsMembersOverlay.style.display = 'none'; });
wsMembersOverlay.addEventListener('click', e => { if (e.target === wsMembersOverlay) wsMembersOverlay.style.display = 'none'; });

// ── View Switcher ──
document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    state.currentView = tab.dataset.view;
    saveState();
    renderBoard();
  });
});

// ── Profile Page ──
document.getElementById('profileCard').addEventListener('click', () => {
  document.querySelectorAll('.sb-icon[data-nav]').forEach(i => i.classList.remove('active'));
  hideAllViews();
  document.getElementById('boardTitle').textContent = 'Profile';
  const bc = document.getElementById('breadcrumbBoard');
  if (bc) bc.textContent = 'Profile';
  const badge = document.getElementById('boardBadge');
  if (badge) badge.style.display = 'none';
  document.getElementById('boardActionsBtn').style.display = 'none';
  const pv = document.createElement('div');
  pv.id = 'profileView';
  document.querySelector('.main').appendChild(pv);
  viewSwitcher.style.display = 'none';
  renderProfileView(pv);
});

// ── Sidebar Toggle ──
document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// ── Search ──
let searchDebounce;
document.getElementById('searchInput').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => renderBoard(), 150);
});

// ── Swimlane Filter ──
document.getElementById('swimlaneFilter').addEventListener('change', (e) => {
  state.swimlaneFilter = e.target.value;
  renderBoard();
});

// ── Sidebar New Task ──
document.getElementById('sidebarNewTaskBtn').addEventListener('click', () => {
  state.addTaskColumn = null;
  openModal();
});

// ── My Work sidebar badge ──
function updateMyWorkBadge() {
  const badge = document.getElementById('myWorkBadge');
  if (!badge) return;
  const count = getMyWorkProjectCount();
  badge.textContent = count > 0 ? count : '';
}
updateMyWorkBadge();

// ── Wire live refresh for home view ──
window._kanban.refreshHomeView = () => { if (state.currentBoard === 'home') showHomeView(); };
window._kanban.hideHomeView = () => hideHomeView();

// ── Initial Render — restore last view, default to home ──
appEl.classList.add('ready');
if (!state.currentBoard || state.currentBoard === 'home') {
  showHomeView();
} else {
  hideHomeView();
  const savedNav = state.currentNav || 'overview';
  const navEl = document.querySelector(`.sb-icon[data-nav="${savedNav}"]`);
  if (navEl) {
    navEl.click();
  } else {
    renderBoard();
  }
}

// Hide loading screen after the view has painted
requestAnimationFrame(() => {
  if (loadingScreen) loadingScreen.style.display = 'none';
});

}); // end initAuth().then
