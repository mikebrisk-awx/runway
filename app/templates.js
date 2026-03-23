/* ========================================
   Board Templates
   ======================================== */

import { state, saveState, getCurrentBoard } from './state.js';
import { generateId } from './utils.js';
import { renderBoard } from './render.js';

export function saveAsTemplate() {
  const board = getCurrentBoard();
  if (!board) return;

  const name = prompt('Template name:', `${board.title} Template`);
  if (!name) return;

  const template = {
    id: generateId(),
    name,
    created_at: new Date().toISOString(),
    columns: board.columns.map(c => ({
      id: c.id,
      name: c.name,
      color: c.color,
      wipLimit: c.wipLimit,
      policy: { ...c.policy },
    })),
  };

  state.boardTemplates.push(template);
  saveState();
  alert(`Template "${name}" saved!`);
}

export function showTemplatePicker() {
  if (state.boardTemplates.length === 0) {
    alert('No templates saved yet. Use "Save as Template" first.');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'templateModal';

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Load Template</h2>
        <button class="icon-btn" id="closeTemplateModal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">
          Loading a template will replace the column structure of the current board. Tasks will be remapped to matching columns.
        </p>
        <div class="template-list">
          ${state.boardTemplates.map(t => `
            <div class="template-card" data-template-id="${t.id}">
              <div class="template-card-info">
                <span class="template-card-name">${t.name}</span>
                <span class="template-card-meta">${t.columns.length} columns &middot; Created ${new Date(t.created_at).toLocaleDateString()}</span>
                <div class="template-card-cols">
                  ${t.columns.map(c => `<span class="template-col-dot" style="background:${c.color}" title="${c.name}"></span>`).join('')}
                </div>
              </div>
              <div class="template-card-actions">
                <button class="btn btn-small btn-primary load-template-btn" data-template-id="${t.id}">Load</button>
                <button class="btn btn-small btn-ghost delete-template-btn" data-template-id="${t.id}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#closeTemplateModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.load-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadTemplate(btn.dataset.templateId);
      overlay.remove();
    });
  });

  overlay.querySelectorAll('.delete-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteTemplate(btn.dataset.templateId);
      overlay.remove();
      showTemplatePicker(); // re-open with updated list
    });
  });
}

function loadTemplate(templateId) {
  const template = state.boardTemplates.find(t => t.id === templateId);
  if (!template) return;

  const board = getCurrentBoard();
  if (!board) return;

  if (!confirm(`Load template "${template.name}"? This will replace the column structure.`)) return;

  // Map old column IDs to new
  const oldCols = board.columns.map(c => c.id);
  const newCols = template.columns.map(c => c.id);

  // Replace columns
  board.columns = template.columns.map(c => ({ ...c, policy: { ...c.policy } }));

  // Remap tasks
  for (const task of board.tasks) {
    if (!newCols.includes(task.column)) {
      // Try to find matching column by name
      const match = template.columns.find(c => c.name.toLowerCase() === board.columns.find(old => old?.id === task.column)?.name?.toLowerCase());
      task.column = match ? match.id : template.columns[0].id;
    }
  }

  saveState();
  renderBoard();
}

function deleteTemplate(templateId) {
  state.boardTemplates = state.boardTemplates.filter(t => t.id !== templateId);
  saveState();
}

export function initTemplates() {
  // Board actions dropdown
  const dropdown = document.getElementById('boardActionsDropdown');
  const toggle = document.getElementById('boardActionsBtn');

  if (toggle && dropdown) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => dropdown.classList.remove('show'));

    document.getElementById('saveTemplateBtn')?.addEventListener('click', () => {
      dropdown.classList.remove('show');
      saveAsTemplate();
    });

    document.getElementById('loadTemplateBtn')?.addEventListener('click', () => {
      dropdown.classList.remove('show');
      showTemplatePicker();
    });
  }
}
