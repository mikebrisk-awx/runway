/* ========================================
   Board Definitions & Default Data
   ======================================== */

const now = new Date().toISOString();

export const BOARDS = {
  'product-design': {
    title: 'Product Design',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready to Start', color: '#3b82f6', wipLimit: 5, policy: { ready: 'Design brief completed, requirements clear, assets identified', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Design Review', color: '#8b5cf6', wipLimit: 3, policy: { ready: 'All deliverables attached, self-review done', done: 'Feedback addressed, stakeholder sign-off' } },
      { id: 'done', name: 'Done', color: '#10b981', wipLimit: 0, policy: { ready: '', done: 'Assets exported, handoff docs ready' } },
    ],
    tasks: []
  },
  'business-dev': {
    title: 'Business Development',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'discovery', name: 'Discovery', color: '#3b82f6', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'stakeholder', name: 'Stakeholder Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Completed', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'ux': {
    title: 'UX Research',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'planning', name: 'Planning', color: '#3b82f6', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'analysis', name: 'Analysis', color: '#8b5cf6', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Complete', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'flagship': {
    title: 'Flagship Products',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'qa', name: 'QA / Testing', color: '#8b5cf6', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Shipped', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'business-products': {
    title: 'Business Products',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'scoping', name: 'Scoping', color: '#3b82f6', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Delivered', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'data-analytics': {
    title: 'Data & Analytics',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'planning', name: 'Planning', color: '#3b82f6', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Complete', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'customer-success': {
    title: 'Customer Success',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Resolved', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'marketing': {
    title: 'Marketing',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Published', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'engineering': {
    title: 'Engineering',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready to Build', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Code Review', color: '#8b5cf6', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Shipped', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'it': {
    title: 'IT & Security',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Queued', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Testing', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Resolved', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'finance': {
    title: 'Finance',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Under Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Approved', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
  'hr': {
    title: 'People & HR',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Complete', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: []
  },
};

export const EPICS = [];

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
