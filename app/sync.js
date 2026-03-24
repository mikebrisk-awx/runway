/* ========================================
   Firestore Real-Time Sync
   ======================================== */

import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { BOARDS } from './data.js';
import { state } from './state.js';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Debounce helper ──
const _boardDebounceTimers = {};

function debounce(fn, delay, key) {
  if (_boardDebounceTimers[key]) clearTimeout(_boardDebounceTimers[key]);
  _boardDebounceTimers[key] = setTimeout(() => {
    delete _boardDebounceTimers[key];
    fn();
  }, delay);
}

// ── Write board tasks to Firestore ──
export async function syncBoardToFirestore(boardId) {
  const user = getCurrentUser();
  if (!user) return;
  if (!BOARDS[boardId]) return;
  try {
    const ref = doc(db, 'boards', boardId);
    await setDoc(ref, {
      tasks: BOARDS[boardId].tasks,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }, { merge: true });
  } catch (err) {
    console.warn('syncBoardToFirestore error:', err);
  }
}

// ── Debounced board sync (exposed on window) ──
function debouncedSyncBoard(boardId) {
  debounce(() => syncBoardToFirestore(boardId), 1500, boardId);
}

// ── Write shared settings to Firestore ──
export async function syncSettingsToFirestore() {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const wipLimits = {};
    const columnPolicies = {};
    for (const [id, board] of Object.entries(BOARDS)) {
      wipLimits[id] = {};
      columnPolicies[id] = {};
      for (const col of board.columns) {
        wipLimits[id][col.id] = col.wipLimit;
        columnPolicies[id][col.id] = col.policy || { ready: '', done: '' };
      }
    }
    const ref = doc(db, 'settings', 'shared');
    await setDoc(ref, {
      wipLimits,
      columnPolicies,
      teamMembers: state.teamMembers || [],
      boardTemplates: state.boardTemplates || [],
      calendarEvents: state.calendarEvents || [],
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }, { merge: true });
  } catch (err) {
    console.warn('syncSettingsToFirestore error:', err);
  }
}

// ── Write per-user prefs to Firestore ──
export async function syncUserPrefsToFirestore() {
  const user = getCurrentUser();
  if (!user) return;
  try {
    const ref = doc(db, 'userPrefs', user.uid);
    await setDoc(ref, {
      theme: state.theme,
      accentColor: state.accentColor,
      currentBoard: state.currentBoard,
      myTodos: state.myTodos || [],
      currentNav: state.currentNav || 'overview',
      myWorkHeaderBg: state.myWorkHeaderBg || null,
      fieldOptions: state.fieldOptions || {},
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('syncUserPrefsToFirestore error:', err);
  }
}

// ── Load all data from Firestore on startup ──
export async function loadFromFirestore() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    // Load all boards
    const boardIds = Object.keys(BOARDS);
    await Promise.all(boardIds.map(async (boardId) => {
      const ref = doc(db, 'boards', boardId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.tasks)) {
          // Preserve reviewImages from local memory — Firestore never stores dataUrls
          const localTasks = BOARDS[boardId].tasks;
          BOARDS[boardId].tasks = data.tasks.map(fsTask => {
            const local = localTasks.find(t => t.id === fsTask.id);
            if (local?.reviewImages?.length) {
              return { ...fsTask, reviewImages: local.reviewImages };
            }
            return fsTask;
          });
        }
      }
    }));

    // Load shared settings
    const settingsRef = doc(db, 'settings', 'shared');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const s = settingsSnap.data();
      if (s.wipLimits) {
        for (const [boardId, limits] of Object.entries(s.wipLimits)) {
          if (BOARDS[boardId]) {
            for (const [colId, limit] of Object.entries(limits)) {
              const col = BOARDS[boardId].columns.find(c => c.id === colId);
              if (col) col.wipLimit = limit;
            }
          }
        }
      }
      if (s.columnPolicies) {
        for (const [boardId, policies] of Object.entries(s.columnPolicies)) {
          if (BOARDS[boardId]) {
            for (const [colId, policy] of Object.entries(policies)) {
              const col = BOARDS[boardId].columns.find(c => c.id === colId);
              if (col) col.policy = policy;
            }
          }
        }
      }
      if (s.teamMembers && s.teamMembers.length > 0) state.teamMembers = s.teamMembers;
      if (s.boardTemplates) state.boardTemplates = s.boardTemplates;
      if (s.calendarEvents) state.calendarEvents = s.calendarEvents;
    }

    // Load user prefs
    const prefsRef = doc(db, 'userPrefs', user.uid);
    const prefsSnap = await getDoc(prefsRef);
    if (prefsSnap.exists()) {
      const p = prefsSnap.data();
      if (p.theme) state.theme = p.theme;
      if (p.accentColor) state.accentColor = p.accentColor;
      if (p.currentBoard) state.currentBoard = p.currentBoard;
      if (p.myTodos) state.myTodos = p.myTodos;
      if (p.currentNav) state.currentNav = p.currentNav;
      if (p.myWorkHeaderBg !== undefined) state.myWorkHeaderBg = p.myWorkHeaderBg;
      if (p.fieldOptions) state.fieldOptions = p.fieldOptions;
    }

  } catch (err) {
    console.warn('loadFromFirestore error — falling back to localStorage:', err);
    // Fallback: loadState() from state.js has already been called or will be
  }
}

// ── Attach real-time listeners ──
export function initSync() {
  const user = getCurrentUser();
  if (!user) return;

  const boardIds = Object.keys(BOARDS);

  boardIds.forEach((boardId) => {
    const ref = doc(db, 'boards', boardId);
    onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // Only react to changes from OTHER users
      if (data.updatedBy && data.updatedBy === user.uid) return;

      if (Array.isArray(data.tasks)) {
        // Preserve local reviewImages — Firestore never stores image dataUrls
        const localTasks = BOARDS[boardId].tasks;
        BOARDS[boardId].tasks = data.tasks.map(fsTask => {
          const local = localTasks.find(t => t.id === fsTask.id);
          if (local?.reviewImages?.length) {
            return { ...fsTask, reviewImages: local.reviewImages };
          }
          return fsTask;
        });

        // Re-render if this board is currently shown
        if (state.currentBoard === boardId && window._kanban?.renderBoard) {
          window._kanban.renderBoard();
        }
      }
    }, (err) => {
      console.warn(`onSnapshot error for board ${boardId}:`, err);
    });
  });

  // Settings listener
  const settingsRef = doc(db, 'settings', 'shared');
  onSnapshot(settingsRef, (snap) => {
    if (!snap.exists()) return;
    const s = snap.data();
    if (s.updatedBy && s.updatedBy === user.uid) return;

    if (s.wipLimits) {
      for (const [boardId, limits] of Object.entries(s.wipLimits)) {
        if (BOARDS[boardId]) {
          for (const [colId, limit] of Object.entries(limits)) {
            const col = BOARDS[boardId].columns.find(c => c.id === colId);
            if (col) col.wipLimit = limit;
          }
        }
      }
    }
    if (s.columnPolicies) {
      for (const [boardId, policies] of Object.entries(s.columnPolicies)) {
        if (BOARDS[boardId]) {
          for (const [colId, policy] of Object.entries(policies)) {
            const col = BOARDS[boardId].columns.find(c => c.id === colId);
            if (col) col.policy = policy;
          }
        }
      }
    }
    if (s.teamMembers && s.teamMembers.length > 0) state.teamMembers = s.teamMembers;
    if (s.boardTemplates) state.boardTemplates = s.boardTemplates;
    if (s.calendarEvents) state.calendarEvents = s.calendarEvents;
  }, (err) => {
    console.warn('onSnapshot error for settings/shared:', err);
  });

  // Expose debounced sync on window so saveState() can trigger it
  window._syncBoard = (boardId) => debouncedSyncBoard(boardId);
  window._syncUserPrefs = () => syncUserPrefsToFirestore();
}
