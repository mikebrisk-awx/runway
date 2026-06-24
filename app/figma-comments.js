/* ========================================
   Figma Comments View
   ======================================== */

import { db } from './firebase.js';
import { state } from './state.js';
import { openModal } from './modal.js';
import { escapeHtml, timeAgo } from './utils.js';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _unsubscribe = null;
let _currentCount = 0;

export function getFigmaCommentCount() {
  return _currentCount;
}

export function renderFigmaCommentsTopbarNav(container) {
  container.innerHTML = ''; // No sub-tabs needed
}

export function renderFigmaCommentsView(container) {
  // Tear down previous listener before re-rendering
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

  const isAdmin      = state.profile?.authRole === 'admin';
  const integration  = state.figmaIntegration;

  if (!integration?.connected) {
    container.innerHTML = `
      <div class="figma-comments-empty-state">
        <div class="figma-comments-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M16 16C16 13.8 17.8 12 20 12H28C30.2 12 32 13.8 32 16V24C32 26.2 30.2 28 28 28H20C17.8 28 16 26.2 16 24V16Z" stroke="var(--text-secondary)" stroke-width="2"/>
            <path d="M20 34L16 38V28" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        ${isAdmin
          ? `<p class="figma-comments-empty-title">Connect Figma to see team comments</p>
             <p class="figma-comments-empty-sub">Open <button class="link-btn" id="fcGoToSettings">Settings → Integrations</button> to connect your Figma team.</p>`
          : `<p class="figma-comments-empty-title">Figma not connected</p>
             <p class="figma-comments-empty-sub">Ask your admin to connect Figma in Settings.</p>`
        }
      </div>`;

    if (isAdmin) {
      container.querySelector('#fcGoToSettings')?.addEventListener('click', () => {
        document.getElementById('settingsBtn')?.click();
      });
    }
    return;
  }

  container.innerHTML = `
    <div class="figma-comments-view">
      <div class="figma-comments-list" id="figmaCommentsList">
        ${_skeletons()}
      </div>
    </div>`;

  const q = query(
    collection(db, 'figmaComments'),
    where('resolved_at', '==', null),
    orderBy('created_at', 'desc')
  );

  _unsubscribe = onSnapshot(q, (snap) => {
    const comments = [];
    snap.forEach(d => comments.push(d.data()));
    _currentCount = comments.length;
    _updateBadge(comments.length);

    const list = container.querySelector('#figmaCommentsList');
    if (!list) return;

    if (comments.length === 0) {
      list.innerHTML = `
        <div class="figma-comments-empty-state">
          <p class="figma-comments-empty-title">All caught up</p>
          <p class="figma-comments-empty-sub">No unresolved Figma comments right now.</p>
        </div>`;
      return;
    }

    const commentMap = new Map(comments.map(c => [c.id, c]));
    list.innerHTML = comments.map(c => _commentCard(c, commentMap)).join('');

    list.querySelectorAll('.figma-comment-card').forEach(card => {
      const id      = card.dataset.id;
      const comment = comments.find(c => c.id === id);
      if (!comment) return;

      // Card click → open in Figma
      card.addEventListener('click', (e) => {
        if (e.target.closest('.figma-create-task-btn')) return;
        const nodeParam = comment.nodeId ? `?node-id=${encodeURIComponent(comment.nodeId)}` : '';
        window.open(`${comment.fileUrl}${nodeParam}`, '_blank', 'noopener,noreferrer');
      });

      // "Create task" → pre-fill modal
      card.querySelector('.figma-create-task-btn')?.addEventListener('click', () => {
        state.addTaskColumn = null;
        openModal({
          title: comment.message.slice(0, 120),
          desc:  `Figma comment from "${comment.fileName}" by ${comment.author.name}`,
        });
      });
    });
  }, (err) => {
    console.warn('figmaComments onSnapshot error:', err);
  });
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _commentCard(c, commentMap = new Map()) {
  const initials = (c.author.name || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const time = timeAgo(c.created_at);
  const parentComment = c.parentId ? commentMap.get(c.parentId) : null;
  const parentSnippet = parentComment
    ? parentComment.message.slice(0, 60) + (parentComment.message.length > 60 ? '…' : '')
    : null;

  return `
    <div class="figma-comment-card" data-id="${c.id}">
      <div class="figma-comment-file">
        ${c.parentId ? '<span class="figma-reply-badge">↩ Reply</span>' : ''}
        <span class="figma-comment-filename">${escapeHtml(c.fileName)}</span>
        <span class="figma-open-icon" title="Open in Figma">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </span>
      </div>
      <div class="figma-comment-meta">
        <div class="figma-comment-avatar">
          ${c.author.photo
            ? `<img src="${escapeHtml(c.author.photo)}" alt="${escapeHtml(c.author.name)}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <span class="figma-avatar-initials"
                style="${c.author.photo ? 'display:none' : 'display:flex'}">${initials}</span>
        </div>
        <span class="figma-comment-author">${escapeHtml(c.author.name)}</span>
        <span class="figma-comment-time">· ${time}</span>
      </div>
      ${parentSnippet ? `<div class="figma-reply-context">"${escapeHtml(parentSnippet)}"</div>` : ''}
      <div class="figma-comment-message">${escapeHtml(c.message)}</div>
      <button class="figma-create-task-btn">Create task</button>
    </div>`;
}

function _skeletons() {
  return Array.from({ length: 3 }, () => `
    <div class="figma-comment-card figma-skeleton">
      <div class="figma-skeleton-line" style="width:40%"></div>
      <div class="figma-skeleton-line" style="width:100%;margin-top:8px"></div>
      <div class="figma-skeleton-line" style="width:70%"></div>
    </div>`).join('');
}

function _updateBadge(count) {
  const badge = document.getElementById('figmaCommentsBadge');
  if (badge) badge.textContent = count > 0 ? String(count) : '';
}
