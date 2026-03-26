/* ========================================
   Review Share — Guest viewer
   No auth required. Accessed via ?token=xxx
   ======================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCkiOqdK9ng8P41lZktjP9yITS-3Kva4uU",
  authDomain: "runway-40912.firebaseapp.com",
  projectId: "runway-40912",
  storageBucket: "runway-40912.firebasestorage.app",
  messagingSenderId: "15308554422",
  appId: "1:15308554422:web:dce572304cefe74ef42617",
};

const app = initializeApp(firebaseConfig, 'review-share');
const db  = getFirestore(app);

// ── State ────────────────────────────────────────────────
let taskDocRef = null;   // Firestore DocumentReference for the task
let taskData   = null;   // Live task object
let boardTitle = '';
let guestName  = '';
let currentImgIndex = 0;
let viewMode = 'fit';

// ── Boot ─────────────────────────────────────────────────
(async function init() {
  // Token is in the hash (e.g. #tkn=abc123) to survive serve's clean-URL redirect
  const token = new URLSearchParams(location.hash.slice(1)).get('tkn');
  if (!token) return showError('No link token', 'This URL is missing a share token. Ask for a new link.');

  // Step 1: look up the shareLinks document (fast direct read, no index needed)
  let linkData;
  try {
    const linkSnap = await getDoc(doc(db, 'shareLinks', token));
    if (!linkSnap.exists()) return showError('Link not found', 'This review link is invalid or has been removed.');
    linkData = linkSnap.data();
  } catch (e) {
    return showError('Unable to load review', 'Could not reach Runway. Please check your connection and try again.');
  }

  // Check expiry
  if (!linkData.expiry || linkData.expiry < Date.now()) {
    return showError('Link expired', 'This review link expired. Ask a team member to share a new one.');
  }

  // Step 2: fetch the task directly using boardId + taskId from the link doc
  const { boardId, taskId } = linkData;
  try {
    const taskSnap = await getDoc(doc(db, 'boards', boardId, 'tasks', taskId));
    if (!taskSnap.exists()) return showError('Link not found', 'This review link is invalid or has been removed.');
    taskData   = taskSnap.data();
    taskDocRef = taskSnap.ref;
  } catch (e) {
    return showError('Unable to load review', 'Could not reach Runway. Please check your connection and try again.');
  }

  // Resolve board title
  try {
    const boardSnap = await getDoc(doc(db, 'boards', boardId));
    boardTitle = boardSnap.exists() ? (boardSnap.data().title || boardId) : boardId;
  } catch { boardTitle = boardId; }

  hide('rsLoading');

  // Check for saved guest name
  guestName = sessionStorage.getItem('rvGuestName') || '';
  if (guestName) {
    showReview();
  } else {
    showNamePrompt(taskData.title || 'this design');
  }
})();

// ── Error / prompts ──────────────────────────────────────
function showError(title, msg) {
  hide('rsLoading');
  document.getElementById('rsErrorTitle').textContent = title;
  document.getElementById('rsErrorMsg').textContent   = msg;
  show('rsError');
}

function showNamePrompt(taskTitle) {
  document.getElementById('rsNameTaskTitle').textContent = taskTitle;
  show('rsNamePrompt');

  const input  = document.getElementById('rsNameInput');
  const submit = document.getElementById('rsNameSubmit');

  const proceed = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    guestName = name;
    sessionStorage.setItem('rvGuestName', name);
    hide('rsNamePrompt');
    showReview();
  };

  submit.addEventListener('click', proceed);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') proceed(); });
}

// ── Main viewer ──────────────────────────────────────────
function showReview() {
  show('rsViewer');
  document.getElementById('rsHeaderBoard').textContent  = boardTitle;
  document.getElementById('rsHeaderTask').textContent   = taskData.title || 'Review';
  document.getElementById('rsGuestName').textContent    = guestName;
  document.getElementById('rsCommentingAs').textContent = guestName;

  const REVIEW_STATUS = {
    pending:    { label: 'Awaiting Review',   color: '#f59e0b' },
    approved:   { label: 'Approved',          color: '#10b981' },
    changes:    { label: 'Changes Requested', color: '#ef4444' },
    discussion: { label: 'In Discussion',     color: '#8b5cf6' },
  };
  const status = REVIEW_STATUS[taskData.reviewStatus || 'pending'];
  const badge  = document.getElementById('rsStatusBadge');
  badge.textContent = status.label;
  badge.style.setProperty('--status-color', status.color);

  renderImages();
  renderPolls();
  renderComments();
  setupListeners();
}

// ── Images ───────────────────────────────────────────────
function renderImages() {
  const images  = taskData.reviewImages || [];
  const viewport = document.getElementById('rsImageViewport');
  viewport.className = `rv-image-viewport rv-view-${viewMode}`;

  if (images.length === 0) {
    viewport.innerHTML = `
      <div class="rv-image-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p>No design mocks uploaded yet</p>
      </div>`;
    return;
  }

  const img = images[currentImgIndex];
  const src = img.url || img.dataUrl || '';
  if (!src) {
    viewport.innerHTML = `<div class="rv-image-missing"><p>Image unavailable</p></div>`;
  } else {
    const pins = img.pins || [];
    viewport.innerHTML = `
      <div class="rv-image-wrap" id="rsImageWrap">
        <img class="rv-main-image" src="${src}" alt="${escHtml(img.name)}" draggable="false" />
        ${pins.map((pin, i) => `
          <div class="rv-pin" style="left:${pin.x}%;top:${pin.y}%" title="${pin.comment ? pin.comment : 'Pin ' + (i + 1)}">${i + 1}</div>
        `).join('')}
      </div>`;
  }

  // Filmstrip
  const strip = document.getElementById('rsFilmstrip');
  if (images.length > 1) {
    strip.hidden = false;
    strip.innerHTML = images.map((im, i) => {
      const thumbSrc = im.url || im.dataUrl || '';
      return `
        <div class="rv-film-thumb${i === currentImgIndex ? ' active' : ''}" data-img-index="${i}">
          ${thumbSrc ? `<img src="${thumbSrc}" alt="${escHtml(im.name)}" />` : '<div class="rv-film-missing"></div>'}
          ${(im.pins || []).length > 0 ? `<span class="rv-film-pin-count">${im.pins.length}</span>` : ''}
        </div>`;
    }).join('');
    strip.querySelectorAll('.rv-film-thumb').forEach(t => {
      t.addEventListener('click', () => {
        currentImgIndex = parseInt(t.dataset.imgIndex);
        renderImages();
      });
    });
  } else {
    strip.hidden = true;
  }
}

// ── Polls ─────────────────────────────────────────────────
function renderPolls() {
  const polls  = taskData.reviewPolls || [];
  const section = document.getElementById('rsPollsSection');
  if (polls.length === 0) { section.innerHTML = ''; return; }

  section.innerHTML = polls.map(poll => {
    const total    = poll.options.reduce((s, o) => s + (o.votes || []).length, 0);
    const myVoteId = poll.options.find(o => (o.votes || []).includes(guestName))?.id;

    const optionsHtml = poll.options.map(o => {
      const votes   = o.votes || [];
      const pct     = total > 0 ? Math.round(votes.length / total * 100) : 0;
      const isMyVote = o.id === myVoteId;
      return `
        <div class="rv-poll-option${isMyVote ? ' my-vote' : ''}${poll.closed ? ' rv-poll-closed-opt' : ''}"
             data-option-id="${o.id}" data-poll-id="${poll.id}">
          <div class="rv-poll-option-dot"></div>
          <span class="rv-poll-option-text">${escHtml(o.text)}</span>
          <span class="rv-poll-option-pct">${pct}%</span>
        </div>`;
    }).join('');

    return `
      <div class="rv-poll${poll.closed ? ' rv-poll-closed' : ''}" data-poll-id="${poll.id}">
        <div class="rv-poll-header">
          <span class="rv-poll-question">${escHtml(poll.question)}</span>
          <div class="rv-poll-meta">
            <span>${escHtml(poll.author)} · ${timeAgo(poll.timestamp)}</span>
            ${poll.closed ? '<span class="rv-poll-closed-tag">Closed</span>' : ''}
          </div>
        </div>
        <div class="rv-poll-options">${optionsHtml}</div>
      </div>`;
  }).join('');

  // Wire up voting
  section.querySelectorAll('.rv-poll-option:not(.rv-poll-closed-opt)').forEach(optEl => {
    optEl.addEventListener('click', () => handleVote(
      Number(optEl.dataset.pollId),
      Number(optEl.dataset.optionId)
    ));
  });
}

async function handleVote(pollId, optionId) {
  if (!taskDocRef) return;
  const poll = (taskData.reviewPolls || []).find(p => p.id === pollId);
  if (!poll || poll.closed) return;

  // Toggle: remove from all, then add to clicked (unless de-voting)
  const hadVote = poll.options.some(o => (o.votes || []).includes(guestName));
  poll.options.forEach(o => { o.votes = (o.votes || []).filter(v => v !== guestName); });
  const opt = poll.options.find(o => o.id === optionId);
  const wasMyVote = hadVote && opt?.id === optionId;
  if (opt && !wasMyVote) opt.votes.push(guestName);

  renderPolls();

  try {
    await updateDoc(taskDocRef, { reviewPolls: taskData.reviewPolls });
  } catch (e) {
    console.error('Vote sync failed:', e);
  }
}

// ── Comments ──────────────────────────────────────────────
function renderComments() {
  const comments = taskData.reviewComments || [];
  const list     = document.getElementById('rsCommentsList');
  const countEl  = document.getElementById('rsCommentCount');
  if (countEl) countEl.textContent = comments.length;

  if (comments.length === 0) {
    list.innerHTML = '<div class="rv-no-comments">No comments yet. Be the first to leave feedback.</div>';
    return;
  }

  list.innerHTML = [...comments].reverse().map(c => {
    const isPinned = c.pinIndex !== undefined;
    const isGuest  = c.isGuest;
    const replies  = (c.replies || []).map(r => `
      <div class="rv-reply">
        <div class="rv-comment-avatar rv-reply-avatar">${avatarHtml(r.author, r.isGuest)}</div>
        <div class="rv-reply-content">
          <div class="rv-reply-meta">
            <span class="rv-comment-author">${escHtml(r.author)}</span>
            ${r.isGuest ? '<span class="rs-guest-comment-tag">Guest</span>' : ''}
            <span class="rv-comment-time">${fmtDate(r.timestamp)}</span>
          </div>
          <div class="rv-comment-body">${renderText(r.text)}</div>
        </div>
      </div>`).join('');

    return `
      <div class="rv-comment${isPinned ? ' rv-comment-pinned' : ''}" data-comment-id="${c.id}">
        <div class="rv-comment-left">
          <div class="rv-comment-avatar">${avatarHtml(c.author, isGuest)}</div>
        </div>
        <div class="rv-comment-right">
          <div class="rv-comment-header">
            <span class="rv-comment-author">${escHtml(c.author)}</span>
            ${isGuest ? '<span class="rs-guest-comment-tag">Guest</span>' : ''}
            ${isPinned ? `<span class="rv-comment-pin-ref">#${c.pinIndex + 1}</span>` : ''}
            <span class="rv-comment-time">${fmtDate(c.timestamp)}</span>
          </div>
          <div class="rv-comment-body">${renderText(c.text)}</div>
        </div>
      </div>
      ${replies ? `<div class="rv-replies" style="margin-left:48px">${replies}</div>` : ''}`;
  }).join('');
}

async function postComment() {
  const input = document.getElementById('rsCommentInput');
  const text  = input?.value.trim();
  if (!text || !taskDocRef) return;

  const comment = {
    id:        Date.now(),
    author:    guestName,
    text,
    timestamp: new Date().toISOString(),
    isGuest:   true,
  };

  // Optimistic update
  if (!taskData.reviewComments) taskData.reviewComments = [];
  taskData.reviewComments.push(comment);
  input.value = '';
  renderComments();

  try {
    await updateDoc(taskDocRef, { reviewComments: arrayUnion(comment) });
  } catch (e) {
    console.error('Comment sync failed:', e);
  }
}

// ── Listeners ─────────────────────────────────────────────
function setupListeners() {
  document.getElementById('rsSendBtn')?.addEventListener('click', postComment);
  document.getElementById('rsCommentInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment();
  });

  document.getElementById('rsViewFit')?.addEventListener('click', () => {
    viewMode = 'fit';
    document.getElementById('rsViewFit').classList.add('active');
    document.getElementById('rsViewScroll').classList.remove('active');
    renderImages();
  });
  document.getElementById('rsViewScroll')?.addEventListener('click', () => {
    viewMode = 'scroll';
    document.getElementById('rsViewScroll').classList.add('active');
    document.getElementById('rsViewFit').classList.remove('active');
    renderImages();
  });
}

// ── Helpers ───────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if (el) el.hidden = false; }
function hide(id) { const el = document.getElementById(id); if (el) el.hidden = true; }

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function avatarHtml(name, isGuest) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const color    = isGuest ? '#6b7280' : stringToColor(name || '');
  return `<div class="rv-avatar" style="background:${color}">${initials}</div>`;
}

function stringToColor(str) {
  const colors = ['#7c5cfc','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function renderText(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/__(.+?)__/g,     '<u>$1</u>')
    .replace(/\n/g,            '<br>');
}
