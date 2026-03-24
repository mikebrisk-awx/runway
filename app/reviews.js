/* ========================================
   Reviews — Design Review Hub
   ======================================== */

import { BOARDS } from './data.js';
import { state, saveState } from './state.js';
import { assigneeAvatarContent, renderCommentText, attachMentionAutocomplete, escapeHtml } from './utils.js';

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
  const thumb = images.length > 0 ? images[0].dataUrl : null;
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
  document.body.appendChild(overlay);

  renderModal(overlay, task, board, boardId);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay);
  });
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
            <span>Comments &amp; Annotations</span>
            <span class="rv-comment-count">${(task.reviewComments || []).length}</span>
          </div>
          <div class="rv-comments-list" id="rvCommentsList">
            ${buildCommentsList(task)}
          </div>
          <div class="rv-comment-input-area">
            <div class="rv-comment-input-wrap">
              <textarea class="rv-comment-input" id="rvCommentInput" placeholder="Add a comment… type @ to mention"></textarea>
              <div class="mention-dropdown" id="rvMentionDropdown" hidden></div>
            </div>
            <button class="rv-send-btn" id="rvSendBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildImageView(img, task) {
  const pins = img.pins || [];
  return `
    <div class="rv-image-wrap" id="rvImageWrap">
      <img class="rv-main-image" id="rvMainImage" src="${img.dataUrl}" alt="${img.name}" draggable="false" />
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
          <img src="${img.dataUrl}" alt="${img.name}" />
          ${(img.pins || []).length > 0
            ? `<span class="rv-film-pin-count">${img.pins.length}</span>`
            : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function buildCommentsList(task) {
  const comments = task.reviewComments || [];
  if (comments.length === 0) {
    return '<div class="rv-no-comments">No comments yet. Upload a mock, drop pins, or type below.</div>';
  }
  return comments.map(c => buildComment(c)).join('');
}

function buildComment(comment) {
  const date = new Date(comment.timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const isPinned = comment.pinIndex !== undefined;
  return `
    <div class="rv-comment${isPinned ? ' rv-comment-pinned' : ''}">
      <div class="rv-comment-header">
        <div class="rv-comment-avatar">${assigneeAvatarContent(comment.author || state.profile.name, state.profile)}</div>
        <span class="rv-comment-author">${comment.author || 'Mike B.'}</span>
        ${isPinned ? `<span class="rv-comment-pin-ref">#${comment.pinIndex + 1}</span>` : ''}
        <span class="rv-comment-time">${date}</span>
      </div>
      <div class="rv-comment-body">${renderCommentText(comment.text)}</div>
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

  // Status change
  overlay.querySelector('#rvStatusSelect').addEventListener('change', e => {
    task.reviewStatus = e.target.value;
    saveState();
  });

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
    refreshImageView(overlay, task, img);
    showPinPopover(overlay, task, img, pinIndex, e.clientX, e.clientY);
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
    showPinPopover(overlay, task, img, pinIdx, e.clientX, e.clientY);
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
    sendComment(overlay, task);
  });
  overlay.querySelector('#rvCommentInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment(overlay, task);
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
  const handleFile = file => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        if (!task.reviewImages) task.reviewImages = [];
        task.reviewImages.push({
          id: Date.now().toString(),
          name: file.name,
          dataUrl: e.target.result,
          pins: [],
        });
        currentImageIndex = task.reviewImages.length - 1;
        saveState();
        renderModal(overlay, task, board, boardId);
      } catch (err) {
        if (err.name === 'QuotaExceededError') {
          alert('Storage quota exceeded. Remove some images before uploading more.');
        }
      }
    };
    reader.readAsDataURL(file);
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

function showPinPopover(overlay, task, img, pinIndex, clientX, clientY) {
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
      if (!task.reviewComments) task.reviewComments = [];
      // Update or add comment for this pin
      const existing = task.reviewComments.findIndex(c => c.pinIndex === pinIndex);
      const commentObj = {
        id: Date.now(),
        author: 'Mike B.',
        text: text,
        pinIndex,
        timestamp: new Date().toISOString(),
      };
      if (existing >= 0) {
        task.reviewComments[existing] = commentObj;
      } else {
        task.reviewComments.push(commentObj);
      }
      saveState();
      refreshCommentsList(overlay, task);
    }
    popover.remove();
    refreshImageView(overlay, task, img);
  });

  popover.querySelector('.rv-pin-cancel').addEventListener('click', () => popover.remove());

  popover.querySelector('.rv-pin-delete').addEventListener('click', () => {
    img.pins.splice(pinIndex, 1);
    // Remove associated comment
    if (task.reviewComments) {
      task.reviewComments = task.reviewComments.filter(c => c.pinIndex !== pinIndex);
      // Re-index pin references
      task.reviewComments.forEach(c => {
        if (c.pinIndex !== undefined && c.pinIndex > pinIndex) c.pinIndex--;
      });
    }
    saveState();
    popover.remove();
    refreshImageView(overlay, task, img);
    refreshCommentsList(overlay, task);
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

function sendComment(overlay, task) {
  const input = overlay.querySelector('#rvCommentInput');
  const text = input?.value.trim();
  if (!text) return;

  if (!task.reviewComments) task.reviewComments = [];
  task.reviewComments.push({
    id: Date.now(),
    author: state.profile.name || 'Me',
    text,
    timestamp: new Date().toISOString(),
  });
  saveState();
  input.value = '';
  refreshCommentsList(overlay, task);
}

function refreshCommentsList(overlay, task) {
  const list = overlay.querySelector('#rvCommentsList');
  if (!list) return;
  list.innerHTML = buildCommentsList(task);
  list.scrollTop = list.scrollHeight;
  const countEl = overlay.querySelector('.rv-comment-count');
  if (countEl) countEl.textContent = (task.reviewComments || []).length;
}
