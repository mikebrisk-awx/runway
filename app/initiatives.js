/* ========================================
   Initiatives View — Programs that group Epics
   ======================================== */

import { BOARDS, EPICS, INITIATIVES } from './data.js';
import { state, saveState } from './state.js';
import { escapeHtml, getInitials } from './utils.js';

const STATUS_CONFIG = {
  'active':    { label: 'Active',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'on-hold':   { label: 'On Hold',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'completed': { label: 'Completed',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

const EPIC_HEALTH_COLORS = {
  'on-track':  '#10b981',
  'at-risk':   '#f59e0b',
  'blocked':   '#ef4444',
  'completed': '#6366f1',
};

let _container = null;

// ── Helpers ──────────────────────────────────

function getInitiativeEpics(initiative) {
  return EPICS.filter(e => e.initiativeId === initiative.id);
}


function getEpicTasksGlobal(epic) {
  const result = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    if (!epic.workspaces?.length || epic.workspaces.includes(boardId)) {
      for (const task of board.tasks) {
        if (task.epicId === epic.id && !task.archived) result.push(task);
      }
    }
  }
  return result;
}

function calcProgress(epicTaskCounts) {
  if (!epicTaskCounts.total) return 0;
  return Math.round((epicTaskCounts.done / epicTaskCounts.total) * 100);
}

function getEpicCounts(epic) {
  const tasks = getEpicTasksGlobal(epic);
  return {
    total: tasks.length,
    done: tasks.filter(t => t.column === 'done').length,
  };
}

function totalProgressForInitiative(epics) {
  let total = 0, done = 0;
  for (const e of epics) {
    const c = getEpicCounts(e);
    total += c.total;
    done  += c.done;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── New Initiative Modal ──────────────────────

function openNewInitiativeModal() {
  document.getElementById('newInitiativeModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'newInitiativeModal';
  overlay.className = 'epic-modal-overlay';

  const today = new Date().toISOString().split('T')[0];

  overlay.innerHTML = `
    <div class="epic-modal initiative-modal">
      <div class="epic-modal-header" style="border-top:3px solid var(--accent)">
        <div class="epic-modal-title-row">
          <h2 class="epic-modal-title">New Initiative</h2>
          <button class="epic-modal-close" id="closeNewInitiativeModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="epic-modal-body">
        <div class="modal-field">
          <label>Title <span style="color:var(--priority-critical)">*</span></label>
          <input type="text" id="initTitle" placeholder="Initiative name..." />
        </div>
        <div class="modal-field">
          <label>Description</label>
          <textarea id="initDesc" rows="3" placeholder="What is this initiative about?"></textarea>
        </div>
        <div class="modal-row">
          <div class="modal-field">
            <label>Owner</label>
            <input type="text" id="initOwner" placeholder="Name..." />
          </div>
          <div class="modal-field">
            <label>Status</label>
            <select id="initStatus">
              <option value="active">Active</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div class="modal-row">
          <div class="modal-field">
            <label>Start Date</label>
            <input type="date" id="initStart" value="${today}" />
          </div>
          <div class="modal-field">
            <label>End Date</label>
            <input type="date" id="initEnd" value="${today}" />
          </div>
        </div>
        <div class="modal-field">
          <label>Color</label>
          <div class="initiative-color-picker" id="initColorPicker">
            ${['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'].map(c => `
              <button type="button" class="init-color-swatch${c === '#6366f1' ? ' selected' : ''}" data-color="${c}" style="background:${c}"></button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancelNewInitiative">Cancel</button>
        <button class="btn btn-primary" id="saveNewInitiative">Create Initiative</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let selectedColor = '#6366f1';

  overlay.querySelectorAll('.init-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      overlay.querySelectorAll('.init-color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedColor = swatch.dataset.color;
    });
  });

  const close = () => {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#closeNewInitiativeModal').addEventListener('click', close);
  overlay.querySelector('#cancelNewInitiative').addEventListener('click', close);

  overlay.querySelector('#saveNewInitiative').addEventListener('click', () => {
    const title = overlay.querySelector('#initTitle').value.trim();
    if (!title) { overlay.querySelector('#initTitle').focus(); return; }

    INITIATIVES.push({
      id: `init_${Date.now()}`,
      title,
      description: overlay.querySelector('#initDesc').value.trim(),
      owner: overlay.querySelector('#initOwner').value.trim() || 'Unassigned',
      status: overlay.querySelector('#initStatus').value || 'active',
      startDate: overlay.querySelector('#initStart').value || today,
      endDate:   overlay.querySelector('#initEnd').value   || today,
      color: selectedColor,
    });

    saveState();
    close();
    if (_container) renderInitiativesView(_container);
  });

  overlay.querySelector('#initTitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('#saveNewInitiative').click();
  });

  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey, { once: true });

  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    overlay.querySelector('#initTitle').focus();
  });
}

// ── Topbar Nav ────────────────────────────────

export function renderInitiativesTopbarNav(navContainer) {
  navContainer.innerHTML = '';
  navContainer.style.display = 'flex';
  navContainer.style.alignItems = 'center';
  navContainer.style.gap = '8px';

  const newBtn = document.createElement('button');
  newBtn.className = 'view-tab new-epic-btn';
  newBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    New Initiative
  `;
  newBtn.addEventListener('click', openNewInitiativeModal);
  navContainer.appendChild(newBtn);
}

// ── Main Render ──────────────────────────────

export function renderInitiativesView(container) {
  _container = container;
  container.innerHTML = '';
  container.className = 'initiatives-view';

  if (INITIATIVES.length === 0) {
    container.innerHTML = `
      <div class="initiatives-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        <p>No initiatives yet.</p>
        <button class="btn btn-primary" id="emptyNewInitiativeBtn">Create your first initiative</button>
      </div>
    `;
    container.querySelector('#emptyNewInitiativeBtn')?.addEventListener('click', openNewInitiativeModal);
    return;
  }

  for (const initiative of INITIATIVES) {
    const epics    = getInitiativeEpics(initiative);
    const progress = totalProgressForInitiative(epics);
    const sConfig  = STATUS_CONFIG[initiative.status] || STATUS_CONFIG['active'];
    const initials = getInitials(initiative.owner || '?');
    const color    = initiative.color || '#6366f1';

    const card = document.createElement('div');
    card.className = 'initiative-card';
    card.dataset.initiativeId = initiative.id;

    card.innerHTML = `
      <div class="initiative-card-accent" style="background:${color}"></div>
      <div class="initiative-card-inner">
        <div class="initiative-header-row">
          <div class="initiative-title-group">
            <span class="initiative-title">${escapeHtml(initiative.title)}</span>
            <span class="initiative-status-badge" style="color:${sConfig.color};background:${sConfig.bg}">${sConfig.label}</span>
          </div>
          <div class="initiative-actions">
            <button class="initiative-delete-btn" data-id="${initiative.id}" title="Delete initiative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          </div>
        </div>

        ${initiative.description ? `<p class="initiative-desc">${escapeHtml(initiative.description)}</p>` : ''}

        <div class="initiative-meta-row">
          <div class="initiative-owner">
            <div class="initiative-avatar">${initials}</div>
            <span>${escapeHtml(initiative.owner || 'Unassigned')}</span>
          </div>
          <div class="initiative-dates">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${formatDate(initiative.startDate)} → ${formatDate(initiative.endDate)}
          </div>
        </div>

        <div class="initiative-progress-row">
          <div class="initiative-progress-bar">
            <div class="initiative-progress-fill" style="width:${progress}%;background:${color}"></div>
          </div>
          <span class="initiative-progress-label">${progress}%</span>
        </div>

        <div class="initiative-epics-section">
          <div class="initiative-epics-header">
            <span class="initiative-epics-label">Epics (${epics.length})</span>
          </div>
          ${epics.length === 0
            ? `<div class="initiative-no-epics">No epics attached — assign an epic to this initiative when creating it.</div>`
            : `<div class="initiative-epics-list">
                ${epics.map(epic => {
                  const counts  = getEpicCounts(epic);
                  const epPct   = calcProgress(counts);
                  const hColor  = EPIC_HEALTH_COLORS[epic.healthManual] || '#6b7280';
                  return `
                    <div class="initiative-epic-row">
                      <div class="initiative-epic-dot" style="background:${hColor}"></div>
                      <span class="initiative-epic-title">${escapeHtml(epic.title)}</span>
                      <div class="initiative-epic-bar">
                        <div class="initiative-epic-fill" style="width:${epPct}%;background:${hColor}"></div>
                      </div>
                      <span class="initiative-epic-pct">${epPct}%</span>
                    </div>
                  `;
                }).join('')}
              </div>`
          }
        </div>
      </div>
    `;

    // Delete
    card.querySelector('.initiative-delete-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Delete initiative "${initiative.title}"? This will not delete its epics.`)) return;
      const idx = INITIATIVES.findIndex(i => i.id === initiative.id);
      if (idx !== -1) INITIATIVES.splice(idx, 1);
      // Clear initiativeId from orphaned epics
      EPICS.forEach(ep => { if (ep.initiativeId === initiative.id) ep.initiativeId = ''; });
      saveState();
      renderInitiativesView(container);
    });

    container.appendChild(card);
  }
}
