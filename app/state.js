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
  workspaceMembers: {}, // { [workspaceId]: [uid, ...] }
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
    if (saved.workspaceMembers && Object.keys(saved.workspaceMembers).length > 0) state.workspaceMembers = saved.workspaceMembers;
    if (saved.myTodos) state.myTodos = saved.myTodos;
    if (saved.currentNav) state.currentNav = saved.currentNav;
    if (saved.myWorkHeaderBg !== undefined) state.myWorkHeaderBg = saved.myWorkHeaderBg;
    if (saved.fieldOptions) state.fieldOptions = saved.fieldOptions;

    // Restore epics into the live EPICS array
    if (saved.epics && Array.isArray(saved.epics)) {
      EPICS.length = 0;
      saved.epics.forEach(e => EPICS.push(e));
    }

    // Merge tasks back into BOARDS (migrate old IDs to new ones)
    const BOARD_ID_MIGRATIONS = { 'ux': 'data-analytics', 'flagship': 'customer-success' };
    if (saved.boardTasks) {
      for (const [boardId, tasks] of Object.entries(saved.boardTasks)) {
        const targetId = BOARD_ID_MIGRATIONS[boardId] || boardId;
        if (BOARDS[targetId] && Array.isArray(tasks) && tasks.length > 0) {
          BOARDS[targetId].tasks = tasks;
        }
      }
    }

    // Restore review image dataUrls from per-task sidecar keys
    try {
      for (const board of Object.values(BOARDS)) {
        for (const task of board.tasks) {
          // Try per-task key first, fall back to legacy combined key
          const raw = localStorage.getItem(`designKanbanImg_${task.id}`)
                   || localStorage.getItem('designKanbanImages');
          if (!raw) continue;
          let imageData;
          try {
            const parsed = JSON.parse(raw);
            // Per-task key is an array; legacy combined key is an object map
            imageData = Array.isArray(parsed) ? parsed : parsed[task.id];
          } catch { continue; }
          if (!imageData?.length) continue;
          // Merge: sidecar has dataUrls, main state has latest pins
          const mainImgs = task.reviewImages || [];
          task.reviewImages = imageData.map(sidecarImg => {
            const mainImg = mainImgs.find(i => i.id === sidecarImg.id);
            return { ...sidecarImg, pins: mainImg?.pins ?? sidecarImg.pins ?? [] };
          });
        }
      }
    } catch(e) {
      console.warn('Failed to restore review images:', e);
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
  const boardTasks = {};       // stripped (no image dataUrls) — for main state + Firestore
  const boardTasksFull = {};   // full (with dataUrls) — for image sidecar only
  const wipLimits = {};
  const columnPolicies = {};
  const imageMap = {};         // taskId → reviewImages[] (with dataUrls)

  for (const [id, board] of Object.entries(BOARDS)) {
    wipLimits[id] = {};
    columnPolicies[id] = {};
    for (const col of board.columns) {
      wipLimits[id][col.id] = col.wipLimit;
      columnPolicies[id][col.id] = col.policy || { ready: '', done: '' };
    }

    // Strip dataUrls from boardTasks so main state stays small
    boardTasks[id] = board.tasks.map(task => {
      if (task.reviewImages?.length) {
        // Collect images for sidecar store
        imageMap[task.id] = task.reviewImages;
        // Return task with metadata-only reviewImages (no dataUrl)
        return {
          ...task,
          reviewImages: task.reviewImages.map(({ id: imgId, name, pins }) => ({ id: imgId, name, pins: pins || [] })),
        };
      }
      return task;
    });
  }

  // Save image blobs in a separate localStorage key.
  // Try per-task keys first (avoids one giant JSON string hitting the quota).
  // Clean up any old single-key format first.
  try {
    // Remove legacy combined key if it exists
    const existingRaw = localStorage.getItem('designKanbanImages');
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        // If it looks like old combined format, clear it to free space
        if (typeof existing === 'object') localStorage.removeItem('designKanbanImages');
      } catch {}
    }
    // Save each task's images separately so one large image can't block others
    for (const [taskId, images] of Object.entries(imageMap)) {
      try {
        localStorage.setItem(`designKanbanImg_${taskId}`, JSON.stringify(images));
      } catch(e) {
        console.warn(`Failed to save images for task ${taskId} (quota?):`, e);
      }
    }
    // Clean up image keys for tasks that no longer have images
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('designKanbanImg_')) {
        const taskId = key.replace('designKanbanImg_', '');
        if (!imageMap[taskId]) localStorage.removeItem(key);
      }
    }
  } catch(e) {
    console.warn('Failed to save review images:', e);
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
  // boardTasks already has dataUrls stripped so Firestore doc stays under 1MB
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
