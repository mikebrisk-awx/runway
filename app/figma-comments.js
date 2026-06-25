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

let _unsubscribe   = null;
let _currentCount  = 0;
let _allComments   = [];
let _viewContainer = null;
let _filters       = { person: '', file: '', time: '' };

export function getFigmaCommentCount() {
  return _currentCount;
}

export function renderFigmaCommentsTopbarNav(container) {
  container.innerHTML = `
    <div class="figma-topbar-filters">
      <button class="view-tab fc-time-tab active" data-time="">All time</button>
      <button class="view-tab fc-time-tab" data-time="today">Today</button>
      <button class="view-tab fc-time-tab" data-time="week">This week</button>
      <div class="figma-topbar-selects">
        <select class="figma-filter-select" id="fcFilterPerson"><option value="">All people</option></select>
        <select class="figma-filter-select" id="fcFilterFile"><option value="">All files</option></select>
      </div>
    </div>`;

  container.querySelectorAll('.fc-time-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.fc-time-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _filters.time = btn.dataset.time;
      if (_viewContainer) _renderFiltered(_viewContainer);
    });
  });

  container.querySelector('#fcFilterPerson')?.addEventListener('change', e => {
    _filters.person = e.target.value;
    if (_viewContainer) _renderFiltered(_viewContainer);
  });

  container.querySelector('#fcFilterFile')?.addEventListener('change', e => {
    _filters.file = e.target.value;
    if (_viewContainer) _renderFiltered(_viewContainer);
  });
}

export function renderFigmaCommentsView(container) {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

  _viewContainer = container;
  _filters       = { person: '', file: '', time: '' };

  const isAdmin     = state.profile?.authRole === 'admin';
  const integration = state.figmaIntegration;

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
    _allComments = [];
    snap.forEach(d => _allComments.push(d.data()));
    _currentCount = _allComments.length;
    _updateBadge(_allComments.length);
    _updateTopbarDropdowns();
    _renderFiltered(container);
  }, (err) => {
    console.warn('figmaComments onSnapshot error:', err);
  });
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _updateTopbarDropdowns() {
  const people = [...new Set(_allComments.map(c => c.author?.name).filter(Boolean))].sort();
  const files  = [...new Set(_allComments.map(c => c.fileName).filter(Boolean))].sort();

  const personSel = document.getElementById('fcFilterPerson');
  const fileSel   = document.getElementById('fcFilterFile');
  if (!personSel || !fileSel) return;

  personSel.innerHTML = '<option value="">All people</option>' +
    people.map(p => `<option value="${escapeHtml(p)}" ${_filters.person === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
  fileSel.innerHTML = '<option value="">All files</option>' +
    files.map(f => `<option value="${escapeHtml(f)}" ${_filters.file === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
}

function _applyFilters(comments) {
  return comments.filter(c => {
    if (_filters.person && c.author?.name !== _filters.person) return false;
    if (_filters.file   && c.fileName !== _filters.file) return false;
    if (_filters.time) {
      const created = new Date(c.created_at);
      const now = new Date();
      if (_filters.time === 'today') {
        if (created.toDateString() !== now.toDateString()) return false;
      } else if (_filters.time === 'week') {
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        if (created < weekAgo) return false;
      }
    }
    return true;
  });
}

function _renderFiltered(container) {
  const list = container.querySelector('#figmaCommentsList');
  if (!list) return;

  const visible = _applyFilters(_allComments);

  if (visible.length === 0) {
    const hasFilters = _filters.person || _filters.file || _filters.time;
    list.innerHTML = `
      <div class="figma-comments-empty-state">
        <p class="figma-comments-empty-title">${hasFilters ? 'No matching comments' : 'All caught up'}</p>
        <p class="figma-comments-empty-sub">${hasFilters ? 'Try adjusting the filters.' : 'No unresolved Figma comments right now.'}</p>
      </div>`;
    return;
  }

  const commentMap = new Map(_allComments.map(c => [c.id, c]));
  list.innerHTML = visible.map(c => _commentCard(c, commentMap)).join('');

  list.querySelectorAll('.figma-comment-card').forEach(card => {
    const id      = card.dataset.id;
    const comment = _allComments.find(c => c.id === id);
    if (!comment) return;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.figma-create-task-btn')) return;
      const nodeParam = comment.nodeId ? `?node-id=${encodeURIComponent(comment.nodeId)}` : '';
      const base = comment.fileUrl?.startsWith('https://www.figma.com/') ? comment.fileUrl : 'https://www.figma.com/';
      window.open(`${base}${nodeParam}`, '_blank', 'noopener,noreferrer');
    });

    card.querySelector('.figma-create-task-btn')?.addEventListener('click', () => {
      state.addTaskColumn = null;
      openModal({
        title: comment.message.slice(0, 120),
        desc:  `Figma comment from "${comment.fileName}" by ${comment.author.name}`,
      });
    });
  });
}

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
      <div class="figma-comment-top">
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
        <span class="figma-comment-filename">${escapeHtml(c.fileName)}</span>
      </div>
      <div class="figma-comment-message">${escapeHtml(c.message)}</div>
      <div class="figma-comment-footer">
        <span class="figma-comment-reply-info">
          ${parentSnippet ? `↳ reply to ${escapeHtml(parentSnippet)}` : ''}
        </span>
        <button class="figma-create-task-btn">Create task</button>
      </div>
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
