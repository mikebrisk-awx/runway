/* ========================================
   Global User Management — Super Admin Only
   ======================================== */

import { state, saveState } from './state.js';
import { getWorkspaceMemberIds } from './home.js';

const COMPANY_WORKSPACE_IDS = [
  { id: 'product-design',    name: 'Product Design' },
  { id: 'business-dev',      name: 'Business Development' },
  { id: 'ux',                name: 'UX Research' },
  { id: 'flagship',          name: 'Flagship Products' },
  { id: 'business-products', name: 'Business Products' },
  { id: 'marketing',         name: 'Marketing' },
  { id: 'engineering',       name: 'Engineering' },
  { id: 'it',                name: 'IT & Security' },
  { id: 'finance',           name: 'Finance' },
  { id: 'hr',                name: 'People & HR' },
];

const ROLE_COLORS = {
  admin:       { bg: 'rgba(124,92,252,0.18)', color: '#9b80ff' },
  contributor: { bg: 'rgba(59,130,246,0.18)', color: '#6ea8fe' },
  viewer:      { bg: 'rgba(107,114,128,0.18)', color: '#9ca3af' },
};

function roleStyle(role) {
  const r = (role || 'contributor').toLowerCase();
  const s = ROLE_COLORS[r] || ROLE_COLORS.contributor;
  return `background:${s.bg};color:${s.color}`;
}

function renderUserRow(member, index, expanded) {
  const adminUid  = window._currentUser?.uid;
  const isAdmin   = member.id === adminUid;
  const role      = (member.role || 'contributor').toLowerCase();
  const wsCount   = COMPANY_WORKSPACE_IDS.filter(w => getWorkspaceMemberIds(w.id).includes(member.id)).length;
  const inner     = member.photo
    ? `<img src="${member.photo}" alt="${member.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`
    : (member.initials || '?');

  const wsToggles = COMPANY_WORKSPACE_IDS.map(ws => {
    const hasMember = getWorkspaceMemberIds(ws.id).includes(member.id);
    return `
      <label class="admin-ws-toggle-row">
        <span class="admin-ws-toggle-name">${ws.name}</span>
        <span class="ws-member-toggle">
          <input type="checkbox" data-uid="${member.id}" data-wsid="${ws.id}"
            ${hasMember ? 'checked' : ''} ${isAdmin ? 'disabled' : ''} />
          <span class="ws-toggle-slider"></span>
        </span>
      </label>`;
  }).join('');

  return `
    <div class="admin-user-card ${expanded ? 'expanded' : ''}" data-index="${index}">
      <div class="admin-user-row" data-toggle="${index}">
        <div class="admin-user-avatar" style="background:${member.color || '#6366f1'}">${inner}</div>
        <div class="admin-user-info">
          <div class="admin-user-name">${member.name || 'Unknown'}</div>
          <div class="admin-user-meta">
            <span class="admin-role-badge" style="${roleStyle(role)}">${role}</span>
            <span class="admin-ws-count">${wsCount} workspace${wsCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div class="admin-user-actions">
          ${isAdmin ? '' : `
            <select class="admin-role-select" data-uid="${member.id}">
              <option value="admin"       ${role === 'admin'       ? 'selected' : ''}>Admin</option>
              <option value="contributor" ${role === 'contributor' ? 'selected' : ''}>Contributor</option>
              <option value="viewer"      ${role === 'viewer'      ? 'selected' : ''}>Viewer</option>
            </select>
          `}
          <svg class="admin-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="admin-user-ws-panel">
        <div class="admin-ws-grid">${wsToggles}</div>
      </div>
    </div>
  `;
}

export function renderAdminView(container, { onBack }) {
  const members = state.teamMembers || [];

  container.innerHTML = `
    <div class="admin-view">

      <!-- Header -->
      <header class="admin-header">
        <button class="admin-back-btn" id="adminBackBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back
        </button>
        <div class="admin-header-center">
          <div class="admin-header-title">User Management</div>
          <div class="admin-header-sub">Manage roles and workspace access · Super Admin only</div>
        </div>
        <div class="admin-header-right">
          <span class="admin-user-count">${members.length} user${members.length !== 1 ? 's' : ''}</span>
        </div>
      </header>

      <!-- Body -->
      <div class="admin-body">
        <div class="admin-users-list" id="adminUsersList">
          ${members.length
            ? members.map((m, i) => renderUserRow(m, i, false)).join('')
            : `<div class="admin-empty">No team members yet. Invite someone to get started.</div>`
          }
        </div>
      </div>

    </div>
  `;

  // Back button
  container.querySelector('#adminBackBtn').addEventListener('click', onBack);

  // Expand/collapse rows
  container.querySelectorAll('[data-toggle]').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.admin-role-select') || e.target.closest('.ws-member-toggle')) return;
      const card = row.closest('.admin-user-card');
      card.classList.toggle('expanded');
    });
  });

  // Workspace access toggles
  container.querySelectorAll('input[type="checkbox"][data-wsid]').forEach(cb => {
    cb.addEventListener('change', () => {
      const { uid, wsid } = cb.dataset;
      if (!state.workspaceMembers[wsid]) {
        state.workspaceMembers[wsid] = [...getWorkspaceMemberIds(wsid)];
      }
      if (cb.checked) {
        if (!state.workspaceMembers[wsid].includes(uid)) state.workspaceMembers[wsid].push(uid);
      } else {
        state.workspaceMembers[wsid] = state.workspaceMembers[wsid].filter(id => id !== uid);
      }
      saveState();
      // Update the ws count badge for this row
      const card = cb.closest('.admin-user-card');
      const wsCount = COMPANY_WORKSPACE_IDS.filter(w => getWorkspaceMemberIds(w.id).includes(uid)).length;
      const countEl = card.querySelector('.admin-ws-count');
      if (countEl) countEl.textContent = `${wsCount} workspace${wsCount !== 1 ? 's' : ''}`;
    });
  });

  // Role selects
  container.querySelectorAll('.admin-role-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const uid = sel.dataset.uid;
      const member = state.teamMembers.find(m => m.id === uid);
      if (member) {
        member.role = sel.value;
        saveState();
        // Update role badge
        const badge = sel.closest('.admin-user-card').querySelector('.admin-role-badge');
        if (badge) { badge.textContent = sel.value; badge.style.cssText = roleStyle(sel.value); }
      }
    });
  });
}
