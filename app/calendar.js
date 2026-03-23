/* ========================================
   Calendar View — Day / Team layout
   ======================================== */

import { BOARDS, PRIORITY_COLORS, CALENDAR_EVENTS } from './data.js';
import { escapeHtml, getInitials, generateId } from './utils.js';
import { openDetailPanel } from './detail-panel.js';
import { state, saveState } from './state.js';

let selectedDate = stripTime(new Date());
let weekStart    = getWeekStart(selectedDate);
let calFilter    = 'all'; // all | meetings | tasks | time-off
const viewWeeks  = 2;

const CAL_FILTERS = [
  { id: 'all',      label: 'All',      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
  { id: 'meetings', label: 'Meetings', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { id: 'tasks',    label: 'Tasks',    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' },
  { id: 'time-off', label: 'Time Off', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' },
];

const WORKSPACE_ORDER = ['product-design', 'business-dev', 'ux', 'flagship', 'business-products'];
const WORKSPACE_LABELS = {
  'product-design':    'Product Design',
  'business-dev':      'Business Dev',
  'ux':                'UX Research',
  'flagship':          'Flagship',
  'business-products': 'Biz Products',
};
const BOARD_COLORS = {
  'product-design':    '#7c5cfc',
  'business-dev':      '#10b981',
  'ux':                '#f59e0b',
  'flagship':          '#3b82f6',
  'business-products': '#ec4899',
};
const CARD_BG = {
  'product-design':    '#2d1f6e',
  'business-dev':      '#0b3d2e',
  'ux':                '#4a3000',
  'flagship':          '#0d2a58',
  'business-products': '#5c0d38',
};
const EVENT_TYPE_CONFIG = {
  meeting:    { label: 'Meeting',   bg: '#1a2248', accent: '#6366f1' },
  'time-off': { label: 'Time Off',  bg: '#2e1800', accent: '#f59e0b' },
  birthday:   { label: 'Birthday',  bg: '#2e0a1c', accent: '#ec4899' },
  holiday:    { label: 'Holiday',   bg: '#062018', accent: '#10b981' },
  review:     { label: 'Review',    bg: '#081a34', accent: '#3b82f6' },
};

// Grid dimensions
const HOUR_HEIGHT  = 110;  // px per hour
const GRID_START   = 8;    // 8 AM
const GRID_END     = 20;   // 8 PM
const GRID_HOURS   = GRID_END - GRID_START;
const GRID_HEIGHT  = GRID_HOURS * HOUR_HEIGHT;
const CARD_PAD     = 4;    // gap between card edge and hour boundary

// ── Helpers ─────────────────────────────────────

function stripTime(d) {
  const c = new Date(d); c.setHours(0,0,0,0); return c;
}
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0,0,0,0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate()  === b.getDate();
}
function getWeekNumber(d) {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  u.setUTCDate(u.getUTCDate() + 4 - (u.getUTCDay() || 7));
  const y = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return Math.ceil(((u - y) / 86400000 + 1) / 7);
}
function fmtWeekLabel(start, days) {
  const end = addDays(start, days - 1);
  const ws = getWeekNumber(start), we = getWeekNumber(end);
  return ws === we ? `W${ws}` : `W${ws} – W${we}`;
}
function fmtMonthYear(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function fmtHour(h) {
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// ── Data ────────────────────────────────────────

function getAllEvents() {
  return [...CALENDAR_EVENTS, ...(state.calendarEvents || [])];
}
function getTasksForDay(boardId, date) {
  const board = BOARDS[boardId];
  if (!board) return [];
  return board.tasks.filter(t => {
    if (t.archived || !t.due) return false;
    return isSameDay(stripTime(new Date(t.due)), date);
  });
}
function getEventsForDay(date) {
  const ds = toDateStr(date);
  return getAllEvents().filter(e => e.date === ds);
}
function getAllDayBannerEvents(date) {
  return getEventsForDay(date).filter(e => e.allDay || !e.boardId);
}
function getTotalForDay(date) {
  const tasks  = WORKSPACE_ORDER.reduce((n, id) => n + getTasksForDay(id, date).length, 0);
  const events = getEventsForDay(date).length;
  return tasks + events;
}

// ── Event creation modal ─────────────────────────

function openNewEventModal(container) {
  const overlay = document.createElement('div');
  overlay.className = 'cal-event-modal-overlay';
  const today = toDateStr(selectedDate);

  overlay.innerHTML = `
    <div class="cal-event-modal">
      <div class="cal-event-modal-header">
        <span class="cal-event-modal-title">New Event</span>
        <button class="cal-event-modal-close" id="calEvClose">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="cal-event-modal-body">
        <div class="cal-ev-field">
          <label class="cal-ev-label">Type</label>
          <div class="cal-ev-type-row">
            ${Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => `
              <button class="cal-ev-type-btn${key === 'meeting' ? ' active' : ''}" data-type="${key}" style="--type-accent:${cfg.accent}">${cfg.label}</button>
            `).join('')}
          </div>
        </div>
        <div class="cal-ev-field">
          <label class="cal-ev-label">Title</label>
          <input class="cal-ev-input" id="calEvTitle" type="text" placeholder="Event title..." />
        </div>
        <div class="cal-ev-field">
          <label class="cal-ev-label">Date</label>
          <input class="cal-ev-input" id="calEvDate" type="date" value="${today}" />
        </div>
        <div class="cal-ev-field">
          <label class="cal-ev-label"><input type="checkbox" id="calEvAllDay" style="margin-right:6px" /> All day</label>
        </div>
        <div id="calEvTimeFields" class="cal-ev-time-row">
          <div class="cal-ev-field" style="flex:1">
            <label class="cal-ev-label">Start</label>
            <select class="cal-ev-input" id="calEvStart">
              ${Array.from({length: GRID_HOURS}, (_, i) => i + GRID_START).map(h => `<option value="${h}">${fmtHour(h)}</option>`).join('')}
            </select>
          </div>
          <div class="cal-ev-field" style="flex:1">
            <label class="cal-ev-label">End</label>
            <select class="cal-ev-input" id="calEvEnd">
              ${Array.from({length: GRID_HOURS}, (_, i) => i + GRID_START).map(h => `<option value="${h}" ${h === 9 ? 'selected' : ''}>${fmtHour(h)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="cal-ev-field">
          <label class="cal-ev-label">Workspace <span style="opacity:.5">(optional)</span></label>
          <select class="cal-ev-input" id="calEvBoard">
            <option value="">All Teams</option>
            ${WORKSPACE_ORDER.map(id => `<option value="${id}">${WORKSPACE_LABELS[id]}</option>`).join('')}
          </select>
        </div>
        <div class="cal-ev-field">
          <label class="cal-ev-label">Assignees <span style="opacity:.5">(optional)</span></label>
          <input class="cal-ev-input" id="calEvAssignees" type="text" placeholder="e.g. Mike B., Alex M." />
        </div>
        <div class="cal-ev-field">
          <label class="cal-ev-label">Notes <span style="opacity:.5">(optional)</span></label>
          <textarea class="cal-ev-input cal-ev-textarea" id="calEvNotes" placeholder="Add a note..."></textarea>
        </div>
      </div>
      <div class="cal-event-modal-footer">
        <button class="cal-ev-cancel" id="calEvCancel">Cancel</button>
        <button class="cal-ev-save" id="calEvSave">Add Event</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);
  setTimeout(() => overlay.querySelector('#calEvTitle').focus(), 50);

  let selectedType = 'meeting';

  overlay.querySelectorAll('.cal-ev-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.cal-ev-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
      if (['birthday', 'holiday', 'time-off'].includes(selectedType)) {
        overlay.querySelector('#calEvAllDay').checked = true;
        overlay.querySelector('#calEvTimeFields').style.display = 'none';
      }
    });
  });
  overlay.querySelector('#calEvAllDay').addEventListener('change', e => {
    overlay.querySelector('#calEvTimeFields').style.display = e.target.checked ? 'none' : '';
  });

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelector('#calEvClose').addEventListener('click', close);
  overlay.querySelector('#calEvCancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#calEvSave').addEventListener('click', () => {
    const title = overlay.querySelector('#calEvTitle').value.trim();
    if (!title) { overlay.querySelector('#calEvTitle').focus(); return; }

    const allDay   = overlay.querySelector('#calEvAllDay').checked;
    const boardId  = overlay.querySelector('#calEvBoard').value || null;
    const assigneesRaw = overlay.querySelector('#calEvAssignees').value.trim();
    const assignees = assigneesRaw ? assigneesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const ev = {
      id: generateId(),
      title,
      type: selectedType,
      date: overlay.querySelector('#calEvDate').value,
      allDay,
      boardId,
      assignees,
      notes: overlay.querySelector('#calEvNotes').value.trim(),
    };
    if (!allDay) {
      ev.startHour = parseInt(overlay.querySelector('#calEvStart').value);
      ev.endHour   = parseInt(overlay.querySelector('#calEvEnd').value);
    }

    if (!state.calendarEvents) state.calendarEvents = [];
    state.calendarEvents.push(ev);
    saveState();
    close();
    renderCalendarView(container);
  });
}

// ── Badge helpers ────────────────────────────────

const AVATAR_PALETTE = ['#7c5cfc','#10b981','#f59e0b','#3b82f6','#ec4899','#ef4444','#8b5cf6','#06b6d4'];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function buildAvatarRow(assignees) {
  if (!assignees?.length) return '';
  const MAX = 4;
  const shown    = assignees.slice(0, MAX);
  const overflow = assignees.length - MAX;
  const avatars  = shown.map(a => {
    const ini = getInitials(a);
    const col = avatarColor(a);
    return `<span class="cal-badge-avatar" style="background:${col}">${ini}</span>`;
  }).join('');
  const more = overflow > 0 ? `<span class="cal-badge-overflow">+${overflow}</span>` : '';
  return `<div class="cal-badge-row">${avatars}${more}</div>`;
}

function buildNotesBadge(notes) {
  if (!notes) return '';
  const isUrl = /^https?:\/\//.test(notes);
  const icon  = isUrl
    ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
    : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 13-8 13S4 15.25 4 10a8 8 0 0 1 8-8z"/></svg>`;
  const label = notes.length > 22 ? notes.slice(0, 22) + '…' : notes;
  return `<span class="cal-badge-note">${icon} ${escapeHtml(label)}</span>`;
}

// ── Card builders ────────────────────────────────

function positionCard(card, startHour, endHour) {
  const top    = (startHour - GRID_START) * HOUR_HEIGHT + CARD_PAD;
  const height = (endHour - startHour)    * HOUR_HEIGHT - CARD_PAD * 2;
  card.style.position = 'absolute';
  card.style.top      = top + 'px';
  card.style.height   = Math.max(height, 40) + 'px';
  card.style.left     = '4px';
  card.style.right    = '4px';
}

function buildTaskCard(task, boardId, slotHour) {
  const card = document.createElement('div');
  card.className = 'cal-event-card';
  card.style.background = CARD_BG[boardId] || '#1e1e2e';
  positionCard(card, slotHour, slotHour + 1);

  const colInfo  = BOARDS[boardId]?.columns.find(c => c.id === task.column);
  const initials = getInitials(task.assignee);
  const timeLabel = `${fmtHour(slotHour)} › ${fmtHour(slotHour + 1)}`;

  const assignees = task.assignee ? [task.assignee] : [];

  card.innerHTML = `
    <div class="cal-event-icon" style="background:${BOARD_COLORS[boardId]}33">${initials}</div>
    <div class="cal-event-body">
      <div class="cal-event-title">${escapeHtml(task.title)}</div>
      <div class="cal-event-time">${timeLabel}</div>
      <div class="cal-card-badges-row">
        ${colInfo ? `<span class="cal-badge-pill" style="background:rgba(255,255,255,0.12)">${colInfo.name}</span>` : ''}
        ${buildAvatarRow(assignees)}
      </div>
    </div>
  `;
  card.addEventListener('click', () => {
    state.currentBoard = boardId;
    saveState();
    openDetailPanel(task.id);
  });
  return card;
}

function buildEventCard(ev) {
  const cfg      = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.meeting;
  const card     = document.createElement('div');
  card.className = 'cal-event-card';
  card.style.background = cfg.bg;

  const startHour = ev.startHour ?? GRID_START;
  const endHour   = ev.endHour   ?? startHour + 1;
  positionCard(card, startHour, endHour);

  const assigneeLabel = ev.assignees?.length ? ev.assignees[0] : '';
  const initials      = getInitials(assigneeLabel) || ev.type.slice(0,2).toUpperCase();
  const timeLabel     = `${fmtHour(startHour)} › ${fmtHour(endHour)}`;

  card.innerHTML = `
    <div class="cal-event-icon" style="background:${cfg.accent}33">${initials}</div>
    <div class="cal-event-body">
      <div class="cal-event-title">${escapeHtml(ev.title)}</div>
      <div class="cal-event-time">${timeLabel}</div>
      <div class="cal-card-badges-row">
        <span class="cal-badge-pill" style="background:${cfg.accent}22;color:${cfg.accent}">${cfg.label}</span>
        ${buildNotesBadge(ev.notes)}
        ${buildAvatarRow(ev.assignees)}
      </div>
    </div>
  `;
  return card;
}

// ── Render ──────────────────────────────────────

export function renderCalendarView(container) {
  container.innerHTML = '';
  container.className = 'calendar-view';

  const today   = stripTime(new Date());
  const days    = viewWeeks * 7;
  const dayList = Array.from({ length: days }, (_, i) => addDays(weekStart, i));

  // ── Header ──────────────────────────────────
  const header = document.createElement('div');
  header.className = 'cal-header';
  header.innerHTML = `
    <div class="cal-header-left">
      <span class="cal-month">${fmtMonthYear(selectedDate)}</span>
    </div>
    <div class="cal-header-center">
      <button class="cal-today-btn" id="calToday">Today</button>
      <button class="cal-arrow" id="calPrev">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="cal-week-label">${fmtWeekLabel(weekStart, days)}</span>
      <button class="cal-arrow" id="calNext">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <div class="cal-header-right">
      <button class="cal-add-event-btn" id="calAddEvent">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Event
      </button>
    </div>
  `;
  container.appendChild(header);

  header.querySelector('#calToday').addEventListener('click', () => {
    selectedDate = stripTime(new Date());
    weekStart    = getWeekStart(selectedDate);
    renderCalendarView(container);
  });
  header.querySelector('#calPrev').addEventListener('click', () => {
    weekStart = addDays(weekStart, -days);
    if (!dayList.some(d => isSameDay(d, selectedDate))) selectedDate = new Date(weekStart);
    renderCalendarView(container);
  });
  header.querySelector('#calNext').addEventListener('click', () => {
    weekStart = addDays(weekStart, days);
    if (!dayList.some(d => isSameDay(d, selectedDate))) selectedDate = addDays(weekStart, 0);
    renderCalendarView(container);
  });
  header.querySelector('#calAddEvent').addEventListener('click', () => openNewEventModal(container));

  // ── Day Strip ───────────────────────────────
  const strip = document.createElement('div');
  strip.className = 'cal-day-strip';
  dayList.forEach(date => {
    const isToday    = isSameDay(date, today);
    const isSelected = isSameDay(date, selectedDate);
    const total = getTotalForDay(date);
    const cell = document.createElement('button');
    cell.className = `cal-strip-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`;
    cell.innerHTML = `
      ${total > 0 ? `<span class="cal-strip-badge">${total}</span>` : ''}
      <div class="cal-strip-inner">
        <span class="cal-strip-name">${date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        <span class="cal-strip-num">${date.getDate()}</span>
      </div>
    `;
    cell.addEventListener('click', () => {
      selectedDate = new Date(date);
      renderCalendarView(container);
    });
    strip.appendChild(cell);
  });
  container.appendChild(strip);

  // ── Grid wrapper ────────────────────────────
  const gridWrap = document.createElement('div');
  gridWrap.className = 'cal-grid-wrap';

  // ── Column headers ──────────────────────────
  const colHeaders = document.createElement('div');
  colHeaders.className = 'cal-col-headers';
  const corner = document.createElement('div');
  corner.className = 'cal-time-gutter-head';
  colHeaders.appendChild(corner);

  WORKSPACE_ORDER.forEach(boardId => {
    const taskCount = getTasksForDay(boardId, selectedDate).length;
    const evCount   = getEventsForDay(selectedDate).filter(e => !e.allDay && e.boardId === boardId).length;
    const ch = document.createElement('div');
    ch.className = 'cal-col-head';
    ch.innerHTML = `
      <span class="cal-col-head-dot" style="background:${BOARD_COLORS[boardId]}"></span>
      <span class="cal-col-head-name">${WORKSPACE_LABELS[boardId]}</span>
      <span class="cal-col-head-count">${taskCount + evCount}</span>
    `;
    colHeaders.appendChild(ch);
  });
  gridWrap.appendChild(colHeaders);

  // ── All-day banner ───────────────────────────
  const bannerEvents = getAllDayBannerEvents(selectedDate);
  if (bannerEvents.length > 0) {
    const bannerRow = document.createElement('div');
    bannerRow.className = 'cal-allday-row';
    const gutterLabel = document.createElement('div');
    gutterLabel.className = 'cal-allday-label';
    gutterLabel.textContent = 'All day';
    bannerRow.appendChild(gutterLabel);
    const bannerList = document.createElement('div');
    bannerList.className = 'cal-allday-list';
    bannerEvents.forEach(ev => {
      const cfg  = EVENT_TYPE_CONFIG[ev.type] || EVENT_TYPE_CONFIG.meeting;
      const pill = document.createElement('div');
      pill.className = 'cal-allday-pill';
      pill.style.background   = cfg.bg;
      pill.style.borderColor  = cfg.accent;
      const timeStr = (!ev.allDay && ev.startHour != null) ? ` · ${fmtHour(ev.startHour)}` : '';
      pill.innerHTML = `
        <span class="cal-allday-pill-dot" style="background:${cfg.accent}"></span>
        <span class="cal-allday-pill-title">${escapeHtml(ev.title)}${timeStr}</span>
        <span class="cal-allday-pill-type">${cfg.label}</span>
      `;
      bannerList.appendChild(pill);
    });
    bannerRow.appendChild(bannerList);
    gridWrap.appendChild(bannerRow);
  }

  // ── Scrollable time grid ─────────────────────
  const timeGrid = document.createElement('div');
  timeGrid.className = 'cal-time-grid';

  const timeBody = document.createElement('div');
  timeBody.className = 'cal-time-body';
  timeBody.style.height = GRID_HEIGHT + 'px';

  // Time labels column — hour labels + 15-min dots
  const labelsCol = document.createElement('div');
  labelsCol.className = 'cal-time-labels-col';

  for (let h = GRID_START; h < GRID_END; h++) {
    const rowTop = (h - GRID_START) * HOUR_HEIGHT;

    // Hour label
    const lbl = document.createElement('div');
    lbl.className = 'cal-time-label';
    lbl.style.top = rowTop + 'px';
    lbl.textContent = fmtHour(h);
    labelsCol.appendChild(lbl);

    // 3 dots at 15, 30, 45 min within each hour
    for (let q = 1; q <= 3; q++) {
      const dot = document.createElement('div');
      dot.className = 'cal-time-dot';
      dot.style.top = (rowTop + q * HOUR_HEIGHT / 4) + 'px';
      labelsCol.appendChild(dot);
    }
  }

  // Current time indicator (only if today is selected)
  if (isSameDay(selectedDate, today)) {
    const now     = new Date();
    const nowFrac = (now.getHours() - GRID_START) + now.getMinutes() / 60;
    if (nowFrac >= 0 && nowFrac <= GRID_HOURS) {
      const nowTop = nowFrac * HOUR_HEIGHT;

      const nowLine = document.createElement('div');
      nowLine.className = 'cal-now-line';
      nowLine.style.top = nowTop + 'px';
      timeBody.appendChild(nowLine);  // appended to timeBody so it spans all columns

      const nowLabel = document.createElement('div');
      nowLabel.className = 'cal-now-label';
      nowLabel.style.top = nowTop + 'px';
      const hh = now.getHours(), mm = String(now.getMinutes()).padStart(2, '0');
      const ampm = hh >= 12 ? 'PM' : 'AM';
      nowLabel.textContent = `${hh > 12 ? hh - 12 : hh || 12}:${mm} ${ampm}`;
      labelsCol.appendChild(nowLabel);
    }
  }

  timeBody.appendChild(labelsCol);

  // Workspace columns with absolutely positioned cards
  WORKSPACE_ORDER.forEach(boardId => {
    const wsCol = document.createElement('div');
    wsCol.className = 'cal-ws-col';

    // Tasks — distributed across hours by index
    if (calFilter === 'all' || calFilter === 'tasks') {
      const tasks = getTasksForDay(boardId, selectedDate);
      tasks.forEach((task, i) => {
        const slotHour = GRID_START + (i % GRID_HOURS);
        wsCol.appendChild(buildTaskCard(task, boardId, slotHour));
      });
    }

    // Timed calendar events for this workspace
    if (calFilter !== 'tasks') {
      getEventsForDay(selectedDate)
        .filter(e => {
          if (e.allDay || e.boardId !== boardId) return false;
          if (calFilter === 'meetings') return ['meeting', 'review'].includes(e.type);
          if (calFilter === 'time-off') return ['time-off', 'birthday', 'holiday'].includes(e.type);
          return true;
        })
        .forEach(ev => wsCol.appendChild(buildEventCard(ev)));
    }

    timeBody.appendChild(wsCol);
  });

  timeGrid.appendChild(timeBody);
  gridWrap.appendChild(timeGrid);
  container.appendChild(gridWrap);
}

// ── Topbar Nav (swaps in for view-switcher) ──────

export function renderCalendarTopbarNav(navContainer, viewContainer) {
  navContainer.innerHTML = '';

  CAL_FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `view-tab${calFilter === f.id ? ' active' : ''}`;
    btn.innerHTML = `${f.icon} ${f.label}`;
    btn.addEventListener('click', () => {
      calFilter = f.id;
      renderCalendarTopbarNav(navContainer, viewContainer);
      renderCalendarView(viewContainer);
    });
    navContainer.appendChild(btn);
  });
}
