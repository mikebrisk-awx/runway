/* ========================================
   My Work View — Tasks assigned to current user
   ======================================== */

import { BOARDS, PRIORITY_COLORS } from './data.js';
import { state, saveState } from './state.js';
import { escapeHtml, getInitials } from './utils.js';
import { openDetailPanel } from './detail-panel.js';

const BUCKETS = [
  { id: 'overdue',   label: 'Past Dates',    color: '#8b4513' },
  { id: 'today',     label: 'Today',          color: '#10b981' },
  { id: 'this-week', label: 'This week',      color: '#3b82f6' },
  { id: 'next-week', label: 'Next week',      color: '#06b6d4' },
  { id: 'later',     label: 'Later',          color: '#f59e0b' },
  { id: 'no-date',   label: 'Without a date', color: '#6b7280' },
];

const DEFAULT_OPEN = new Set(['overdue', 'today', 'this-week']);

// Persistent view state
let mwView = 'list'; // list | kanban | table

const BOARD_LABELS = {
  'product-design': 'Product Design', 'business-dev': 'Business Dev',
  'ux': 'UX Research', 'flagship': 'Flagship', 'business-products': 'Biz Products',
};
const BOARD_COLORS = {
  'product-design': '#7c5cfc', 'business-dev': '#10b981', 'ux': '#f59e0b',
  'flagship': '#3b82f6', 'business-products': '#ec4899',
};

// Kanban column groupings across all boards
const KANBAN_COLS = [
  { id: 'backlog',     label: 'Backlog',     color: '#9ca3af' },
  { id: 'ready',       label: 'Ready',       color: '#3b82f6', aliases: ['discovery','planning','scoping'] },
  { id: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'review',      label: 'Review',      color: '#8b5cf6', aliases: ['analysis','stakeholder','qa'] },
  { id: 'done',        label: 'Done',        color: '#10b981' },
];

function getKanbanCol(columnId) {
  for (const kc of KANBAN_COLS) {
    if (kc.id === columnId) return kc;
    if (kc.aliases?.includes(columnId)) return kc;
  }
  return KANBAN_COLS[0];
}

function stripTime(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }

function getBucket(task) {
  if (!task.due) return 'no-date';
  const due  = stripTime(new Date(task.due));
  const now  = stripTime(new Date());
  const diff = Math.round((due - now) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return 'overdue';
  if (diff === 0) return 'today';
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const daysLeftInWeek = 7 - dayOfWeek;
  if (diff <= daysLeftInWeek) return 'this-week';
  if (diff <= daysLeftInWeek + 7) return 'next-week';
  return 'later';
}

function fmtDue(due) {
  return new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getMyTasks(userName) {
  const tasks = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) {
      if (!task.archived && task.assignee === userName) {
        tasks.push({ ...task, boardId });
      }
    }
  }
  return tasks;
}

// ── List view (buckets) ──────────────────────

function renderListView(body, myTasks) {
  const grouped = {};
  for (const b of BUCKETS) grouped[b.id] = [];
  for (const task of myTasks) grouped[getBucket(task)].push(task);

  const openBuckets = new Set(DEFAULT_OPEN);

  function render() {
    body.innerHTML = '';
    for (const bucket of BUCKETS) {
      const tasks = grouped[bucket.id];
      const isOpen = openBuckets.has(bucket.id);

      const section = document.createElement('div');
      section.className = 'mw-bucket';

      const bucketHead = document.createElement('button');
      bucketHead.className = `mw-bucket-head${isOpen ? ' open' : ''}`;
      bucketHead.innerHTML = `
        <svg class="mw-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="${isOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"/>
        </svg>
        <span class="mw-bucket-label" style="color:${bucket.color}">${bucket.label}</span>
        <span class="mw-bucket-count">${tasks.length} item${tasks.length !== 1 ? 's' : ''}</span>
      `;
      bucketHead.addEventListener('click', () => {
        if (openBuckets.has(bucket.id)) openBuckets.delete(bucket.id);
        else openBuckets.add(bucket.id);
        render();
      });
      section.appendChild(bucketHead);

      if (isOpen) {
        const list = document.createElement('div');
        list.className = 'mw-task-list';
        list.style.borderLeftColor = bucket.color;

        tasks.forEach(task => {
          const col = BOARDS[task.boardId]?.columns.find(c => c.id === task.column);
          const row = document.createElement('div');
          row.className = 'mw-task-row';
          row.innerHTML = `
            <span class="mw-task-priority" style="background:${PRIORITY_COLORS[task.priority]}"></span>
            <span class="mw-task-title">${escapeHtml(task.title)}</span>
            <span class="mw-task-board" style="color:${BOARD_COLORS[task.boardId]};background:${BOARD_COLORS[task.boardId]}18">${BOARD_LABELS[task.boardId] || task.boardId}</span>
            ${col ? `<span class="mw-task-col">${escapeHtml(col.name)}</span>` : ''}
            ${task.due ? `<span class="mw-task-due${bucket.id === 'overdue' ? ' overdue' : ''}">${fmtDue(task.due)}</span>` : ''}
            ${task.size ? `<span class="mw-task-size">${task.size}</span>` : ''}
          `;
          row.addEventListener('click', () => { state.currentBoard = task.boardId; openDetailPanel(task.id); });
          list.appendChild(row);
        });

        const addRow = document.createElement('div');
        addRow.className = 'mw-add-row';
        addRow.textContent = '+ Add task';
        list.appendChild(addRow);
        section.appendChild(list);
      }

      body.appendChild(section);
    }
  }
  render();
}

// ── Kanban view ──────────────────────────────

function renderKanbanView(body, myTasks) {
  body.className = 'mw-body mw-kanban';

  const cols = {};
  for (const kc of KANBAN_COLS) cols[kc.id] = [];
  for (const task of myTasks) {
    const kc = getKanbanCol(task.column);
    cols[kc.id].push(task);
  }

  KANBAN_COLS.forEach(kc => {
    const tasks = cols[kc.id];
    const col = document.createElement('div');
    col.className = 'mw-kanban-col';

    col.innerHTML = `
      <div class="mw-kanban-head">
        <span class="mw-kanban-dot" style="background:${kc.color}"></span>
        <span class="mw-kanban-col-name">${kc.label}</span>
        <span class="mw-kanban-count">${tasks.length}</span>
      </div>
    `;

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'mw-kanban-card';
      card.style.borderLeft = `3px solid ${PRIORITY_COLORS[task.priority]}`;
      card.innerHTML = `
        <div class="mw-kanban-card-title">${escapeHtml(task.title)}</div>
        <div class="mw-kanban-card-meta">
          <span class="mw-task-board" style="color:${BOARD_COLORS[task.boardId]};background:${BOARD_COLORS[task.boardId]}18">${BOARD_LABELS[task.boardId] || task.boardId}</span>
          ${task.due ? `<span class="mw-task-due">${fmtDue(task.due)}</span>` : ''}
          ${task.size ? `<span class="mw-task-size">${task.size}</span>` : ''}
        </div>
      `;
      card.addEventListener('click', () => { state.currentBoard = task.boardId; openDetailPanel(task.id); });
      col.appendChild(card);
    });

    body.appendChild(col);
  });
}

// ── Table view ───────────────────────────────

function renderTableView(body, myTasks) {
  body.className = 'mw-body mw-table-wrap';

  if (myTasks.length === 0) {
    body.innerHTML = `<div class="mw-empty-state">No tasks assigned to you.</div>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'tv-table';
  table.innerHTML = `
    <thead>
      <tr class="tv-head-row">
        <th class="tv-th">Name</th>
        <th class="tv-th">Board</th>
        <th class="tv-th">Status</th>
        <th class="tv-th">Due date</th>
        <th class="tv-th">Priority</th>
        <th class="tv-th tv-th-size">Size</th>
      </tr>
    </thead>
    <tbody>
      ${myTasks.map(task => {
        const col = BOARDS[task.boardId]?.columns.find(c => c.id === task.column);
        const kc = getKanbanCol(task.column);
        const dueLabel = task.due ? fmtDue(task.due) : '—';
        const isOverdue = task.due && stripTime(new Date(task.due)) < stripTime(new Date());
        return `
          <tr class="tv-row" data-task-id="${task.id}" data-board-id="${task.boardId}">
            <td class="tv-td">
              <div class="tv-name">
                <span class="tv-priority-bar" style="background:${PRIORITY_COLORS[task.priority]}"></span>
                ${escapeHtml(task.title)}
              </div>
            </td>
            <td class="tv-td">
              <span class="mw-task-board" style="color:${BOARD_COLORS[task.boardId]};background:${BOARD_COLORS[task.boardId]}18">${BOARD_LABELS[task.boardId] || task.boardId}</span>
            </td>
            <td class="tv-td">
              <span class="tv-status-badge" style="background:${kc.color}22;color:${kc.color}">${col?.name || kc.label}</span>
            </td>
            <td class="tv-td">
              <span class="tv-due${isOverdue ? ' overdue' : ''}">${dueLabel}</span>
            </td>
            <td class="tv-td">
              <span class="tv-priority-pill" style="color:${PRIORITY_COLORS[task.priority]};background:${PRIORITY_COLORS[task.priority]}18">${task.priority}</span>
            </td>
            <td class="tv-td tv-size">${task.size || '<span class="tv-dash">—</span>'}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;

  body.appendChild(table);

  body.querySelectorAll('.tv-row').forEach(row => {
    row.addEventListener('click', () => {
      state.currentBoard = row.dataset.boardId;
      openDetailPanel(row.dataset.taskId);
    });
  });
}

// ── Main render ──────────────────────────────

export function renderMyWorkView(container) {
  const userName = state.profile?.name || 'Mike Brisk';
  const initials = getInitials(userName);
  const myTasks  = getMyTasks(userName);

  container.innerHTML = '';
  container.className = 'mywork-view';

  const header = document.createElement('div');
  header.className = 'mw-header';
  header.innerHTML = `
    <div class="mw-user-row">
      <div class="mw-avatar">${initials}</div>
      <div class="mw-user-info">
        <span class="mw-user-name">${escapeHtml(userName)}</span>
        <span class="mw-user-sub">${myTasks.length} task${myTasks.length !== 1 ? 's' : ''} assigned to you</span>
      </div>
    </div>
  `;
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'mw-body';

  if (mwView === 'list')   renderListView(body, myTasks);
  else if (mwView === 'kanban') renderKanbanView(body, myTasks);
  else if (mwView === 'table')  renderTableView(body, myTasks);

  container.appendChild(body);
}

// ── Topbar nav ───────────────────────────────

export function renderMyWorkTopbarNav(navContainer, viewContainer) {
  navContainer.innerHTML = '';

  const tabs = [
    { id: 'list',   label: 'List',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>' },
    { id: 'kanban', label: 'Kanban', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
    { id: 'table',  label: 'Table',  icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>' },
  ];

  tabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `view-tab${mwView === tab.id ? ' active' : ''}`;
    btn.innerHTML = `${tab.icon} ${tab.label}`;
    btn.addEventListener('click', () => {
      mwView = tab.id;
      renderMyWorkTopbarNav(navContainer, viewContainer);
      renderMyWorkView(viewContainer);
    });
    navContainer.appendChild(btn);
  });
}
