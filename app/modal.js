/* ========================================
   Add Task Modal
   ======================================== */

import { state, saveState, getCurrentBoard } from './state.js';
import { generateId, attachAssigneeAutocomplete } from './utils.js';
import { logTaskCreated } from './activity.js';
import { renderBoard } from './render.js';
import { EPICS } from './data.js';

export function openModal() {
  document.getElementById('addTaskModal').classList.add('show');
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskAssignee').value = '';
  document.getElementById('taskDue').value = '';
  const otherInput = document.getElementById('taskRequesterOther');
  otherInput.value = '';
  otherInput.style.display = 'none';

  // Rebuild dynamic field options in modal
  const reqSel = document.getElementById('taskRequester');
  reqSel.innerHTML = '<option value="">None</option>' +
    (state.fieldOptions.requester || []).map(o => `<option value="${o}">${o}</option>`).join('') +
    '<option value="__other__">Other...</option>';
  reqSel.value = '';

  const platSel = document.getElementById('taskPlatform');
  platSel.innerHTML = '<option value="">None</option>' +
    (state.fieldOptions.platform || []).map(o => `<option value="${o}">${o}</option>`).join('');
  platSel.value = '';

  const typeSel = document.getElementById('taskType');
  typeSel.innerHTML = (state.fieldOptions.type || []).map(o =>
    `<option value="${o.toLowerCase()}">${o}</option>`).join('');
  // Default to first type option
  typeSel.selectedIndex = 0;

  const sizeSel = document.getElementById('taskSize');
  sizeSel.innerHTML = '<option value="">None</option>' +
    (state.fieldOptions.size || []).map(o => `<option value="${o}">${o}</option>`).join('');
  sizeSel.value = '';

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

  attachAssigneeAutocomplete(
    document.getElementById('taskAssignee'),
    () => {
      const members = state.teamMembers || [];
      const profile = state.profile;
      if (profile?.name && !members.find(m => m.name === profile.name)) {
        return [{ name: profile.name, initials: profile.name.split(' ').map(n => n[0]).join('').toUpperCase(), color: '#6366f1' }, ...members];
      }
      return members;
    }
  );

  document.getElementById('taskRequester').addEventListener('change', (e) => {
    const otherInput = document.getElementById('taskRequesterOther');
    if (e.target.value === '__other__') {
      otherInput.style.display = '';
      otherInput.focus();
    } else {
      otherInput.style.display = 'none';
      otherInput.value = '';
    }
  });

  document.getElementById('saveTask').addEventListener('click', () => {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;

    const board = getCurrentBoard();
    const colId = state.addTaskColumn || 'backlog';
    const colTasks = board.tasks.filter(t => t.column === colId && !t.archived);
    const now = new Date().toISOString();

    const requesterSel = document.getElementById('taskRequester').value;
    const requester = requesterSel === '__other__'
      ? document.getElementById('taskRequesterOther').value.trim()
      : requesterSel;

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
      requester,
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
