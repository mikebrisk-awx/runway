/* ========================================
   Add Task Modal
   ======================================== */

import { state, saveState, getCurrentBoard } from './state.js';
import { generateId } from './utils.js';
import { logTaskCreated } from './activity.js';
import { renderBoard } from './render.js';
import { EPICS } from './data.js';

export function openModal() {
  document.getElementById('addTaskModal').classList.add('show');
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskAssignee').value = '';
  document.getElementById('taskType').value = 'design';
  document.getElementById('taskSize').value = '';
  document.getElementById('taskDue').value = '';
  document.getElementById('taskRequester').value = '';
  document.getElementById('taskPlatform').value = '';

  // Populate epic dropdown
  const epicSel = document.getElementById('taskEpic');
  epicSel.innerHTML = '<option value="">None</option>' +
    EPICS.map(e => `<option value="${e.id}">${e.title}</option>`).join('');

  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

export function closeModal() {
  document.getElementById('addTaskModal').classList.remove('show');
}

export function initModal() {
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelTask').addEventListener('click', closeModal);
  document.getElementById('addTaskModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('addTaskModal')) closeModal();
  });

  document.getElementById('saveTask').addEventListener('click', () => {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;

    const board = getCurrentBoard();
    const colId = state.addTaskColumn || 'backlog';
    const colTasks = board.tasks.filter(t => t.column === colId && !t.archived);
    const now = new Date().toISOString();

    const newTask = {
      id: generateId(),
      title,
      desc: document.getElementById('taskDesc').value.trim(),
      priority: document.getElementById('taskPriority').value,
      type: document.getElementById('taskType').value,
      assignee: document.getElementById('taskAssignee').value.trim() || state.profile.name,
      due: document.getElementById('taskDue').value || '',
      column: colId,
      position: colTasks.length,
      size: document.getElementById('taskSize').value || null,
      created_at: now,
      updated_at: now,
      comments: [],
      activity: [],
      links: [],
      depends_on: [],
      checklist: [],
      blocked: null,
      column_entered_at: now,
      column_history: [],
      archived: false,
      recurring: null,
      requester: document.getElementById('taskRequester').value || '',
      platform: document.getElementById('taskPlatform').value || '',
      epicId: document.getElementById('taskEpic').value || '',
    };

    board.tasks.push(newTask);
    logTaskCreated(newTask.id);
    saveState();
    renderBoard();
    closeModal();
  });

  // Enter to submit
  document.getElementById('taskTitle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('saveTask').click();
    }
  });
}
