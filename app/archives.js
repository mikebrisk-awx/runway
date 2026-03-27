/* ========================================
   Archives View — Completed Tasks
   ======================================== */

import { BOARDS, PRIORITY_COLORS } from './data.js';
import { state } from './state.js';
import { escapeHtml, capitalize } from './utils.js';
import { openDetailPanel } from './detail-panel.js';
import { COMPANY_WORKSPACES } from './home.js';
import { downloadTaskImages } from './download-utils.js';

let filterTime = 'all';
let _sort = { col: 'completed', dir: -1 }; // most recently completed first

const TIME_FILTERS = [
  { key: 'all',        label: 'All',        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>' },
  { key: 'today',      label: 'Today',      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' },
  { key: 'this-week',  label: 'This Week',  icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
  { key: 'last-week',  label: 'Last Week',  icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 14 7 16 9 18"/><line x1="7" y1="16" x2="13" y2="16"/></svg>' },
  { key: 'this-month', label: 'This Month', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="8" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none"/></svg>' },
  { key: 'this-year',  label: 'This Year',  icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
];

function matchesTimeFilter(task) {
  if (filterTime === 'all') return true;
  const dateStr = task.column_entered_at || task.updated_at;
  if (!dateStr) return filterTime === 'all';
  const d = new Date(dateStr);
  const now = new Date();

  if (filterTime === 'today') {
    return d.toDateString() === now.toDateString();
  }
  if (filterTime === 'this-week') {
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());
    return d >= startOfWeek;
  }
  if (filterTime === 'last-week') {
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setHours(0, 0, 0, 0);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    return d >= startOfLastWeek && d < startOfThisWeek;
  }
  if (filterTime === 'this-month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (filterTime === 'this-year') {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

function getWorkspaceLabel(id) {
  return COMPANY_WORKSPACES.find(w => w.id === id)?.name || id;
}

function getWorkspaceColor(id) {
  return COMPANY_WORKSPACES.find(w => w.id === id)?.color || '#6b7280';
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low', null, undefined];

function getCompletedTasks() {
  const result = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) {
      if (!task.archived && task.column === 'done') {
        const col = board.columns.find(c => c.id === 'done');
        result.push({ ...task, boardId, _colName: col?.name || 'Done' });
      }
    }
  }
  return result;
}

function sortTasks(tasks) {
  const { col, dir } = _sort;
  return [...tasks].sort((a, b) => {
    let va, vb;
    if (col === 'title') {
      va = (a.title || '').toLowerCase();
      vb = (b.title || '').toLowerCase();
      return va < vb ? dir : va > vb ? -dir : 0;
    }
    if (col === 'workspace') {
      va = getWorkspaceLabel(a.boardId).toLowerCase();
      vb = getWorkspaceLabel(b.boardId).toLowerCase();
      return va < vb ? dir : va > vb ? -dir : 0;
    }
    if (col === 'priority') {
      va = PRIORITY_ORDER.indexOf(a.priority);
      vb = PRIORITY_ORDER.indexOf(b.priority);
      va = va === -1 ? 99 : va;
      vb = vb === -1 ? 99 : vb;
      return (va - vb) * -dir;
    }
    if (col === 'assignee') {
      va = (a.assignee || '').toLowerCase();
      vb = (b.assignee || '').toLowerCase();
      return va < vb ? dir : va > vb ? -dir : 0;
    }
    if (col === 'completed') {
      va = a.column_entered_at || a.updated_at || '';
      vb = b.column_entered_at || b.updated_at || '';
      return va < vb ? dir : va > vb ? -dir : 0;
    }
    return 0;
  });
}

// ── Topbar Nav ─────────────────────────────────

export function renderArchivesTopbarNav(navContainer, viewContainer) {
  navContainer.innerHTML = '';

  TIME_FILTERS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `view-tab${filterTime === tab.key ? ' active' : ''}`;
    btn.innerHTML = `${tab.icon} ${tab.label}`;
    btn.addEventListener('click', () => {
      filterTime = tab.key;
      renderArchivesTopbarNav(navContainer, viewContainer);
      renderArchivesView(viewContainer);
    });
    navContainer.appendChild(btn);
  });
}

// ── Main Render ────────────────────────────────

export function renderArchivesView(container) {
  container.innerHTML = '';
  container.className = 'archives-view';

  let tasks = getCompletedTasks().filter(matchesTimeFilter);

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="archives-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
          <polyline points="20 12 20 22 4 22 4 12"/>
          <rect x="2" y="7" width="20" height="5" rx="1"/>
          <line x1="12" y1="12" x2="12" y2="17"/>
        </svg>
        <p>No completed tasks yet.</p>
        <span>Tasks moved to the "Done" column will appear here.</span>
      </div>
    `;
    return;
  }

  tasks = sortTasks(tasks);

  const sortArrow = (key) => {
    if (_sort.col !== key) return '<span class="list-sort-icon">↕</span>';
    return `<span class="list-sort-icon active">${_sort.dir === 1 ? '↑' : '↓'}</span>`;
  };

  const wrap = document.createElement('div');
  wrap.className = 'view-content';
  wrap.style.maxWidth = '100%';

  const listEl = document.createElement('div');
  listEl.className = 'list-view';

  const COLS = [
    { key: 'title',     label: 'Title',     flex: 3   },
    { key: 'workspace', label: 'Workspace', flex: 1.5 },
    { key: 'priority',  label: 'Priority',  flex: 1   },
    { key: 'assignee',  label: 'Assignee',  flex: 1   },
    { key: 'completed', label: 'Completed', flex: 1   },
  ];

  listEl.innerHTML = `
    <div class="list-header">
      ${COLS.map(c => `
        <button class="list-col-title${_sort.col === c.key ? ' list-col-sorted' : ''}" data-col="${c.key}" style="flex:${c.flex}">
          ${c.label}${sortArrow(c.key)}
        </button>
      `).join('')}
      <div style="width:36px;flex-shrink:0"></div>
    </div>
    ${tasks.map(t => {
      const wsColor = getWorkspaceColor(t.boardId);
      const wsLabel = getWorkspaceLabel(t.boardId);
      const completedAt = t.column_entered_at || t.updated_at;
      const hasImages = (t.reviewImages || []).some(img => img.dataUrl || img.url);
      return `
        <div class="list-row" data-task-id="${t.id}" data-board-id="${t.boardId}">
          <span class="list-cell" style="flex:3">
            <span class="list-task-title">${escapeHtml(t.title)}</span>
          </span>
          <span class="list-cell" style="flex:1.5">
            <span class="archives-ws-dot" style="background:${wsColor}"></span>
            <span class="archives-ws-label">${escapeHtml(wsLabel)}</span>
          </span>
          <span class="list-cell" style="flex:1">
            <span class="list-priority-dot" style="background:${PRIORITY_COLORS[t.priority] || '#9ca3af'}"></span>
            ${t.priority ? capitalize(t.priority) : '—'}
          </span>
          <span class="list-cell" style="flex:1">${escapeHtml(t.assignee || '—')}</span>
          <span class="list-cell" style="flex:1">${fmtDate(completedAt)}</span>
          <span class="list-cell archives-dl-cell" style="width:36px;flex-shrink:0;justify-content:center">
            ${hasImages ? `
              <button class="archives-dl-btn" data-task-id="${t.id}" title="Download images (${t.reviewImages.filter(i => i.dataUrl || i.url).length})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            ` : ''}
          </span>
        </div>
      `;
    }).join('')}
  `;

  wrap.appendChild(listEl);
  container.appendChild(wrap);

  // Sort on header click
  listEl.querySelectorAll('.list-col-title[data-col]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.col;
      _sort = _sort.col === key ? { col: key, dir: _sort.dir * -1 } : { col: key, dir: 1 };
      renderArchivesView(container);
    });
  });

  // Download button — stop propagation so it doesn't open detail panel
  listEl.querySelectorAll('.archives-dl-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const task = tasks.find(t => t.id === btn.dataset.taskId);
      if (task) await downloadTaskImages(task, btn);
    });
  });

  // Click row → open detail panel
  listEl.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('click', () => {
      state.currentBoard = row.dataset.boardId;
      openDetailPanel(row.dataset.taskId);
    });
  });
}
