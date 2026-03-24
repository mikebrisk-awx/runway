/* ========================================
   Card Detail Side Panel — Redesigned
   ======================================== */

import { state, saveState, getCurrentBoard, getTask, BOARDS } from './state.js';
import { escapeHtml, capitalize, formatDate, generateId, timeAgo, getInitials, assigneeAvatarContent, attachAssigneeAutocomplete } from './utils.js';
import { PRIORITY_COLORS, PRIORITY_LABELS } from './data.js';
import { ACTIVITY_ICONS, logCommentAdded, logChecklistToggled, logLinkAdded, logDependencyAdded, logDependencyRemoved, logBlocked, logUnblocked, logTaskEdited } from './activity.js';
import { renderBoard } from './render.js';

export function openDetailPanel(taskId) {
  state.detailPanelTaskId = taskId;
  document.getElementById('detailOverlay').classList.add('show');
  renderDetailPanel();
}

export function closeDetailPanel() {
  state.detailPanelTaskId = null;
  document.getElementById('detailOverlay').classList.remove('show');
}

// ── Collapsible section helper ──
function section({ id, icon, iconColor, title, count, hasData, defaultOpen, noToggle, body }) {
  if (noToggle) {
    return `
      <div class="dp-section" data-section-id="${id}">
        <div class="dp-divider"></div>
        <div class="dp-section-title-plain">${title}${count ? ` <span class="dp-section-count">${count}</span>` : ''}</div>
        <div class="dp-section-body open" data-body="${id}">
          ${body}
        </div>
      </div>
    `;
  }
  const open = defaultOpen !== undefined ? defaultOpen : hasData;
  return `
    <div class="dp-section" data-section-id="${id}">
      <div class="dp-divider"></div>
      <button class="dp-section-toggle ${open ? 'open' : ''}" data-toggle="${id}">
        <span class="dp-section-title">${title}</span>
        ${count ? `<span class="dp-section-count">${count}</span>` : ''}
        ${!hasData ? `<span class="dp-section-add-hint">+ Add</span>` : ''}
        <svg class="dp-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="dp-section-body ${open ? 'open' : ''}" data-body="${id}">
        ${body}
      </div>
    </div>
  `;
}

export function renderDetailPanel() {
  const task = getTask(state.detailPanelTaskId);
  if (!task) return;

  const panel = document.getElementById('detailPanelBody');
  const board = getCurrentBoard();
  const colName = board.columns.find(c => c.id === task.column)?.name || task.column;
  const initials = getInitials(task.assignee);
  const dueStr = task.due ? formatDate(task.due) : '';
  const isOverdue = task.due && new Date(task.due) < new Date();

  // Blocked strip
  const blockedStrip = task.blocked ? `
    <div class="blocked-strip">
      <div class="blocked-strip-content">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        <span>Blocked: ${escapeHtml(task.blocked.reason)}</span>
      </div>
      <button class="btn-mini unblock-btn">Unblock</button>
    </div>
  ` : '';

  // Checklist
  const checkDone = task.checklist ? task.checklist.filter(c => c.done).length : 0;
  const checkTotal = task.checklist ? task.checklist.length : 0;
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  // ── Header ──
  const headerMeta = `
    <div class="dp-header-meta">
      <div class="dp-meta-person">
        <span class="dp-meta-avatar">${assigneeAvatarContent(task.assignee, state.profile)}</span>
        <span>${escapeHtml(task.assignee)}</span>
      </div>
      ${dueStr ? `
        <span class="dp-meta-due ${isOverdue ? 'overdue' : ''}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${dueStr}
        </span>
      ` : ''}
    </div>
    <textarea class="dp-title" id="detailTitle">${escapeHtml(task.title)}</textarea>
  `;

  const headerHtml = `
    ${blockedStrip}
    <div class="dp-header-area">
      <div class="dp-header-content">
        ${headerMeta}
        <textarea class="dp-desc-inline" id="detailDesc" placeholder="Add a description...">${escapeHtml(task.desc)}</textarea>
      </div>
    </div>
  `;

  const headerHtmlNoDesc = `
    ${blockedStrip}
    <div class="dp-header-area">
      <div class="dp-header-content">
        ${headerMeta}
      </div>
    </div>
  `;

  // ── Properties ──
  const propsHtml = `
    <div class="dp-props-grid">
      <div class="dp-field">
        <label>Assignee</label>
        <input type="text" id="detailAssignee" value="${escapeHtml(task.assignee)}" />
      </div>
      <div class="dp-field">
        <label>Due Date</label>
        <input type="date" id="detailDue" value="${task.due || ''}" />
      </div>
      <div class="dp-field">
        <label>Column</label>
        <select id="detailColumn">
          ${board.columns.map(c => `<option value="${c.id}" ${task.column === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="dp-field">
        <label>Priority</label>
        <select id="detailPriority">
          <option value="critical" ${task.priority === 'critical' ? 'selected' : ''}>Critical</option>
          <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
          <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
        </select>
      </div>
      <div class="dp-field">
        <label>Type</label>
        <select id="detailType">
          ${(state.fieldOptions.type || []).map(o => {
            const val = o.toLowerCase();
            return `<option value="${val}" ${task.type === val ? 'selected' : ''}>${o}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="dp-field">
        <label>Size</label>
        <select id="detailSize">
          <option value="" ${!task.size ? 'selected' : ''}>None</option>
          ${(state.fieldOptions.size || []).map(o =>
            `<option value="${o}" ${task.size === o ? 'selected' : ''}>${o}</option>`
          ).join('')}
        </select>
      </div>
      <div class="dp-field">
        <label>Requester</label>
        ${(() => {
          const knownRequesters = ['', ...(state.fieldOptions.requester || [])];
          const isCustom = task.requester && !knownRequesters.includes(task.requester);
          return `
            <select id="detailRequester">
              <option value="" ${!task.requester ? 'selected' : ''}>None</option>
              ${(state.fieldOptions.requester || []).map(o =>
                `<option value="${o}" ${task.requester === o ? 'selected' : ''}>${o}</option>`
              ).join('')}
              <option value="__other__" ${isCustom ? 'selected' : ''}>Other...</option>
            </select>
            <input type="text" id="detailRequesterOther" placeholder="Specify requester..."
              style="margin-top:6px;${isCustom ? '' : 'display:none;'}"
              value="${isCustom ? escapeHtml(task.requester) : ''}" />
          `;
        })()}
      </div>
      <div class="dp-field">
        <label>Platform</label>
        <select id="detailPlatform">
          <option value="" ${!task.platform ? 'selected' : ''}>None</option>
          ${(state.fieldOptions.platform || []).map(o =>
            `<option value="${o}" ${task.platform === o ? 'selected' : ''}>${o}</option>`
          ).join('')}
        </select>
      </div>
    </div>
  `;


  // ── Checklist Section ──
  const checklistBody = `
    ${checkTotal > 0 ? `<div class="checklist-progress-bar"><div class="checklist-progress-fill" style="width:${checkPct}%"></div></div>` : ''}
    <div class="checklist-items" id="checklistItems">
      ${(task.checklist || []).map(item => `
        <div class="checklist-item" data-item-id="${item.id}">
          <input type="checkbox" ${item.done ? 'checked' : ''} class="checklist-checkbox" data-item-id="${item.id}" />
          <span class="checklist-text ${item.done ? 'done' : ''}">${escapeHtml(item.text)}</span>
          <button class="checklist-delete" data-item-id="${item.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('')}
    </div>
    <div class="dp-inline-add">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <input type="text" class="dp-inline-input" id="checklistInput" placeholder="Add an item..." />
    </div>
  `;

  const checklistSection = section({
    id: 'checklist',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>',
    iconColor: 'rgba(16,185,129,0.12)',
    title: 'Checklist',
    count: checkTotal > 0 ? `${checkDone}/${checkTotal}` : '',
    hasData: checkTotal > 0,
    body: checklistBody,
  });

  // ── Links Section ──
  const linksBody = `
    <div class="links-list" id="linksList">
      ${(task.links || []).map(link => `
        <div class="link-item" data-link-id="${link.id}">
          <span class="link-icon">${getLinkIcon(link.type)}</span>
          <a href="${escapeHtml(link.url)}" target="_blank" class="link-label">${escapeHtml(link.label)}</a>
          <button class="link-delete" data-link-id="${link.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('')}
    </div>
    <div class="dp-inline-add-row">
      <input type="text" class="dp-inline-input" id="linkLabel" placeholder="Label" style="flex:1" />
      <input type="text" class="dp-inline-input" id="linkUrl" placeholder="https://..." style="flex:2" />
      <button class="dp-add-btn" id="addLinkBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  `;

  const linksSection = section({
    id: 'links',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    iconColor: 'rgba(139,92,246,0.12)',
    title: 'Links',
    count: task.links.length > 0 ? `${task.links.length}` : '',
    hasData: task.links.length > 0,
    noToggle: true,
    body: linksBody,
  });

  // ── Dependencies Section ──
  const depsBody = `
    <div class="deps-list" id="depsList">
      ${(task.depends_on || []).map(depId => {
        const dep = board.tasks.find(t => t.id === depId);
        if (!dep) return '';
        const depCol = board.columns.find(c => c.id === dep.column)?.name || dep.column;
        return `
          <div class="dep-item" data-dep-id="${depId}">
            <div class="dep-item-left">
              <div class="card-priority-bar-mini" style="background:${PRIORITY_COLORS[dep.priority]}"></div>
              <span class="dep-title">${escapeHtml(dep.title)}</span>
              <span class="dep-col">${depCol}</span>
            </div>
            <button class="dep-delete" data-dep-id="${depId}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      }).join('')}
    </div>
    <div class="dp-inline-add-row">
      <select class="dp-inline-input" id="depSelect" style="flex:1">
        <option value="">Select a task...</option>
        ${board.tasks
          .filter(t => t.id !== task.id && !task.depends_on.includes(t.id) && !t.archived)
          .map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`)
          .join('')}
      </select>
      <button class="dp-add-btn" id="addDepBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>
  `;

  const depsSection = section({
    id: 'deps',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    iconColor: 'rgba(245,158,11,0.12)',
    title: 'Dependencies',
    count: task.depends_on.length > 0 ? `${task.depends_on.length}` : '',
    hasData: task.depends_on.length > 0,
    body: depsBody,
  });

  // ── Recurring Section ──
  const recurringBody = `
    <select class="dp-inline-input" id="detailRecurring" style="width:100%">
      <option value="" ${!task.recurring ? 'selected' : ''}>None</option>
      <option value="daily" ${task.recurring?.frequency === 'daily' ? 'selected' : ''}>Daily</option>
      <option value="weekly" ${task.recurring?.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
      <option value="biweekly" ${task.recurring?.frequency === 'biweekly' ? 'selected' : ''}>Bi-weekly</option>
      <option value="monthly" ${task.recurring?.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
    </select>
  `;

  const recurringSection = section({
    id: 'recurring',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    iconColor: 'rgba(20,184,166,0.12)',
    title: 'Recurring',
    hasData: !!task.recurring,
    body: recurringBody,
  });

  // ── Comments Section ──
  const commentsBody = `
    <div class="dp-comment-input-area">
      <div class="dp-comment-input-row">
        <span class="dp-meta-avatar">${assigneeAvatarContent(state.profile.name, state.profile)}</span>
        <textarea class="dp-comment-textarea" id="commentInput" placeholder="Write a comment..." rows="2"></textarea>
      </div>
      <button class="dp-post-btn" id="addCommentBtn">Post</button>
    </div>
    <div class="comments-list" id="commentsList">
      ${(task.comments || []).map(c => `
        <div class="comment-item">
          <div class="comment-avatar">${assigneeAvatarContent(c.author, state.profile)}</div>
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author">${escapeHtml(c.author)}</span>
              <span class="comment-time">${timeAgo(c.timestamp)}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const commentsSection = section({
    id: 'comments',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    iconColor: 'rgba(99,102,241,0.12)',
    title: 'Comments',
    count: task.comments.length > 0 ? `${task.comments.length}` : '',
    hasData: task.comments.length > 0,
    defaultOpen: true,
    body: commentsBody,
  });

  // ── Activity Section ──
  const activityBody = `
    <div class="activity-timeline" id="activityTimeline">
      ${(task.activity || []).slice(0, 50).map(a => `
        <div class="activity-item">
          <div class="activity-icon">${ACTIVITY_ICONS[a.action] || ACTIVITY_ICONS.edited}</div>
          <div class="activity-content">
            <span class="activity-user">${escapeHtml(a.user)}</span>
            <span class="activity-detail">${escapeHtml(a.detail)}</span>
            <span class="activity-time">${timeAgo(a.timestamp)}</span>
          </div>
        </div>
      `).join('')}
      ${task.activity.length === 0 ? '<div class="activity-empty">No activity yet</div>' : ''}
    </div>
  `;

  const activitySection = section({
    id: 'activity',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    iconColor: 'rgba(107,114,128,0.12)',
    title: 'Activity',
    hasData: task.activity.length > 0,
    noToggle: true,
    body: activityBody,
  });

  // ── Assemble ──
  const commentCount = task.comments.length;
  panel.innerHTML = `
    <div class="dp-tabs">
      <button class="dp-tab active" data-tab="details">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Details
      </button>
      <button class="dp-tab" data-tab="comments">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Comments${commentCount > 0 ? ` <span class="dp-tab-count">${commentCount}</span>` : ''}
      </button>
    </div>
    <div class="dp-tab-pane" data-pane="details">
      ${headerHtml}
      ${propsHtml}
      ${linksSection}
      ${checklistSection}
      ${depsSection}
      ${recurringSection}
      ${activitySection}
      <div class="dp-divider"></div>
      <div class="dp-footer">
        <button class="dp-delete-link" id="deleteTaskBtn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete task
        </button>
        <span class="dp-timestamp">Created ${timeAgo(task.created_at)}</span>
      </div>
    </div>
    <div class="dp-tab-pane" data-pane="comments" hidden>
      ${headerHtmlNoDesc}
      ${commentsBody}
    </div>
  `;

  // Wire tabs
  panel.querySelectorAll('.dp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.dp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      panel.querySelectorAll('.dp-tab-pane').forEach(pane => {
        pane.hidden = pane.dataset.pane !== target;
      });
    });
  });

  // Wire collapsible toggles
  panel.querySelectorAll('.dp-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.toggle;
      const body = panel.querySelector(`[data-body="${id}"]`);
      btn.classList.toggle('open');
      body.classList.toggle('open');
    });
  });

  bindDetailListeners(task);
}

function bindDetailListeners(task) {
  const board = getCurrentBoard();
  const panel = document.getElementById('detailPanelBody');

  // Title
  const titleEl = document.getElementById('detailTitle');
  titleEl.addEventListener('input', () => {
    titleEl.style.height = 'auto';
    titleEl.style.height = titleEl.scrollHeight + 'px';
  });
  titleEl.addEventListener('change', () => {
    const old = task.title;
    task.title = titleEl.value.trim() || old;
    if (old !== task.title) logTaskEdited(task.id, 'title', old, task.title);
    task.updated_at = new Date().toISOString();
    saveState();
    renderBoard();
  });

  // Inline fields
  const fieldBindings = [
    { el: 'detailPriority', field: 'priority' },
    { el: 'detailType', field: 'type' },
    { el: 'detailSize', field: 'size', transform: v => v || null },
    { el: 'detailAssignee', field: 'assignee' },
    { el: 'detailDue', field: 'due' },
    { el: 'detailPlatform', field: 'platform' },
  ];

  for (const { el, field, transform } of fieldBindings) {
    const elem = document.getElementById(el);
    if (!elem) continue;
    elem.addEventListener('change', () => {
      const old = task[field];
      task[field] = transform ? transform(elem.value) : elem.value;
      if (old !== task[field]) logTaskEdited(task.id, field, old, task[field]);
      task.updated_at = new Date().toISOString();
      saveState();
      renderBoard();
      renderDetailPanel();
    });
  }

  // Requester with Other freeform
  const reqSel = document.getElementById('detailRequester');
  const reqOther = document.getElementById('detailRequesterOther');
  if (reqSel) {
    reqSel.addEventListener('change', () => {
      if (reqSel.value === '__other__') {
        reqOther.style.display = '';
        reqOther.focus();
      } else {
        reqOther.style.display = 'none';
        reqOther.value = '';
        const old = task.requester;
        task.requester = reqSel.value;
        if (old !== task.requester) logTaskEdited(task.id, 'requester', old, task.requester);
        task.updated_at = new Date().toISOString();
        saveState();
        renderBoard();
      }
    });
  }
  if (reqOther) {
    reqOther.addEventListener('change', () => {
      const val = reqOther.value.trim();
      if (!val) return;
      const old = task.requester;
      task.requester = val;
      if (old !== task.requester) logTaskEdited(task.id, 'requester', old, task.requester);
      task.updated_at = new Date().toISOString();
      saveState();
      renderBoard();
    });
  }

  attachAssigneeAutocomplete(
    document.getElementById('detailAssignee'),
    () => {
      const members = state.teamMembers || [];
      const profile = state.profile;
      if (profile?.name && !members.find(m => m.name === profile.name)) {
        return [{ name: profile.name, initials: getInitials(profile.name), color: '#6366f1' }, ...members];
      }
      return members;
    }
  );

  // Column change
  document.getElementById('detailColumn').addEventListener('change', (e) => {
    const oldCol = task.column;
    const newCol = e.target.value;
    if (oldCol !== newCol) {
      const now = new Date().toISOString();
      const oldName = board.columns.find(c => c.id === oldCol)?.name || oldCol;
      const newName = board.columns.find(c => c.id === newCol)?.name || newCol;
      if (task.column_entered_at) {
        task.column_history.push({ column: oldCol, entered_at: task.column_entered_at, exited_at: now });
      }
      task.column_entered_at = now;
      task.column = newCol;
      task.updated_at = now;
      const { logTaskMoved } = window._kanban;
      if (logTaskMoved) logTaskMoved(task.id, oldName, newName);
      saveState();
      renderBoard();
      renderDetailPanel();
    }
  });

  // Description
  document.getElementById('detailDesc')?.addEventListener('change', (e) => {
    task.desc = e.target.value;
    task.updated_at = new Date().toISOString();
    saveState();
    renderBoard();
  });

  // Checklist
  panel.querySelectorAll('.checklist-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const item = task.checklist.find(i => i.id === cb.dataset.itemId);
      if (item) {
        item.done = cb.checked;
        logChecklistToggled(task.id, item.text, item.done);
        task.updated_at = new Date().toISOString();
        saveState();
        renderBoard();
        renderDetailPanel();
      }
    });
  });

  panel.querySelectorAll('.checklist-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      task.checklist = task.checklist.filter(i => i.id !== btn.dataset.itemId);
      task.updated_at = new Date().toISOString();
      saveState();
      renderBoard();
      renderDetailPanel();
    });
  });

  // Checklist add — Enter to submit
  const checkInput = document.getElementById('checklistInput');
  if (checkInput) {
    checkInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = checkInput.value.trim();
        if (!text) return;
        task.checklist.push({ id: generateId(), text, done: false });
        task.updated_at = new Date().toISOString();
        saveState();
        renderBoard();
        renderDetailPanel();
        setTimeout(() => document.getElementById('checklistInput')?.focus(), 50);
      }
    });
  }

  // Links
  panel.querySelectorAll('.link-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      task.links = task.links.filter(l => l.id !== btn.dataset.linkId);
      task.updated_at = new Date().toISOString();
      saveState();
      renderBoard();
      renderDetailPanel();
    });
  });

  document.getElementById('addLinkBtn')?.addEventListener('click', () => {
    const label = document.getElementById('linkLabel').value.trim();
    const url = document.getElementById('linkUrl').value.trim();
    if (!label || !url) return;
    task.links.push({ id: generateId(), label, url, type: detectLinkType(url) });
    logLinkAdded(task.id, label);
    task.updated_at = new Date().toISOString();
    saveState();
    renderBoard();
    renderDetailPanel();
  });

  // Dependencies
  panel.querySelectorAll('.dep-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const depTask = board.tasks.find(t => t.id === btn.dataset.depId);
      task.depends_on = task.depends_on.filter(id => id !== btn.dataset.depId);
      if (depTask) logDependencyRemoved(task.id, depTask.title);
      task.updated_at = new Date().toISOString();
      saveState();
      renderBoard();
      renderDetailPanel();
    });
  });

  document.getElementById('addDepBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('depSelect');
    const depId = sel.value;
    if (!depId) return;
    const depTask = board.tasks.find(t => t.id === depId);
    task.depends_on.push(depId);
    if (depTask) logDependencyAdded(task.id, depTask.title);
    task.updated_at = new Date().toISOString();
    saveState();
    renderBoard();
    renderDetailPanel();
  });

  // Recurring
  document.getElementById('detailRecurring')?.addEventListener('change', (e) => {
    const freq = e.target.value;
    if (freq) {
      task.recurring = { frequency: freq, next_due: computeNextDue(freq, task.due) };
    } else {
      task.recurring = null;
    }
    task.updated_at = new Date().toISOString();
    saveState();
  });

  // Comments
  document.getElementById('addCommentBtn')?.addEventListener('click', () => {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    if (!text) return;
    task.comments.unshift({ id: generateId(), author: state.profile.name, text, timestamp: new Date().toISOString() });
    logCommentAdded(task.id);
    task.updated_at = new Date().toISOString();
    saveState();
    renderBoard();
    renderDetailPanel();
  });

  document.getElementById('commentInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      document.getElementById('addCommentBtn').click();
    }
  });

  // Unblock
  const unblockBtn = panel.querySelector('.unblock-btn');
  if (unblockBtn) {
    unblockBtn.addEventListener('click', () => {
      task.blocked = null;
      task.updated_at = new Date().toISOString();
      logUnblocked(task.id);
      saveState();
      renderBoard();
      renderDetailPanel();
    });
  }

  // Delete
  document.getElementById('deleteTaskBtn')?.addEventListener('click', () => {
    if (confirm('Delete this task? This cannot be undone.')) {
      board.tasks = board.tasks.filter(t => t.id !== task.id);
      saveState();
      renderBoard();
      closeDetailPanel();
    }
  });

  // Auto-resize title and description
  const descEl = document.getElementById('detailDesc');
  const autoResize = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  setTimeout(() => {
    if (titleEl) autoResize(titleEl);
    if (descEl) autoResize(descEl);
  }, 10);
  descEl?.addEventListener('input', () => autoResize(descEl));
}

// ── Helpers ──
function getLinkIcon(type) {
  switch(type) {
    case 'figma': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5zM12 2h3.5a3.5 3.5 0 1 1 0 7H12V2zm0 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0zm-7 0A3.5 3.5 0 0 1 8.5 11H12v3.5a3.5 3.5 0 0 1-7 0zM5 12a3.5 3.5 0 0 1 3.5-3.5H12V16H8.5A3.5 3.5 0 0 1 5 12z"/></svg>';
    case 'sketch': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 8 12 22 22 8 12 2"/></svg>';
    default: return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
  }
}

function detectLinkType(url) {
  if (url.includes('figma.com')) return 'figma';
  if (url.includes('sketch.com') || url.includes('sketch.cloud')) return 'sketch';
  return 'url';
}

function computeNextDue(frequency, currentDue) {
  const base = currentDue ? new Date(currentDue) : new Date();
  const next = new Date(base);
  switch(frequency) {
    case 'daily': next.setDate(next.getDate() + 1); break;
    case 'weekly': next.setDate(next.getDate() + 7); break;
    case 'biweekly': next.setDate(next.getDate() + 14); break;
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
  }
  return next.toISOString();
}

export function initDetailPanel() {
  document.getElementById('closeDetailPanel').addEventListener('click', closeDetailPanel);
  document.getElementById('detailOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('detailOverlay')) closeDetailPanel();
  });
}
