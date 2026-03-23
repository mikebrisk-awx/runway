/* ========================================
   Design Kanban — Main Entry Point
   ======================================== */

import { state, loadState, saveState } from './state.js';
import { applyTheme, setAccentColor, initThemeListeners } from './theme.js';
import { renderBoard } from './render.js';
import { renderProjectsView, renderProjectsTopbarNav } from './projects.js';
import { renderCalendarView, renderCalendarTopbarNav } from './calendar.js';
import { renderMyWorkView, renderMyWorkTopbarNav } from './mywork.js';
import { renderReviewsView, renderReviewsTopbarNav } from './reviews.js';
import { initModal, openModal } from './modal.js';
import { initSettings, updateProfile } from './settings.js';
import { initShortcuts } from './shortcuts.js';
import { initDetailPanel } from './detail-panel.js';
import { initTemplates } from './templates.js';
import { startRecurringEngine } from './recurring.js';
import { logTaskMoved } from './activity.js';
import { logUnarchived } from './activity.js';

// Expose references needed by render.js for callbacks
window._kanban = {
  openModal,
  logTaskMoved,
  logUnarchived,
  renderBoard: () => renderBoard(),
};

// ── Initialize ──
loadState();
applyTheme();
setAccentColor(state.accentColor);
updateProfile();
initThemeListeners();
initModal();
initSettings();
initDetailPanel();
initShortcuts();
initTemplates();
startRecurringEngine();

// ── Sidebar Navigation ──
const NAV_PLACEHOLDERS = { trends: 'Trends', calendar: 'Calendar' };

const viewSwitcher = document.querySelector('.view-switcher');

const WORKSPACE_LABELS = {
  'all': 'All Workspaces',
  'product-design': 'Product Design',
  'business-dev': 'Business Dev',
  'ux': 'UX Research',
  'flagship': 'Flagship',
  'business-products': 'Biz Products',
};

let projectsWsFilter = 'all';

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

  // ── Workspace dropdown next to title ─────
  if (!document.getElementById('projectsWsBtn')) {
    const titleRow = document.querySelector('.topbar-title-row');

    const wsBtn = document.createElement('button');
    wsBtn.id = 'projectsWsBtn';
    wsBtn.className = 'projects-ws-title-btn';
    wsBtn.innerHTML = `
      <span id="projectsWsLabel">${WORKSPACE_LABELS[projectsWsFilter]}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    `;

    const wsDrop = document.createElement('div');
    wsDrop.id = 'projectsWsDrop';
    wsDrop.className = 'board-actions-dropdown';
    wsDrop.innerHTML = Object.entries(WORKSPACE_LABELS).map(([id, label]) => `
      <button class="context-menu-item projects-ws-option${projectsWsFilter === id ? ' active-workspace' : ''}" data-ws="${id}">
        ${label}
      </button>
    `).join('');

    titleRow.appendChild(wsBtn);
    titleRow.appendChild(wsDrop);

    wsBtn.addEventListener('click', e => {
      e.stopPropagation();
      wsDrop.classList.toggle('show');
    });

    wsDrop.querySelectorAll('.projects-ws-option').forEach(opt => {
      opt.addEventListener('click', () => {
        projectsWsFilter = opt.dataset.ws;
        document.getElementById('projectsWsLabel').textContent = WORKSPACE_LABELS[projectsWsFilter];
        wsDrop.querySelectorAll('.projects-ws-option').forEach(o => o.classList.remove('active-workspace'));
        opt.classList.add('active-workspace');
        wsDrop.classList.remove('show');
        // Push filter into projects module and re-render
        import('./projects.js').then(({ setWorkspaceFilter }) => {
          setWorkspaceFilter(projectsWsFilter, viewContainer);
        });
      });
    });

    document.addEventListener('click', () => wsDrop.classList.remove('show'));
  }
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

function restoreTopbar() {
  viewSwitcher.style.display = '';
  document.getElementById('projectsTopbarNav')?.remove();
  document.getElementById('projectsWsBtn')?.remove();
  document.getElementById('projectsWsDrop')?.remove();
  document.getElementById('calendarTopbarNav')?.remove();
  document.getElementById('myWorkTopbarNav')?.remove();
  document.getElementById('reviewsTopbarNav')?.remove();
  projectsWsFilter = 'all';
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
  restoreTopbar();
  viewSwitcher.style.display = '';
  // Restore topbar title elements
  const badge = document.getElementById('boardBadge');
  if (badge) badge.style.display = '';
  document.getElementById('boardActionsBtn').style.display = '';
}

document.querySelectorAll('.sb-icon[data-nav]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sb-icon[data-nav]').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const nav = item.dataset.nav;

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

    } else {
      // Placeholder for Trends
      hideAllViews();
      const ph = document.createElement('div');
      ph.id = 'navPlaceholder';
      ph.className = 'nav-placeholder';
      document.querySelector('.main').appendChild(ph);
      ph.innerHTML = `<div class="nav-placeholder-inner">
        <div class="nav-placeholder-icon">${item.innerHTML}</div>
        <h2>${NAV_PLACEHOLDERS[nav]}</h2>
        <p>This section is coming soon.</p>
      </div>`;
    }
  });
});

// ── All Workspaces → combined board view ──
document.getElementById('allWorkspacesBtn').addEventListener('click', () => {
  state.currentBoard = 'all';
  document.querySelectorAll('.sb-icon[data-nav]').forEach(i => i.classList.remove('active'));
  document.querySelector('.sb-icon[data-nav="overview"]').classList.add('active');
  document.querySelectorAll('.workspace-item').forEach(w => w.classList.remove('active-workspace'));
  document.getElementById('allWorkspacesBtn').classList.add('active-workspace');
  document.getElementById('boardActionsDropdown').classList.remove('show');
  document.getElementById('boardContainer').style.display = '';
  document.getElementById('viewContainer').style.display = 'none';
  const badge = document.getElementById('boardBadge');
  if (badge) badge.style.display = '';
  document.getElementById('boardActionsBtn').style.display = '';
  const ph = document.getElementById('navPlaceholder');
  if (ph) ph.remove();
  const pv = document.getElementById('projectsView');
  if (pv) pv.remove();
  restoreTopbar();
  saveState();
  renderBoard();
});

// ── Workspace Switcher (in dropdown) ──
document.querySelectorAll('.workspace-item[data-board]').forEach(item => {
  item.addEventListener('click', () => {
    state.currentBoard = item.dataset.board;
    state.currentView = 'board';
    // Switch sidebar to overview
    document.querySelectorAll('.sb-icon[data-nav]').forEach(i => i.classList.remove('active'));
    document.querySelector('.sb-icon[data-nav="overview"]').classList.add('active');
    // Update active workspace in dropdown
    document.querySelectorAll('.workspace-item').forEach(w => w.classList.remove('active-workspace'));
    item.classList.add('active-workspace');
    document.getElementById('allWorkspacesBtn').classList.remove('active-workspace');
    // Close dropdown
    document.getElementById('boardActionsDropdown').classList.remove('show');
    // Show board
    document.getElementById('boardContainer').style.display = '';
    document.getElementById('viewContainer').style.display = 'none';
    const ph = document.getElementById('navPlaceholder');
    if (ph) ph.remove();
    const pv2 = document.getElementById('projectsView');
    if (pv2) pv2.remove();
    restoreTopbar();
    saveState();
    renderBoard();
  });
});

// ── View Switcher ──
document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    state.currentView = tab.dataset.view;
    saveState();
    renderBoard();
  });
});

// ── Sidebar Toggle ──
document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// ── Search ──
document.getElementById('searchInput').addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  renderBoard();
});

// ── Swimlane Filter ──
document.getElementById('swimlaneFilter').addEventListener('change', (e) => {
  state.swimlaneFilter = e.target.value;
  renderBoard();
});

// ── Initial Render ──
renderBoard();
