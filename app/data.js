/* ========================================
   Board Definitions & Default Data
   ======================================== */

const now = new Date().toISOString();

export const BOARDS = {
  'product-design': {
    title: 'Product Design',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'awaiting-assignee', name: 'Awaiting Assignee', color: '#06b6d4', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready to Start', color: '#3b82f6', wipLimit: 5, policy: { ready: 'Design brief completed, requirements clear, assets identified', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Design Review', color: '#8b5cf6', wipLimit: 3, policy: { ready: 'All deliverables attached, self-review done', done: 'Feedback addressed, stakeholder sign-off' } },
      { id: 'done', name: 'Done', color: '#10b981', wipLimit: 0, policy: { ready: '', done: 'Assets exported, handoff docs ready' } },
    ],
    tasks: []
  },
};

export const EPICS = [];

export const INITIATIVES = [];

// ── Team Calendar Events ──────────────────────────────────────────────────────
export const CALENDAR_EVENTS = [];

export const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981'
};

export const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export const SIZE_LABELS = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'X-Large'
};
