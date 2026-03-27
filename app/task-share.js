/* ========================================
   Task Share — Public task viewer
   No auth required. Accessed via #tkn=xxx
   ======================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCkiOqdK9ng8P41lZktjP9yITS-3Kva4uU",
  authDomain: "runway-40912.firebaseapp.com",
  projectId: "runway-40912",
  storageBucket: "runway-40912.firebasestorage.app",
  messagingSenderId: "15308554422",
  appId: "1:15308554422:web:dce572304cefe74ef42617",
};

const app = initializeApp(firebaseConfig, 'task-share');
const db  = getFirestore(app);

// ── Boot ─────────────────────────────────────────────────
(async function init() {
  const token = new URLSearchParams(location.hash.slice(1)).get('tkn');
  if (!token) return showError('No link token', 'This URL is missing a share token.');

  // Look up taskLinks/{token} → boardId + taskId
  let linkData;
  try {
    const linkSnap = await getDoc(doc(db, 'taskLinks', token));
    if (!linkSnap.exists()) return showError('Link not found', 'This link is invalid or has been removed by the task owner.');
    linkData = linkSnap.data();
  } catch {
    return showError('Unable to load', 'Could not reach Runway. Please check your connection and try again.');
  }

  const { boardId, taskId } = linkData;

  // Fetch task
  let task;
  try {
    const taskSnap = await getDoc(doc(db, 'boards', boardId, 'tasks', taskId));
    if (!taskSnap.exists()) return showError('Link not found', 'This link is invalid or has been removed by the task owner.');
    task = taskSnap.data();
  } catch {
    return showError('Unable to load', 'Could not reach Runway. Please check your connection and try again.');
  }

  // Fetch board title
  let boardTitle = boardId;
  try {
    const boardSnap = await getDoc(doc(db, 'boards', boardId));
    if (boardSnap.exists()) boardTitle = boardSnap.data().title || boardId;
  } catch { /* use boardId fallback */ }

  hide('tsLoading');
  renderTask(task, boardTitle);
})();

// ── Helpers ──────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if (el) el.hidden = false; }
function hide(id) { const el = document.getElementById(id); if (el) el.hidden = true; }
function esc(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showError(title, msg) {
  hide('tsLoading');
  document.getElementById('tsErrorTitle').textContent = title;
  document.getElementById('tsErrorMsg').textContent   = msg;
  show('tsError');
}

// ── Renderer ─────────────────────────────────────────────
function renderTask(task, boardTitle) {
  // Header
  document.getElementById('tsHeaderBoard').textContent = boardTitle;
  document.getElementById('tsHeaderTask').textContent  = task.title || 'Task';

  // Status badge
  const statusBadge = document.getElementById('tsStatusBadge');
  if (statusBadge) {
    statusBadge.textContent = capitalize(task.column || 'Unknown');
    statusBadge.className = 'rs-status-badge';
  }

  // Title + description
  document.getElementById('tsTitle').textContent = task.title || '';
  const descEl = document.getElementById('tsDesc');
  descEl.textContent = task.desc || '';
  if (!task.desc) descEl.hidden = true;

  // Meta chips
  const metaRow = document.getElementById('tsMetaRow');
  const chips = [];
  if (task.priority) {
    const colors = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#10b981' };
    const c = colors[task.priority] || 'var(--text-secondary)';
    chips.push(`<span class="ts-meta-chip" style="color:${c}">${capitalize(task.priority)}</span>`);
  }
  if (task.assignee) chips.push(`<span class="ts-meta-chip">${esc(task.assignee)}</span>`);
  if (task.due) chips.push(`<span class="ts-meta-chip">${formatDate(task.due)}</span>`);
  if (task.type) chips.push(`<span class="ts-meta-chip">${capitalize(task.type)}</span>`);
  metaRow.innerHTML = chips.join('');

  // Checklist
  if (task.checklist && task.checklist.length) {
    const section = document.getElementById('tsChecklistSection');
    const list    = document.getElementById('tsChecklist');
    section.hidden = false;
    list.innerHTML = task.checklist.map(item => `
      <div class="ts-check-item ${item.done ? 'done' : ''}">
        <input type="checkbox" ${item.done ? 'checked' : ''} disabled />
        <span>${esc(item.text)}</span>
      </div>
    `).join('');
  }

  // Links
  if (task.links && task.links.length) {
    const section = document.getElementById('tsLinksSection');
    const list    = document.getElementById('tsLinks');
    section.hidden = false;
    list.innerHTML = task.links.map(link => `
      <a class="ts-link-item" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        ${esc(link.label || link.url)}
      </a>
    `).join('');
  }

  // Sidebar fields
  const sidebarRows = document.getElementById('tsSidebarRows');
  const fields = [];
  if (task.column)    fields.push({ label: 'Status',    value: capitalize(task.column) });
  if (task.priority)  fields.push({ label: 'Priority',  value: capitalize(task.priority) });
  if (task.assignee)  fields.push({ label: 'Assignee',  value: task.assignee });
  if (task.due)       fields.push({ label: 'Due',       value: formatDate(task.due) });
  if (task.type)      fields.push({ label: 'Type',      value: capitalize(task.type) });
  if (task.epic)      fields.push({ label: 'Epic',      value: task.epic });
  if (task.platform)  fields.push({ label: 'Platform',  value: task.platform });
  if (task.requester) fields.push({ label: 'Requester', value: task.requester });

  sidebarRows.innerHTML = fields.map(f => `
    <div class="ts-sidebar-field">
      <span class="ts-sidebar-label">${esc(f.label)}</span>
      <span class="ts-sidebar-value">${esc(f.value)}</span>
    </div>
  `).join('');

  show('tsViewer');
}

function capitalize(str) {
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}
