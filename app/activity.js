/* ========================================
   Activity Log System
   ======================================== */

import { state, saveState, getTask } from './state.js';
import { generateId } from './utils.js';

const MAX_ACTIVITY_PER_TASK = 200;

export function logActivity(taskId, action, detail) {
  const task = getTask(taskId);
  if (!task) return;

  const entry = {
    id: generateId(),
    action,
    detail,
    timestamp: new Date().toISOString(),
    user: state.profile.name,
  };

  task.activity.unshift(entry);

  // Prune oldest entries
  if (task.activity.length > MAX_ACTIVITY_PER_TASK) {
    task.activity = task.activity.slice(0, MAX_ACTIVITY_PER_TASK);
  }

  task.updated_at = entry.timestamp;
}

export function logTaskCreated(taskId) {
  logActivity(taskId, 'created', 'Task created');
}

export function logTaskMoved(taskId, fromCol, toCol) {
  logActivity(taskId, 'moved', `Moved from ${fromCol} to ${toCol}`);
}

export function logTaskEdited(taskId, field, oldVal, newVal) {
  logActivity(taskId, 'edited', `Changed ${field} from "${oldVal}" to "${newVal}"`);
}

export function logTaskDeleted(taskId) {
  // This won't persist on the task since it's being deleted,
  // but we log it for consistency if needed
  logActivity(taskId, 'deleted', 'Task deleted');
}

export function logCommentAdded(taskId) {
  logActivity(taskId, 'commented', 'Added a comment');
}

export function logBlocked(taskId, reason) {
  logActivity(taskId, 'blocked', `Blocked: ${reason}`);
}

export function logUnblocked(taskId) {
  logActivity(taskId, 'unblocked', 'Unblocked');
}

export function logChecklistToggled(taskId, itemText, done) {
  logActivity(taskId, 'checklist', `${done ? 'Completed' : 'Unchecked'}: ${itemText}`);
}

export function logDependencyAdded(taskId, depTitle) {
  logActivity(taskId, 'dependency', `Added dependency on "${depTitle}"`);
}

export function logDependencyRemoved(taskId, depTitle) {
  logActivity(taskId, 'dependency', `Removed dependency on "${depTitle}"`);
}

export function logLinkAdded(taskId, label) {
  logActivity(taskId, 'link', `Added link: ${label}`);
}

export function logArchived(taskId) {
  logActivity(taskId, 'archived', 'Archived');
}

export function logUnarchived(taskId) {
  logActivity(taskId, 'unarchived', 'Restored from archive');
}

export const ACTIVITY_ICONS = {
  created: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  moved: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>',
  edited: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  commented: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  blocked: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  unblocked: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  checklist: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>',
  dependency: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  deleted: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  archived: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  unarchived: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
};
