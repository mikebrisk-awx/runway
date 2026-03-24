/* ========================================
   Notifications — @mention alerts
   ======================================== */

import { db } from './firebase.js';
import {
  collection, doc, addDoc, getDocs, query,
  orderBy, onSnapshot, writeBatch, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { state } from './state.js';
import { openDetailPanel } from './detail-panel.js';
import { escapeHtml, timeAgo } from './utils.js';

let _currentUser = null;
let _unsubscribe  = null;
let _notifications = [];   // live list for this session

// ── Init: attach Firestore listener for current user's notifications ──
export function initNotifications(user) {
  if (!user?.uid) return;
  _currentUser = user;

  const notifCol = collection(db, 'notifications', user.uid, 'items');
  const q = query(notifCol, orderBy('timestamp', 'desc'));

  _unsubscribe = onSnapshot(q, (snap) => {
    _notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateBadge();
    // Re-render panel if it's open
    const panel = document.getElementById('notifPanel');
    if (panel && !panel.hidden) renderNotificationPanel();
  }, (err) => {
    console.warn('Notifications listener error:', err.message);
  });

  // Wire up bell button
  const bellBtn = document.getElementById('notifBtn');
  if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotifPanel();
    });
  }

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const bellBtn = document.getElementById('notifBtn');
    if (panel && !panel.hidden && !panel.contains(e.target) && !bellBtn?.contains(e.target)) {
      panel.hidden = true;
    }
  });
}

// ── Update badge count ──
function updateBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const unread = _notifications.filter(n => !n.read).length;
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

// ── Toggle flyout panel ──
function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  if (panel.hidden) {
    renderNotificationPanel();
    panel.hidden = false;
    // Mark all as read after a short delay (feels more natural)
    setTimeout(() => markAllRead(), 800);
  } else {
    panel.hidden = true;
  }
}

// ── Render the flyout ──
function renderNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;

  const items = _notifications.slice(0, 30);

  panel.innerHTML = `
    <div class="notif-panel-header">
      <span class="notif-panel-title">Notifications</span>
      <div class="notif-panel-actions">
        ${items.some(n => !n.read) ? `<button class="notif-mark-read-btn" id="markAllReadBtn">Mark all read</button>` : ''}
        <button class="notif-close-btn" id="notifCloseBtn" title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="notif-list" id="notifList">
      ${items.length === 0
        ? `<div class="notif-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span>No notifications yet</span>
           </div>`
        : items.map(n => renderNotifItem(n)).join('')
      }
    </div>
  `;

  // Close button
  panel.querySelector('#notifCloseBtn')?.addEventListener('click', () => {
    panel.hidden = true;
  });

  // Mark all read button
  panel.querySelector('#markAllReadBtn')?.addEventListener('click', () => {
    markAllRead();
  });

  // Notification click → open task
  panel.querySelectorAll('.notif-item[data-task-id]').forEach(el => {
    el.addEventListener('click', () => {
      const taskId = el.dataset.taskId;
      panel.hidden = true;
      if (taskId) openDetailPanel(taskId);
    });
  });
}

function renderNotifItem(n) {
  const initials = (n.fromName || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const avatarHtml = n.fromPhoto
    ? `<img src="${escapeHtml(n.fromPhoto)}" class="notif-avatar-img" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
      + `<span class="notif-avatar-initials" style="display:none">${initials}</span>`
    : `<span class="notif-avatar-initials">${initials}</span>`;

  const snippet = n.commentSnippet ? `<div class="notif-snippet">"${escapeHtml(n.commentSnippet)}"</div>` : '';

  return `
    <div class="notif-item${n.read ? '' : ' notif-unread'}" data-task-id="${escapeHtml(n.taskId || '')}">
      <div class="notif-avatar">${avatarHtml}</div>
      <div class="notif-content">
        <div class="notif-message">
          <strong>${escapeHtml(n.fromName || 'Someone')}</strong> mentioned you in
          <em>${escapeHtml(n.taskTitle || 'a task')}</em>
        </div>
        ${snippet}
        <div class="notif-time">${timeAgo(n.timestamp?.toDate?.() || n.timestamp)}</div>
      </div>
      ${!n.read ? '<span class="notif-dot"></span>' : ''}
    </div>
  `;
}

// ── Mark all notifications as read ──
async function markAllRead() {
  if (!_currentUser?.uid) return;
  const unread = _notifications.filter(n => !n.read);
  if (!unread.length) return;
  try {
    const batch = writeBatch(db);
    unread.forEach(n => {
      const ref = doc(db, 'notifications', _currentUser.uid, 'items', n.id);
      batch.update(ref, { read: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn('markAllRead error:', err.message);
  }
}

// ── Send notifications to @mentioned users ──
export async function sendMentionNotifications(commentText, taskId, taskTitle, boardId) {
  if (!_currentUser) return;

  // Parse all @mentions from the comment
  const mentions = [...commentText.matchAll(/@([\w.\-]+(?:\s[\w.\-]+)?)/g)].map(m => m[1].toLowerCase());
  if (!mentions.length) return;

  // Deduplicate and exclude self
  const unique = [...new Set(mentions)].filter(
    name => name !== (_currentUser.name || '').toLowerCase()
  );
  if (!unique.length) return;

  // Look up matching users from Firestore
  let allUsers = [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    allUsers = snap.docs.map(d => d.data());
  } catch {
    // Fall back to state.teamMembers (no uid available but best effort)
    allUsers = state.teamMembers || [];
  }

  // Snippet of the comment text (first 80 chars)
  const snippet = commentText.length > 80 ? commentText.slice(0, 80) + '…' : commentText;

  const batch = writeBatch(db);
  let wrote = 0;

  for (const mentionName of unique) {
    const match = allUsers.find(u => (u.name || '').toLowerCase() === mentionName);
    if (!match?.uid) continue;
    if (match.uid === _currentUser.uid) continue; // never self-notify

    const notifRef = doc(collection(db, 'notifications', match.uid, 'items'));
    batch.set(notifRef, {
      type: 'mention',
      fromUid: _currentUser.uid,
      fromName: _currentUser.name || '',
      fromPhoto: _currentUser.photo || '',
      taskId,
      taskTitle: taskTitle || '',
      boardId: boardId || '',
      commentSnippet: snippet,
      read: false,
      timestamp: serverTimestamp(),
    });
    wrote++;
  }

  if (wrote > 0) {
    try { await batch.commit(); } catch (err) {
      console.warn('sendMentionNotifications error:', err.message);
    }
  }
}
