/* ========================================
   Reviews — Design Review Hub
   ======================================== */

import { BOARDS } from './data.js';
import { state, saveState } from './state.js';
import { assigneeAvatarContent, renderCommentText, attachMentionAutocomplete, escapeHtml } from './utils.js';
import { uploadReviewImage } from './image-upload.js';
import { sendStatusChangeNotification, sendLikeNotification } from './notifications.js';
import { timeAgo } from './utils.js';
import { db } from './firebase.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Column IDs that represent "in review" across all boards
const REVIEW_COLS = new Set(['review', 'stakeholder', 'analysis', 'qa']);

const REVIEW_STATUS = {
  pending:    { label: 'Awaiting Review',    color: '#f59e0b' },
  approved:   { label: 'Approved',           color: '#10b981' },
  changes:    { label: 'Changes Requested',  color: '#ef4444' },
  discussion: { label: 'In Discussion',      color: '#8b5cf6' },
};

export const RV_FILTERS = [
  { id: 'all',        label: 'All Reviews',        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>` },
  { id: 'pending',    label: 'Awaiting',           icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
  { id: 'approved',   label: 'Approved',           icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>` },
  { id: 'changes',    label: 'Changes Requested',  icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` },
];

let rvFilter = 'all';
let currentPinMode = false;
let currentImageIndex = 0;
let viewMode = 'fit'; // 'fit' | 'scroll' | 'fullscreen'

const BOARD_COLORS = {
  'product-design':   '#7c5cfc',
  'business-dev':     '#3b82f6',
  'ux':               '#10b981',
  'flagship':         '#f59e0b',
  'business-products':'#ef4444',
};

function getReviewTasks() {
  const items = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) {
      if (!task.archived && REVIEW_COLS.has(task.column)) {
        items.push({ task, boardId, board });
      }
    }
  }
  return items;
}

// ── Queue View ──────────────────────────────────────────
export function renderReviewsView(container) {
  const items = getReviewTasks();
  const filtered = rvFilter === 'all'
    ? [...items].sort((a, b) => {
        const aApproved = (a.task.reviewStatus || 'pending') === 'approved' ? 1 : 0;
        const bApproved = (b.task.reviewStatus || 'pending') === 'approved' ? 1 : 0;
        return aApproved - bApproved;
      })
    : items.filter(({ task }) => (task.reviewStatus || 'pending') === rvFilter);

  container.innerHTML = `<div class="rv-view"></div>`;
  const view = container.querySelector('.rv-view');

  if (filtered.length === 0) {
    view.innerHTML = `
      <div class="rv-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <p>No items in review</p>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'rv-grid';
  filtered.forEach(({ task, boardId, board }) => {
    const card = buildReviewCard(task, boardId, board);
    grid.appendChild(card);
  });
  view.appendChild(grid);
}

function buildReviewCard(task, boardId, board) {
  const col = board.columns.find(c => c.id === task.column);
  const status = REVIEW_STATUS[task.reviewStatus || 'pending'] || REVIEW_STATUS.pending;
  const images = task.reviewImages || [];
  const thumb = images.length > 0 ? (images[0].dataUrl || images[0].url) : null;
  const due = task.due ? new Date(task.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const boardColor = BOARD_COLORS[boardId] || '#9ca3af';
  const initials = task.assignee ? task.assignee.split(' ').map(w => w[0]).join('') : '';
  const pinCount = images.reduce((n, img) => n + (img.pins ? img.pins.length : 0), 0);
  const commentCount = (task.reviewComments || []).length;

  const card = document.createElement('div');
  card.className = 'rv-card';
  card.dataset.taskId = task.id;
  card.dataset.boardId = boardId;

  card.innerHTML = `
    <div class="rv-card-thumb${!thumb ? ' rv-card-thumb-empty' : ''}">
      ${thumb
        ? `<img src="${thumb}" alt="${task.title}" />`
        : `<div class="rv-thumb-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
           </div>`
      }
      <span class="rv-card-img-count">${images.length} mock${images.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="rv-card-body">
      <div class="rv-card-meta">
        <span class="rv-board-dot" style="background:${boardColor}"></span>
        <span class="rv-board-name">${board.title}</span>
        ${col ? `<span class="rv-col-sep">·</span><span class="rv-col-name">${col.name}</span>` : ''}
      </div>
      <div class="rv-card-title">${task.title}</div>
      <div class="rv-card-footer">
        <span class="rv-status-badge" style="--status-color:${status.color}">${status.label}</span>
        <div class="rv-card-footer-right">
          ${pinCount > 0 ? `<span class="rv-card-stat" title="Pins">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${pinCount}
          </span>` : ''}
          ${commentCount > 0 ? `<span class="rv-card-stat" title="Comments">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${commentCount}
          </span>` : ''}
          ${task.assignee ? `<span class="rv-assignee">${assigneeAvatarContent(task.assignee, state.profile)}</span>` : ''}
          ${due ? `<span class="rv-due">${due}</span>` : ''}
        </div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openReviewModal(task.id, boardId));
  return card;
}

// ── Topbar Nav ──────────────────────────────────────────
export function renderReviewsTopbarNav(navContainer, viewContainer) {
  navContainer.innerHTML = '';
  RV_FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `view-tab${rvFilter === f.id ? ' active' : ''}`;
    btn.innerHTML = `${f.icon} ${f.label}`;
    btn.addEventListener('click', () => {
      rvFilter = f.id;
      renderReviewsTopbarNav(navContainer, viewContainer);
      renderReviewsView(viewContainer);
    });
    navContainer.appendChild(btn);
  });
}

// ── Review Modal ─────────────────────────────────────────
function openReviewModal(taskId, boardId) {
  currentImageIndex = 0;
  currentPinMode = false;

  const board = BOARDS[boardId];
  const task = board?.tasks.find(t => t.id === taskId);
  if (!task) return;

  const overlay = document.createElement('div');
  overlay.className = 'rv-modal-overlay';
  overlay.dataset.taskId = taskId;
  overlay.dataset.boardId = boardId;
  document.body.appendChild(overlay);

  renderModal(overlay, task, board, boardId);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay);
  });
}

/**
 * If a review modal is open for the given task, refresh its comments list
 * with the latest data from BOARDS. Called by the Firestore onSnapshot handler
 * when a remote update arrives for the task currently shown in the modal.
 */
export function refreshOpenReviewModal(taskId, boardId) {
  const overlay = document.querySelector(`.rv-modal-overlay[data-task-id="${taskId}"]`);
  if (!overlay) return;
  const freshTask = BOARDS[boardId]?.tasks.find(t => t.id === taskId);
  if (!freshTask) return;
  refreshCommentsList(overlay, freshTask, boardId);
  refreshPollsList(overlay, freshTask, boardId);
}

function renderModal(overlay, task, board, boardId) {
  overlay.innerHTML = buildModalHTML(task, board);
  setupModalListeners(overlay, task, board, boardId);
}

function buildModalHTML(task, board) {
  const images = task.reviewImages || [];
  const currentImg = images[currentImageIndex] || null;

  return `
    <div class="rv-modal">
      <div class="rv-modal-header">
        <div class="rv-modal-title">
          <span class="rv-modal-board">${board.title}</span>
          <span class="rv-modal-sep">/</span>
          <span>${task.title}</span>
        </div>
        <div class="rv-modal-header-actions">
          <select class="rv-status-select" id="rvStatusSelect">
            ${Object.entries(REVIEW_STATUS).map(([val, s]) =>
              `<option value="${val}"${(task.reviewStatus || 'pending') === val ? ' selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
          <div class="rv-share-wrap">
            <button class="rv-share-btn" id="rvShareBtn" title="Share this review">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share
            </button>
            <div class="rv-share-panel" id="rvSharePanel" hidden>
              <div class="rv-share-panel-title">Share review link</div>
              <div class="rv-share-link-row">
                <input class="rv-share-link-input" id="rvShareLinkInput" readonly />
                <button class="rv-share-copy-btn" id="rvShareCopyBtn">Copy</button>
              </div>
              <div class="rv-share-actions">
                <button class="rv-share-action-btn" id="rvShareEmailBtn">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Email
                </button>
                <button class="rv-share-action-btn" id="rvShareSlackBtn">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"/><path d="M8.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 0v4m7-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0 0v4M8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>
                  Copy for Slack
                </button>
              </div>
              <div class="rv-share-expiry" id="rvShareExpiry"></div>
            </div>
          </div>
          <button class="rv-close-btn" id="rvCloseBtn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="rv-modal-body">
        <div class="rv-left">
          <div class="rv-image-toolbar">
            <button class="rv-tool-btn${currentPinMode ? ' active' : ''}" id="rvPinModeBtn" title="Click image to drop pins">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Pin
            </button>
            <label class="rv-tool-btn rv-upload-label" title="Upload design mock">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Mock
              <input type="file" id="rvFileInput" accept="image/*" style="display:none" />
            </label>
            ${currentImg ? `
              <button class="rv-tool-btn rv-tool-danger" id="rvDeleteImgBtn" title="Remove this image">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>` : ''}
            <span class="rv-toolbar-hint">${currentPinMode ? 'Click image to drop a pin' : ''}</span>
            <div class="rv-view-mode-btns">
              <button class="rv-view-btn${viewMode === 'fit' ? ' active' : ''}" id="rvViewFit" title="Fit to window">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
              <button class="rv-view-btn${viewMode === 'scroll' ? ' active' : ''}" id="rvViewScroll" title="Actual size (scroll)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              </button>
              <button class="rv-view-btn" id="rvViewFullscreen" title="Fullscreen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><polyline points="21 15 21 21 15 21"/><polyline points="3 9 3 3 9 3"/></svg>
              </button>
            </div>
          </div>
          <div class="rv-image-viewport${currentPinMode ? ' rv-pin-mode' : ''} rv-view-${viewMode}" id="rvImageViewport">
            ${currentImg ? buildImageView(currentImg, task) : buildEmptyImageView()}
          </div>
          ${images.length > 1 ? buildFilmstrip(images, currentImageIndex) : ''}
        </div>
        <div class="rv-right">
          <div class="rv-comments-header">
            <div class="rv-comments-header-left">
              <span>Comments</span>
              <span class="rv-comment-count">${(task.reviewComments || []).length}</span>
            </div>
            <button class="rv-add-poll-btn" id="rvAddPollBtn" title="Create a poll">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Poll
            </button>
          </div>
          <div class="rv-comment-input-area">
            <div class="rv-comment-input-wrap">
              <textarea class="rv-comment-input" id="rvCommentInput" placeholder="Add a comment… type @ to mention"></textarea>
              <div class="mention-dropdown" id="rvMentionDropdown" hidden></div>
            </div>
            <div class="rv-input-toolbar">
              <div class="rv-input-fmt-btns">
                <button class="rv-fmt-btn" id="rvFmtBold" title="Bold"><b>B</b></button>
                <button class="rv-fmt-btn" id="rvFmtItalic" title="Italic"><i>I</i></button>
                <button class="rv-fmt-btn" id="rvFmtUnderline" title="Underline"><u>U</u></button>
                <span class="rv-fmt-sep"></span>
                <button class="rv-fmt-btn" id="rvFmtMention" title="Mention">@</button>
                <div class="rv-emoji-wrap">
                  <button class="rv-fmt-btn" id="rvFmtEmoji" title="Emoji">😊</button>
                  <div class="rv-emoji-picker" id="rvEmojiPicker" hidden></div>
                </div>
              </div>
              <button class="rv-send-btn" id="rvSendBtn">Post</button>
            </div>
          </div>
          <div class="rv-create-poll-form" id="rvCreatePollForm" style="display:none">
            <input class="rv-poll-question-input" id="rvPollQuestion" type="text" placeholder="Ask a question…" maxlength="200" />
            <div class="rv-poll-form-options" id="rvPollFormOptions">
              <input class="rv-poll-option-input" type="text" placeholder="Option 1" maxlength="100" />
              <input class="rv-poll-option-input" type="text" placeholder="Option 2" maxlength="100" />
            </div>
            <button class="rv-add-option-btn" id="rvAddOptionBtn">+ Add option</button>
            <div class="rv-poll-form-actions">
              <button class="btn-ghost-sm" id="rvCancelPollBtn">Cancel</button>
              <button class="btn-primary-sm" id="rvSubmitPollBtn">Create Poll</button>
            </div>
          </div>
          <div class="rv-polls-section" id="rvPollsSection">
            ${buildPollsList(task)}
          </div>
          <div class="rv-comments-list" id="rvCommentsList">
            ${buildCommentsList(task)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildImageView(img, task) {
  const pins = img.pins || [];
  const imgSrc = img.dataUrl || img.url;
  if (!imgSrc) {
    return `
      <div class="rv-image-missing">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p>"${escapeHtml(img.name)}" needs to be re-uploaded</p>
        <label class="rv-upload-cta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Re-upload image
          <input type="file" id="rvFileInputEmpty" accept="image/*" style="display:none" />
        </label>
      </div>
    `;
  }
  return `
    <div class="rv-image-wrap" id="rvImageWrap">
      <img class="rv-main-image" id="rvMainImage" src="${imgSrc}" alt="${img.name}" draggable="false" />
      ${pins.map((pin, i) => `
        <div class="rv-pin" style="left:${pin.x}%;top:${pin.y}%" data-pin-index="${i}" title="${pin.comment ? pin.comment : 'Pin ' + (i + 1)}">${i + 1}</div>
      `).join('')}
    </div>
  `;
}

function buildEmptyImageView() {
  return `
    <div class="rv-image-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <p>No design mocks uploaded yet</p>
      <label class="rv-upload-cta">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload a mock to start reviewing
        <input type="file" id="rvFileInputEmpty" accept="image/*" style="display:none" />
      </label>
    </div>
  `;
}

function buildFilmstrip(images, activeIndex) {
  return `
    <div class="rv-filmstrip" id="rvFilmstrip">
      ${images.map((img, i) => `
        <div class="rv-film-thumb${i === activeIndex ? ' active' : ''}" data-img-index="${i}" title="${img.name}">
          ${(img.dataUrl || img.url)
            ? `<img src="${img.dataUrl || img.url}" alt="${img.name}" />`
            : `<div class="rv-film-missing" title="Re-upload needed"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>`
          }
          ${(img.pins || []).length > 0
            ? `<span class="rv-film-pin-count">${img.pins.length}</span>`
            : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ── Polls ────────────────────────────────────────────────
function buildPollsList(task) {
  const polls = task.reviewPolls || [];
  if (polls.length === 0) return '';
  return polls.map(p => buildPoll(p)).join('');
}

function buildPoll(poll) {
  const me = state.profile.name || '';
  const total = poll.options.reduce((s, o) => s + (o.votes || []).length, 0);
  const myVoteId = poll.options.find(o => (o.votes || []).includes(me))?.id;
  const canClose = poll.author === me && !poll.closed;

  const optionsHtml = poll.options.map(o => {
    const votes = o.votes || [];
    const pct = total > 0 ? Math.round(votes.length / total * 100) : 0;
    const isMyVote = o.id === myVoteId;
    return `
      <div class="rv-poll-option${isMyVote ? ' my-vote' : ''}${poll.closed ? ' rv-poll-closed-opt' : ''}"
           data-option-id="${o.id}" data-poll-id="${poll.id}" title="${poll.closed ? '' : 'Click to vote'}">
        <div class="rv-poll-option-dot"></div>
        <span class="rv-poll-option-text">${escapeHtml(o.text)}</span>
        <span class="rv-poll-option-pct">${pct}%</span>
      </div>`;
  }).join('');

  return `
    <div class="rv-poll${poll.closed ? ' rv-poll-closed' : ''}" data-poll-id="${poll.id}">
      <div class="rv-poll-header">
        <span class="rv-poll-question">${escapeHtml(poll.question)}</span>
        <div class="rv-poll-meta">
          <span>${escapeHtml(poll.author)} · ${timeAgo(poll.timestamp)}</span>
          ${poll.closed ? '<span class="rv-poll-closed-tag">Closed</span>' : ''}
          ${canClose ? `<button class="rv-poll-close-btn" data-poll-id="${poll.id}">Close poll</button>` : ''}
        </div>
      </div>
      <div class="rv-poll-options">${optionsHtml}</div>
    </div>`;
}

function refreshPollsList(overlay, task, boardId) {
  const section = overlay.querySelector('#rvPollsSection');
  if (!section) return;
  section.innerHTML = buildPollsList(task);

  // Vote on an option
  section.querySelectorAll('.rv-poll-option:not(.rv-poll-closed-opt)').forEach(optEl => {
    optEl.addEventListener('click', () => {
      const pollId = Number(optEl.dataset.pollId);
      const optionId = Number(optEl.dataset.optionId);
      const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
      const poll = liveTask.reviewPolls?.find(p => p.id === pollId);
      if (!poll || poll.closed) return;
      const me = state.profile.name || 'Me';
      // Toggle: remove existing vote from all options first
      const hadVote = poll.options.some(o => (o.votes || []).includes(me));
      poll.options.forEach(o => { o.votes = (o.votes || []).filter(v => v !== me); });
      // Add vote to clicked option (unless they had voted for this one — that toggles off)
      const opt = poll.options.find(o => o.id === optionId);
      if (opt && !(hadVote && opt.id === optionId)) opt.votes.push(me);
      saveState();
      if (boardId && window._syncBoard) window._syncBoard(boardId);
      refreshPollsList(overlay, liveTask, boardId);
    });
  });

  // Close poll
  section.querySelectorAll('.rv-poll-close-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pollId = Number(btn.dataset.pollId);
      const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
      const poll = liveTask.reviewPolls?.find(p => p.id === pollId);
      if (!poll) return;
      poll.closed = true;
      saveState();
      if (boardId && window._syncBoard) window._syncBoard(boardId);
      refreshPollsList(overlay, liveTask, boardId);
    });
  });
}

function buildCommentsList(task) {
  const comments = task.reviewComments || [];
  if (comments.length === 0) {
    return '<div class="rv-no-comments">No comments yet. Upload a mock, drop pins, or type below.</div>';
  }
  return [...comments].reverse().map(c => buildComment(c)).join('');
}

function buildComment(comment) {
  const fmtDate = ts => new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const isPinned = comment.pinIndex !== undefined;
  const likes = comment.likes || [];
  const replies = comment.replies || [];
  const me = state.profile.name || '';
  const hasLiked = me && likes.includes(me);

  const repliesHtml = replies.map(r => `
    <div class="rv-reply">
      <div class="rv-comment-avatar rv-reply-avatar">${assigneeAvatarContent(r.author, state.profile)}</div>
      <div class="rv-reply-content">
        <div class="rv-reply-meta">
          <span class="rv-comment-author">${escapeHtml(r.author || 'Me')}</span>
          <span class="rv-comment-time">${fmtDate(r.timestamp)}</span>
        </div>
        <div class="rv-comment-body">${renderCommentText(r.text)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="rv-comment${isPinned ? ' rv-comment-pinned' : ''}${replies.length > 0 ? ' rv-comment-has-replies' : ''}" data-comment-id="${comment.id}">
      <div class="rv-comment-left">
        <div class="rv-comment-avatar">${assigneeAvatarContent(comment.author || state.profile.name, state.profile)}</div>
      </div>
      <div class="rv-comment-right">
        <div class="rv-comment-header">
          <span class="rv-comment-author">${escapeHtml(comment.author || 'Me')}</span>
          ${isPinned ? `<span class="rv-comment-pin-ref">#${comment.pinIndex + 1}</span>` : ''}
          <span class="rv-comment-time">${fmtDate(comment.timestamp)}</span>
        </div>
        <div class="rv-comment-body">${renderCommentText(comment.text)}</div>
        <div class="rv-comment-actions">
          <button class="rv-like-btn${hasLiked ? ' liked' : ''}" data-comment-id="${comment.id}" title="${hasLiked ? 'Unlike' : 'Like'}">
            👍${likes.length > 0 ? ` <span>${likes.length}</span>` : ''}
          </button>
          <button class="rv-reply-btn" data-comment-id="${comment.id}">Reply</button>
        </div>
        ${repliesHtml ? `<div class="rv-replies">${repliesHtml}</div>` : ''}
      </div>
    </div>
  `;
}

function closeModal(overlay) {
  currentPinMode = false;
  viewMode = 'fit';
  overlay.remove();
}

function setupModalListeners(overlay, task, board, boardId) {
  // Close
  overlay.querySelector('#rvCloseBtn').addEventListener('click', () => closeModal(overlay));

  // Share panel
  setupSharePanel(overlay, task, boardId);

  // Status change
  overlay.querySelector('#rvStatusSelect').addEventListener('change', e => {
    const newStatus = e.target.value;
    const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
    liveTask.reviewStatus = newStatus;
    saveState();
    if (boardId && window._syncBoard) window._syncBoard(boardId);
    sendStatusChangeNotification(liveTask, boardId, newStatus);
  });

  // Poll button — show/hide create form
  overlay.querySelector('#rvAddPollBtn')?.addEventListener('click', () => {
    const form = overlay.querySelector('#rvCreatePollForm');
    if (!form) return;
    const isVisible = form.style.display !== 'none';
    form.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) overlay.querySelector('#rvPollQuestion')?.focus();
  });

  // Add option row
  overlay.querySelector('#rvAddOptionBtn')?.addEventListener('click', () => {
    const container = overlay.querySelector('#rvPollFormOptions');
    const count = container.querySelectorAll('.rv-poll-option-input').length;
    if (count >= 5) return;
    const inp = document.createElement('input');
    inp.className = 'rv-poll-option-input';
    inp.type = 'text';
    inp.placeholder = `Option ${count + 1}`;
    inp.maxLength = 100;
    container.appendChild(inp);
    inp.focus();
  });

  // Cancel poll form
  overlay.querySelector('#rvCancelPollBtn')?.addEventListener('click', () => {
    const form = overlay.querySelector('#rvCreatePollForm');
    if (form) form.style.display = 'none';
  });

  // Submit poll
  overlay.querySelector('#rvSubmitPollBtn')?.addEventListener('click', () => {
    const question = overlay.querySelector('#rvPollQuestion')?.value.trim();
    if (!question) return;
    const optionInputs = [...overlay.querySelectorAll('.rv-poll-option-input')];
    const options = optionInputs.map(i => i.value.trim()).filter(Boolean);
    if (options.length < 2) { alert('Please add at least 2 options.'); return; }
    const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
    if (!liveTask.reviewPolls) liveTask.reviewPolls = [];
    liveTask.reviewPolls.push({
      id: Date.now(),
      question,
      options: options.map((text, i) => ({ id: i + 1, text, votes: [] })),
      author: state.profile.name || 'Me',
      timestamp: new Date().toISOString(),
      closed: false,
    });
    saveState();
    if (boardId && window._syncBoard) window._syncBoard(boardId);
    // Reset form
    overlay.querySelector('#rvPollQuestion').value = '';
    const container = overlay.querySelector('#rvPollFormOptions');
    container.innerHTML = `
      <input class="rv-poll-option-input" type="text" placeholder="Option 1" maxlength="100" />
      <input class="rv-poll-option-input" type="text" placeholder="Option 2" maxlength="100" />
    `;
    overlay.querySelector('#rvCreatePollForm').style.display = 'none';
    refreshPollsList(overlay, liveTask, boardId);
  });

  // Initial wire-up of existing polls
  refreshPollsList(overlay, task, boardId);

  // Pin mode toggle
  const pinBtn = overlay.querySelector('#rvPinModeBtn');
  pinBtn.addEventListener('click', () => {
    currentPinMode = !currentPinMode;
    pinBtn.classList.toggle('active', currentPinMode);
    const hint = overlay.querySelector('.rv-toolbar-hint');
    if (hint) hint.textContent = currentPinMode ? 'Click image to drop a pin' : '';
    const viewport = overlay.querySelector('#rvImageViewport');
    if (viewport) viewport.classList.toggle('rv-pin-mode', currentPinMode);
  });

  // Image click → drop pin
  overlay.addEventListener('click', e => {
    if (!currentPinMode) return;
    const imageEl = overlay.querySelector('#rvMainImage');
    if (!imageEl) return;
    const wrap = overlay.querySelector('#rvImageWrap');
    if (!wrap || !wrap.contains(e.target) || e.target.classList.contains('rv-pin')) return;

    const rect = imageEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    const images = task.reviewImages || [];
    const img = images[currentImageIndex];
    if (!img) return;
    if (!img.pins) img.pins = [];

    const pinIndex = img.pins.length;
    img.pins.push({
      id: Date.now().toString(),
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      comment: '',
    });
    saveState();
    if (boardId && window._syncBoard) window._syncBoard(boardId);
    refreshImageView(overlay, task, img);
    showPinPopover(overlay, task, img, pinIndex, e.clientX, e.clientY, boardId);
  });

  // Pin click → show popover (view mode)
  overlay.addEventListener('click', e => {
    if (currentPinMode) return;
    const pinEl = e.target.closest('.rv-pin');
    if (!pinEl) return;
    e.stopPropagation();
    const pinIdx = parseInt(pinEl.dataset.pinIndex);
    const img = (task.reviewImages || [])[currentImageIndex];
    if (!img) return;
    showPinPopover(overlay, task, img, pinIdx, e.clientX, e.clientY, boardId);
  });

  // Filmstrip click
  overlay.addEventListener('click', e => {
    const thumb = e.target.closest('.rv-film-thumb');
    if (!thumb) return;
    currentImageIndex = parseInt(thumb.dataset.imgIndex);
    renderModal(overlay, task, board, boardId);
  });

  // Delete current image
  overlay.querySelector('#rvDeleteImgBtn')?.addEventListener('click', () => {
    const images = task.reviewImages || [];
    if (images.length === 0) return;
    images.splice(currentImageIndex, 1);
    currentImageIndex = Math.max(0, currentImageIndex - 1);
    saveState();
    renderModal(overlay, task, board, boardId);
  });

  // View mode controls
  overlay.querySelector('#rvViewFit')?.addEventListener('click', () => {
    viewMode = 'fit';
    renderModal(overlay, task, board, boardId);
  });
  overlay.querySelector('#rvViewScroll')?.addEventListener('click', () => {
    viewMode = 'scroll';
    renderModal(overlay, task, board, boardId);
  });
  overlay.querySelector('#rvViewFullscreen')?.addEventListener('click', () => {
    const viewport = overlay.querySelector('#rvImageViewport');
    if (viewport?.requestFullscreen) viewport.requestFullscreen();
    else if (viewport?.webkitRequestFullscreen) viewport.webkitRequestFullscreen();
  });

  // File upload
  setupFileUpload(overlay, task, board, boardId);

  // Send comment
  overlay.querySelector('#rvSendBtn')?.addEventListener('click', () => {
    sendComment(overlay, task, boardId);
  });
  overlay.querySelector('#rvCommentInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment(overlay, task, boardId);
  });

  // Formatting buttons
  const input = overlay.querySelector('#rvCommentInput');
  function wrapSelection(before, after) {
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    const selected = input.value.slice(start, end);
    const replacement = before + (selected || 'text') + after;
    input.setRangeText(replacement, start, end, 'select');
    if (!selected) {
      input.setSelectionRange(start + before.length, start + before.length + 4);
    }
    input.focus();
  }
  overlay.querySelector('#rvFmtBold')?.addEventListener('click', () => wrapSelection('**', '**'));
  overlay.querySelector('#rvFmtItalic')?.addEventListener('click', () => wrapSelection('*', '*'));
  overlay.querySelector('#rvFmtUnderline')?.addEventListener('click', () => wrapSelection('__', '__'));
  overlay.querySelector('#rvFmtMention')?.addEventListener('click', () => {
    if (!input) return;
    const pos = input.selectionStart;
    input.setRangeText('@', pos, pos, 'end');
    input.focus();
    input.dispatchEvent(new Event('input'));
  });

  // Emoji picker
  const emojiPicker = overlay.querySelector('#rvEmojiPicker');
  const emojis = ['😀','😂','🥲','😍','🤔','😎','🙌','👍','👏','🔥','❤️','✅','💡','🎉','🚀','👀','💯','⚡','🤝','😅','🙏','💪','🎨','✨','📌','🗣️','💬','📝','🤯','😤'];
  if (emojiPicker) {
    emojiPicker.innerHTML = emojis.map(e => `<button class="rv-emoji-btn">${e}</button>`).join('');
    emojiPicker.querySelectorAll('.rv-emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!input) return;
        const pos = input.selectionStart;
        input.setRangeText(btn.textContent, pos, pos, 'end');
        input.focus();
        emojiPicker.hidden = true;
      });
    });
  }
  overlay.querySelector('#rvFmtEmoji')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (emojiPicker) emojiPicker.hidden = !emojiPicker.hidden;
  });
  overlay.addEventListener('click', (e) => {
    if (emojiPicker && !e.target.closest('.rv-emoji-wrap')) emojiPicker.hidden = true;
  });

  // @mention autocomplete
  attachMentionAutocomplete(
    overlay.querySelector('#rvCommentInput'),
    overlay.querySelector('#rvMentionDropdown'),
    () => [
      { name: state.profile.name, role: state.profile.role || '', photo: state.profile.photo || '' },
      ...(state.teamMembers || []).filter(m => m.name !== state.profile.name),
    ]
  );
}

function setupFileUpload(overlay, task, board, boardId) {
  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const imageId = Date.now().toString();
    try {
      // Upload to Firebase Storage and get a shareable URL
      const url = await uploadReviewImage(file, boardId, task.id, imageId);
      if (!task.reviewImages) task.reviewImages = [];
      task.reviewImages.push({
        id: imageId,
        name: file.name,
        url,
        pins: [],
      });
      currentImageIndex = task.reviewImages.length - 1;
      saveState();
      renderModal(overlay, task, board, boardId);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again.');
    }
  };

  ['rvFileInput', 'rvFileInputEmpty'].forEach(id => {
    const input = overlay.querySelector(`#${id}`);
    if (input) {
      input.addEventListener('change', e => {
        handleFile(e.target.files[0]);
        e.target.value = '';
      });
    }
  });
}

function refreshImageView(overlay, task, img) {
  const viewport = overlay.querySelector('#rvImageViewport');
  if (!viewport) return;
  viewport.innerHTML = buildImageView(img, task);
  if (currentPinMode) viewport.classList.add('rv-pin-mode');
}

function showPinPopover(overlay, task, img, pinIndex, clientX, clientY, boardId) {
  // Remove existing
  document.querySelectorAll('.rv-pin-popover').forEach(p => p.remove());

  const pin = img.pins[pinIndex];
  if (!pin) return;

  const popover = document.createElement('div');
  popover.className = 'rv-pin-popover';
  popover.innerHTML = `
    <div class="rv-pin-popover-header">
      <span class="rv-pin-popover-num">${pinIndex + 1}</span>
      <span class="rv-pin-popover-title">Pin annotation</span>
      <button class="rv-pin-delete" title="Delete pin">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    <textarea class="rv-pin-comment-input" placeholder="Add annotation note...">${pin.comment || ''}</textarea>
    <div class="rv-pin-popover-actions">
      <button class="rv-pin-save btn-primary-sm">Save</button>
      <button class="rv-pin-cancel btn-ghost-sm">Cancel</button>
    </div>
  `;

  document.body.appendChild(popover);

  // Position
  popover.style.left = (clientX + 12) + 'px';
  popover.style.top = (clientY - 10) + 'px';

  // Adjust if off-screen
  requestAnimationFrame(() => {
    const rect = popover.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      popover.style.left = (clientX - rect.width - 12) + 'px';
    }
    if (rect.bottom > window.innerHeight - 8) {
      popover.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }
  });

  popover.querySelector('textarea').focus();

  popover.querySelector('.rv-pin-save').addEventListener('click', () => {
    const text = popover.querySelector('textarea').value.trim();
    pin.comment = text;
    saveState();
    if (text) {
      // Always use the live BOARDS reference to avoid stale closure issues
      const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
      if (!liveTask.reviewComments) liveTask.reviewComments = [];
      // Update or add comment for this pin
      const existing = liveTask.reviewComments.findIndex(c => c.pinIndex === pinIndex);
      const commentObj = {
        id: Date.now(),
        author: state.profile.name || 'Me',
        text: text,
        pinIndex,
        timestamp: new Date().toISOString(),
      };
      if (existing >= 0) {
        liveTask.reviewComments[existing] = commentObj;
      } else {
        liveTask.reviewComments.push(commentObj);
      }
      saveState();
      if (boardId && window._syncBoard) window._syncBoard(boardId);
      refreshCommentsList(overlay, liveTask, boardId);
    }
    popover.remove();
    refreshImageView(overlay, task, img);
  });

  popover.querySelector('.rv-pin-cancel').addEventListener('click', () => popover.remove());

  popover.querySelector('.rv-pin-delete').addEventListener('click', () => {
    img.pins.splice(pinIndex, 1);
    // Remove associated comment — use live BOARDS reference
    const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
    if (liveTask.reviewComments) {
      liveTask.reviewComments = liveTask.reviewComments.filter(c => c.pinIndex !== pinIndex);
      // Re-index pin references
      liveTask.reviewComments.forEach(c => {
        if (c.pinIndex !== undefined && c.pinIndex > pinIndex) c.pinIndex--;
      });
    }
    saveState();
    if (boardId && window._syncBoard) window._syncBoard(boardId);
    popover.remove();
    refreshImageView(overlay, task, img);
    refreshCommentsList(overlay, liveTask, boardId);
  });

  // Close on outside click
  setTimeout(() => {
    const handler = e => {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 0);
}

function sendComment(overlay, task, boardId) {
  const input = overlay.querySelector('#rvCommentInput');
  const text = input?.value.trim();
  if (!text) return;

  // Always use the live BOARDS reference — the closure's `task` may be stale
  // if onSnapshot replaced the object in BOARDS since the modal opened.
  const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;

  if (!liveTask.reviewComments) liveTask.reviewComments = [];
  liveTask.reviewComments.push({
    id: Date.now(),
    author: state.profile.name || 'Me',
    text,
    timestamp: new Date().toISOString(),
  });
  saveState();
  // Explicitly sync the board containing this task (may differ from state.currentBoard)
  if (boardId && window._syncBoard) window._syncBoard(boardId);
  input.value = '';
  refreshCommentsList(overlay, liveTask, boardId);
}

// ── Share Panel ──────────────────────────────────────────

function generateShareToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getOrCreateShareToken(task, boardId) {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  // Reuse existing token if not yet expired
  if (task.shareToken && task.shareTokenExpiry && task.shareTokenExpiry > now) {
    return task.shareToken;
  }
  const token = generateShareToken();
  task.shareToken = token;
  task.shareTokenExpiry = now + weekMs;
  saveState();
  if (boardId && window._syncBoard) window._syncBoard(boardId);
  // Write to shareLinks collection — enables fast direct lookup without a collection group index
  setDoc(doc(db, 'shareLinks', token), {
    boardId,
    taskId: task.id,
    expiry: task.shareTokenExpiry,
  }).catch(err => console.warn('shareLinks write failed:', err));
  return token;
}

function setupSharePanel(overlay, task, boardId) {
  const shareBtn = overlay.querySelector('#rvShareBtn');
  const panel    = overlay.querySelector('#rvSharePanel');
  if (!shareBtn || !panel) return;

  shareBtn.addEventListener('click', e => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    if (!panel.hidden) populateSharePanel(overlay, task, boardId);
  });

  // Close on outside click
  document.addEventListener('click', function handler(e) {
    if (!overlay.querySelector('.rv-share-wrap')?.contains(e.target)) {
      panel.hidden = true;
    }
    if (!document.body.contains(overlay)) {
      document.removeEventListener('click', handler);
    }
  });

  // Copy link
  overlay.querySelector('#rvShareCopyBtn')?.addEventListener('click', () => {
    const input = overlay.querySelector('#rvShareLinkInput');
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = overlay.querySelector('#rvShareCopyBtn');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  // Email
  overlay.querySelector('#rvShareEmailBtn')?.addEventListener('click', () => {
    const link = overlay.querySelector('#rvShareLinkInput')?.value || '';
    const subject = encodeURIComponent(`Review: ${task.title}`);
    const body = encodeURIComponent(
      `Hi,\n\nYou've been invited to review "${task.title}" on Runway.\n\nView and leave feedback here:\n${link}\n\nThis link expires in 7 days.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  });

  // Slack
  overlay.querySelector('#rvShareSlackBtn')?.addEventListener('click', () => {
    const link = overlay.querySelector('#rvShareLinkInput')?.value || '';
    const slackText = `*Review ready: ${task.title}*\n${link}`;
    navigator.clipboard.writeText(slackText).then(() => {
      const btn = overlay.querySelector('#rvShareSlackBtn');
      const orig = btn.innerHTML;
      btn.textContent = 'Copied for Slack!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    });
  });
}

function populateSharePanel(overlay, task, boardId) {
  const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
  const token = getOrCreateShareToken(liveTask, boardId);
  // Always upsert the shareLinks doc — handles tokens generated before this feature existed
  setDoc(doc(db, 'shareLinks', token), {
    boardId,
    taskId: liveTask.id,
    expiry: liveTask.shareTokenExpiry,
  }).catch(err => console.warn('shareLinks write failed:', err));
  const url = `${location.origin}${location.pathname.replace(/\/[^/]*$/, '')}/review-share.html#tkn=${token}`;
  const input = overlay.querySelector('#rvShareLinkInput');
  if (input) input.value = url;

  const expiry = overlay.querySelector('#rvShareExpiry');
  if (expiry && liveTask.shareTokenExpiry) {
    const days = Math.ceil((liveTask.shareTokenExpiry - Date.now()) / (1000 * 60 * 60 * 24));
    expiry.textContent = `Link expires in ${days} day${days !== 1 ? 's' : ''}`;
  }
}

function refreshCommentsList(overlay, task, boardId) {
  const list = overlay.querySelector('#rvCommentsList');
  if (!list) return;
  list.innerHTML = buildCommentsList(task);
  list.scrollTop = 0;
  const countEl = overlay.querySelector('.rv-comment-count');
  if (countEl) countEl.textContent = (task.reviewComments || []).length;

  // ── Like buttons ──
  list.querySelectorAll('.rv-like-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const commentId = Number(btn.dataset.commentId);
      const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
      const comment = liveTask.reviewComments?.find(c => c.id === commentId);
      if (!comment) return;
      if (!comment.likes) comment.likes = [];
      const me = state.profile.name || 'Me';
      const idx = comment.likes.indexOf(me);
      const isAdding = idx < 0;
      if (idx >= 0) comment.likes.splice(idx, 1);
      else comment.likes.push(me);
      saveState();
      if (boardId && window._syncBoard) window._syncBoard(boardId);
      if (isAdding) sendLikeNotification(comment, liveTask, boardId);
      refreshCommentsList(overlay, liveTask, boardId);
    });
  });

  // ── Reply buttons ──
  list.querySelectorAll('.rv-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const commentId = Number(btn.dataset.commentId);
      const commentEl = list.querySelector(`.rv-comment[data-comment-id="${commentId}"]`);
      if (!commentEl || commentEl.querySelector('.rv-reply-form')) return;

      const form = document.createElement('div');
      form.className = 'rv-reply-form';
      form.innerHTML = `
        <textarea class="rv-reply-input" placeholder="Reply…" rows="2"></textarea>
        <div class="rv-reply-form-footer">
          <span class="rv-reply-hint">⌘ + Enter to send</span>
          <button class="rv-reply-send btn-primary-sm">Send</button>
        </div>
      `;
      commentEl.appendChild(form);
      form.querySelector('.rv-reply-input').focus();

      const sendReply = () => {
        const text = form.querySelector('.rv-reply-input').value.trim();
        if (!text) return;
        const liveTask = BOARDS[boardId]?.tasks.find(t => t.id === task.id) || task;
        const comment = liveTask.reviewComments?.find(c => c.id === commentId);
        if (!comment) return;
        if (!comment.replies) comment.replies = [];
        comment.replies.push({
          id: Date.now(),
          author: state.profile.name || 'Me',
          text,
          timestamp: new Date().toISOString(),
        });
        saveState();
        if (boardId && window._syncBoard) window._syncBoard(boardId);
        refreshCommentsList(overlay, liveTask, boardId);
      };

      form.querySelector('.rv-reply-send').addEventListener('click', sendReply);
      form.querySelector('.rv-reply-input').addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); sendReply(); }
        if (e.key === 'Escape') form.remove();
      });
    });
  });
}
