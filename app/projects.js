/* ========================================
   Projects View — Cross-board Epics
   ======================================== */

import { BOARDS, EPICS } from './data.js';
import { state, saveState } from './state.js';
import { escapeHtml, getInitials, assigneeAvatarContent } from './utils.js';

const HEALTH_CONFIG = {
  'on-track':  { label: 'On Track',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'at-risk':   { label: 'At Risk',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'blocked':   { label: 'Blocked',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  'completed': { label: 'Completed', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
};

const WORKSPACE_LABELS = {
  'product-design':   'Product Design',
  'business-dev':     'Business Dev',
  'ux':               'UX Research',
  'flagship':         'Flagship',
  'business-products':'Biz Products',
};

let filterHealth    = 'all';
let filterWorkspace = 'all';
let _container      = null; // reference for re-renders from modal

// ── Helpers ──────────────────────────────────

function getEpicTasks(epic) {
  const result = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) {
      if (!task.archived && (epic.taskIds.includes(task.id) || task.epicId === epic.id)) {
        result.push({ ...task, boardId, boardTitle: board.title });
      }
    }
  }
  return result;
}

function calcAutoHealth(tasks) {
  if (tasks.length === 0) return 'at-risk';
  if (tasks.some(t => t.blocked)) return 'blocked';
  const done = tasks.filter(t => t.column === 'done').length;
  const pct  = done / tasks.length;
  if (pct >= 1)   return 'completed';
  if (pct >= 0.5) return 'on-track';
  return 'at-risk';
}

function getEffectiveHealth(epic, tasks) {
  return epic.healthManual || calcAutoHealth(tasks);
}

function calcProgress(tasks) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter(t => t.column === 'done').length / tasks.length) * 100);
}

function calcTimelinePct(startDate, endDate) {
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  const now   = Date.now();
  if (now <= start) return 0;
  if (now >= end)   return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Epic Detail Modal ─────────────────────────

function openEpicModal(epicId) {
  const epicDef = EPICS.find(e => e.id === epicId);
  if (!epicDef) return;

  const tasks    = getEpicTasks(epicDef);
  const health   = getEffectiveHealth(epicDef, tasks);
  const hConfig  = HEALTH_CONFIG[health];
  const progress = calcProgress(tasks);
  const timelinePct  = calcTimelinePct(epicDef.startDate, epicDef.endDate);
  const doneCount    = tasks.filter(t => t.column === 'done').length;
  const activeCount  = tasks.filter(t => t.column !== 'done' && t.column !== 'backlog').length;
  const blockedCount = tasks.filter(t => t.blocked).length;
  const initials     = getInitials(epicDef.owner);

  // Group tasks by workspace
  const byWorkspace = {};
  for (const t of tasks) {
    if (!byWorkspace[t.boardId]) byWorkspace[t.boardId] = [];
    byWorkspace[t.boardId].push(t);
  }

  // Remove existing modal if any
  document.getElementById('epicModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'epicModal';
  overlay.className = 'epic-modal-overlay';

  overlay.innerHTML = `
    <div class="epic-modal">
      <!-- Modal header -->
      <div class="epic-modal-header" style="border-top: 3px solid ${hConfig.color}">
        <div class="epic-modal-title-row">
          <h2 class="epic-modal-title">${escapeHtml(epicDef.title)}</h2>
          <button class="epic-modal-close" id="epicModalClose">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="epic-modal-meta">
          <span class="epic-health-badge" style="color:${hConfig.color};background:${hConfig.bg}">
            ${hConfig.label}${epicDef.healthManual ? '' : ' <span class="epic-auto-tag">auto</span>'}
          </span>
          <div class="epic-owner">
            <div class="epic-owner-avatar">${assigneeAvatarContent(epicDef.owner, state.profile)}</div>
            <span class="epic-owner-name">${escapeHtml(epicDef.owner)}</span>
          </div>
          <div class="epic-workspaces">
            ${epicDef.workspaces.map(ws => `<span class="epic-ws-chip">${WORKSPACE_LABELS[ws] || ws}</span>`).join('')}
          </div>
        </div>
      </div>

      <!-- Modal body -->
      <div class="epic-modal-body">

        <!-- Description -->
        <p class="epic-modal-desc">${escapeHtml(epicDef.description)}</p>

        <!-- Stats row -->
        <div class="epic-modal-stats">
          <div class="epic-modal-stat">
            <span class="epic-modal-stat-value">${tasks.length}</span>
            <span class="epic-modal-stat-label">Total tasks</span>
          </div>
          <div class="epic-modal-stat">
            <span class="epic-modal-stat-value" style="color:#10b981">${doneCount}</span>
            <span class="epic-modal-stat-label">Done</span>
          </div>
          <div class="epic-modal-stat">
            <span class="epic-modal-stat-value" style="color:#f59e0b">${activeCount}</span>
            <span class="epic-modal-stat-label">Active</span>
          </div>
          ${blockedCount > 0 ? `
            <div class="epic-modal-stat">
              <span class="epic-modal-stat-value" style="color:#ef4444">${blockedCount}</span>
              <span class="epic-modal-stat-label">Blocked</span>
            </div>
          ` : ''}
          <div class="epic-modal-stat">
            <span class="epic-modal-stat-value">${progress}%</span>
            <span class="epic-modal-stat-label">Complete</span>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="epic-modal-progress">
          <div class="epic-progress-bar">
            <div class="epic-progress-fill" style="width:${progress}%;background:${hConfig.color}"></div>
          </div>
        </div>

        <!-- Timeline -->
        <div class="epic-modal-timeline">
          <span class="epic-section-label">Timeline</span>
          <div class="epic-modal-timeline-row">
            <span class="epic-date">${fmtDate(epicDef.startDate)}</span>
            <div class="epic-timeline-track" style="flex:1">
              <div class="epic-timeline-fill" style="width:${timelinePct}%"></div>
            </div>
            <span class="epic-date">${fmtDate(epicDef.endDate)}</span>
          </div>
        </div>

        <div class="epic-modal-divider"></div>

        <!-- Health override -->
        <div class="epic-health-override">
          <span class="epic-section-label">Health Status</span>
          <div class="health-override-options">
            <button class="health-opt${!epicDef.healthManual ? ' active' : ''}" data-health="">Auto</button>
            ${Object.entries(HEALTH_CONFIG).map(([key, cfg]) => `
              <button class="health-opt${epicDef.healthManual === key ? ' active' : ''}"
                data-health="${key}"
                style="${epicDef.healthManual === key ? `color:${cfg.color};border-color:${cfg.color};background:${cfg.bg}` : ''}">
                ${cfg.label}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="epic-modal-divider"></div>

        <!-- Tasks by workspace -->
        <div class="epic-task-breakdown">
          <span class="epic-section-label">Tasks by Workspace</span>
          ${Object.entries(byWorkspace).map(([boardId, bTasks]) => `
            <div class="epic-ws-group">
              <div class="epic-ws-group-header">
                <span class="epic-ws-group-name">${WORKSPACE_LABELS[boardId] || boardId}</span>
                <span class="epic-ws-group-count">${bTasks.length}</span>
                <button class="epic-open-board-btn" data-board="${boardId}">
                  Open board
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                  </svg>
                </button>
              </div>
              <div class="epic-ws-tasks">
                ${bTasks.map(t => {
                  const col = BOARDS[t.boardId]?.columns.find(c => c.id === t.column);
                  return `
                    <div class="epic-task-row">
                      <div class="epic-task-status-dot" style="background:${col?.color || '#888'}"></div>
                      <span class="epic-task-name">${escapeHtml(t.title)}</span>
                      <span class="epic-task-col">${col?.name || ''}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on overlay click or X button
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeEpicModal();
  });
  overlay.querySelector('#epicModalClose').addEventListener('click', closeEpicModal);

  // Escape key
  const onKey = e => { if (e.key === 'Escape') closeEpicModal(); };
  document.addEventListener('keydown', onKey);
  overlay._onKey = onKey;

  // Health override
  overlay.querySelectorAll('.health-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      epicDef.healthManual = btn.dataset.health || null;
      closeEpicModal();
      openEpicModal(epicId); // re-open with updated state
      if (_container) renderProjectsView(_container); // refresh cards
    });
  });

  // Open board buttons
  overlay.querySelectorAll('.epic-open-board-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeEpicModal();
      const wsItem = document.querySelector(`.workspace-item[data-board="${btn.dataset.board}"]`);
      if (wsItem) wsItem.click();
    });
  });

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('visible'));
}

function closeEpicModal() {
  const overlay = document.getElementById('epicModal');
  if (!overlay) return;
  if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey);
  overlay.classList.remove('visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

export function setWorkspaceFilter(ws, container) {
  filterWorkspace = ws;
  if (container) renderProjectsView(container);
}

// ── Topbar Nav (swaps in for view-switcher) ──

export function renderProjectsTopbarNav(navContainer, viewContainer) {
  navContainer.innerHTML = '';

  const filters = [
    { key: 'all',       label: 'All',       icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
    { key: 'on-track',  label: 'On Track',  icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' },
    { key: 'at-risk',   label: 'At Risk',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    { key: 'blocked',   label: 'Blocked',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' },
    { key: 'completed', label: 'Completed', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
  ];

  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `view-tab${filterHealth === f.key ? ' active' : ''}`;
    btn.innerHTML = `${f.icon} ${f.label}`;
    btn.addEventListener('click', () => {
      filterHealth = f.key;
      renderProjectsTopbarNav(navContainer, viewContainer);
      renderProjectsView(viewContainer);
    });
    navContainer.appendChild(btn);
  });

  // New Epic button
  const sep2 = document.createElement('div');
  sep2.style.cssText = 'width:1px;height:18px;background:var(--bg-hover);margin:0 6px;align-self:center;flex-shrink:0';
  navContainer.appendChild(sep2);

  const newEpicBtn = document.createElement('button');
  newEpicBtn.className = 'view-tab new-epic-btn';
  newEpicBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    New Epic
  `;
  newEpicBtn.addEventListener('click', () => openNewEpicModal(viewContainer));
  navContainer.appendChild(newEpicBtn);
}

// ── New Epic Modal ────────────────────────────

function openNewEpicModal(viewContainer) {
  document.getElementById('newEpicModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'newEpicModal';
  overlay.className = 'epic-modal-overlay';

  overlay.innerHTML = `
    <div class="epic-modal" style="max-width:480px">
      <div class="epic-modal-header" style="border-top:3px solid var(--accent)">
        <div class="epic-modal-title-row">
          <h2 class="epic-modal-title">New Epic</h2>
          <button class="epic-modal-close" id="closeNewEpicModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="epic-modal-body">
        <div class="modal-field">
          <label>Title <span style="color:var(--priority-critical)">*</span></label>
          <input type="text" id="epicTitle" placeholder="Epic name..." />
        </div>
        <div class="modal-field">
          <label>Description</label>
          <textarea id="epicDesc" rows="3" placeholder="What is this epic about?"></textarea>
        </div>
        <div class="modal-row">
          <div class="modal-field">
            <label>Owner</label>
            <input type="text" id="epicOwner" placeholder="Name..." />
          </div>
          <div class="modal-field">
            <label>Health</label>
            <select id="epicHealth">
              <option value="">Auto</option>
              <option value="on-track">On Track</option>
              <option value="at-risk">At Risk</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div class="modal-row">
          <div class="modal-field">
            <label>Start Date</label>
            <input type="date" id="epicStart" />
          </div>
          <div class="modal-field">
            <label>End Date</label>
            <input type="date" id="epicEnd" />
          </div>
        </div>
        <div class="modal-field">
          <label>Workspaces</label>
          <div class="epic-ws-checkboxes">
            ${Object.entries(WORKSPACE_LABELS).map(([id, label]) => `
              <label class="epic-ws-check-label">
                <input type="checkbox" value="${id}" class="epic-ws-checkbox" />
                ${label}
              </label>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancelNewEpic">Cancel</button>
        <button class="btn btn-primary" id="saveNewEpic">Create Epic</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#closeNewEpicModal').addEventListener('click', close);
  overlay.querySelector('#cancelNewEpic').addEventListener('click', close);

  overlay.querySelector('#saveNewEpic').addEventListener('click', () => {
    const title = overlay.querySelector('#epicTitle').value.trim();
    if (!title) { overlay.querySelector('#epicTitle').focus(); return; }

    const workspaces = [...overlay.querySelectorAll('.epic-ws-checkbox:checked')].map(cb => cb.value);
    const today = new Date().toISOString().split('T')[0];

    EPICS.push({
      id: `ep${Date.now()}`,
      title,
      description: overlay.querySelector('#epicDesc').value.trim(),
      owner: overlay.querySelector('#epicOwner').value.trim() || 'Unassigned',
      workspaces: workspaces.length ? workspaces : [],
      startDate: overlay.querySelector('#epicStart').value || today,
      endDate: overlay.querySelector('#epicEnd').value || today,
      healthManual: overlay.querySelector('#epicHealth').value || null,
      taskIds: [],
    });

    close();
    if (viewContainer) renderProjectsView(viewContainer);
  });

  // Enter submits
  overlay.querySelector('#epicTitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('#saveNewEpic').click();
  });

  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey, { once: true });

  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    overlay.querySelector('#epicTitle').focus();
  });
}

// ── Overview Stats ────────────────────────────

const WORKSPACE_ORDER_OV = ['product-design', 'business-dev', 'ux', 'flagship', 'business-products'];
const WORKSPACE_COLORS_OV = {
  'product-design': '#7c5cfc', 'business-dev': '#10b981', 'ux': '#f59e0b',
  'flagship': '#3b82f6', 'business-products': '#ec4899',
};
const WORKSPACE_SHORT = {
  'product-design': 'Design', 'business-dev': 'Biz Dev', 'ux': 'UX',
  'flagship': 'Flagship', 'business-products': 'Biz Prod',
};

function buildSVGPie(data, size = 120, innerR = 38) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return `<svg width="${size}" height="${size}"></svg>`;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  let angle = -Math.PI / 2;
  const paths = [];
  data.forEach(d => {
    if (d.value === 0) return;
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    paths.push(`<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${d.color}"/>`);
  });
  paths.push(`<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="var(--bg-card)"/>`);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths.join('')}</svg>`;
}

function buildProjectOverview() {
  const allTasks = [];
  for (const board of Object.values(BOARDS)) {
    for (const t of board.tasks) { if (!t.archived) allTasks.push(t); }
  }
  const total      = allTasks.length;
  const done       = allTasks.filter(t => t.column === 'done').length;
  const inProgress = allTasks.filter(t => t.column !== 'done' && t.column !== 'backlog').length;
  const blocked    = allTasks.filter(t => t.blocked).length;
  const backlog    = allTasks.filter(t => t.column === 'backlog').length;

  const pieData = [
    { label: 'Done',        value: done,       color: '#10b981' },
    { label: 'In Progress', value: inProgress,  color: '#f59e0b' },
    { label: 'Blocked',     value: blocked,     color: '#ef4444' },
    { label: 'Backlog',     value: backlog,     color: '#6b7280' },
  ];

  const wsTasks = WORKSPACE_ORDER_OV.map(id => ({
    id, label: WORKSPACE_SHORT[id],
    count: (BOARDS[id]?.tasks || []).filter(t => !t.archived).length,
    color: WORKSPACE_COLORS_OV[id],
  }));
  const maxWs = Math.max(...wsTasks.map(w => w.count), 1);

  const pie = buildSVGPie(pieData, 130, 40);

  const el = document.createElement('div');
  el.className = 'proj-overview';
  el.innerHTML = `
    <div class="proj-overview-stats">
      <div class="proj-stat-card">
        <div class="proj-stat-label">All Tasks</div>
        <div class="proj-stat-num">${total}</div>
      </div>
      <div class="proj-stat-card">
        <div class="proj-stat-label"><span class="proj-stat-dot" style="background:#10b981"></span>Done</div>
        <div class="proj-stat-num">${done}</div>
      </div>
      <div class="proj-stat-card">
        <div class="proj-stat-label"><span class="proj-stat-dot" style="background:#f59e0b"></span>In Progress</div>
        <div class="proj-stat-num">${inProgress}</div>
      </div>
      <div class="proj-stat-card">
        <div class="proj-stat-label"><span class="proj-stat-dot" style="background:#ef4444"></span>Blocked</div>
        <div class="proj-stat-num">${blocked}</div>
      </div>
    </div>
    <div class="proj-overview-charts">
      <div class="proj-chart-card">
        <div class="proj-chart-title">Tasks by status</div>
        <div class="proj-chart-pie-wrap">
          ${pie}
          <div class="proj-pie-legend">
            ${pieData.filter(d => d.value > 0).map(d => `
              <div class="proj-legend-row">
                <span class="proj-legend-dot" style="background:${d.color}"></span>
                <span class="proj-legend-label">${d.label}</span>
                <span class="proj-legend-val">${d.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="proj-chart-card">
        <div class="proj-chart-title">Tasks by workspace</div>
        <div class="proj-chart-bars">
          ${wsTasks.map(w => `
            <div class="proj-bar-col">
              <div class="proj-bar-track">
                <div class="proj-bar-fill" style="height:${Math.round((w.count / maxWs) * 100)}%;background:${w.color}22;border-top:3px solid ${w.color}"></div>
              </div>
              <span class="proj-bar-count">${w.count}</span>
              <span class="proj-bar-label" style="color:${w.color}">${w.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  return el;
}

// ── Main Render ──────────────────────────────

export function renderProjectsView(container) {
  _container = container;

  let epics = EPICS.map(epic => {
    const tasks  = getEpicTasks(epic);
    const health = getEffectiveHealth(epic, tasks);
    return { ...epic, _tasks: tasks, _health: health };
  });

  if (filterHealth !== 'all')    epics = epics.filter(e => e._health === filterHealth);
  if (filterWorkspace !== 'all') epics = epics.filter(e => e.workspaces.includes(filterWorkspace));

  container.innerHTML = '';
  container.className = 'projects-view';

  // ── Overview (All tab only) ───────────────
  if (filterHealth === 'all') {
    container.appendChild(buildProjectOverview());
  }

  // ── Grid ─────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'projects-grid';
  container.appendChild(grid);

  if (epics.length === 0) {
    grid.innerHTML = `<div class="projects-empty">No epics match these filters.</div>`;
    return;
  }

  for (const epic of epics) {
    const hConfig     = HEALTH_CONFIG[epic._health];
    const progress    = calcProgress(epic._tasks);
    const timelinePct = calcTimelinePct(epic.startDate, epic.endDate);
    const doneCount   = epic._tasks.filter(t => t.column === 'done').length;
    const activeCount = epic._tasks.filter(t => t.column !== 'done' && t.column !== 'backlog').length;
    const initials    = getInitials(epic.owner);

    const card = document.createElement('div');
    card.className = 'epic-card';
    card.dataset.epicId = epic.id;
    card.title = 'Click to view details';

    card.innerHTML = `
      <div class="epic-card-inner">
        <div class="epic-header-row">
          <span class="epic-title">${escapeHtml(epic.title)}</span>
          <span class="epic-health-badge" style="color:${hConfig.color};background:${hConfig.bg}">
            ${hConfig.label}${epic.healthManual ? '' : ' <span class="epic-auto-tag">auto</span>'}
          </span>
        </div>

        <p class="epic-desc">${escapeHtml(epic.description)}</p>

        <div class="epic-workspaces">
          ${epic.workspaces.map(ws => `<span class="epic-ws-chip">${WORKSPACE_LABELS[ws] || ws}</span>`).join('')}
        </div>

        <div class="epic-progress-row">
          <div class="epic-progress-bar">
            <div class="epic-progress-fill" style="width:${progress}%;background:${hConfig.color}"></div>
          </div>
          <span class="epic-progress-label">${progress}%</span>
        </div>

        <div class="epic-stats">
          <span class="epic-stat-item">
            <span class="epic-stat-dot" style="background:#8b8a94"></span>
            ${epic._tasks.length} task${epic._tasks.length !== 1 ? 's' : ''}
          </span>
          <span class="epic-stat-item">
            <span class="epic-stat-dot" style="background:#10b981"></span>
            ${doneCount} done
          </span>
          <span class="epic-stat-item">
            <span class="epic-stat-dot" style="background:#f59e0b"></span>
            ${activeCount} active
          </span>
        </div>

        <div class="epic-footer">
          <div class="epic-owner">
            <div class="epic-owner-avatar">${assigneeAvatarContent(epic.owner, state.profile)}</div>
            <span class="epic-owner-name">${escapeHtml(epic.owner)}</span>
          </div>
          <div class="epic-timeline-mini">
            <span class="epic-date">${fmtDateShort(epic.startDate)}</span>
            <div class="epic-timeline-track">
              <div class="epic-timeline-fill" style="width:${timelinePct}%"></div>
            </div>
            <span class="epic-date">${fmtDateShort(epic.endDate)}</span>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);

    card.addEventListener('click', () => openEpicModal(epic.id));
  }
}
