/* ========================================
   Team Panel — Firestore-backed invites
   ======================================== */

import { state, saveState } from './state.js';
import { getWorkspaceMemberIds } from './home.js';
import { db } from './firebase.js';
import {
  collection, doc, setDoc, getDoc, getDocs,
  deleteDoc, serverTimestamp, onSnapshot, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const AVATAR_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#3b82f6',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
];

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

function colorForEmail(email) {
  let hash = 0;
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Render members list ─────────────────────────────────────────────
async function renderMemberList() {
  const list = document.getElementById('teamMemberList');
  if (!list) return;

  list.innerHTML = `<div style="padding:12px 0;color:var(--text-tertiary);font-size:13px">Loading…</div>`;

  // Load real users from Firestore
  let users = [];
  let invites = [];
  try {
    const usersSnap  = await getDocs(collection(db, 'users'));
    const invSnap    = await getDocs(collection(db, 'invites'));
    users   = usersSnap.docs.map(d => d.data());
    invites = invSnap.docs.map(d => d.data()).filter(i => i.status === 'pending');
  } catch (err) {
    // Firestore not available — fall back to state.teamMembers
    users = (state.teamMembers || []).map(m => ({ name: m.name, email: '', role: m.role, photo: null }));
  }

  // Deduplicate: don't show pending invite if that email already joined
  const joinedEmails = new Set(users.map(u => (u.email || '').toLowerCase()));
  const pendingInvites = invites.filter(i => !joinedEmails.has((i.email || '').toLowerCase()));

  const currentUid = window._currentUser?.uid;

  list.innerHTML = [
    // Active members
    ...users.map(u => {
      const isYou = u.uid === currentUid;
      const photo = u.photo
        ? `<img src="${u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" alt="${u.name}" />`
        : getInitials(u.name || u.email || '?');
      const color = colorForEmail(u.email || u.uid || '');
      return `
        <div class="team-member-row" data-uid="${u.uid}">
          <div class="team-member-avatar" style="background:${color};overflow:hidden">${photo}</div>
          <div class="team-member-info">
            <span class="team-member-name">${u.name || u.email}${isYou ? ' <span class="team-you-badge">you</span>' : ''}</span>
            <span class="team-member-role">${u.roleTitle || u.role || 'Contributor'} · <span class="team-access-badge team-access-${u.role || 'contributor'}">${u.role || 'contributor'}</span></span>
          </div>
          ${!isYou ? `<button class="team-member-remove icon-btn" data-uid="${u.uid}" title="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
        </div>`;
    }),
    // Pending invites
    ...pendingInvites.map(i => `
      <div class="team-member-row team-member-pending" data-email="${i.email}">
        <div class="team-member-avatar team-pending-avatar">${(i.email[0] || '?').toUpperCase()}</div>
        <div class="team-member-info">
          <span class="team-member-name">${i.email}</span>
          <span class="team-member-role"><span class="team-pending-badge">Invite pending</span></span>
        </div>
        <button class="team-invite-cancel icon-btn" data-email="${i.email}" title="Cancel invite">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`),
  ].join('') || `<div style="padding:12px 0;color:var(--text-tertiary);font-size:13px">No members yet.</div>`;

  // Remove member
  list.querySelectorAll('.team-member-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this team member?')) return;
      try { await deleteDoc(doc(db, 'users', btn.dataset.uid)); } catch {}
      renderMemberList();
      updateAvatarStrip();
    });
  });

  // Cancel invite
  list.querySelectorAll('.team-invite-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await deleteDoc(doc(db, 'invites', btn.dataset.email.toLowerCase())); } catch {}
      renderMemberList();
    });
  });

  // Also sync to state.teamMembers for local use (avatar strip etc.)
  state.teamMembers = users.map(u => ({
    id: u.uid,
    name: u.name || u.email || '',
    role: u.roleTitle || u.role || 'Contributor',
    color: colorForEmail(u.email || u.uid || ''),
    initials: getInitials(u.name || u.email || '?'),
    photo: u.photo || null,
  }));
  saveState();
  updateAvatarStrip();
  window._kanban?.refreshHomeView?.();
}

// ── Avatar strip in topbar ───────────────────────────────────────────
export function updateAvatarStrip() {
  const allMembers = state.teamMembers || [];
  const strip = document.querySelector('.team-avatars');
  if (!strip) return;

  // Filter to only members of the current workspace
  const wsIds = getWorkspaceMemberIds(state.currentBoard);
  const members = wsIds.length > 0
    ? allMembers.filter(m => wsIds.includes(m.id))
    : allMembers;

  const visible  = members.slice(0, 4);
  const overflow = members.length - 4;

  strip.innerHTML = visible.map(m => {
    const inner = m.photo
      ? `<img src="${m.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" alt="${m.initials}" />`
      : m.initials;
    return `<div class="team-avatar" style="background:${m.color};overflow:hidden" title="${m.name}">${inner}</div>`;
  }).join('') + (overflow > 0 ? `<div class="team-avatar-overflow">+${overflow}</div>` : '');
}

// ── Send invite ──────────────────────────────────────────────────────
async function sendInvite() {
  const emailInput   = document.getElementById('inviteEmail');
  const roleInput    = document.getElementById('inviteRole');
  const errEl        = document.getElementById('inviteError');
  const successEl    = document.getElementById('inviteSuccess');
  const submitBtn    = document.getElementById('inviteSubmitBtn');

  const email    = (emailInput?.value || '').trim().toLowerCase();
  const roleTitle = (roleInput?.value || '').trim();

  errEl.style.display = 'none';
  successEl.style.display = 'none';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block';
    emailInput?.focus();
    return;
  }

  // Check if already a member
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const alreadyMember = usersSnap.docs.some(d => (d.data().email || '').toLowerCase() === email);
    if (alreadyMember) {
      errEl.textContent = 'This person is already a team member.';
      errEl.style.display = 'block';
      return;
    }
  } catch {}

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';

  try {
    // Save invite to Firestore
    await setDoc(doc(db, 'invites', email), {
      email,
      roleTitle: roleTitle || 'Designer',
      role: 'contributor',
      invitedBy: window._currentUser?.uid || '',
      invitedByName: window._currentUser?.name || '',
      invitedAt: serverTimestamp(),
      status: 'pending',
    });

    // Open pre-composed email in default mail client
    const appUrl  = window.location.origin + window.location.pathname;
    const inviter = window._currentUser?.name || 'Your teammate';
    const subject = encodeURIComponent(`${inviter} invited you to Runway`);
    const body    = encodeURIComponent(
      `Hi,\n\n${inviter} has invited you to collaborate on Runway — a design task tracker for the team.\n\nClick the link below to sign in with your Google account and get started:\n\n${appUrl}\n\nSee you there!`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');

    // Clear form and show success
    if (emailInput) emailInput.value = '';
    if (roleInput)  roleInput.value  = '';
    successEl.textContent = `Invite sent to ${email} — their email client should have opened.`;
    successEl.style.display = 'block';
    renderMemberList();

  } catch (err) {
    errEl.textContent = `Failed to save invite: ${err.message}`;
    errEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Send Invite`;
  }
}

// ── Public: open / close ─────────────────────────────────────────────
export function openTeam() {
  document.getElementById('teamOverlay').classList.add('show');
  document.getElementById('inviteEmail').value = '';
  document.getElementById('inviteRole').value  = '';
  document.getElementById('inviteError').style.display   = 'none';
  document.getElementById('inviteSuccess').style.display = 'none';
  renderMemberList();
  setTimeout(() => document.getElementById('inviteEmail').focus(), 100);
}

export function closeTeam() {
  document.getElementById('teamOverlay').classList.remove('show');
}

// ── Init ─────────────────────────────────────────────────────────────
export function initTeam() {
  document.getElementById('teamAddBtn').addEventListener('click', openTeam);
  document.getElementById('closeTeam').addEventListener('click', closeTeam);
  document.getElementById('teamOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('teamOverlay')) closeTeam();
  });

  document.getElementById('inviteSubmitBtn').addEventListener('click', sendInvite);
  document.getElementById('inviteEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendInvite();
  });

  // ── Copy invite link ──
  document.getElementById('copyInviteLinkBtn')?.addEventListener('click', async () => {
    const btn     = document.getElementById('copyInviteLinkBtn');
    const appUrl  = window.location.origin + window.location.pathname;
    const inviter = window._currentUser?.name || 'Your teammate';
    const message = `${inviter} invited you to Runway — a design task tracker for the team.\n\nSign in with your Google account to get started:\n${appUrl}`;

    try {
      await navigator.clipboard.writeText(message);
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      btn.style.color = 'var(--priority-low)';
      setTimeout(() => {
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy link`;
        btn.style.color = '';
      }, 2000);
    } catch {
      // Fallback: select text from a temp input
      const tmp = document.createElement('textarea');
      tmp.value = message;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      tmp.remove();
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy link`; }, 2000);
    }
  });

  // Initial avatar strip
  updateAvatarStrip();
}
