# Figma Comments Sidebar Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Figma Comments" sidebar tab to Runway that shows a real-time feed of unresolved comments from the team's Figma files via a webhook → Firestore → onSnapshot pipeline.

**Architecture:** A Vercel serverless function at `/api/figma-webhook.js` receives `FILE_COMMENT` events from Figma, verifies a passcode stored in Firestore, and writes/updates docs in a `figmaComments` Firestore collection. The new `app/figma-comments.js` module renders the feed via an `onSnapshot` listener on that collection. Admin setup is wired into the existing Integrations settings page.

**Tech Stack:** Vanilla JS ES modules (browser), Firebase Client SDK v10.12.0 (CDN), Firebase Admin SDK v12 (Node.js, Vercel function), Vercel serverless functions (CommonJS), Firestore.

## Global Constraints

- No bundler, no TypeScript — browser JS is plain ES modules loaded from CDN.
- Firebase Client SDK is imported from `https://www.gstatic.com/firebasejs/10.12.0/`.
- Vercel function uses CommonJS (`require` / `module.exports`) — do NOT use `import/export`.
- No test runner exists — verification is manual (browser DevTools + `curl`).
- Follow existing DOM manipulation patterns — `innerHTML` templates, no framework.
- `state.profile.authRole === 'admin'` is the admin check throughout the codebase.

---

### Task 1: Firebase Admin dependency + Vercel function

**Files:**
- Modify: `package.json`
- Create: `api/figma-webhook.js`

**Interfaces:**
- Produces: `POST /api/figma-webhook` endpoint that accepts Figma webhook payloads and writes to `figmaComments/{commentId}` in Firestore.

**Pre-requisite (manual — do once before this task):**

Get a Firebase service account:
1. Firebase Console → Project Settings → Service Accounts → "Generate new private key" → download JSON.
2. Add these three Vercel env vars (via `vercel env add` or the Vercel dashboard) for **all environments**:
   - `FIREBASE_PROJECT_ID` → value of `project_id` from the JSON (e.g. `runway-40912`)
   - `FIREBASE_CLIENT_EMAIL` → value of `client_email` from the JSON
   - `FIREBASE_PRIVATE_KEY` → value of `private_key` from the JSON (the full `-----BEGIN...` string including `\n` characters — paste as-is)

- [ ] **Step 1: Add `firebase-admin` to `package.json`**

Replace the full contents of `package.json` with:

```json
{
  "name": "runway",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "npx serve -l 3000 -s ."
  },
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

- [ ] **Step 2: Install the dependency**

```bash
pnpm install
```

Expected: `node_modules/firebase-admin/` created, `pnpm-lock.yaml` updated.

- [ ] **Step 3: Create `api/figma-webhook.js`**

```js
const admin = require('firebase-admin');

// Lazy singleton — survives warm Vercel invocations
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Cache passcode across warm invocations — busted on mismatch
let _cachedPasscode = null;

async function getPasscode() {
  if (_cachedPasscode) return _cachedPasscode;
  const snap = await db.collection('settings').doc('shared').get();
  _cachedPasscode = snap.data()?.figmaIntegration?.passcode || null;
  return _cachedPasscode;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;
  const passcode = await getPasscode();

  if (!passcode || body.passcode !== passcode) {
    _cachedPasscode = null; // Bust cache — passcode may have changed
    return res.status(400).json({ error: 'Invalid passcode' });
  }

  if (body.event_type !== 'FILE_COMMENT') {
    return res.status(200).json({ ok: true }); // Ignore ping and other events
  }

  const comments = Array.isArray(body.comment) ? body.comment : [body.comment].filter(Boolean);

  for (const comment of comments) {
    if (!comment?.id) continue;

    if (comment.resolved_at) {
      // Mark resolved — removed from unresolved feed by the client query
      try {
        await db.collection('figmaComments').doc(comment.id).update({
          resolved_at: comment.resolved_at,
        });
      } catch (_) {
        // Doc may not exist if webhook fired for a comment we never stored
      }
    } else {
      // New comment or reply
      await db.collection('figmaComments').doc(comment.id).set({
        id: comment.id,
        fileKey: body.file_key || '',
        fileName: body.file_name || 'Untitled File',
        fileUrl: `https://www.figma.com/design/${body.file_key}/`,
        message: comment.message || '',
        author: {
          name: comment.user?.handle || comment.user?.name || 'Unknown',
          photo: comment.user?.img_url || '',
        },
        nodeId: comment.client_meta?.node_id || null,
        created_at: comment.created_at || new Date().toISOString(),
        resolved_at: null,
        parentId: comment.parent_id || null,
      });
    }
  }

  return res.status(200).json({ ok: true });
};
```

- [ ] **Step 4: Deploy to Vercel preview to verify the function is reachable**

```bash
npx vercel
```

After deploy, note the preview URL (e.g. `https://runway-abc123.vercel.app`). Then test with curl — this will fail passcode check (no passcode in Firestore yet) but must return 400, not 500:

```bash
curl -s -X POST https://<preview-url>/api/figma-webhook \
  -H "Content-Type: application/json" \
  -d '{"event_type":"FILE_COMMENT","passcode":"wrong"}' \
  | cat
```

Expected output: `{"error":"Invalid passcode"}`

If you see a 500 or a function crash, check the Vercel function logs for the env var or Admin SDK init error.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml api/figma-webhook.js
git commit -m "feat: add Vercel webhook function for Figma comments"
```

---

### Task 2: State + Sync for `figmaIntegration`

**Files:**
- Modify: `app/state.js` (lines ~7–37, state object)
- Modify: `app/sync.js` (loadFromFirestore, settings onSnapshot)

**Interfaces:**
- Produces: `state.figmaIntegration` — `null` or `{ connected: true, webhookId, teamId, connectedAt }` — readable by any module that imports `state`.

- [ ] **Step 1: Add `figmaIntegration` to the state object in `app/state.js`**

In `app/state.js`, add one line to the `state` object after `slackWebhookUrl`:

```js
  slackWebhookUrl: '',
  figmaIntegration: null, // { connected, webhookId, teamId, connectedAt } or null
```

- [ ] **Step 2: Load `figmaIntegration` from Firestore on startup in `app/sync.js`**

In `loadFromFirestore()`, inside the block that processes `settingsSnap.data()` (after `if (s.workspaceFieldOptions ...)`), add:

```js
if (s.figmaIntegration?.webhookId) {
  state.figmaIntegration = {
    connected: true,
    webhookId: s.figmaIntegration.webhookId,
    teamId: s.figmaIntegration.teamId,
    connectedAt: s.figmaIntegration.connectedAt || null,
  };
} else {
  state.figmaIntegration = null;
}
```

- [ ] **Step 3: Keep `figmaIntegration` in sync via the settings `onSnapshot` listener**

In `initSync()`, inside the settings `onSnapshot` callback (after `if (s.workspaceFieldOptions ...)`), add the same block:

```js
if (s.figmaIntegration?.webhookId) {
  state.figmaIntegration = {
    connected: true,
    webhookId: s.figmaIntegration.webhookId,
    teamId: s.figmaIntegration.teamId,
    connectedAt: s.figmaIntegration.connectedAt || null,
  };
} else {
  state.figmaIntegration = null;
}
```

- [ ] **Step 4: Verify in browser**

Open the app. Open DevTools console and run:
```js
import('./app/state.js').then(m => console.log(m.state.figmaIntegration))
```
Expected: `null` (no integration connected yet). No errors.

- [ ] **Step 5: Commit**

```bash
git add app/state.js app/sync.js
git commit -m "feat: add figmaIntegration to state and sync from Firestore"
```

---

### Task 3: Settings panel — Figma integration UI

**Files:**
- Modify: `index.html` (inside `#integrationsSettingsPage`)
- Modify: `app/settings.js` (add Figma connect/disconnect logic to `initSettings()`)

**Interfaces:**
- Consumes: `state.figmaIntegration` (from Task 2), `state.profile.authRole`
- Produces: On "Connect": writes `figmaIntegration: { webhookId, teamId, passcode, connectedAt }` to Firestore `settings/shared`. On "Disconnect": clears it. `state.figmaIntegration` is updated by the onSnapshot listener (Task 2).

- [ ] **Step 1: Add Figma integration HTML to `index.html`**

In `index.html`, find `<div class="settings-subpage" id="integrationsSettingsPage">`. After the closing `</div>` of the Slack section (look for `id="testSlackWebhook"`), add:

```html
<div class="settings-section" id="figmaIntegrationSection">
  <h3>Figma</h3>
  <p class="settings-hint">Connect your Figma team to see unresolved comments in the sidebar. Requires a Figma Personal Access Token and your Team ID. Only admins can connect or disconnect.</p>

  <div id="figmaNotAdmin" style="display:none;">
    <p class="settings-hint" style="color:var(--text-secondary);">Ask your admin to connect Figma.</p>
  </div>

  <div id="figmaConnectForm">
    <div class="settings-field">
      <label for="figmaTokenInput">Personal Access Token</label>
      <input type="password" id="figmaTokenInput" placeholder="figd_..." autocomplete="off" />
    </div>
    <div class="settings-field">
      <label for="figmaTeamIdInput">Team ID</label>
      <input type="text" id="figmaTeamIdInput" placeholder="123456789" />
      <p class="settings-hint">Find it in your Figma team URL: figma.com/files/team/<strong>TEAM_ID</strong>/...</p>
    </div>
    <button class="btn-primary" id="connectFigmaBtn">Connect</button>
    <span id="figmaConnectStatus" style="margin-left:10px;font-size:13px;"></span>
  </div>

  <div id="figmaConnectedStatus" style="display:none;">
    <p class="settings-hint" style="color:var(--green,#10b981);">&#10003; Connected — Team ID: <span id="figmaConnectedTeamId"></span></p>
    <p class="settings-hint" style="color:var(--text-secondary);font-size:12px;">Connected <span id="figmaConnectedAt"></span></p>
    <button class="btn-secondary" id="disconnectFigmaBtn">Disconnect</button>
    <span id="figmaDisconnectStatus" style="margin-left:10px;font-size:13px;"></span>
  </div>
</div>
```

- [ ] **Step 2: Add Figma integration logic to `initSettings()` in `app/settings.js`**

At the end of the `initSettings()` function body, before the closing `}`, add:

```js
// ── Figma Integration ──────────────────────────────────────────────────────
document.getElementById('openIntegrationsSettings')?.addEventListener('click', () => {
  renderFigmaIntegrationUI();
}, { once: false }); // re-render each time panel opens

function renderFigmaIntegrationUI() {
  const isAdmin = state.profile?.authRole === 'admin';
  const integration = state.figmaIntegration;

  document.getElementById('figmaNotAdmin').style.display    = isAdmin ? 'none' : '';
  document.getElementById('figmaConnectForm').style.display = isAdmin && !integration?.connected ? '' : 'none';
  document.getElementById('figmaConnectedStatus').style.display = integration?.connected ? '' : 'none';

  if (integration?.connected) {
    document.getElementById('figmaConnectedTeamId').textContent = integration.teamId || '';
    const at = integration.connectedAt ? new Date(integration.connectedAt).toLocaleDateString() : '';
    document.getElementById('figmaConnectedAt').textContent = at;
  }
}

document.getElementById('connectFigmaBtn')?.addEventListener('click', async () => {
  const token  = document.getElementById('figmaTokenInput').value.trim();
  const teamId = document.getElementById('figmaTeamIdInput').value.trim();
  const status = document.getElementById('figmaConnectStatus');

  if (!token || !teamId) {
    status.textContent = 'Token and Team ID are required.';
    status.style.color = 'var(--red, #ef4444)';
    return;
  }

  const btn = document.getElementById('connectFigmaBtn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  status.textContent = '';

  try {
    // Generate a random passcode
    const passcode = Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const endpoint = window.location.origin + '/api/figma-webhook';

    const res = await fetch('https://api.figma.com/v2/webhooks', {
      method: 'POST',
      headers: {
        'X-Figma-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'FILE_COMMENT',
        team_id: teamId,
        endpoint,
        passcode,
        status: 'ACTIVE',
        description: 'Runway Figma Comments',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Figma API error ${res.status}`);
    }

    const data = await res.json();
    const connectedAt = new Date().toISOString();

    // Write to Firestore settings/shared — function reads passcode from here
    const { doc, setDoc, serverTimestamp } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
    );
    const { db: firestoreDb } = await import('./firebase.js');

    await setDoc(
      doc(firestoreDb, 'settings', 'shared'),
      {
        figmaIntegration: {
          connected: true,
          webhookId: data.id || data.webhook_id || '',
          teamId,
          passcode,
          connectedAt,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    status.textContent = 'Connected!';
    status.style.color = 'var(--green, #10b981)';
    document.getElementById('figmaTokenInput').value = '';
    // state.figmaIntegration is updated by the onSnapshot in sync.js
    setTimeout(renderFigmaIntegrationUI, 500);
  } catch (err) {
    status.textContent = err.message || 'Connection failed.';
    status.style.color = 'var(--red, #ef4444)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
});

document.getElementById('disconnectFigmaBtn')?.addEventListener('click', async () => {
  const integration = state.figmaIntegration;
  if (!integration?.connected) return;

  const btn = document.getElementById('disconnectFigmaBtn');
  const status = document.getElementById('figmaDisconnectStatus');
  btn.disabled = true;
  btn.textContent = 'Disconnecting…';
  status.textContent = '';

  // Prompt for token to call Figma DELETE (token is never stored server-side)
  const token = prompt('Enter your Figma Personal Access Token to deregister the webhook:');
  if (!token) {
    btn.disabled = false;
    btn.textContent = 'Disconnect';
    return;
  }

  try {
    if (integration.webhookId) {
      await fetch(`https://api.figma.com/v2/webhooks/${integration.webhookId}`, {
        method: 'DELETE',
        headers: { 'X-Figma-Token': token },
      });
    }

    const { doc, setDoc, deleteField, serverTimestamp } = await import(
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
    );
    const { db: firestoreDb } = await import('./firebase.js');

    await setDoc(
      doc(firestoreDb, 'settings', 'shared'),
      { figmaIntegration: deleteField(), updatedAt: serverTimestamp() },
      { merge: true }
    );

    status.textContent = 'Disconnected.';
    setTimeout(renderFigmaIntegrationUI, 500);
  } catch (err) {
    status.textContent = err.message || 'Failed to disconnect.';
    status.style.color = 'var(--red, #ef4444)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Disconnect';
  }
});
```

- [ ] **Step 3: Verify in browser**

1. Open Settings → Integrations. The Figma section should appear.
2. Log in as a non-admin — the "Ask your admin" message should show instead of the form.
3. Log in as an admin — the connect form should appear with Token and Team ID inputs.
4. No console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html app/settings.js
git commit -m "feat: add Figma integration connect/disconnect to Settings"
```

---

### Task 4: `app/figma-comments.js` module + modal pre-fill

**Files:**
- Create: `app/figma-comments.js`
- Modify: `app/modal.js` (add optional `prefill` param to `openModal`)

**Interfaces:**
- Consumes: `state.figmaIntegration` (Task 2), `db` from `./firebase.js`, `openModal` from `./modal.js`, `escapeHtml`/`formatDate` from `./utils.js`
- Produces: `renderFigmaCommentsView(container)`, `renderFigmaCommentsTopbarNav(container)`, `getFigmaCommentCount()` → `number`

- [ ] **Step 1: Add optional `prefill` param to `openModal` in `app/modal.js`**

Change the signature and add two lines after `_pendingImages = []`:

```js
export function openModal(prefill = {}) {
  document.getElementById('addTaskModal').classList.add('show');
  document.getElementById('taskTitle').value = prefill.title || '';
  document.getElementById('taskDesc').value  = prefill.desc  || '';
```

The rest of `openModal` is unchanged — it will overwrite priority/assignee/etc. with defaults, which is fine.

- [ ] **Step 2: Create `app/figma-comments.js`**

```js
/* ========================================
   Figma Comments View
   ======================================== */

import { db } from './firebase.js';
import { state } from './state.js';
import { openModal } from './modal.js';
import { escapeHtml, timeAgo } from './utils.js';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _unsubscribe = null;
let _currentCount = 0;

export function getFigmaCommentCount() {
  return _currentCount;
}

export function renderFigmaCommentsTopbarNav(container) {
  container.innerHTML = ''; // No sub-tabs needed
}

export function renderFigmaCommentsView(container) {
  // Tear down previous listener before re-rendering
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

  const isAdmin      = state.profile?.authRole === 'admin';
  const integration  = state.figmaIntegration;

  if (!integration?.connected) {
    container.innerHTML = `
      <div class="figma-comments-empty-state">
        <div class="figma-comments-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M16 16C16 13.8 17.8 12 20 12H28C30.2 12 32 13.8 32 16V24C32 26.2 30.2 28 28 28H20C17.8 28 16 26.2 16 24V16Z" stroke="var(--text-secondary)" stroke-width="2"/>
            <path d="M20 34L16 38V28" stroke="var(--text-secondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        ${isAdmin
          ? `<p class="figma-comments-empty-title">Connect Figma to see team comments</p>
             <p class="figma-comments-empty-sub">Open <button class="link-btn" id="fcGoToSettings">Settings → Integrations</button> to connect your Figma team.</p>`
          : `<p class="figma-comments-empty-title">Figma not connected</p>
             <p class="figma-comments-empty-sub">Ask your admin to connect Figma in Settings.</p>`
        }
      </div>`;

    if (isAdmin) {
      container.querySelector('#fcGoToSettings')?.addEventListener('click', () => {
        document.getElementById('settingsBtn')?.click();
      });
    }
    return;
  }

  container.innerHTML = `
    <div class="figma-comments-view">
      <div class="figma-comments-list" id="figmaCommentsList">
        ${_skeletons()}
      </div>
    </div>`;

  const q = query(
    collection(db, 'figmaComments'),
    where('resolved_at', '==', null),
    orderBy('created_at', 'desc')
  );

  _unsubscribe = onSnapshot(q, (snap) => {
    const comments = [];
    snap.forEach(d => comments.push(d.data()));
    _currentCount = comments.length;
    _updateBadge(comments.length);

    const list = container.querySelector('#figmaCommentsList');
    if (!list) return;

    if (comments.length === 0) {
      list.innerHTML = `
        <div class="figma-comments-empty-state">
          <p class="figma-comments-empty-title">All caught up</p>
          <p class="figma-comments-empty-sub">No unresolved Figma comments right now.</p>
        </div>`;
      return;
    }

    const commentMap = new Map(comments.map(c => [c.id, c]));
    list.innerHTML = comments.map(c => _commentCard(c, commentMap)).join('');

    list.querySelectorAll('.figma-comment-card').forEach(card => {
      const id      = card.dataset.id;
      const comment = comments.find(c => c.id === id);
      if (!comment) return;

      // Card click → open in Figma
      card.addEventListener('click', (e) => {
        if (e.target.closest('.figma-create-task-btn')) return;
        const nodeParam = comment.nodeId ? `?node-id=${encodeURIComponent(comment.nodeId)}` : '';
        window.open(`${comment.fileUrl}${nodeParam}`, '_blank', 'noopener,noreferrer');
      });

      // "Create task" → pre-fill modal
      card.querySelector('.figma-create-task-btn')?.addEventListener('click', () => {
        state.addTaskColumn = null;
        openModal({
          title: comment.message.slice(0, 120),
          desc:  `Figma comment from "${comment.fileName}" by ${comment.author.name}`,
        });
      });
    });
  }, (err) => {
    console.warn('figmaComments onSnapshot error:', err);
  });
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _commentCard(c, commentMap = new Map()) {
  const initials = (c.author.name || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const time = timeAgo(c.created_at);
  const parentComment = c.parentId ? commentMap.get(c.parentId) : null;
  const parentSnippet = parentComment
    ? parentComment.message.slice(0, 60) + (parentComment.message.length > 60 ? '…' : '')
    : null;

  return `
    <div class="figma-comment-card" data-id="${c.id}">
      <div class="figma-comment-file">
        ${c.parentId ? '<span class="figma-reply-badge">↩ Reply</span>' : ''}
        <span class="figma-comment-filename">${escapeHtml(c.fileName)}</span>
        <span class="figma-open-icon" title="Open in Figma">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </span>
      </div>
      <div class="figma-comment-meta">
        <div class="figma-comment-avatar">
          ${c.author.photo
            ? `<img src="${escapeHtml(c.author.photo)}" alt="${escapeHtml(c.author.name)}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <span class="figma-avatar-initials"
                style="${c.author.photo ? 'display:none' : 'display:flex'}">${initials}</span>
        </div>
        <span class="figma-comment-author">${escapeHtml(c.author.name)}</span>
        <span class="figma-comment-time">· ${time}</span>
      </div>
      ${parentSnippet ? `<div class="figma-reply-context">"${escapeHtml(parentSnippet)}"</div>` : ''}
      <div class="figma-comment-message">${escapeHtml(c.message)}</div>
      <button class="figma-create-task-btn">Create task</button>
    </div>`;
}

function _skeletons() {
  return Array.from({ length: 3 }, () => `
    <div class="figma-comment-card figma-skeleton">
      <div class="figma-skeleton-line" style="width:40%"></div>
      <div class="figma-skeleton-line" style="width:100%;margin-top:8px"></div>
      <div class="figma-skeleton-line" style="width:70%"></div>
    </div>`).join('');
}

function _updateBadge(count) {
  const badge = document.getElementById('figmaCommentsBadge');
  if (badge) badge.textContent = count > 0 ? String(count) : '';
}
```

- [ ] **Step 3: Add CSS for the new components to `styles.css`**

Append to the end of `styles.css`:

```css
/* ── Figma Comments ─────────────────────────────────────────────── */
.figma-comments-view {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.figma-comments-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.figma-comment-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  position: relative;
}

.figma-comment-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
}

.figma-comment-file {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.figma-comment-filename { font-weight: 600; }

.figma-open-icon {
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
  color: var(--text-secondary);
}

.figma-comment-card:hover .figma-open-icon { opacity: 1; }

.figma-reply-badge {
  background: var(--bg-tertiary, var(--bg-secondary));
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  color: var(--text-secondary);
}

.figma-comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.figma-comment-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.figma-comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.figma-avatar-initials {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  align-items: center;
  justify-content: center;
}

.figma-comment-author {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.figma-comment-time {
  font-size: 12px;
  color: var(--text-secondary);
}

.figma-reply-context {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  margin-bottom: 6px;
  padding-left: 8px;
  border-left: 2px solid var(--border);
  line-height: 1.4;
}

.figma-comment-message {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 10px;
}

.figma-create-task-btn {
  display: none;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.figma-comment-card:hover .figma-create-task-btn { display: inline-flex; }
.figma-create-task-btn:hover { background: var(--accent); color: #fff; }

.figma-comments-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  gap: 8px;
}

.figma-comments-empty-icon { opacity: 0.4; margin-bottom: 8px; }

.figma-comments-empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.figma-comments-empty-sub {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--accent);
  cursor: pointer;
  font-size: inherit;
  text-decoration: underline;
}

/* Skeleton loading */
.figma-skeleton { pointer-events: none; }

.figma-skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg,
    var(--border) 25%,
    var(--bg-secondary) 50%,
    var(--border) 75%);
  background-size: 200% 100%;
  animation: figma-shimmer 1.4s infinite;
  margin-bottom: 6px;
}

@keyframes figma-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 4: Verify the module loads without errors**

In the browser console:
```js
import('./app/figma-comments.js').then(m => console.log('exports:', Object.keys(m)))
```
Expected: `exports: ['getFigmaCommentCount', 'renderFigmaCommentsTopbarNav', 'renderFigmaCommentsView']`

- [ ] **Step 5: Commit**

```bash
git add app/figma-comments.js app/modal.js styles.css
git commit -m "feat: add figma-comments view module and CSS"
```

---

### Task 5: Wire up `index.html` + `main.js`

**Files:**
- Modify: `index.html` (sidebar button + badge)
- Modify: `app/main.js` (import, nav case, topbar function, badge wiring, `refreshActiveView`)

**Interfaces:**
- Consumes: `renderFigmaCommentsView`, `renderFigmaCommentsTopbarNav`, `getFigmaCommentCount` from `./figma-comments.js`

- [ ] **Step 1: Add sidebar button and badge to `index.html`**

Find the archives nav button (it ends with `</button>` and contains `data-nav="archives"`). Insert the new button directly after it:

```html
        <button class="sb-icon" data-nav="figma-comments" title="Figma Comments">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="sb-badge" id="figmaCommentsBadge"></span>
        </button>
```

- [ ] **Step 2: Add import to `app/main.js`**

Near the top of `main.js`, after the `renderArchivesView` import line, add:

```js
import { renderFigmaCommentsView, renderFigmaCommentsTopbarNav, getFigmaCommentCount } from './figma-comments.js';
```

- [ ] **Step 3: Add `showFigmaCommentsTopbar` helper function in `main.js`**

After the `showInitiativesTopbar()` function definition (around line 208), add:

```js
function showFigmaCommentsTopbar() {
  viewSwitcher.style.display = 'none';
  let fn = document.getElementById('figmaCommentsTopbarNav');
  if (!fn) {
    fn = document.createElement('div');
    fn.id = 'figmaCommentsTopbarNav';
    fn.className = 'view-switcher';
    viewSwitcher.parentNode.insertBefore(fn, viewSwitcher);
  }
  renderFigmaCommentsTopbarNav(fn);
}
```

- [ ] **Step 4: Add `figmaCommentsTopbarNav` cleanup to `restoreTopbar()` in `main.js`**

In `restoreTopbar()`, add one line with the other `remove()` calls:

```js
document.getElementById('figmaCommentsTopbarNav')?.remove();
```

- [ ] **Step 5: Add `figma-comments` nav case to the sidebar click handler in `main.js`**

In the `nav` switch inside the `querySelectorAll('.sb-icon[data-nav]').forEach` block, after the `else if (nav === 'initiatives')` block, add:

```js
    } else if (nav === 'figma-comments') {
      hideAllViews();
      document.getElementById('boardTitle').textContent = 'Figma Comments';
      const bc = document.getElementById('breadcrumbBoard');
      if (bc) bc.textContent = 'Figma Comments';
      const badge = document.getElementById('boardBadge');
      if (badge) badge.style.display = 'none';
      document.getElementById('boardActionsBtn').style.display = 'none';
      const fv = document.createElement('div');
      fv.id = 'figmaCommentsView';
      fv.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';
      document.querySelector('.main').appendChild(fv);
      showFigmaCommentsTopbar();
      renderFigmaCommentsView(fv);
```

- [ ] **Step 6: Add `figmaCommentsView` cleanup to `hideAllViews()` in `main.js`**

In `hideAllViews()`, after the `initiativesV?.remove()` lines, add:

```js
  const figmaCommentsV = document.getElementById('figmaCommentsView');
  if (figmaCommentsV) figmaCommentsV.remove();
```

- [ ] **Step 7: Add `figma-comments` to `refreshActiveView` in `main.js`**

In the `viewMap` object inside `window._kanban.refreshActiveView`, add:

```js
    'figma-comments': 'figmaCommentsView',
```

In the `renderers` object inside the same function, add:

```js
    'figma-comments': renderFigmaCommentsView,
```

- [ ] **Step 8: Wire the badge count in `main.js`**

After the `updateMyWorkBadge()` function definition, add:

```js
function updateFigmaCommentsBadge() {
  const badge = document.getElementById('figmaCommentsBadge');
  if (!badge) return;
  const count = getFigmaCommentCount();
  badge.textContent = count > 0 ? String(count) : '';
}
```

Then inside `window._kanban.refreshActiveView`, at the end of its function body, call:

```js
  updateFigmaCommentsBadge();
```

- [ ] **Step 9: End-to-end manual verification**

1. Open the app in the browser (on `localhost:3000`).
2. The speech-bubble sidebar icon should appear between Archives and Trends.
3. Click it — the main area should show "Figma not connected" (for non-admins) or the connect form prompt (for admins). No JS errors.
4. Log in as admin → go to Settings → Integrations → verify the Figma section is visible with Token + Team ID inputs.
5. Enter a valid Figma token and team ID → click Connect. Verify "Connected!" status and the connected state renders.
6. Send a test webhook payload to the deployed Vercel function using curl:

```bash
curl -s -X POST https://<your-vercel-url>/api/figma-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "FILE_COMMENT",
    "passcode": "<the-passcode-from-firestore-settings-shared>",
    "file_key": "test123",
    "file_name": "Test File",
    "comment": [{
      "id": "test-comment-1",
      "message": "This button radius feels too sharp.",
      "created_at": "2026-06-24T12:00:00Z",
      "resolved_at": null,
      "parent_id": null,
      "user": { "handle": "Jane Smith", "img_url": "" },
      "client_meta": { "node_id": "1:23" }
    }]
  }' | cat
```

Expected: `{"ok":true}`

7. Reload the app → click the Figma Comments tab → the test comment card should appear.
8. Click the card — should open `figma.com/design/test123/?node-id=1%3A23` in a new tab.
9. Hover the card — "Create task" button should appear. Click it — modal should open with the comment text pre-filled as the title.

- [ ] **Step 10: Commit**

```bash
git add index.html app/main.js
git commit -m "feat: wire Figma Comments sidebar tab into navigation"
```

---

## Post-deploy checklist (production)

After merging to main and Vercel deploys:
1. Admin opens Settings → Integrations → Figma, enters token + team ID, clicks Connect. (The endpoint URL will be the production domain.)
2. Post a comment on any file in the Figma team.
3. Within seconds, the comment should appear in the Figma Comments tab.
