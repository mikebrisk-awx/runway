# Figma Comments Sidebar Tab — Design Spec

**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

A new sidebar tab in Runway that shows a real-time feed of unresolved Figma comments across all files in the team's Figma workspace. Comments arrive via a Figma team-scoped webhook — no file URL management required. Each comment can be opened in Figma or converted into a Runway task in one click.

---

## Architecture

### 1. Vercel Serverless Function — `/api/figma-webhook.js`

- Receives `POST` requests from Figma for `FILE_COMMENT` events.
- Verifies the request by comparing `req.body.passcode` against the stored passcode in Firestore `settings/shared.figmaIntegration.passcode`. Figma sends the passcode as a plain field in the JSON body (not an HMAC header). Rejects mismatched requests with `400`.
- On a new comment event: writes a doc to `figmaComments/{commentId}` in Firestore.
- On a resolved comment event (`resolved_at` is set in the payload): updates the Firestore doc to set `resolved_at`, effectively removing it from the unresolved feed.
- Responds `200` immediately to avoid Figma retries.

**Figma webhook events handled:**
- `FILE_COMMENT` — new comment or reply posted
- `FILE_COMMENT` with `resolved_at` — comment resolved

### 2. Firestore Collection — `figmaComments`

Each document keyed by Figma comment ID:

```
figmaComments/{commentId}
  id: string              // Figma comment ID
  fileKey: string         // Figma file key
  fileName: string        // Human-readable file name
  fileUrl: string         // https://figma.com/design/{fileKey}/...
  message: string         // Comment text
  author: {
    name: string
    photo: string         // Avatar URL from Figma
  }
  nodeId: string | null   // For deep-linking to the specific frame/node
  created_at: string      // ISO timestamp
  resolved_at: string | null  // null = unresolved
  parentId: string | null // Set if this is a reply; parent comment ID
```

Query for the sidebar feed: `where resolved_at == null, orderBy created_at desc`.

### 3. Settings Panel — Figma Integration (admin-only)

New "Integrations" section in the existing settings panel, visible only to users with `role === 'admin'`.

**Fields:**
- Figma Personal Access Token (password-masked input)
- Figma Team ID (text input)

**"Connect" button flow:**
1. Generates a random passcode string.
2. Calls `POST https://api.figma.com/v2/webhooks` with the token, registering a `FILE_COMMENT` webhook for the team, pointing to `window.location.origin + '/api/figma-webhook'` as the endpoint URL.
3. Saves the passcode, webhook ID, token, and team ID to `settings/shared.figmaIntegration` in Firestore.
4. Shows "Connected" status with the connection timestamp.

**"Disconnect" button flow:**
1. Calls `DELETE https://api.figma.com/v2/webhooks/{webhookId}` to deregister.
2. Clears `settings/shared.figmaIntegration` in Firestore.

**Non-admin view:** The Integrations section is hidden entirely for non-admins.

### 4. Figma Comments Module — `app/figma-comments.js`

New module following the same pattern as other view modules (e.g. `reviews.js`, `trends.js`).

**Exports:**
- `renderFigmaCommentsView(container)` — renders the full view into a container div
- `renderFigmaCommentsTopbarNav(container)` — renders the topbar (just a title, no sub-tabs needed)

**Real-time data:** Attaches a Firestore `onSnapshot` listener on `figmaComments` (unresolved, newest-first). Unsubscribes when the view is removed from DOM.

---

## UI

### Sidebar Icon

Inserted between the Reviews and Trends nav items in `index.html`. Uses a speech-bubble SVG icon, `data-nav="figma-comments"`, `title="Figma Comments"`.

Badge: red pill showing unresolved comment count, same implementation as the My Work badge (`#figmaCommentsBadge`). Updates on every Firestore snapshot.

### Comment Feed

Each card:
```
┌─────────────────────────────────────────────────┐
│ Homepage Redesign                    ↗ (open)   │
│ ● Jane Smith  ·  2 min ago                      │
│ "The button radius feels too sharp here, can    │
│  we soften it to match the card style?"         │
│                              [Create task]      │
└─────────────────────────────────────────────────┘
```

- **Card click** (anywhere except the "Create task" button): opens `figma.com/design/{fileKey}?node-id={nodeId}` in a new tab.
- **"Create task" button**: calls `openModal()` with the task title pre-filled as the comment message (truncated to 120 chars) and the description pre-filled as `"Figma comment from {fileName} by {author.name}"`.
- Author avatar: rendered as an `<img>` using Figma's avatar URL; falls back to initials if the image fails.
- Timestamps rendered as relative time ("2 min ago", "3 hours ago") using the existing `formatDate` utility in `app/utils.js`.
- Comment text truncated to 2 lines with CSS `-webkit-line-clamp`.
- Replies (comments with `parentId`) are shown as standalone cards in the flat feed. The card displays the reply text with a subtle "↩ Reply" label and the parent comment's first 60 chars as context beneath the author line.

### Empty & Loading States

- **Loading**: skeleton shimmer cards (3), same style as other loading states in the app.
- **No unresolved comments**: centered illustration + "You're all caught up — no unresolved Figma comments."
- **Not connected (admin)**: "Connect your Figma team in Settings to start seeing comments." with a button that scrolls to the Settings integration section.
- **Not connected (non-admin)**: "Ask your admin to connect Figma to enable this view."

---

## `main.js` Changes

- Import `renderFigmaCommentsView`, `renderFigmaCommentsTopbarNav` from `./figma-comments.js`.
- Add `figma-comments` case to the sidebar nav click handler (same pattern as `reviews`, `archives`, etc.).
- Add `figma-comments` to the `viewMap` and `renderers` map inside `refreshActiveView`.
- Wire `#figmaCommentsBadge` count update after Firestore load, similar to `updateMyWorkBadge`.

---

## Deployment

The Vercel function at `/api/figma-webhook.js` will be picked up automatically by Vercel on next deploy. The webhook endpoint URL will be `https://{vercel-project-url}/api/figma-webhook`.

The admin must complete the one-time "Connect" flow in Settings after deployment for webhooks to begin flowing.

---

## Out of Scope

- Replying to Figma comments from within Runway.
- Showing resolved comments (filtered out by design).
- Support for Figma files outside the configured team.
- Notification/push alerts for new comments.
