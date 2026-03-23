/* ========================================
   Recurring Tasks Engine
   ======================================== */

import { BOARDS } from './state.js';
import { generateId } from './utils.js';
import { saveState } from './state.js';

export function processRecurringTasks() {
  const now = new Date();
  let changed = false;

  for (const board of Object.values(BOARDS)) {
    const lastCol = board.columns[board.columns.length - 1];
    if (!lastCol) continue;

    for (const task of [...board.tasks]) {
      if (!task.recurring || !task.recurring.frequency) continue;
      if (task.column !== lastCol.id) continue;
      if (!task.recurring.next_due) continue;

      const nextDue = new Date(task.recurring.next_due);
      if (nextDue > now) continue;

      // Create a new instance
      const newTask = {
        ...JSON.parse(JSON.stringify(task)),
        id: generateId(),
        column: board.columns[0].id,
        position: board.tasks.filter(t => t.column === board.columns[0].id && !t.archived).length,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        column_entered_at: now.toISOString(),
        column_history: [],
        comments: [],
        activity: [{ id: generateId(), action: 'created', detail: 'Recurring task auto-created', timestamp: now.toISOString(), user: 'System' }],
        checklist: task.checklist.map(c => ({ ...c, id: generateId(), done: false })),
        blocked: null,
        archived: false,
      };

      // Compute new due date
      const newDue = computeNextDueDate(task.recurring.frequency, task.due);
      newTask.due = newDue.toISOString().split('T')[0];
      newTask.recurring.next_due = computeNextDueDate(task.recurring.frequency, newTask.due).toISOString();

      board.tasks.push(newTask);

      // Update original's next_due to prevent re-triggering
      task.recurring.next_due = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // far future

      changed = true;
    }
  }

  if (changed) {
    saveState();
  }

  return changed;
}

function computeNextDueDate(frequency, currentDue) {
  const base = currentDue ? new Date(currentDue) : new Date();
  const next = new Date(base);
  switch(frequency) {
    case 'daily': next.setDate(next.getDate() + 1); break;
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'biweekly': next.setDate(next.getDate() + 14); break;
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
  }
  return next;
}

export function startRecurringEngine() {
  // Check on startup
  processRecurringTasks();
  // Check every minute
  setInterval(processRecurringTasks, 60 * 1000);
}
