/* ========================================
   State Management & Persistence
   ======================================== */

import { BOARDS } from './data.js';

export const state = {
  currentBoard: 'product-design',
  theme: 'dark',
  accentColor: '#7c5cfc',
  showSwimlanes: true,
  showWip: true,
  compactCards: false,
  profile: { name: '', role: '', bio: '', location: '', timezone: '', skills: [], photo: '' },
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
  customWorkspaces: [], // [{ id, name, description, color }]
  myTodos: [],
  notepad: '',
  slackWebhookUrl: '',
  figmaIntegration: null, // { connected, webhookId, teamId, connectedAt } or null
  fieldOptions: {
    requester: ['Product Team', 'Marketing', 'Engineering', 'Leadership', 'Client Services'],
    platform: ['iOS', 'Android', 'Web', 'All'],
    type: ['Design', 'Research', 'Dev', 'Content'],
    size: ['XS — Extra Small', 'S — Small', 'M — Medium', 'L — Large', 'XL — Extra Large'],
  },
  workspaceFieldOptions: {}, // { [workspaceId | '__global__']: { requester, platform, type, size } }
};

// ── Migration helpers ──
export function ensureTaskFields(task) {
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
  if (!task.reviewPolls) task.reviewPolls = [];
}

function ensureColumnFields(col) {
  if (!col.policy) col.policy = { ready: '', done: '' };
}

// ── Display-preference cache ──
// The ONLY thing this app keeps in localStorage. It holds no content — just
// enough UI chrome (theme, accent, last workspace) to paint the first frame
// without a flash while Firestore is still answering. Every piece of content —
// tasks, epics, initiatives, team, settings, field options — comes exclusively
// from Firestore via loadFromFirestore() in sync.js.
const PREFS_KEY = 'runwayPrefs';

const PREF_FIELDS = [
  'theme', 'accentColor', 'currentBoard', 'currentNav', 'currentView',
  'showSwimlanes', 'showWip', 'compactCards',
];

// Drop content written by older builds so it can never be read back into the
// board or re-uploaded into the live database.
function purgeLegacyLocalContent() {
  try {
    // The notepad used to live only in localStorage. Carry it into state on
    // first run so the next saveState() pushes it up to Firestore, where
    // loadFromFirestore() will take over as the source from then on.
    const legacyNote = localStorage.getItem('runway_notepad');
    if (legacyNote && !state.notepad) state.notepad = legacyNote;

    localStorage.removeItem('runway_notepad');
    localStorage.removeItem('designKanban');
    localStorage.removeItem('designKanbanImages');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('designKanbanImg_')) localStorage.removeItem(key);
    }
  } catch(e) {
    console.warn('Failed to purge legacy local content:', e);
  }
}

// ── Normalize remote data ──
// Firestore documents may predate the current schema, so fill in missing
// fields on every task and column after a remote load.
export function normalizeBoards() {
  for (const board of Object.values(BOARDS)) {
    for (const col of board.columns) {
      ensureColumnFields(col);
    }
    for (const task of board.tasks) {
      ensureTaskFields(task);
    }
  }
}

// ── Load State ──
// Restores display preferences only. Content is NOT loaded here — it arrives
// from Firestore in loadFromFirestore().
export function loadState() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      for (const key of PREF_FIELDS) {
        if (saved[key] !== undefined) state[key] = saved[key];
      }
    }
  } catch(e) {
    console.warn('Failed to load display preferences:', e);
  }

  purgeLegacyLocalContent();
  normalizeBoards();
}

// ── Save State ──
// Persists display preferences locally; all content goes to Firestore.
export function saveState() {
  try {
    const prefs = {};
    for (const key of PREF_FIELDS) prefs[key] = state[key];
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch(e) {
    console.warn('Failed to save display preferences:', e);
  }

  // Firestore is the system of record for all content (debounced, non-blocking).
  if (window._syncBoard) window._syncBoard(state.currentBoard);
  if (window._syncUserPrefs) window._syncUserPrefs();
  if (window._syncSettings) window._syncSettings();
}


// ── Helpers ──
// A stored currentBoard can name a workspace that no longer exists — a removed
// company workspace, or a custom one deleted by someone else. Fall back rather
// than leaving getCurrentBoard() undefined, which blanks the board.
// Call after custom workspaces have been hydrated into BOARDS.
export function ensureValidCurrentBoard() {
  if (state.currentBoard === 'home') return state.currentBoard;
  if (BOARDS[state.currentBoard]) return state.currentBoard;
  const fallback = BOARDS['product-design'] ? 'product-design' : Object.keys(BOARDS)[0];
  console.warn(`Workspace "${state.currentBoard}" no longer exists — falling back to "${fallback || 'home'}".`);
  state.currentBoard = fallback || 'home';
  return state.currentBoard;
}

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

// A task counts as complete when it reaches the conventional `done` column, or
// the board's final column for boards that name their completion stage
// something else (Shipped, Delivered, Resolved, Approved…).
export function isDoneColumn(boardId, columnId) {
  return columnId === 'done' || isLastColumn(boardId, columnId);
}

export { BOARDS };

// ── Field Options Helper ──
// Returns field options for the active workspace, falling back to __global__,
// then the legacy flat fieldOptions object.
const DEFAULT_FIELD_OPTIONS = {
  requester: ['Product Team', 'Marketing', 'Engineering', 'Leadership', 'Client Services'],
  platform: ['iOS', 'Android', 'Web', 'All'],
  type: ['Design', 'Research', 'Dev', 'Content'],
  size: ['XS — Extra Small', 'S — Small', 'M — Medium', 'L — Large', 'XL — Extra Large'],
};

export function getActiveFieldOptions(boardId) {
  const wsId = boardId || state.currentBoard;
  return state.workspaceFieldOptions[wsId]
    || state.workspaceFieldOptions['__global__']
    || state.fieldOptions
    || DEFAULT_FIELD_OPTIONS;
}

export function setWorkspaceFieldOptions(boardId, opts) {
  state.workspaceFieldOptions[boardId] = opts;
}
