/* ========================================
   Board Rendering
   ======================================== */

import { state, saveState, getCurrentBoard, BOARDS } from './state.js';
import { PRIORITY_COLORS, PRIORITY_LABELS } from './data.js';
import { escapeHtml, capitalize, formatDate, getInitials, assigneeAvatarContent } from './utils.js';
import { setupDropZone } from './dragdrop.js';
import { showContextMenu, showColumnMenu } from './context-menu.js';
import { openDetailPanel } from './detail-panel.js';

const ALL_WS_COLS = [
  { id: 'backlog',     name: 'Backlog',     color: '#9ca3af', aliases: [] },
  { id: 'ready',       name: 'Ready',       color: '#3b82f6', aliases: ['discovery','planning','scoping'] },
  { id: 'in-progress', name: 'In Progress', color: '#f59e0b', aliases: [] },
  { id: 'review',      name: 'Review',      color: '#8b5cf6', aliases: ['analysis','stakeholder','qa'] },
  { id: 'done',        name: 'Done',        color: '#10b981', aliases: ['completed','shipped','delivered'] },
];

const BOARD_COLORS_MAP = {
  'product-design': '#7c5cfc', 'business-dev': '#10b981',
  'ux': '#f59e0b', 'flagship': '#3b82f6', 'business-products': '#ec4899',
};
const BOARD_LABELS_MAP = {
  'product-design': 'Product Design', 'business-dev': 'Business Dev',
  'ux': 'UX Research', 'flagship': 'Flagship', 'business-products': 'Biz Products',
};

function normalizeCol(colId) {
  for (const kc of ALL_WS_COLS) {
    if (kc.id === colId || kc.aliases.includes(colId)) return kc;
  }
  return ALL_WS_COLS[0];
}

function renderAllWorkspacesBoard(container) {
  container.innerHTML = '';

  // Collect all tasks grouped into normalized columns
  const cols = {};
  for (const kc of ALL_WS_COLS) cols[kc.id] = [];

  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) {
      if (task.archived) continue;
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.desc.toLowerCase().includes(q) && !task.assignee.toLowerCase().includes(q)) continue;
      }
      if (state.swimlaneFilter !== 'all' && task.priority !== state.swimlaneFilter) continue;
      const kc = normalizeCol(task.column);
      cols[kc.id].push({ ...task, boardId });
    }
  }

  for (const kc of ALL_WS_COLS) {
    const tasks = cols[kc.id];
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.columnId = kc.id;
    columnEl.innerHTML = `
      <div class="column-header">
        <div class="column-header-left">
          <div class="column-dot" style="background:${kc.color}"></div>
          <span class="column-name">${kc.name}</span>
          <span class="column-count">${tasks.length}</span>
        </div>
      </div>
      <div class="column-body" data-column-id="${kc.id}"></div>
    `;

    const body = columnEl.querySelector('.column-body');
    for (const task of tasks) {
      const prevBoard = state.currentBoard;
      state.currentBoard = task.boardId;
      const card = createTaskCard(task);
      state.currentBoard = prevBoard;

      // Inject board chip into card-tags
      const tagsEl = card.querySelector('.card-tags');
      if (tagsEl) {
        const chip = document.createElement('span');
        chip.className = 'card-tag';
        chip.style.cssText = `color:${BOARD_COLORS_MAP[task.boardId]};background:${BOARD_COLORS_MAP[task.boardId]}22;border:none`;
        chip.textContent = BOARD_LABELS_MAP[task.boardId] || task.boardId;
        tagsEl.prepend(chip);
      }

      card.addEventListener('click', () => { state.currentBoard = task.boardId; openDetailPanel(task.id); });
      body.appendChild(card);
    }

    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg><p>No tasks here</p>`;
      body.appendChild(empty);
    }
    container.appendChild(columnEl);
  }
}

export function renderBoard() {
  // ── All Workspaces mode ──
  if (state.currentBoard === 'all') {
    document.getElementById('boardTitle').textContent = 'All Workspaces';
    const breadcrumb = document.getElementById('breadcrumbBoard');
    if (breadcrumb) breadcrumb.textContent = 'All Workspaces';
    const allTasks = Object.values(BOARDS).flatMap(b => b.tasks.filter(t => !t.archived));
    const badgeEl = document.getElementById('boardBadge');
    if (badgeEl) badgeEl.textContent = `${allTasks.length} task${allTasks.length !== 1 ? 's' : ''}`;
    document.getElementById('boardContainer').style.display = 'flex';
    document.getElementById('viewContainer').style.display = 'none';
    renderAllWorkspacesBoard(document.getElementById('boardContainer'));
    return;
  }

  const board = getCurrentBoard();
  if (!board) return;

  // Update header
  document.getElementById('boardTitle').textContent = board.title;
  const breadcrumb = document.getElementById('breadcrumbBoard');
  if (breadcrumb) breadcrumb.textContent = board.title;
  const activeTasks = board.tasks.filter(t => !t.archived);
  const badgeEl = document.getElementById('boardBadge');
  if (badgeEl) badgeEl.textContent = `${activeTasks.length} task${activeTasks.length !== 1 ? 's' : ''}`;

  // Update nav
  document.querySelectorAll('.sb-icon[data-board]').forEach(item => {
    item.classList.toggle('active', item.dataset.board === state.currentBoard);
  });

  // Update view switcher
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === state.currentView);
  });

  // Show/hide views
  const boardContainer = document.getElementById('boardContainer');
  const viewContainer = document.getElementById('viewContainer');

  if (state.currentView === 'board') {
    boardContainer.style.display = 'flex';
    viewContainer.style.display = 'none';
    renderBoardView(board, boardContainer);
  } else {
    boardContainer.style.display = 'none';
    viewContainer.style.display = 'flex';
    viewContainer.classList.remove('tv-container');
    if (state.currentView === 'list') renderListView(viewContainer, board);
    else if (state.currentView === 'table') renderTableView(viewContainer, board);
    else if (state.currentView === 'custom') renderCustomView(viewContainer, board);
  }
}

function renderBoardView(board, container) {
  container.innerHTML = '';

  for (const col of board.columns) {
    let tasks = board.tasks
      .filter(t => t.column === col.id && !t.archived)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    // Apply search filter
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q)
      );
    }

    // Apply swimlane filter
    if (state.swimlaneFilter !== 'all') {
      tasks = tasks.filter(t => t.priority === state.swimlaneFilter);
    }

    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.columnId = col.id;

    const allColTasks = board.tasks.filter(t => t.column === col.id && !t.archived);
    const isOverWip = col.wipLimit > 0 && allColTasks.length > col.wipLimit;

    // Column policy tooltip
    const hasPolicy = col.policy && (col.policy.ready || col.policy.done);
    const policyIcon = hasPolicy ? `
      <button class="column-policy-btn" data-column-id="${col.id}" title="Column policy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      </button>
    ` : '';

    columnEl.innerHTML = `
      <div class="column-header">
        <div class="column-header-left">
          <div class="column-dot" style="background:${col.color}"></div>
          <span class="column-name">${col.name}</span>
          <span class="column-count">${allColTasks.length}</span>
          ${policyIcon}
        </div>
        <button class="icon-btn col-options-btn" data-column-id="${col.id}" style="width:28px;height:28px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
      </div>
      <div style="padding: 0 0 10px;">
        <button class="add-task-btn" data-column-id="${col.id}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="column-body" data-column-id="${col.id}"></div>
    `;

    const body = columnEl.querySelector('.column-body');

    if (state.showSwimlanes && state.swimlaneFilter === 'all') {
      const priorities = ['critical', 'high', 'medium', 'low'];
      for (const p of priorities) {
        const pTasks = tasks.filter(t => t.priority === p);
        if (pTasks.length === 0) continue;

        const swimHeader = document.createElement('div');
        swimHeader.className = 'swimlane-header';
        swimHeader.innerHTML = `
          <div class="swimlane-dot" style="background:${PRIORITY_COLORS[p]}"></div>
          <span class="swimlane-label">${PRIORITY_LABELS[p]}</span>
          <span class="swimlane-count">${pTasks.length}</span>
        `;
        body.appendChild(swimHeader);

        for (const task of pTasks) {
          body.appendChild(createTaskCard(task));
        }
      }
    } else {
      for (const task of tasks) {
        body.appendChild(createTaskCard(task));
      }
    }

    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
        <p>No tasks here</p>
      `;
      body.appendChild(empty);
    }

    container.appendChild(columnEl);
    setupDropZone(body);
  }

  // Render archive section if there are archived tasks
  const archivedTasks = board.tasks.filter(t => t.archived);
  if (archivedTasks.length > 0) {
    renderArchiveSection(container, archivedTasks);
  }

  // Bind add-task buttons
  container.querySelectorAll('.add-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.addTaskColumn = btn.dataset.columnId;
      const { openModal } = window._kanban;
      openModal();
    });
  });

  // Bind column options menu
  container.querySelectorAll('.col-options-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      showColumnMenu(e, btn.dataset.columnId);
    });
  });

  // Bind policy tooltips
  container.querySelectorAll('.column-policy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showPolicyTooltip(e, btn.dataset.columnId);
    });
  });
}

function renderArchiveSection(container, archivedTasks) {
  const section = document.createElement('div');
  section.className = 'archive-section';
  section.innerHTML = `
    <button class="archive-toggle" id="archiveToggle">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
      Archive <span class="archive-count">${archivedTasks.length}</span>
      <svg class="archive-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="archive-body" style="display:none;">
      ${archivedTasks.map(t => `
        <div class="archive-item" data-task-id="${t.id}">
          <div class="archive-item-left">
            <div class="card-priority-bar-mini" style="background:${PRIORITY_COLORS[t.priority]}"></div>
            <span class="archive-item-title">${escapeHtml(t.title)}</span>
            <span class="card-tag ${t.type}" style="font-size:10px">${capitalize(t.type)}</span>
          </div>
          <button class="btn-mini restore-btn" data-task-id="${t.id}">Restore</button>
        </div>
      `).join('')}
    </div>
  `;
  container.appendChild(section);

  section.querySelector('#archiveToggle').addEventListener('click', () => {
    const body = section.querySelector('.archive-body');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    section.querySelector('.archive-chevron').style.transform = isOpen ? '' : 'rotate(180deg)';
  });

  section.querySelectorAll('.restore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const board = getCurrentBoard();
      const task = board.tasks.find(t => t.id === btn.dataset.taskId);
      if (task) {
        task.archived = false;
        task.updated_at = new Date().toISOString();
        const { logUnarchived } = window._kanban;
        if (logUnarchived) logUnarchived(task.id);
        saveState();
        renderBoard();
      }
    });
  });
}

export function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card${state.compactCards ? ' compact' : ''}`;
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.tabIndex = 0;

  const initials = getInitials(task.assignee);
  const dueStr = task.due ? formatDate(task.due) : '';
  const isCritical = task.priority === 'critical';

  // Aging check
  const agingMs = state.agingThresholdDays * 24 * 60 * 60 * 1000;
  const board = getCurrentBoard();
  const colIdx = board ? board.columns.findIndex(c => c.id === task.column) : -1;
  const isFirstCol = colIdx === 0;
  const isLastCol = board ? colIdx === board.columns.length - 1 : false;
  const timeSinceEntry = task.column_entered_at ? Date.now() - new Date(task.column_entered_at).getTime() : 0;
  const isAging = !isFirstCol && !isLastCol && timeSinceEntry > agingMs;

  if (isAging) card.classList.add('aging-glow');
  if (task.blocked) card.classList.add('card-blocked');

  // Inline checklist (show first 3)
  const checkItems = (task.checklist || []).slice(0, 3);
  const checkHtml = checkItems.length > 0 ? `
    <div class="card-checklist-inline">
      ${checkItems.map(c => `
        <div class="card-check-item ${c.done ? 'done' : ''}">
          <input type="checkbox" ${c.done ? 'checked' : ''} />
          <span>${escapeHtml(c.text)}</span>
        </div>
      `).join('')}
      ${task.checklist.length > 3 ? `<span class="card-add-subtask">+ ${task.checklist.length - 3} more</span>` : ''}
    </div>
  ` : '';

  // Progress bar
  const checkTotal = task.checklist ? task.checklist.length : 0;
  const checkDone = task.checklist ? task.checklist.filter(c => c.done).length : 0;
  const progressPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : (parseInt(task.id, 36) % 60) + 20;
  const progressColor = checkTotal > 0 ? 'var(--accent)' : PRIORITY_COLORS[task.priority];

  // Comment + view counts
  const commentCount = task.comments ? task.comments.length : 0;
  const viewCount = (parseInt(task.id, 36) % 40) + 2;

  const sizeBadge = task.size ? `<span class="size-badge">${task.size}</span>` : '';

  card.innerHTML = `
    <!-- Top row: tags + date -->
    <div class="card-top-row">
      <div class="card-tags">
        <span class="card-tag ${task.type}">${capitalize(task.type)}</span>
        ${sizeBadge}
        ${task.platform ? `<span class="card-tag platform">${escapeHtml(task.platform)}</span>` : ''}
      </div>
      <span class="card-date">${dueStr || ''}</span>
    </div>

    <!-- Title -->
    <div class="card-top">
      <span class="card-title">${isCritical ? '&#x1F525; ' : ''}${escapeHtml(task.title)}</span>
      <button class="card-menu-btn" data-task-id="${task.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>

    ${task.desc && !state.compactCards ? `<div class="card-desc">${escapeHtml(task.desc)}</div>` : ''}

    <!-- Image thumbnails -->
    ${!state.compactCards && task.reviewImages?.length ? `
      <div class="card-img-strip">
        ${task.reviewImages.slice(0, 3).map(img => `
          <div class="card-img-thumb" style="background-image:url('${img.dataUrl}')"></div>
        `).join('')}
        ${task.reviewImages.length > 3 ? `<div class="card-img-more">+${task.reviewImages.length - 3}</div>` : ''}
      </div>
    ` : ''}

    <!-- Inline checklist -->
    ${!state.compactCards ? checkHtml : ''}

    <!-- Progress bar -->
    ${!state.compactCards ? `
      <div class="card-progress">
        <div class="card-progress-fill" style="width:${progressPct}%;background:${progressColor}"></div>
      </div>
    ` : ''}

    <!-- Footer: avatar stack + stats -->
    ${!state.compactCards ? `
      <div class="card-footer">
        <div class="card-avatar-stack">
          <div class="card-assignee-avatar">${assigneeAvatarContent(task.assignee, state.profile)}</div>
          ${commentCount > 0 ? `<div class="card-avatar-overflow">+${commentCount}</div>` : ''}
        </div>
        <div class="card-stats">
          <span class="card-stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${viewCount}
          </span>
          <span class="card-stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${commentCount}
          </span>
        </div>
      </div>
    ` : ''}
  `;

  // Drag events
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.drop-indicator-line').forEach(p => p.remove());
    document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));
  });

  // Context menu
  card.querySelector('.card-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showContextMenu(e, task.id);
  });

  // Open detail panel on card click
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-menu-btn')) return;
    openDetailPanel(task.id);
  });

  // Keyboard: Enter to open detail
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      openDetailPanel(task.id);
    }
  });

  return card;
}

// ── List View ──
function renderListView(container, board) {
  const tasks = board.tasks.filter(t => !t.archived).sort((a, b) => {
    const colA = board.columns.findIndex(c => c.id === a.column);
    const colB = board.columns.findIndex(c => c.id === b.column);
    return colA - colB || (a.position || 0) - (b.position || 0);
  });

  container.innerHTML = `
    <div class="view-content" style="max-width:100%">
      <div class="list-view">
        <div class="list-header">
          <span class="list-col-title" style="flex:3">Task</span>
          <span class="list-col-title" style="flex:1">Status</span>
          <span class="list-col-title" style="flex:1">Priority</span>
          <span class="list-col-title" style="flex:1">Type</span>
          <span class="list-col-title" style="flex:1">Assignee</span>
          <span class="list-col-title" style="flex:1">Requester</span>
          <span class="list-col-title" style="flex:1">Platform</span>
          <span class="list-col-title" style="flex:1">Due</span>
          <span class="list-col-title" style="flex:0.5">Size</span>
        </div>
        ${tasks.map(t => {
          const col = board.columns.find(c => c.id === t.column);
          const colName = col?.name || '';
          const colColor = col?.color || '#888';
          return `
            <div class="list-row" data-task-id="${t.id}">
              <span class="list-cell" style="flex:3">
                <span class="list-task-title">${t.priority === 'critical' ? '&#x1F525; ' : ''}${escapeHtml(t.title)}</span>
              </span>
              <span class="list-cell" style="flex:1">
                <span class="list-status-dot" style="background:${colColor}"></span>
                ${escapeHtml(colName)}
              </span>
              <span class="list-cell" style="flex:1">
                <span class="list-priority-dot" style="background:${PRIORITY_COLORS[t.priority]}"></span>
                ${capitalize(t.priority)}
              </span>
              <span class="list-cell" style="flex:1"><span class="card-tag ${t.type}" style="font-size:11px">${capitalize(t.type)}</span></span>
              <span class="list-cell" style="flex:1">${escapeHtml(t.assignee)}</span>
              <span class="list-cell" style="flex:1">${t.requester ? escapeHtml(t.requester) : '—'}</span>
              <span class="list-cell" style="flex:1">${t.platform ? `<span class="card-tag platform" style="font-size:11px">${escapeHtml(t.platform)}</span>` : '—'}</span>
              <span class="list-cell" style="flex:1">${t.due ? formatDate(t.due) : '—'}</span>
              <span class="list-cell" style="flex:0.5">${t.size || '—'}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.list-row').forEach(row => {
    row.addEventListener('click', () => openDetailPanel(row.dataset.taskId));
  });
}

// ── Table View ──
function renderTableView(container, board) {
  const now = new Date();

  function statusBadge(task, col) {
    if (task.blocked) return { label: 'Blocked', bg: '#ef4444', text: '#fff' };
    const id = col?.id || '';
    if (id === 'done') return { label: col.name, bg: '#10b981', text: '#fff' };
    if (id === 'backlog') return { label: col.name, bg: 'var(--bg-hover)', text: 'var(--text-secondary)' };
    if (id === 'in-progress') return { label: col.name, bg: '#f59e0b', text: '#fff' };
    return { label: col?.name || '—', bg: col?.color + '22' || 'var(--bg-hover)', text: col?.color || 'var(--text-secondary)' };
  }

  function dueDateCell(due) {
    if (!due) return '<span class="tv-dash">—</span>';
    const d = new Date(due);
    const overdue = d < now;
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (overdue) {
      return `<span class="tv-due overdue"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${label}</span>`;
    }
    return `<span class="tv-due">${label}</span>`;
  }

  function ownerCell(assignee) {
    if (!assignee) return '<span class="tv-dash">—</span>';
    const ini = getInitials(assignee);
    // Simple color hash
    const colors = ['#7c5cfc','#10b981','#f59e0b','#3b82f6','#ec4899','#ef4444'];
    let h = 0; for (let i = 0; i < assignee.length; i++) h = assignee.charCodeAt(i) + ((h << 5) - h);
    const bg = colors[Math.abs(h) % colors.length];
    return `<span class="tv-avatar" style="background:${bg}" title="${escapeHtml(assignee)}">${assigneeAvatarContent(assignee, state.profile)}</span>`;
  }

  container.classList.add('tv-container');
  const wrap = document.createElement('div');
  wrap.className = 'tv-wrap';

  board.columns.forEach(col => {
    const tasks = board.tasks.filter(t => !t.archived && t.column === col.id);

    const section = document.createElement('div');
    section.className = 'tv-section';
    section.style.setProperty('--col-color', col.color);

    const table = document.createElement('table');
    table.className = 'tv-table';
    table.innerHTML = `
      <thead>
        <tr class="tv-head-row">
          <th class="tv-th tv-th-name">Name</th>
          <th class="tv-th tv-th-owner">Owner</th>
          <th class="tv-th tv-th-status">Status</th>
          <th class="tv-th tv-th-due">Due date</th>
          <th class="tv-th tv-th-priority">Priority</th>
          <th class="tv-th tv-th-size">Size</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(t => {
          const sb = statusBadge(t, col);
          const checkDone = (t.checklist || []).filter(c => c.done).length;
          const checkTotal = (t.checklist || []).length;
          return `
            <tr class="tv-row" data-task-id="${t.id}">
              <td class="tv-td">
                <div class="tv-name">
                  <span class="tv-priority-bar" style="background:${PRIORITY_COLORS[t.priority]}"></span>
                  ${escapeHtml(t.title)}
                  ${checkTotal > 0 ? `<span class="tv-checklist-badge">${checkDone}/${checkTotal}</span>` : ''}
                </div>
              </td>
              <td class="tv-td">${ownerCell(t.assignee)}</td>
              <td class="tv-td tv-status">
                <span class="tv-status-badge" style="background:${sb.bg};color:${sb.text}">${sb.label}</span>
              </td>
              <td class="tv-td tv-due-cell">${dueDateCell(t.due)}</td>
              <td class="tv-td">
                <span class="tv-priority-pill" style="color:${PRIORITY_COLORS[t.priority]};background:${PRIORITY_COLORS[t.priority]}18">
                  ${capitalize(t.priority)}
                </span>
              </td>
              <td class="tv-td tv-size">${t.size || '<span class="tv-dash">—</span>'}</td>
            </tr>
          `;
        }).join('')}
        <tr class="tv-add-row">
          <td colspan="6" class="tv-add-cell">+ Add item</td>
        </tr>
      </tbody>
    `;

    section.appendChild(table);
    wrap.appendChild(section);
  });

  container.innerHTML = '';
  container.appendChild(wrap);

  container.querySelectorAll('.tv-row').forEach(row => {
    row.addEventListener('click', () => openDetailPanel(row.dataset.taskId));
  });
}

// ── Custom View (Capacity + Digest combined) ──
function renderCustomView(container, board) {
  // Import from views.js dynamically
  import('./views.js').then(({ renderCapacityView, renderDigestView }) => {
    container.innerHTML = `
      <div class="view-content">
        <div class="custom-view-grid">
          <div id="customCapacity"></div>
          <div id="customDigest"></div>
        </div>
      </div>
    `;
    renderCapacityView(document.getElementById('customCapacity'));
    renderDigestView(document.getElementById('customDigest'));
  });
}

// ── Column Policy Tooltip ──
let policyTooltipEl = null;

function showPolicyTooltip(e, columnId) {
  hidePolicyTooltip();
  const board = getCurrentBoard();
  const col = board.columns.find(c => c.id === columnId);
  if (!col || !col.policy) return;

  policyTooltipEl = document.createElement('div');
  policyTooltipEl.className = 'policy-tooltip';

  let content = '';
  if (col.policy.ready) {
    content += `<div class="policy-section"><strong>Definition of Ready</strong><p>${escapeHtml(col.policy.ready)}</p></div>`;
  }
  if (col.policy.done) {
    content += `<div class="policy-section"><strong>Definition of Done</strong><p>${escapeHtml(col.policy.done)}</p></div>`;
  }

  policyTooltipEl.innerHTML = content;
  document.body.appendChild(policyTooltipEl);

  const rect = e.target.getBoundingClientRect();
  let x = rect.left;
  let y = rect.bottom + 8;
  const ttRect = policyTooltipEl.getBoundingClientRect();
  if (x + ttRect.width > window.innerWidth) x = window.innerWidth - ttRect.width - 8;
  policyTooltipEl.style.left = x + 'px';
  policyTooltipEl.style.top = y + 'px';

  setTimeout(() => {
    document.addEventListener('click', hidePolicyTooltip, { once: true });
  }, 10);
}

function hidePolicyTooltip() {
  if (policyTooltipEl) {
    policyTooltipEl.remove();
    policyTooltipEl = null;
  }
}
