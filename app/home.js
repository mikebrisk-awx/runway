/* ========================================
   Workspace Home — Entry Point
   ======================================== */

import { state } from './state.js';
import { BOARDS } from './data.js';

// ── Workspace definitions ─────────────────────────────────────────────────────
// memberIds: Firebase UIDs of users with access. Admins always get full access.
const MICHAEL = 'M7uGdptay1TlwDBE8kKtqqSFWYu1';
const MELISSA  = 'VFiY3U1Wj1OPmhKfmEIwn8m8lGm1';

const COMPANY_WORKSPACES = [
  {
    id: 'product-design',
    name: 'Product Design',
    description: 'UI/UX design, visual systems, and component libraries',
    color: '#7c5cfc',
    memberIds: [MICHAEL, MELISSA],
  },
  {
    id: 'business-dev',
    name: 'Business Development',
    description: 'Partnerships, sales strategy, and market expansion',
    color: '#10b981',
    memberIds: [MICHAEL],
  },
  {
    id: 'ux',
    name: 'UX Research',
    description: 'User research, usability testing, and insights',
    color: '#f59e0b',
    memberIds: [MICHAEL],
  },
  {
    id: 'flagship',
    name: 'Flagship Products',
    description: 'Core product development and feature delivery',
    color: '#3b82f6',
    memberIds: [MICHAEL],
  },
  {
    id: 'business-products',
    name: 'Business Products',
    description: 'B2B tools, APIs, and enterprise integrations',
    color: '#ec4899',
    memberIds: [MICHAEL],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Brand, campaigns, content strategy, and growth',
    color: '#f97316',
    memberIds: [MICHAEL],
  },
  {
    id: 'engineering',
    name: 'Engineering',
    description: 'Platform infrastructure, backend systems, and DevOps',
    color: '#06b6d4',
    memberIds: [MICHAEL],
  },
  {
    id: 'it',
    name: 'IT & Security',
    description: 'Internal tools, security policy, and access management',
    color: '#8b5cf6',
    memberIds: [MICHAEL],
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Budgeting, reporting, and financial planning',
    color: '#84cc16',
    memberIds: [MICHAEL],
  },
  {
    id: 'hr',
    name: 'People & HR',
    description: 'Recruiting, onboarding, and team culture initiatives',
    color: '#f43f5e',
    memberIds: [MICHAEL],
  },
];

// ── Workspace SVG icons ───────────────────────────────────────────────────────
function getWorkspaceIcon(id) {
  const icons = {
    'product-design': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    'business-dev':   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    'ux':             `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    'flagship':       `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    'business-products': `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    'marketing':      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    'engineering':    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    'it':             `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    'finance':        `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    'hr':             `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  };
  return icons[id] || icons['flagship'];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Workspace card HTML ───────────────────────────────────────────────────────
function renderWorkspaceCard(ws) {
  const board = BOARDS[ws.id];
  const taskCount = board ? board.tasks.length : 0;
  const taskLabel = taskCount === 1 ? '1 task' : `${taskCount} tasks`;

  if (ws.member) {
    return `
      <button class="home-ws-card" data-board="${ws.id}" data-name="${ws.name}" data-member="true">
        <div class="home-ws-card-bar" style="background:${ws.color}"></div>
        <div class="home-ws-card-inner">
          <div class="home-ws-card-icon" style="color:${ws.color}; background:${ws.color}18;">
            ${getWorkspaceIcon(ws.id)}
          </div>
          <div class="home-ws-card-name">${ws.name}</div>
          <div class="home-ws-card-desc">${ws.description}</div>
          <div class="home-ws-card-footer">
            <span class="home-ws-pill">${taskLabel}</span>
            <span class="home-ws-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </span>
          </div>
        </div>
      </button>
    `;
  }

  return `
    <div class="home-ws-card home-ws-card--locked" data-board="${ws.id}" data-member="false">
      <div class="home-ws-card-bar" style="background:${ws.color}; opacity:0.4;"></div>
      <div class="home-ws-card-inner">
        <div class="home-ws-card-icon" style="color:${ws.color}; background:${ws.color}18; opacity:0.6;">
          ${getWorkspaceIcon(ws.id)}
        </div>
        <div class="home-ws-card-name">${ws.name}</div>
        <div class="home-ws-card-desc">${ws.description}</div>
        <div class="home-ws-card-footer">
          <button class="home-ws-request-btn" data-board="${ws.id}">Request Access</button>
          <span class="home-ws-lock-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
        </div>
      </div>
    </div>
  `;
}

// ── Team member row HTML ──────────────────────────────────────────────────────
function renderTeamMember(member, index) {
  const colors = ['#7c5cfc', '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#f97316'];
  const color = colors[index % colors.length];
  const initials = member.name
    ? member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';
  const roleLabel = member.role || 'Member';
  const accessCount = member.workspaces?.length ?? 5;
  return `
    <div class="home-team-row">
      <div class="home-team-avatar" style="background:${color}">
        ${member.photo ? `<img src="${member.photo}" alt="${member.name}" />` : initials}
      </div>
      <div class="home-team-info">
        <div class="home-team-name">${member.name || 'Team Member'}</div>
        <div class="home-team-role">${roleLabel}</div>
      </div>
      <div class="home-team-access">
        <span class="home-team-access-pill">${accessCount} workspace${accessCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  `;
}

// ── Main render ───────────────────────────────────────────────────────────────
function isSuperAdmin() {
  // Prefer the role stamped from Firebase auth (most reliable)
  const authRole = (state.profile?.authRole || window._currentUser?.role || '').toLowerCase();
  if (authRole === 'admin' || authRole === 'super admin' || authRole === 'owner') return true;
  // Fallback: match current user by UID in teamMembers
  const uid = window._currentUser?.uid;
  if (uid) {
    const selfInTeam = (state.teamMembers || []).find(m => m.id === uid);
    const teamRole = (selfInTeam?.role || '').toLowerCase();
    if (teamRole === 'admin' || teamRole === 'owner') return true;
  }
  return false;
}

export function renderHomeView(container, { onWorkspaceSelect, onManageUsers }) {
  const superAdmin = isSuperAdmin();
  const uid = window._currentUser?.uid || '';

  const workspaces = COMPANY_WORKSPACES.map(w => ({
    ...w,
    member: superAdmin || w.memberIds.includes(uid),
  }));

  const myWorkspaces    = workspaces.filter(w => w.member);
  const otherWorkspaces = workspaces.filter(w => !w.member);

  const greeting    = getGreeting();
  const firstName   = (state.profile?.name || 'there').split(' ')[0];
  const userPhoto   = state.profile?.photo || '';
  const userInitials = (state.profile?.name || 'MB')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const teamMembers = (state.teamMembers || []).slice(0, 6);

  container.innerHTML = `
    <div class="home-view">

      <!-- ── Header ─────────────────────────────────── -->
      <header class="home-header">
        <div class="home-header-left">
          <div class="home-logo">
            <img src="assets/logo.svg" width="28" height="28" alt="Runway" />
            <span class="home-logo-name">Runway</span>
          </div>
        </div>
        <div class="home-header-right">
          <button class="home-header-btn" id="homeManageUsersBtn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Manage Users
          </button>
          <div class="home-user-pill">
            ${userPhoto
              ? `<img src="${userPhoto}" class="home-user-photo" alt="${firstName}" />`
              : `<div class="home-user-initials">${userInitials}</div>`
            }
            <span>${state.profile?.name || 'Mike Brisk'}</span>
          </div>
        </div>
      </header>

      <!-- ── Scrollable body ────────────────────────── -->
      <div class="home-body">

        <!-- Hero -->
        <div class="home-hero">
          <h1 class="home-greeting">${greeting}, ${firstName}.</h1>
          <p class="home-sub">Select a workspace to pick up where you left off.</p>
        </div>

        <!-- Your Workspaces -->
        <section class="home-section">
          <div class="home-section-hd">
            <h2 class="home-section-title">Your Workspaces</h2>
            <button class="home-new-ws-btn" id="homeNewWsBtn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Workspace
            </button>
          </div>
          <div class="home-ws-grid">
            ${myWorkspaces.map(ws => renderWorkspaceCard(ws)).join('')}
          </div>
        </section>

        <!-- All Company Workspaces -->
        <section class="home-section">
          <div class="home-section-hd">
            <h2 class="home-section-title">All Company Workspaces</h2>
            <span class="home-section-badge">${otherWorkspaces.length} more</span>
          </div>
          <div class="home-ws-grid">
            ${otherWorkspaces.map(ws => renderWorkspaceCard(ws)).join('')}
          </div>
        </section>

        <!-- Team & Permissions -->
        <section class="home-section">
          <div class="home-section-hd">
            <h2 class="home-section-title">Team & Permissions</h2>
            <button class="home-manage-link" id="homeManageBtn">
              Manage all
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>

          <div class="home-team-panel">
            <!-- Left: member list -->
            <div class="home-team-list">
              ${teamMembers.length
                ? teamMembers.map((m, i) => renderTeamMember(m, i)).join('')
                : `
                  <div class="home-team-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span>No team members added yet</span>
                  </div>
                `}
              <button class="home-invite-btn" id="homeInviteBtn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Invite a team member
              </button>
            </div>

            <!-- Right: permissions info -->
            <div class="home-permissions-info">
              <div class="home-perm-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div class="home-perm-title">Access Control</div>
              <div class="home-perm-desc">Control who can view and edit each workspace. Assign roles and manage permissions per team.</div>
              <div class="home-perm-roles">
                <div class="home-role-row">
                  <span class="home-role-badge home-role-admin">Admin</span>
                  <span class="home-role-text">Full access to all workspaces</span>
                </div>
                <div class="home-role-row">
                  <span class="home-role-badge home-role-member">Member</span>
                  <span class="home-role-text">Access to assigned workspaces</span>
                </div>
                <div class="home-role-row">
                  <span class="home-role-badge home-role-viewer">Viewer</span>
                  <span class="home-role-text">Read-only access</span>
                </div>
              </div>
              <button class="home-manage-users-cta" id="homeManageCta">
                Manage Users & Roles
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </div>
          </div>
        </section>

      </div><!-- end home-body -->
    </div><!-- end home-view -->
  `;

  // ── Event wiring ──────────────────────────────────────────────────────────
  container.querySelectorAll('.home-ws-card[data-member="true"]').forEach(card => {
    card.addEventListener('click', () => onWorkspaceSelect(card.dataset.board, card.dataset.name));
  });

  container.querySelectorAll('.home-ws-request-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      btn.textContent = 'Requested ✓';
      btn.disabled = true;
      btn.classList.add('home-ws-request-btn--sent');
    });
  });

  const manageHandler = () => onManageUsers();
  document.getElementById('homeManageUsersBtn')?.addEventListener('click', manageHandler);
  document.getElementById('homeManageBtn')?.addEventListener('click', manageHandler);
  document.getElementById('homeManageCta')?.addEventListener('click', manageHandler);
  document.getElementById('homeInviteBtn')?.addEventListener('click', manageHandler);

  document.getElementById('homeNewWsBtn')?.addEventListener('click', () => {
    alert('New workspace creation coming soon.');
  });
}
