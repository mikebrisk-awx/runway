/* ========================================
   Firestore Real-Time Sync
   Per-task subcollection architecture
   ======================================== */

import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { BOARDS, EPICS } from './data.js';
import { state } from './state.js';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  deleteField
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Guard: don't sync boards until initial load is confirmed ──
let _initialLoadDone = false;

// ── Debounce helper ──
const _debounceTimers = {};

function debounce(fn, delay, key) {
  if (_debounceTimers[key]) clearTimeout(_debounceTimers[key]);
  _debounceTimers[key] = setTimeout(() => {
    delete _debounceTimers[key];
    fn();
  }, delay);
}

// ── Change-detection snapshot ──
// Stores the last-synced JSON for each task so we can diff efficiently.
// Structure: { boardId: { taskId: jsonString } }
const _lastSyncedTasks = {};

// ── Strip reviewImage base64 dataUrls for Firestore (keeps doc under 1MB) ──
// Storage URLs (img.url) are kept so other users can see the images.
function stripTaskForFirestore(task) {
  const copy = { ...task };
  if (copy.reviewImages?.length) {
    copy.reviewImages = copy.reviewImages.map(({ id, name, pins, url }) => ({
      id, name, pins: pins || [], ...(url ? { url } : {}),
    }));
  }
  return copy;
}

// ── Diff current tasks against last-synced snapshot ──
function diffTasks(boardId) {
  const current = BOARDS[boardId]?.tasks || [];
  const prev = _lastSyncedTasks[boardId] || {};

  const added = [];
  const modified = [];
  const currentIds = new Set();

  for (const task of current) {
    currentIds.add(task.id);
    const stripped = stripTaskForFirestore(task);
    const json = JSON.stringify(stripped);
    if (!prev[task.id]) {
      added.push(stripped);
    } else if (prev[task.id] !== json) {
      modified.push(stripped);
    }
  }

  const deleted = [];
  for (const taskId of Object.keys(prev)) {
    if (!currentIds.has(taskId)) {
      deleted.push(taskId);
    }
  }

  return { added, modified, deleted };
}

// ── Update the last-synced snapshot after a successful write or remote load ──
function updateSnapshot(boardId, tasks) {
  if (!_lastSyncedTasks[boardId]) _lastSyncedTasks[boardId] = {};
  const snap = _lastSyncedTasks[boardId];
  // Build a fresh snapshot from the provided tasks
  const currentIds = new Set();
  for (const task of tasks) {
    const stripped = stripTaskForFirestore(task);
    snap[task.id] = JSON.stringify(stripped);
    currentIds.add(task.id);
  }
  // Remove tasks that no longer exist
  for (const id of Object.keys(snap)) {
    if (!currentIds.has(id)) delete snap[id];
  }
}

// ── Write only changed tasks to Firestore (per-task subcollection) ──
export async function syncBoardToFirestore(boardId) {
  const user = getCurrentUser();
  if (!user) return;
  if (!BOARDS[boardId]) return;
  if (!_initialLoadDone) return;
  if (BOARDS[boardId].tasks.length === 0) return;

  const { added, modified, deleted } = diffTasks(boardId);
  if (added.length === 0 && modified.length === 0 && deleted.length === 0) return;

  try {
    // Firestore batches are limited to 500 ops — split if needed
    const ops = [];
    for (const task of [...added, ...modified]) {
      ops.push({ type: 'set', task });
    }
    for (const taskId of deleted) {
      ops.push({ type: 'delete', taskId });
    }

    // Process in chunks of 500
    for (let i = 0; i < ops.length; i += 500) {
      const chunk = ops.slice(i, i + 500);
      const batch = writeBatch(db);
      for (const op of chunk) {
        if (op.type === 'set') {
          const ref = doc(db, 'boards', boardId, 'tasks', op.task.id);
          batch.set(ref, {
            ...op.task,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid,
          });
        } else {
          const ref = doc(db, 'boards', boardId, 'tasks', op.taskId);
          batch.delete(ref);
        }
      }
      await batch.commit();
    }

    // Update snapshot after successful write
    updateSnapshot(boardId, BOARDS[boardId].tasks);
  } catch (err) {
    console.warn('syncBoardToFirestore error:', err);
  }
}

// ── Debounced syncs ──
function debouncedSyncBoard(boardId) {
  debounce(() => syncBoardToFirestore(boardId), 1500, boardId);
}

function debouncedSyncSettings() {
  debounce(() => syncSettingsToFirestore(), 2000, '__settings__');
}

function debouncedSyncUserPrefs() {
  debounce(() => syncUserPrefsToFirestore(), 1500, '__userPrefs__');
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
      workspaceMembers: state.workspaceMembers || {},
      epics: EPICS || [],
      boardTemplates: state.boardTemplates || [],
      calendarEvents: state.calendarEvents || [],
      agingThresholdDays: state.agingThresholdDays ?? 5,
      fieldOptions: state.fieldOptions || {},
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
      // Display preferences
      theme: state.theme,
      accentColor: state.accentColor,
      showSwimlanes: state.showSwimlanes,
      showWip: state.showWip,
      compactCards: state.compactCards,
      currentView: state.currentView,
      currentBoard: state.currentBoard,
      currentNav: state.currentNav || 'overview',
      myWorkHeaderBg: state.myWorkHeaderBg || null,
      // Personal data
      myTodos: state.myTodos || [],
      profile: {
        bio: state.profile?.bio || '',
        location: state.profile?.location || '',
        timezone: state.profile?.timezone || '',
        skills: state.profile?.skills || [],
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('syncUserPrefsToFirestore error:', err);
  }
}

// ── One-time migration: move tasks array → subcollection ──
async function migrateBoard(boardId) {
  const boardRef = doc(db, 'boards', boardId);
  const boardSnap = await getDoc(boardRef);
  if (!boardSnap.exists()) return false;

  const data = boardSnap.data();
  // Already migrated or no tasks array — nothing to do
  if (data.migrated || !Array.isArray(data.tasks)) return false;

  console.info(`Migrating board "${boardId}" tasks to subcollection…`);
  const tasks = data.tasks;

  // Write each task as a subcollection doc (batched, 500 at a time)
  for (let i = 0; i < tasks.length; i += 500) {
    const chunk = tasks.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const task of chunk) {
      const stripped = stripTaskForFirestore(task);
      const ref = doc(db, 'boards', boardId, 'tasks', task.id);
      batch.set(ref, stripped);
    }
    await batch.commit();
  }

  // Remove old tasks array and mark as migrated
  await updateDoc(boardRef, {
    tasks: deleteField(),
    migrated: true,
  });

  console.info(`Migration complete for board "${boardId}" (${tasks.length} tasks).`);
  return true;
}

// ── Load all data from Firestore on startup ──
export async function loadFromFirestore() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    // Load all boards — migrate if needed, then read from subcollection
    const boardIds = Object.keys(BOARDS);
    await Promise.all(boardIds.map(async (boardId) => {
      // Run migration if this board still has the old tasks-array format
      await migrateBoard(boardId);

      // Load tasks from subcollection
      const tasksSnap = await getDocs(collection(db, 'boards', boardId, 'tasks'));
      if (!tasksSnap.empty) {
        const remoteTasks = [];
        tasksSnap.forEach(d => remoteTasks.push(d.data()));

        // Sort by column then position (matches drag-drop ordering)
        remoteTasks.sort((a, b) => {
          if (a.column !== b.column) return (a.column || '').localeCompare(b.column || '');
          return (a.position || 0) - (b.position || 0);
        });

        // Merge reviewImages: Firestore has Storage URLs; local may have legacy dataUrls.
        const localTasks = BOARDS[boardId].tasks;
        BOARDS[boardId].tasks = remoteTasks.map(fsTask => {
          const local = localTasks.find(t => t.id === fsTask.id);
          if (fsTask.reviewImages?.length || local?.reviewImages?.length) {
            const fsImages = fsTask.reviewImages || [];
            const localMap = new Map((local?.reviewImages || []).map(i => [i.id, i]));
            return {
              ...fsTask,
              reviewImages: fsImages.map(fsImg => {
                const loc = localMap.get(fsImg.id);
                return { ...fsImg, ...(loc?.dataUrl ? { dataUrl: loc.dataUrl } : {}) };
              }),
            };
          }
          return fsTask;
        });
      }

      // Initialize the diff snapshot from what we just loaded
      updateSnapshot(boardId, BOARDS[boardId].tasks);
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
      if (s.workspaceMembers && Object.keys(s.workspaceMembers).length > 0) state.workspaceMembers = s.workspaceMembers;
      if (Array.isArray(s.epics) && s.epics.length > 0) {
        EPICS.length = 0;
        s.epics.forEach(e => EPICS.push(e));
      }
      if (s.boardTemplates) state.boardTemplates = s.boardTemplates;
      if (s.calendarEvents) state.calendarEvents = s.calendarEvents;
      if (s.agingThresholdDays != null) state.agingThresholdDays = s.agingThresholdDays;
      if (s.fieldOptions && Object.keys(s.fieldOptions).length > 0) state.fieldOptions = s.fieldOptions;
    }

    // Load user prefs
    const prefsRef = doc(db, 'userPrefs', user.uid);
    const prefsSnap = await getDoc(prefsRef);
    if (prefsSnap.exists()) {
      const p = prefsSnap.data();
      if (p.theme) state.theme = p.theme;
      if (p.accentColor) state.accentColor = p.accentColor;
      if (p.showSwimlanes !== undefined) state.showSwimlanes = p.showSwimlanes;
      if (p.showWip !== undefined) state.showWip = p.showWip;
      if (p.compactCards !== undefined) state.compactCards = p.compactCards;
      if (p.currentView) state.currentView = p.currentView;
      if (p.currentBoard) state.currentBoard = p.currentBoard;
      if (p.currentNav) state.currentNav = p.currentNav;
      if (p.myWorkHeaderBg !== undefined) state.myWorkHeaderBg = p.myWorkHeaderBg;
      if (p.myTodos) state.myTodos = p.myTodos;
      if (p.profile) {
        state.profile = { ...state.profile, ...p.profile };
      }
    }

  } catch (err) {
    console.warn('loadFromFirestore error — falling back to localStorage:', err);
  }
  _initialLoadDone = true;
}

// ── Attach real-time listeners ──
export function initSync() {
  const user = getCurrentUser();
  if (!user) return;

  const boardIds = Object.keys(BOARDS);

  // Per-board: listen to the tasks subcollection for granular real-time updates
  boardIds.forEach((boardId) => {
    const tasksRef = collection(db, 'boards', boardId, 'tasks');
    onSnapshot(tasksRef, (snapshot) => {
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;

      let needsRender = false;
      const tasks = BOARDS[boardId].tasks;

      for (const change of changes) {
        const fsTask = change.doc.data();

        // Skip changes we wrote ourselves
        if (fsTask.updatedBy && fsTask.updatedBy === user.uid) {
          // Still update snapshot so diff stays in sync with Firestore
          if (_lastSyncedTasks[boardId]) {
            const stripped = stripTaskForFirestore(fsTask);
            _lastSyncedTasks[boardId][fsTask.id] = JSON.stringify(stripped);
          }
          continue;
        }

        if (change.type === 'removed') {
          const idx = tasks.findIndex(t => t.id === fsTask.id);
          if (idx !== -1) {
            tasks.splice(idx, 1);
            needsRender = true;
          }
          if (_lastSyncedTasks[boardId]) delete _lastSyncedTasks[boardId][fsTask.id];
          continue;
        }

        // 'added' or 'modified'
        const localIdx = tasks.findIndex(t => t.id === fsTask.id);
        const local = localIdx !== -1 ? tasks[localIdx] : null;

        // If local task is newer than Firestore (debounce in-flight), keep local
        const localTime = local?.updated_at ? new Date(local.updated_at).getTime() : 0;
        const fsTime = fsTask.updated_at ? new Date(fsTask.updated_at).getTime() : 0;
        if (local && localTime > fsTime) {
          // Update snapshot so we don't re-upload this task
          if (_lastSyncedTasks[boardId]) {
            const stripped = stripTaskForFirestore(fsTask);
            _lastSyncedTasks[boardId][fsTask.id] = JSON.stringify(stripped);
          }
          continue;
        }

        const merged = { ...fsTask };

        // Merge reviewImages: Firestore has Storage URLs, local may have dataUrls.
        // Use Firestore as source of truth for the image list; overlay any local
        // dataUrls (legacy) on top so they still display if present.
        if (fsTask.reviewImages?.length || local?.reviewImages?.length) {
          const fsImages = fsTask.reviewImages || [];
          const localMap = new Map((local?.reviewImages || []).map(i => [i.id, i]));
          merged.reviewImages = fsImages.map(fsImg => {
            const loc = localMap.get(fsImg.id);
            return { ...fsImg, ...(loc?.dataUrl ? { dataUrl: loc.dataUrl } : {}) };
          });
        }

        // Merge comments by ID so concurrent writes never drop each other's comments
        const mergeById = (localArr, fsArr) => {
          if (!localArr?.length && !fsArr?.length) return undefined;
          const map = new Map();
          for (const c of (localArr || [])) map.set(c.id, c);
          for (const c of (fsArr || [])) {
            if (!map.has(c.id)) map.set(c.id, c);
          }
          return [...map.values()];
        };
        const mergedComments = mergeById(local?.comments, fsTask.comments);
        if (mergedComments) merged.comments = mergedComments;
        const mergedReviewComments = mergeById(local?.reviewComments, fsTask.reviewComments);
        if (mergedReviewComments) merged.reviewComments = mergedReviewComments;

        if (localIdx !== -1) {
          tasks[localIdx] = merged;
        } else {
          tasks.push(merged);
        }

        // Update snapshot
        if (_lastSyncedTasks[boardId]) {
          const stripped = stripTaskForFirestore(fsTask);
          _lastSyncedTasks[boardId][fsTask.id] = JSON.stringify(stripped);
        }

        needsRender = true;
      }

      if (needsRender) {
        if (state.currentBoard === boardId && window._kanban?.renderBoard) {
          window._kanban.renderBoard();
        }
        window._kanban?.refreshHomeView?.();
        window._kanban?.refreshDetailPanel?.();
        window._kanban?.refreshActiveView?.();
      }
    }, (err) => {
      console.warn(`onSnapshot error for board ${boardId}/tasks:`, err);
    });
  });

  // Settings listener (unchanged — single doc)
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
    if (s.workspaceMembers && Object.keys(s.workspaceMembers).length > 0) state.workspaceMembers = s.workspaceMembers;
    if (Array.isArray(s.epics) && s.epics.length > 0) {
      EPICS.length = 0;
      s.epics.forEach(e => EPICS.push(e));
    }
    if (s.boardTemplates) state.boardTemplates = s.boardTemplates;
    if (s.calendarEvents) state.calendarEvents = s.calendarEvents;
    if (s.agingThresholdDays != null) state.agingThresholdDays = s.agingThresholdDays;
    if (s.fieldOptions && Object.keys(s.fieldOptions).length > 0) state.fieldOptions = s.fieldOptions;
    window._kanban?.refreshHomeView?.();
  }, (err) => {
    console.warn('onSnapshot error for settings/shared:', err);
  });

  // Expose debounced syncs on window so saveState() can trigger them
  window._syncBoard     = (boardId) => debouncedSyncBoard(boardId);
  window._syncUserPrefs = () => debouncedSyncUserPrefs();
  window._syncSettings  = () => debouncedSyncSettings();
}
