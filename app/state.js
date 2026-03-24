/* ========================================
   State Management & Persistence
   ======================================== */

import { BOARDS, EPICS } from './data.js';

export const state = {
  currentBoard: 'product-design',
  theme: 'dark',
  accentColor: '#7c5cfc',
  showSwimlanes: true,
  showWip: true,
  compactCards: false,
  profile: { name: 'Mike Brisk', role: 'Design Lead', bio: '', location: '', timezone: '', skills: [], photo: '' },
  swimlaneFilter: 'all',
  searchQuery: '',
  wipLimits: {},
  addTaskColumn: null,
  detailPanelTaskId: null,
  currentView: 'board', // board | capacity | charts | digest
  boardTemplates: [],
  calendarEvents: [],
  schemaVersion: 5,
  agingThresholdDays: 5,
  teamMembers: [],
  myTodos: [],
  fieldOptions: {
    requester: ['Product Team', 'Marketing', 'Engineering', 'Leadership', 'Client Services'],
    platform: ['iOS', 'Android', 'Web', 'All'],
    type: ['Design', 'Research', 'Dev', 'Content'],
    size: ['XS — Extra Small', 'S — Small', 'M — Medium', 'L — Large', 'XL — Extra Large'],
  },
};

// ── Migration helpers ──
function ensureTaskFields(task) {
  const now = new Date().toISOString();
  // Phase 1 fields
  if (task.position === undefined) task.position = 0;
  if (!task.size) task.size = null;
  if (!task.created_at) task.created_at = now;
  if (!task.updated_at) task.updated_at = now;
  // Phase 2 fields
  if (!task.comments) task.comments = [];
  if (!task.activity) task.activity = [];
  if (!task.links) task.links = [];
  if (!task.depends_on) task.depends_on = [];
  if (!task.checklist) task.checklist = [];
  if (task.blocked === undefined) task.blocked = null;
  // Phase 3 fields
  if (!task.column_entered_at) task.column_entered_at = task.updated_at || now;
  if (!task.column_history) task.column_history = [];
  if (task.archived === undefined) task.archived = false;
  if (task.recurring === undefined) task.recurring = null;
  // Phase 4 fields
  if (task.requester === undefined) task.requester = '';
  if (task.platform === undefined) task.platform = '';
  if (task.epicId === undefined) task.epicId = '';
  // Phase 5 fields (Reviews)
  if (!task.reviewImages) task.reviewImages = [];
  if (!task.reviewStatus) task.reviewStatus = 'pending';
  if (!task.reviewComments) task.reviewComments = [];
}

function ensureColumnFields(col) {
  if (!col.policy) col.policy = { ready: '', done: '' };
}

function migrate(saved) {
  // Ensure all tasks have all fields
  if (saved.boardTasks) {
    for (const tasks of Object.values(saved.boardTasks)) {
      if (Array.isArray(tasks)) {
        // Assign positions if missing
        const byCol = {};
        tasks.forEach(t => {
          ensureTaskFields(t);
          if (!byCol[t.column]) byCol[t.column] = 0;
          if (t.position === 0 && byCol[t.column] > 0) {
            t.position = byCol[t.column];
          }
          byCol[t.column]++;
        });
      }
    }
  }
  // Ensure column policies
  if (saved.wipLimits) {
    // Column policies are stored with board definitions, not in saved state
    // They'll be ensured when loading into BOARDS
  }
  saved.schemaVersion = 5;
  return saved;
}

// ── Load State ──
export function loadState() {
  try {
    const raw = localStorage.getItem('designKanban');
    if (!raw) return;
    const saved = JSON.parse(raw);

    // Run migrations
    migrate(saved);

    // Merge saved state into current state
    if (saved.currentBoard) state.currentBoard = saved.currentBoard;
    if (saved.theme) state.theme = saved.theme;
    if (saved.accentColor) state.accentColor = saved.accentColor;
    if (saved.showSwimlanes !== undefined) state.showSwimlanes = saved.showSwimlanes;
    if (saved.showWip !== undefined) state.showWip = saved.showWip;
    if (saved.compactCards !== undefined) state.compactCards = saved.compactCards;
    if (saved.profile) state.profile = saved.profile;
    if (saved.currentView) state.currentView = saved.currentView;
    if (saved.boardTemplates) state.boardTemplates = saved.boardTemplates;
    if (saved.calendarEvents) state.calendarEvents = saved.calendarEvents;
    if (saved.agingThresholdDays) state.agingThresholdDays = saved.agingThresholdDays;
    if (saved.teamMembers && saved.teamMembers.length > 0) state.teamMembers = saved.teamMembers;
    if (saved.myTodos) state.myTodos = saved.myTodos;
    if (saved.currentNav) state.currentNav = saved.currentNav;
    if (saved.myWorkHeaderBg !== undefined) state.myWorkHeaderBg = saved.myWorkHeaderBg;
    if (saved.fieldOptions) state.fieldOptions = saved.fieldOptions;

    // Restore epics into the live EPICS array
    if (saved.epics && Array.isArray(saved.epics)) {
      EPICS.length = 0;
      saved.epics.forEach(e => EPICS.push(e));
    }

    // Merge tasks back into BOARDS
    if (saved.boardTasks) {
      for (const [boardId, tasks] of Object.entries(saved.boardTasks)) {
        if (BOARDS[boardId] && Array.isArray(tasks)) {
          BOARDS[boardId].tasks = tasks;
        }
      }
    }

    // Merge WIP limits and column policies
    if (saved.wipLimits) {
      for (const [boardId, limits] of Object.entries(saved.wipLimits)) {
        if (BOARDS[boardId]) {
          for (const [colId, limit] of Object.entries(limits)) {
            const col = BOARDS[boardId].columns.find(c => c.id === colId);
            if (col) col.wipLimit = limit;
          }
        }
      }
    }

    if (saved.columnPolicies) {
      for (const [boardId, policies] of Object.entries(saved.columnPolicies)) {
        if (BOARDS[boardId]) {
          for (const [colId, policy] of Object.entries(policies)) {
            const col = BOARDS[boardId].columns.find(c => c.id === colId);
            if (col) col.policy = policy;
          }
        }
      }
    }
  } catch(e) {
    console.warn('Failed to load state:', e);
  }

  // Ensure all board columns have policies
  for (const board of Object.values(BOARDS)) {
    for (const col of board.columns) {
      ensureColumnFields(col);
    }
    for (const task of board.tasks) {
      ensureTaskFields(task);
    }
  }
}

// ── Save State ──
export function saveState() {
  const boardTasks = {};
  const wipLimits = {};
  const columnPolicies = {};

  for (const [id, board] of Object.entries(BOARDS)) {
    boardTasks[id] = board.tasks;
    wipLimits[id] = {};
    columnPolicies[id] = {};
    for (const col of board.columns) {
      wipLimits[id][col.id] = col.wipLimit;
      columnPolicies[id][col.id] = col.policy || { ready: '', done: '' };
    }
  }

  try {
    localStorage.setItem('designKanban', JSON.stringify({
      currentBoard: state.currentBoard,
      theme: state.theme,
      accentColor: state.accentColor,
      showSwimlanes: state.showSwimlanes,
      showWip: state.showWip,
      compactCards: state.compactCards,
      profile: state.profile,
      currentView: state.currentView,
      boardTemplates: state.boardTemplates,
      calendarEvents: state.calendarEvents,
      agingThresholdDays: state.agingThresholdDays,
      teamMembers: state.teamMembers,
      myTodos: state.myTodos,
      currentNav: state.currentNav,
      myWorkHeaderBg: state.myWorkHeaderBg,
      fieldOptions: state.fieldOptions,
      epics: EPICS,
      boardTasks: boardTasks,
      wipLimits: wipLimits,
      columnPolicies: columnPolicies,
      schemaVersion: state.schemaVersion,
    }));
  } catch(e) {
    console.warn('Failed to save state:', e);
  }

  // Trigger Firestore sync if available (non-blocking)
  if (window._syncBoard) window._syncBoard(state.currentBoard);
}

// ── Helpers ──
export function getCurrentBoard() {
  return BOARDS[state.currentBoard];
}

export function getTask(taskId) {
  const board = getCurrentBoard();
  return board ? board.tasks.find(t => t.id === taskId) : null;
}

export function getAllTasks() {
  const all = [];
  for (const board of Object.values(BOARDS)) {
    all.push(...board.tasks);
  }
  return all;
}

export function getColumnIndex(boardId, columnId) {
  const board = BOARDS[boardId];
  if (!board) return -1;
  return board.columns.findIndex(c => c.id === columnId);
}

export function isLastColumn(boardId, columnId) {
  const board = BOARDS[boardId];
  if (!board) return false;
  return board.columns[board.columns.length - 1].id === columnId;
}

export { BOARDS };
