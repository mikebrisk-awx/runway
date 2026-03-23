/* ========================================
   Context Menu
   ======================================== */

import { state, saveState, getCurrentBoard } from './state.js';
import { logBlocked, logUnblocked } from './activity.js';
import { openDetailPanel } from './detail-panel.js';
import { renderBoard } from './render.js';
import { logArchived } from './activity.js';

let contextMenuEl = null;

export function showContextMenu(e, taskId) {
  hideContextMenu();

  const board = getCurrentBoard();
  const task = board.tasks.find(t => t.id === taskId);
  if (!task) return;

  contextMenuEl = document.createElement('div');
  contextMenuEl.className = 'context-menu show';

  // View details option
  let html = `
    <button class="context-menu-item" data-action="details">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      View Details
    </button>
  `;

  // Block/unblock
  if (task.blocked) {
    html += `
      <button class="context-menu-item" data-action="unblock">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Unblock
      </button>
    `;
  } else {
    html += `
      <button class="context-menu-item" data-action="block">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        Mark as Blocked
      </button>
    `;
  }

  // Archive
  html += `
    <button class="context-menu-item" data-action="archive">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
      Archive
    </button>
  `;

  // Move to columns
  const otherCols = board.columns.filter(c => c.id !== task.column);
  html += otherCols.map(c => `
    <button class="context-menu-item" data-action="move" data-col="${c.id}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
      Move to ${c.name}
    </button>
  `).join('');

  // Delete
  html += `
    <button class="context-menu-item danger" data-action="delete">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Delete
    </button>
  `;

  contextMenuEl.innerHTML = html;
  document.body.appendChild(contextMenuEl);

  // Position
  const rect = contextMenuEl.getBoundingClientRect();
  let x = e.clientX, y = e.clientY;
  if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
  contextMenuEl.style.left = x + 'px';
  contextMenuEl.style.top = y + 'px';

  // Actions
  contextMenuEl.querySelector('[data-action="details"]').addEventListener('click', () => {
    hideContextMenu();
    openDetailPanel(taskId);
  });

  contextMenuEl.querySelectorAll('[data-action="move"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const oldCol = task.column;
      const oldColName = board.columns.find(c => c.id === oldCol)?.name || oldCol;
      const newColName = board.columns.find(c => c.id === btn.dataset.col)?.name || btn.dataset.col;

      const now = new Date().toISOString();
      if (task.column_entered_at) {
        task.column_history.push({ column: oldCol, entered_at: task.column_entered_at, exited_at: now });
      }
      task.column_entered_at = now;
      task.column = btn.dataset.col;
      task.updated_at = now;

      const { logTaskMoved } = window._kanban;
      if (logTaskMoved) logTaskMoved(task.id, oldColName, newColName);

      saveState();
      renderBoard();
      hideContextMenu();
    });
  });

  const blockBtn = contextMenuEl.querySelector('[data-action="block"]');
  if (blockBtn) {
    blockBtn.addEventListener('click', () => {
      const reason = prompt('Block reason:');
      if (reason !== null) {
        task.blocked = { reason: reason || 'No reason given', since: new Date().toISOString() };
        task.updated_at = new Date().toISOString();
        logBlocked(task.id, task.blocked.reason);
        saveState();
        renderBoard();
      }
      hideContextMenu();
    });
  }

  const unblockBtn = contextMenuEl.querySelector('[data-action="unblock"]');
  if (unblockBtn) {
    unblockBtn.addEventListener('click', () => {
      task.blocked = null;
      task.updated_at = new Date().toISOString();
      logUnblocked(task.id);
      saveState();
      renderBoard();
      hideContextMenu();
    });
  }

  contextMenuEl.querySelector('[data-action="archive"]').addEventListener('click', () => {
    task.archived = true;
    task.updated_at = new Date().toISOString();
    logArchived(task.id);
    saveState();
    renderBoard();
    hideContextMenu();
  });

  contextMenuEl.querySelector('[data-action="delete"]').addEventListener('click', () => {
    board.tasks = board.tasks.filter(t => t.id !== taskId);
    saveState();
    renderBoard();
    hideContextMenu();
  });
}

export function hideContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.remove();
    contextMenuEl = null;
  }
}

document.addEventListener('click', hideContextMenu);
