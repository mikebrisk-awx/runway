/* ========================================
   Team Panel
   ======================================== */

import { state, saveState } from './state.js';

const AVATAR_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

const DEFAULT_MEMBERS = [
  { id: 'm1', name: 'Mike Brisk', role: 'Design Lead', color: '#f59e0b', initials: 'MB' },
];

function getMembers() {
  if (!state.teamMembers || state.teamMembers.length === 0) {
    state.teamMembers = DEFAULT_MEMBERS.map(m => ({ ...m }));
  }
  return state.teamMembers;
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

function renderMemberList() {
  const list = document.getElementById('teamMemberList');
  if (!list) return;
  const members = getMembers();
  list.innerHTML = members.map(m => `
    <div class="team-member-row" data-id="${m.id}">
      <div class="team-member-avatar" style="background:${m.color}">${m.initials}</div>
      <div class="team-member-info">
        <span class="team-member-name">${m.name}</span>
        <span class="team-member-role">${m.role}</span>
      </div>
      <button class="team-member-remove icon-btn" data-id="${m.id}" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('.team-member-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.teamMembers = getMembers().filter(m => m.id !== btn.dataset.id);
      saveState();
      renderMemberList();
      updateAvatarStrip();
    });
  });
}

export function updateAvatarStrip() {
  const members = getMembers();
  const strip = document.querySelector('.team-avatars');
  if (!strip) return;

  const visible = members.slice(0, 3);
  const overflow = members.length - 3;

  strip.innerHTML = visible.map(m => {
    const isCurrentUser = state.profile?.name && m.name === state.profile.name;
    const photo = isCurrentUser ? state.profile.photo : null;
    const inner = photo
      ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" alt="${m.initials}" />`
      : m.initials;
    return `<div class="team-avatar" style="background:${m.color}" title="${m.name}">${inner}</div>`;
  }).join('') + (overflow > 0
    ? `<div class="team-avatar-overflow">+${overflow}</div>`
    : '');
}

export function openTeam() {
  document.getElementById('teamOverlay').classList.add('show');
  document.getElementById('inviteName').value = '';
  document.getElementById('inviteRole').value = '';
  renderMemberList();
  setTimeout(() => document.getElementById('inviteName').focus(), 100);
}

export function closeTeam() {
  document.getElementById('teamOverlay').classList.remove('show');
}

export function initTeam() {
  // Ensure state has teamMembers
  if (!state.teamMembers || state.teamMembers.length === 0) {
    state.teamMembers = DEFAULT_MEMBERS.map(m => ({ ...m }));
  }

  document.getElementById('teamAddBtn').addEventListener('click', openTeam);
  document.getElementById('closeTeam').addEventListener('click', closeTeam);
  document.getElementById('teamOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('teamOverlay')) closeTeam();
  });

  document.getElementById('inviteSubmitBtn').addEventListener('click', () => {
    const name = document.getElementById('inviteName').value.trim();
    const role = document.getElementById('inviteRole').value.trim();
    if (!name) {
      document.getElementById('inviteName').focus();
      return;
    }
    const members = getMembers();
    const initials = getInitials(name);
    const color = AVATAR_COLORS[members.length % AVATAR_COLORS.length];
    members.push({ id: 'u' + Date.now(), name, role: role || 'Team Member', color, initials });
    state.teamMembers = members;
    saveState();
    document.getElementById('inviteName').value = '';
    document.getElementById('inviteRole').value = '';
    renderMemberList();
    updateAvatarStrip();
    document.getElementById('inviteName').focus();
  });

  document.getElementById('inviteName').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('inviteSubmitBtn').click();
  });

  updateAvatarStrip();
}
