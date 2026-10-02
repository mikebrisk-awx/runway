# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Run locally:**
```bash
pnpm dev
# or: npx serve -l 3000 -s .
```

The app is a static site served directly — no build step, no bundler. All JS uses native ES modules loaded via `<script type="module">` in `index.html`. Changes to any `.js` or `.css` file take effect immediately on page reload.

There are no tests, no linting config, and no CI pipeline.

## Architecture

**Stack:** Vanilla JS (ES modules) + Firebase (Auth, Firestore, Storage). No framework, no bundler, no TypeScript.

**Entry point:** `index.html` loads `app/main.js` as a module. `main.js` initializes auth, loads state, wires up navigation, and kicks off the first render.

### State Layer (`app/state.js`, `app/data.js`)

- `app/data.js` defines the static `BOARDS` object — each board has a `columns` array and a mutable `tasks` array (starts empty, populated at runtime from Firestore).
- `app/state.js` exports a singleton `state` object (theme, currentBoard, profile, etc.) plus `loadState()` / `saveState()`. These handle **display preferences only** — theme, accent, last workspace, view toggles — under the `runwayPrefs` localStorage key. They move no content. `saveState()` persists those prefs, then triggers debounced Firestore syncs via `window._syncBoard`, `window._syncSettings`, `window._syncUserPrefs`.
- A task moved into a board's Done column is **unassigned automatically** (`unassignOnDone()` in `activity.js`, called from all three move paths: `dragdrop.js`, `context-menu.js`, `detail-panel.js`). The previous assignee is written to the task's activity log first so the completion stays attributable.
- Remote documents may predate the current schema, so `ensureTaskFields()` is applied wherever tasks enter memory — the initial per-board load and the real-time listener, both in `sync.js` — and `normalizeBoards()` covers columns after a full load.

### Persistence & Sync (`app/sync.js`, `app/firebase.js`)

- **Firestore is the only source of content.** localStorage holds nothing but display preferences (see above), so there is no local cache of tasks, epics, settings or team data, and no offline fallback: if `loadFromFirestore()` fails it logs and sets `window._contentLoadError`, and boards render empty rather than showing stale data.
- On startup: `loadState()` (prefs only) → `loadFromFirestore()` (all content). Whatever Firestore holds becomes the board, including nothing — tasks are never carried over from a previous state, so a task deleted remotely stays deleted. Shared settings are applied unconditionally, so a value cleared remotely clears locally. The one exception is a local task whose `updated_at` is newer than the incoming document (in-flight debounce guard).
- **Firestore structure:**
  - `boards/{boardId}/tasks/{taskId}` — per-task subcollection (migrated from a top-level `tasks` array)
  - `settings/shared` — WIP limits, column policies, **column names** (renames sync to everyone), team members, epics, workspace membership, field options. Applied through `applySharedSettings()`, used by both the initial load and the real-time listener so the two cannot drift.
  - `userPrefs/{uid}` — per-user display preferences (theme, currentBoard, etc.)
- `applySharedSettings()` prunes `workspaceMembers` entries whose board no longer exists. Without that, a removed workspace's membership round-trips forever (read into state, written straight back by `syncSettingsToFirestore`) and can never be deleted by anyone. Note this means loading the app rewrites the shared doc without those keys.
- Only `product-design` is defined in `data.js`; every other workspace is a custom one from `settings/shared.customWorkspaces`, hydrated into `BOARDS` at runtime. `ensureValidCurrentBoard()` in `state.js` catches a stored `currentBoard` naming a workspace that no longer exists.
- Real-time listeners via `onSnapshot` on each board's tasks subcollection and on `settings/shared`. Echo prevention: changes written by the current user (`updatedBy === user.uid`) and matching the last-synced snapshot are skipped.
- Base64 image dataUrls are stripped before Firestore writes; Firebase Storage URLs are kept in the task for multi-user sharing. The legacy `designKanbanImg_{taskId}` localStorage sidecar is gone — `loadState()` purges those keys along with the old `designKanban` blob.

### Auth (`app/auth.js`)

Google OAuth via Firebase. On first login, users are provisioned into `users/{uid}` with role `contributor` (or `admin` if they are the first user, or whatever role a pending invite specifies). `window._currentUser` is set after auth. The role system: `admin` (super admin, full access) vs `contributor`.

### Rendering (`app/render.js`)

Pure DOM manipulation — `innerHTML` templates. `renderBoard()` is the main render function for the kanban view. Each navigation section has its own `render*View()` function in its corresponding module (e.g. `renderCalendarView` in `calendar.js`). Views are destroyed and recreated on navigation (no virtual DOM diffing).

### Navigation Model (`app/main.js`)

The app has two levels:
1. **Home view** (`homeView` element) — workspace picker, shown when `state.currentBoard === 'home'`. Slides in over the main app.
2. **App shell** (`.app`) — sidebar + topbar + main area. The sidebar has nav icons (`data-nav` attributes) for: `overview` (kanban board), `projects`, `calendar`, `people` (My Work), `reviews`, `archives`, `initiatives`, `trends`.

Active views are appended to `.main` and removed on navigation; `hideAllViews()` cleans them up. The topbar's view-switcher tabs (board/capacity/charts/digest) control `state.currentView` within the overview.

### Cross-module Communication

Most callbacks use direct imports, but a few are wired through `window._kanban` (an object set in `main.js`) to break circular dependencies between `render.js` and `main.js`. Firestore sync functions are exposed as `window._syncBoard`, `window._syncSettings`, `window._syncUserPrefs`.

### Custom Workspaces

Beyond the hardcoded `COMPANY_WORKSPACES` in `home.js`, users can create custom workspaces stored in `state.customWorkspaces`. `hydrateCustomWorkspacesFromState()` in `home.js` dynamically adds entries to `BOARDS` for custom workspaces, which then get their own Firestore listeners attached via `window._ensureBoardSync`.

### Field Options

Task fields (requester, platform, type, size) have configurable options per workspace, stored in `state.workspaceFieldOptions[wsId]`. Falls back to `state.workspaceFieldOptions['__global__']` then legacy `state.fieldOptions`. Access via `getActiveFieldOptions(boardId)` from `state.js`.

### Shareable Views

`review-share.html` and `task-share.html` are standalone pages for public/external share links — they load their own scripts and connect to Firestore directly without auth.
