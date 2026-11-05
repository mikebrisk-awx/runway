/* ========================================
   Gantt View
   A native take on the Arc "Gantt timeline" block (uiarc.dev): grouped rows,
   draggable/resizable bars snapped to whole days, dependency arrows that turn
   red on conflict, animated day/week/month zoom, foldable groups, undo, and the
   same keyboard map and ARIA contract. Groups are the board's columns; arrows
   come from task.depends_on.

   Dates: a bar runs from task.start (new optional ISO day) to task.due
   (inclusive). Without a start it begins on the day the task was created;
   without a due date it is a one-day bar drawn dashed ("unscheduled").
   Dragging writes both fields.
   ======================================== */

import { state, saveState } from './state.js';
import { escapeHtml, toDate, formatDate, assigneeAvatarContent } from './utils.js';
import { logTaskEdited } from './activity.js';
import { openDetailPanel } from './detail-panel.js';

const DAY_MS = 86400000;
const PX_PER_DAY = { day: 44, week: 20, month: 6 };
const ZOOMS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month']];
const ROW_H = 40;
const UNDO_LIMIT = 20;
const DONE_IDS = new Set(['done', 'complete', 'completed', 'shipped']);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Survives re-renders (the view is rebuilt on every renderBoard()).
const ui = {
  boardId: null,
  selected: null,   // task id whose dependency arrows are highlighted
  focus: null,      // task id holding the roving tabindex
  undo: [],         // [{ id, start, due, title }]
  anchorDay: null,  // date at the left edge of the track, to keep scroll across renders
  scrollTop: 0,
  restoreFocus: false,
  status: '',
};

// Live rendering context for the current DOM.
let ctx = null;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Date helpers (local days) ──
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function diffDays(a, b) { return Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS); }
function parseDay(v) { const d = toDate(v); return d ? startOfDay(d) : null; }
function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtRange(a, b) {
  return a.getTime() === b.getTime() ? formatDate(a) : `${formatDate(a)} – ${formatDate(b)}`;
}

// ── Model ──
function filteredTasks(board) {
  let tasks = board.tasks.filter(t => !t.archived);
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.desc || '').toLowerCase().includes(q) ||
      (t.assignee || '').toLowerCase().includes(q));
  }
  if (state.swimlaneFilter && state.swimlaneFilter !== 'all') {
    tasks = tasks.filter(t => t.priority === state.swimlaneFilter);
  }
  return tasks;
}

function buildModel(board) {
  const today = startOfDay(new Date());
  const groups = board.columns.map(c => ({ id: c.id, name: c.name, color: c.color || 'var(--accent)', items: [] }));
  const byId = new Map(groups.map(g => [g.id, g]));

  const items = filteredTasks(board).map(t => {
    const due = parseDay(t.due);
    const explicitStart = parseDay(t.start);
    const created = parseDay(t.created_at) || today;
    // No dates at all: a dashed placeholder on today, so it is visible and can be dragged into place.
    let start = explicitStart || (due ? (due < created ? due : created) : today);
    let end = due || start;
    if (end < start) end = start;
    const isDone = DONE_IDS.has(t.column);
    const checklist = Array.isArray(t.checklist) ? t.checklist : [];
    const progress = isDone ? 1 : checklist.length ? checklist.filter(c => c.done).length / checklist.length : 0;
    return { id: t.id, task: t, name: t.title || 'Untitled', group: t.column, start, end, scheduled: !!due, undated: !due && !explicitStart, progress };
  });

  for (const it of items) {
    let g = byId.get(it.group);
    if (!g) {
      g = byId.get('__other') || { id: '__other', name: 'Other', color: 'var(--text-tertiary)', items: [] };
      if (!byId.has('__other')) { byId.set('__other', g); groups.push(g); }
    }
    g.items.push(it);
  }
  for (const g of groups) {
    g.items.sort((a, b) => (a.undated - b.undated) || a.start - b.start || (a.task.position || 0) - (b.task.position || 0));
  }

  // Range: Monday on or before (earliest start, today) − 1 week, to latest end + 3 weeks.
  let min = today, max = today;
  for (const it of items) { if (it.start < min) min = it.start; if (it.end > max) max = it.end; }
  let rangeStart = addDays(min, -7);
  rangeStart = addDays(rangeStart, -((rangeStart.getDay() + 6) % 7));
  const rangeEnd = addDays(max, 21);
  const days = diffDays(rangeEnd, rangeStart) + 1;

  const itemById = new Map(items.map(it => [it.id, it]));
  for (const it of items) {
    it.s = diffDays(it.start, rangeStart);
    it.l = diffDays(it.end, it.start) + 1;
    it.deps = (it.task.depends_on || []).filter(id => itemById.has(id));
  }
  return { groups, items, itemById, rangeStart, days, today, todayIdx: diffDays(today, rangeStart) };
}

function conflictsOf(model, it) {
  // A task conflicts with a dependency when it starts on or before the day that dependency ends.
  return it.deps.map(id => model.itemById.get(id)).filter(dep => it.s <= dep.s + dep.l - 1);
}

function barLabel(model, it) {
  const pct = Math.round(it.progress * 100);
  let label = `${it.name}, ${fmtRange(it.start, it.end)}, ${pct}% done`;
  if (it.undated) label += ', no dates set';
  else if (!it.scheduled) label += ', no due date';
  const bad = conflictsOf(model, it);
  if (bad.length) label += `. Warning: starts before ${bad.map(d => `“${d.name}”`).join(', ')} ends`;
  return label;
}

// ── Collapsed groups (per board, persisted as a display pref) ──
function collapsedSet(board) {
  if (!state.ganttCollapsed || typeof state.ganttCollapsed !== 'object') state.ganttCollapsed = {};
  if (!Array.isArray(state.ganttCollapsed[board.id])) {
    // Fold finished work by default, like Arc's defaultCollapsed.
    state.ganttCollapsed[board.id] = board.columns.filter(c => DONE_IDS.has(c.id)).map(c => c.id);
  }
  return new Set(state.ganttCollapsed[board.id]);
}

// ── Render ──
export function renderGanttView(container, board) {
  if (ui.boardId !== board.id) {
    Object.assign(ui, { boardId: board.id, selected: null, focus: null, undo: [], anchorDay: null, scrollTop: 0 });
  } else if (ctx?.scroller?.isConnected) {
    rememberScroll();
  }
  ctx?.cleanup?.();

  const zoom = PX_PER_DAY[state.ganttZoom] ? state.ganttZoom : 'week';
  const model = buildModel(board);
  const collapsed = collapsedSet(board);
  const visibleIds = model.groups.filter(g => !collapsed.has(g.id)).flatMap(g => g.items.map(i => i.id));
  if (!ui.focus || !visibleIds.includes(ui.focus)) ui.focus = visibleIds[0] || null;
  if (ui.selected && !model.itemById.has(ui.selected)) ui.selected = null;
  const unscheduled = model.items.filter(i => !i.scheduled).length;
  const titleId = `ganttTitle-${board.id}`;

  container.innerHTML = `
    <div class="view-content gantt-wrap">
      <section class="gantt" data-zoom="${zoom}" aria-labelledby="${titleId}" style="--gd:${PX_PER_DAY[zoom]}px; --gdays:${model.days}">
        <div class="gantt-toolbar">
          <div class="gantt-toolbar-left">
            <h2 class="gantt-title" id="${titleId}">${escapeHtml(board.title)} timeline</h2>
            <span class="gantt-meta">${model.items.length} task${model.items.length === 1 ? '' : 's'}${unscheduled ? ` · ${unscheduled} without a due date (dashed)` : ''}</span>
          </div>
          <div class="gantt-toolbar-right">
            <button type="button" class="gantt-btn" data-gantt-undo ${ui.undo.length ? '' : 'disabled'} title="Undo (⌘Z)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>
              Undo
            </button>
            <button type="button" class="gantt-btn" data-gantt-today>Today</button>
            <div class="gantt-zoom" role="group" aria-label="Zoom">
              ${ZOOMS.map(([z, label]) => `<button type="button" class="gantt-zoom-btn" data-gantt-zoom="${z}" aria-pressed="${z === zoom}">${label}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="gantt-scroller">
          <div class="gantt-canvas">
            <div class="gantt-head" aria-hidden="true">
              <div class="gantt-corner">Task</div>
              <div class="gantt-scale">${renderScale(model)}</div>
            </div>
            <div class="gantt-body">
              <div class="gantt-grid" aria-hidden="true">
                <div class="gantt-today" style="--s:${model.todayIdx}"></div>
                <svg class="gantt-arrows">
                  <defs>
                    ${['', 'conflict', 'hi'].map(k => `<marker id="ganttHead${k}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="gantt-arrowhead${k ? ` is-${k}` : ''}" d="M0 0 L8 4 L0 8 z"/></marker>`).join('')}
                  </defs>
                </svg>
              </div>
              ${model.groups.map(g => renderGroup(model, g, collapsed.has(g.id))).join('')}
              ${model.items.length ? '' : `<div class="gantt-empty">No tasks to show${state.searchQuery ? ' for this search' : ''}.</div>`}
            </div>
          </div>
        </div>

        <div class="gantt-foot">
          <span class="gantt-status" role="status" aria-live="polite">${escapeHtml(ui.status)}</span>
          <span class="gantt-hint" aria-hidden="true">Drag to move · drag edges to resize · Alt+←/→ move · Alt+Shift+←/→ resize · O opens</span>
        </div>
        <p class="gantt-sr" id="ganttBarHelp">Alt plus Left or Right Arrow moves the task by one day. Alt plus Shift plus Left or Right Arrow changes its end date by one day. Enter or Space selects it to highlight its dependencies. O opens the task details.</p>
      </section>
    </div>
  `;

  const root = container.querySelector('.gantt');
  ctx = {
    board, model, root, zoom,
    gd: PX_PER_DAY[zoom],
    scroller: root.querySelector('.gantt-scroller'),
    body: root.querySelector('.gantt-body'),
    svg: root.querySelector('.gantt-arrows'),
    statusEl: root.querySelector('.gantt-status'),
    live: new Map(),    // id → { s, l } while dragging or springing
    cancelers: new Set(),
    cleanup: null,
  };

  wire(ctx);
  restoreScroll(ctx);
  drawArrows();
  if (ui.restoreFocus) {
    ui.restoreFocus = false;
    barEl(ui.focus)?.focus({ preventScroll: true });
  }
}

function renderScale(model) {
  const { rangeStart, days } = model;
  const months = [], years = [], weeks = [], dayCells = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(rangeStart, i);
    if (i === 0 || d.getDate() === 1) months.push({ s: i, d });
    if (i === 0 || (d.getMonth() === 0 && d.getDate() === 1)) years.push({ s: i, d });
    if (d.getDay() === 1) weeks.push({ s: i, d });
    dayCells.push({ s: i, d });
  }
  const span = (list, i) => (list[i + 1] ? list[i + 1].s : days) - list[i].s;
  const isToday = d => d.getTime() === model.today.getTime();
  return `
    <div class="gantt-tier gantt-tier-top gl-months">${months.map((m, i) => `<div class="gantt-cell" style="--s:${m.s};--l:${span(months, i)}"><span>${MONTHS_LONG[m.d.getMonth()]} ${m.d.getFullYear()}</span></div>`).join('')}</div>
    <div class="gantt-tier gantt-tier-top gl-years">${years.map((y, i) => `<div class="gantt-cell" style="--s:${y.s};--l:${span(years, i)}"><span>${y.d.getFullYear()}</span></div>`).join('')}</div>
    <div class="gantt-tier gantt-tier-bottom gl-days">${dayCells.map(c => `<div class="gantt-cell${isToday(c.d) ? ' is-today' : ''}${c.d.getDay() % 6 === 0 ? ' is-weekend' : ''}" style="--s:${c.s};--l:1"><b>${'SMTWTFS'[c.d.getDay()]}</b>${c.d.getDate()}</div>`).join('')}</div>
    <div class="gantt-tier gantt-tier-bottom gl-weeks">${weeks.map(w => `<div class="gantt-cell" style="--s:${w.s};--l:7"><span>${MONTHS[w.d.getMonth()]} ${w.d.getDate()}</span></div>`).join('')}</div>
    <div class="gantt-tier gantt-tier-bottom gl-monthsb">${months.map((m, i) => `<div class="gantt-cell" style="--s:${m.s};--l:${span(months, i)}"><span>${MONTHS[m.d.getMonth()]}</span></div>`).join('')}</div>
  `;
}

function renderGroup(model, g, isCollapsed) {
  const n = g.items.length;
  let summary = '';
  if (n) {
    const s = Math.min(...g.items.map(i => i.s));
    const e = Math.max(...g.items.map(i => i.s + i.l));
    const pct = g.items.reduce((a, i) => a + i.progress, 0) / n;
    summary = `<div class="gantt-summary" aria-hidden="true" style="--s:${s};--l:${e - s};--c:${g.color};--p:${pct}"></div>`;
  }
  return `
    <div class="gantt-group${isCollapsed ? ' is-collapsed' : ''}" data-group="${escapeHtml(g.id)}" style="--c:${g.color}">
      <div class="gantt-row gantt-group-row">
        <div class="gantt-label">
          <button type="button" class="gantt-group-toggle" aria-expanded="${!isCollapsed}" ${n ? '' : 'disabled'}>
            <svg class="gantt-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            <span class="gantt-group-dot" aria-hidden="true"></span>
            <span class="gantt-group-name">${escapeHtml(g.name)}</span>
            <span class="gantt-group-count">${n}</span>
          </button>
        </div>
        <div class="gantt-track">${summary}</div>
      </div>
      <div class="gantt-group-rows" ${isCollapsed ? 'aria-hidden="true" inert' : ''}>
        <div class="gantt-group-rows-inner">
          ${g.items.map(it => renderTaskRow(model, it, g)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTaskRow(model, it, g) {
  const t = it.task;
  const pct = Math.round(it.progress * 100);
  const avatar = t.assignee
    ? `<span class="gantt-avatar" title="${escapeHtml(t.assignee)}">${assigneeAvatarContent(t.assignee, state.profile, state.teamMembers)}</span>`
    : `<span class="gantt-avatar is-empty" aria-hidden="true"></span>`;
  const conflict = conflictsOf(model, it).length > 0;
  return `
    <div class="gantt-row gantt-task-row" data-row="${escapeHtml(it.id)}">
      <div class="gantt-label">
        ${avatar}
        <span class="gantt-task-name" data-open="${escapeHtml(it.id)}" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>
      </div>
      <div class="gantt-track">
        <div class="gantt-bar${it.scheduled ? '' : ' is-unscheduled'}${conflict ? ' is-conflict' : ''}${ui.selected === it.id ? ' is-selected' : ''}"
             data-bar="${escapeHtml(it.id)}" role="button" aria-roledescription="Task bar"
             aria-pressed="${ui.selected === it.id}" aria-label="${escapeHtml(barLabel(model, it))}"
             aria-describedby="ganttBarHelp" tabindex="${ui.focus === it.id ? 0 : -1}"
             style="--s:${it.s};--l:${it.l};--c:${g.color};--p:${it.progress}">
          <span class="gantt-handle gantt-handle-start" aria-hidden="true"></span>
          <span class="gantt-bar-fill" aria-hidden="true"></span>
          <span class="gantt-bar-name" aria-hidden="true">${escapeHtml(it.name)}</span>
          <span class="gantt-bar-pct" aria-hidden="true">${pct}%</span>
          <span class="gantt-handle gantt-handle-end" aria-hidden="true"></span>
        </div>
      </div>
    </div>
  `;
}

// ── DOM helpers ──
function barEl(id) { return id ? ctx?.root.querySelector(`[data-bar="${CSS.escape(id)}"]`) : null; }
function labelWidth() { return ctx.root.querySelector('.gantt-label')?.offsetWidth || 248; }
function setGd(px) {
  ctx.gd = px;
  ctx.root.style.setProperty('--gd', `${px}px`);
}
function setBarPos(id, s, l) {
  const el = barEl(id);
  if (!el) return;
  el.style.setProperty('--s', s);
  el.style.setProperty('--l', l);
}
function announce(msg) {
  ui.status = msg;
  if (ctx?.statusEl) ctx.statusEl.textContent = msg;
}

function rememberScroll() {
  ui.anchorDay = addDays(ctx.model.rangeStart, Math.round(ctx.scroller.scrollLeft / ctx.gd));
  ui.scrollTop = ctx.scroller.scrollTop;
}
function restoreScroll(c) {
  const { scroller, model, gd } = c;
  if (ui.anchorDay) {
    scroller.scrollLeft = diffDays(ui.anchorDay, model.rangeStart) * gd;
    scroller.scrollTop = ui.scrollTop;
  } else {
    scrollToDay(model.todayIdx, 0.25, false);
  }
}
function scrollToDay(idx, fraction = 0.25, smooth = true) {
  const { scroller, gd } = ctx;
  const trackW = scroller.clientWidth - labelWidth();
  const left = Math.max(0, idx * gd - trackW * fraction);
  scroller.scrollTo({ left, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
}

// Keep a bar visible horizontally (the sticky label column covers the left edge).
function revealBar(id) {
  const el = barEl(id);
  if (!el) return;
  const { scroller, gd } = ctx;
  const it = ctx.model.itemById.get(id);
  const live = ctx.live.get(id) || it;
  const lw = labelWidth();
  const trackW = scroller.clientWidth - lw;
  const x0 = live.s * gd, x1 = (live.s + live.l) * gd;
  if (x0 < scroller.scrollLeft + 8) scroller.scrollLeft = Math.max(0, x0 - 24);
  else if (x1 > scroller.scrollLeft + trackW - 8) scroller.scrollLeft = Math.min(x0 - 24, x1 - trackW + 24);
  el.closest('.gantt-row')?.scrollIntoView({ block: 'nearest' });
}

// ── Dependency arrows ──
let arrowsRaf = 0;
function drawArrowsSoon() {
  if (arrowsRaf) return;
  arrowsRaf = requestAnimationFrame(() => { arrowsRaf = 0; drawArrows(); });
}
// Redraw every frame for `ms` (fold animation, smooth scroll).
function drawArrowsFor(ms) {
  const until = performance.now() + ms;
  const tick = () => { drawArrows(); if (performance.now() < until && ctx) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

function drawArrows() {
  if (!ctx?.svg?.isConnected) return;
  const { model, svg, body, gd, live } = ctx;
  const bodyTop = body.getBoundingClientRect().top;
  const rowY = new Map();
  body.querySelectorAll('.gantt-task-row').forEach(row => {
    const grp = row.closest('.gantt-group');
    if (grp.classList.contains('is-collapsed') && !grp.classList.contains('is-folding')) return;
    const r = row.getBoundingClientRect();
    const groupRows = row.closest('.gantt-group-rows').getBoundingClientRect();
    if (r.bottom <= groupRows.top + 1) return; // folded away
    rowY.set(row.dataset.row, r.top - bodyTop + ROW_H / 2);
  });

  const width = model.days * gd;
  svg.setAttribute('width', width);
  svg.setAttribute('height', body.scrollHeight);
  svg.setAttribute('viewBox', `0 0 ${width} ${body.scrollHeight}`);

  const paths = [];
  for (const it of model.items) {
    if (!rowY.has(it.id)) continue;
    const to = live.get(it.id) || it;
    for (const depId of it.deps) {
      if (!rowY.has(depId)) continue;
      const fromIt = model.itemById.get(depId);
      const from = live.get(depId) || fromIt;
      const x1 = (from.s + from.l) * gd - 2, y1 = rowY.get(depId);
      const x2 = to.s * gd + 1, y2 = rowY.get(it.id);
      const conflict = Math.round(to.s) <= Math.round(from.s) + Math.round(from.l) - 1;
      const hi = ui.selected && (ui.selected === it.id || ui.selected === depId);
      let d;
      if (x2 - x1 >= 18) {
        const mx = x1 + 10;
        d = `M${x1} ${y1} H${mx} V${y2} H${x2 - 1}`;
      } else {
        const midY = y2 + (y1 < y2 ? -ROW_H / 2 : ROW_H / 2);
        d = `M${x1} ${y1} h10 V${midY} H${x2 - 12} V${y2} H${x2 - 1}`;
      }
      paths.push(`<path class="gantt-arrow${conflict ? ' is-conflict' : ''}${hi ? ' is-hi' : ''}${ui.selected && !hi ? ' is-dim' : ''}" d="${d}" marker-end="url(#ganttHead${hi ? 'hi' : conflict ? 'conflict' : ''})"/>`);
    }
  }
  const defs = svg.querySelector('defs').outerHTML;
  svg.innerHTML = defs + paths.join('');
}

// ── Springs ──
function spring({ from, to, velocity = 0, onUpdate, onDone, stiffness = 420, damping = 36, epsilon = 0.002 }) {
  if (reducedMotion()) { onUpdate(to); onDone?.(); return () => {}; }
  let x = from, v = velocity, last = performance.now(), raf = 0, stopped = false;
  const step = now => {
    if (stopped) return;
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    v += (-stiffness * (x - to) - damping * v) * dt;
    x += v * dt;
    if (Math.abs(v) < epsilon * 10 && Math.abs(x - to) < epsilon) { onUpdate(to); onDone?.(); return; }
    onUpdate(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  const cancel = () => { stopped = true; cancelAnimationFrame(raf); };
  ctx?.cancelers.add(cancel);
  return cancel;
}

// ── Zoom ──
function setZoom(next) {
  if (!PX_PER_DAY[next] || next === ctx.zoom) return;
  const { scroller, root } = ctx;
  const lw = labelWidth();
  const halfTrack = (scroller.clientWidth - lw) / 2;
  const centerDay = (scroller.scrollLeft + halfTrack) / ctx.gd;
  ctx.zoom = next;
  state.ganttZoom = next;
  saveState();
  root.dataset.zoom = next;
  root.querySelectorAll('[data-gantt-zoom]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ganttZoom === next)));
  ctx.zoomCancel?.();
  ctx.zoomCancel = spring({
    from: ctx.gd, to: PX_PER_DAY[next], stiffness: 260, damping: 30, epsilon: 0.01,
    onUpdate: px => {
      setGd(px);
      scroller.scrollLeft = Math.max(0, centerDay * px - halfTrack);
      drawArrows();
    },
  });
  announce(`Zoom: ${next}`);
}

// ── Commit date changes ──
function commit(id, s, l, verb) {
  const it = ctx.model.itemById.get(id);
  if (!it) return;
  const t = it.task;
  const newStart = isoDay(addDays(ctx.model.rangeStart, s));
  const newDue = isoDay(addDays(ctx.model.rangeStart, s + l - 1));
  const unchanged = newStart === isoDay(it.start) && newDue === (t.due || '') && t.start;
  if (unchanged) { ctx.live.delete(id); setBarPos(id, it.s, it.l); drawArrows(); return; }

  ui.undo.push({ id, start: t.start, due: t.due, title: it.name });
  if (ui.undo.length > UNDO_LIMIT) ui.undo.shift();
  applyDates(t, newStart, newDue);

  // Re-render from the saved task so labels, summaries and conflicts are all recomputed.
  const range = fmtRange(addDays(ctx.model.rangeStart, s), addDays(ctx.model.rangeStart, s + l - 1));
  ui.focus = id;
  ui.restoreFocus = ctx.root.contains(document.activeElement);
  ui.status = `${verb} “${it.name}” to ${range}.`;
  rerender();
  const fresh = ctx.model.itemById.get(id);
  const bad = fresh ? conflictsOf(ctx.model, fresh) : [];
  if (bad.length) announce(`${ui.status} Conflict: starts before ${bad.map(d => `“${d.name}”`).join(', ')} ends.`);
}

function applyDates(t, start, due) {
  const oldStart = t.start, oldDue = t.due;
  if (start === undefined || start === null) delete t.start; else t.start = start;
  t.due = due || '';
  if ((oldStart || '') !== (t.start || '')) logTaskEdited(t.id, 'start', oldStart || '', t.start || '');
  if ((oldDue || '') !== (t.due || '')) logTaskEdited(t.id, 'due', oldDue || '', t.due || '');
  t.updated_at = new Date().toISOString();
  saveState();
}

function undo() {
  const last = ui.undo.pop();
  if (!last) return;
  const t = ctx.board.tasks.find(x => x.id === last.id);
  if (!t) { ui.status = 'Nothing to undo.'; rerender(); return; }
  applyDates(t, last.start, last.due);
  ui.focus = last.id;
  ui.restoreFocus = ctx.root.contains(document.activeElement);
  ui.status = `Undid change to “${last.title}”.`;
  rerender();
}

function rerender() {
  const container = ctx.root.closest('#viewContainer') || ctx.root.parentElement.parentElement;
  renderGanttView(container, ctx.board);
}

// ── Wiring ──
function wire(c) {
  const { root, scroller, body } = c;

  root.querySelector('[data-gantt-undo]').addEventListener('click', undo);
  root.querySelector('[data-gantt-today]').addEventListener('click', () => { scrollToDay(c.model.todayIdx, 0.25); drawArrowsFor(500); });
  root.querySelectorAll('[data-gantt-zoom]').forEach(b => b.addEventListener('click', () => setZoom(b.dataset.ganttZoom)));

  // Group fold/unfold
  body.querySelectorAll('.gantt-group-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const grp = btn.closest('.gantt-group');
      const id = grp.dataset.group;
      const set = collapsedSet(c.board);
      const willCollapse = !set.has(id);
      if (willCollapse) set.add(id); else set.delete(id);
      state.ganttCollapsed[c.board.id] = [...set];
      saveState();
      const rows = grp.querySelector('.gantt-group-rows');
      grp.classList.add('is-folding');
      grp.classList.toggle('is-collapsed', willCollapse);
      btn.setAttribute('aria-expanded', String(!willCollapse));
      if (willCollapse) { rows.setAttribute('aria-hidden', 'true'); rows.inert = true; }
      else { rows.removeAttribute('aria-hidden'); rows.inert = false; }
      if (willCollapse && rows.contains(document.activeElement)) btn.focus();
      const done = () => { grp.classList.remove('is-folding'); drawArrows(); };
      if (reducedMotion()) done(); else { drawArrowsFor(380); setTimeout(done, 380); }
      // Keep the roving tab stop on a visible bar.
      const visible = visibleBarIds();
      if (!visible.includes(ui.focus)) { ui.focus = visible[0] || null; syncTabStops(); }
      announce(`${grp.querySelector('.gantt-group-name').textContent} ${willCollapse ? 'folded' : 'unfolded'}.`);
    });
  });

  // Open details from the task name in the sticky column
  body.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => openDetailPanel(el.dataset.open));
  });

  body.addEventListener('pointerdown', onPointerDown);
  body.addEventListener('keydown', onKeyDown);
  body.addEventListener('focusin', e => {
    const bar = e.target.closest?.('[data-bar]');
    if (bar && ui.focus !== bar.dataset.bar) { ui.focus = bar.dataset.bar; syncTabStops(); }
  });
  root.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && ui.undo.length) {
      e.preventDefault();
      undo();
    }
  });

  const onScroll = () => drawArrowsSoon();
  scroller.addEventListener('scroll', onScroll, { passive: true });
  const ro = new ResizeObserver(() => drawArrowsSoon());
  ro.observe(scroller);

  c.cleanup = () => {
    ro.disconnect();
    c.cancelers.forEach(fn => fn());
    c.zoomCancel?.();
  };
}

function visibleBarIds() {
  return [...ctx.body.querySelectorAll('.gantt-group:not(.is-collapsed) [data-bar]')].map(b => b.dataset.bar);
}
function syncTabStops() {
  ctx.body.querySelectorAll('[data-bar]').forEach(b => { b.tabIndex = b.dataset.bar === ui.focus ? 0 : -1; });
}

function setSelected(id) {
  ui.selected = id;
  ctx.body.querySelectorAll('[data-bar]').forEach(b => {
    const on = b.dataset.bar === id;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  drawArrows();
}

function onKeyDown(e) {
  const bar = e.target.closest?.('[data-bar]');
  if (!bar) return;
  const id = bar.dataset.bar;
  const it = ctx.model.itemById.get(id);
  const handled = () => { e.preventDefault(); e.stopPropagation(); };

  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey) {
    handled();
    const ids = visibleBarIds();
    const next = ids[ids.indexOf(id) + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) { ui.focus = next; syncTabStops(); barEl(next).focus({ preventScroll: true }); revealBar(next); }
    return;
  }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.altKey) {
    handled();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (e.shiftKey) {
      const l = Math.max(1, it.l + dir);
      if (l !== it.l) commit(id, it.s, l, 'Resized');
    } else {
      commit(id, it.s + dir, it.l, 'Moved');
    }
    requestAnimationFrame(() => revealBar(id));
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    handled();
    setSelected(ui.selected === id ? null : id);
    announce(ui.selected ? `Selected “${it.name}”.` : 'Selection cleared.');
    return;
  }
  // Leave Escape to the global handler while the detail panel is open, so it closes first.
  if (e.key === 'Escape' && ui.selected && !document.getElementById('detailOverlay')?.classList.contains('show')) {
    handled();
    setSelected(null);
    announce('Selection cleared.');
    return;
  }
  if ((e.key === 'o' || e.key === 'O') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    handled();
    openDetailPanel(id);
  }
}

// ── Pointer drag ──
function onPointerDown(e) {
  if (e.button !== 0) return;
  const bar = e.target.closest('[data-bar]');
  if (!bar) return;
  const id = bar.dataset.bar;
  const it = ctx.model.itemById.get(id);
  if (!it) return;
  const mode = e.target.closest('.gantt-handle-start') ? 'start' : e.target.closest('.gantt-handle-end') ? 'end' : 'move';
  const { scroller } = ctx;
  const startX = e.clientX, startScroll = scroller.scrollLeft;
  const s0 = it.s, l0 = it.l;
  let dragging = false, lastX = e.clientX, samples = [{ x: e.clientX, t: performance.now() }];
  let cur = { s: s0, l: l0 }, snap = { s: s0, l: l0 };
  let autoRaf = 0, ghost = null, tip = null;

  ctx.cancelers.forEach(fn => fn()); // stop any settling spring on this view
  ctx.live.delete(id);

  const rubber = raw => raw >= 1 ? raw : 1 - (1 - raw) * 0.25; // resists shortening past one day

  const compute = () => {
    const dx = (lastX - startX) + (scroller.scrollLeft - startScroll);
    const dd = dx / ctx.gd;
    if (mode === 'move') {
      cur = { s: s0 + dd, l: l0 };
      snap = { s: Math.round(cur.s), l: l0 };
    } else if (mode === 'end') {
      cur = { s: s0, l: rubber(l0 + dd) };
      snap = { s: s0, l: Math.max(1, Math.round(l0 + dd)) };
    } else {
      const l = rubber(l0 - dd);
      cur = { s: s0 + l0 - l, l };
      const ss = Math.min(Math.round(s0 + dd), s0 + l0 - 1);
      snap = { s: ss, l: s0 + l0 - ss };
    }
    ctx.live.set(id, cur);
    setBarPos(id, cur.s, cur.l);
    if (ghost) {
      ghost.style.setProperty('--s', snap.s);
      ghost.style.setProperty('--l', snap.l);
      tip.textContent = fmtRange(addDays(ctx.model.rangeStart, snap.s), addDays(ctx.model.rangeStart, snap.s + snap.l - 1));
    }
    drawArrows();
  };

  const autoScroll = () => {
    const r = scroller.getBoundingClientRect();
    const left = r.left + labelWidth(), right = r.right, edge = 48;
    let v = 0;
    if (lastX < left + edge) v = -Math.ceil((left + edge - lastX) / 4);
    else if (lastX > right - edge) v = Math.ceil((lastX - (right - edge)) / 4);
    if (v) { scroller.scrollLeft += v; compute(); }
    autoRaf = requestAnimationFrame(autoScroll);
  };

  const onMove = ev => {
    lastX = ev.clientX;
    samples.push({ x: ev.clientX, t: performance.now() });
    if (samples.length > 5) samples.shift();
    if (!dragging) {
      if (Math.abs(ev.clientX - startX) < 4) return;
      dragging = true;
      bar.classList.add('is-dragging');
      ctx.root.classList.add('is-dragging-any');
      ghost = document.createElement('div');
      ghost.className = 'gantt-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      tip = document.createElement('div');
      tip.className = 'gantt-drag-tip';
      ghost.appendChild(tip);
      bar.parentElement.insertBefore(ghost, bar);
      autoRaf = requestAnimationFrame(autoScroll);
    }
    compute();
  };

  const finish = ev => {
    bar.removeEventListener('pointermove', onMove);
    bar.removeEventListener('pointerup', finish);
    bar.removeEventListener('pointercancel', finish);
    cancelAnimationFrame(autoRaf);
    if (!dragging) {
      if (ev.type === 'pointerup') {
        ui.focus = id; syncTabStops();
        setSelected(id);
        openDetailPanel(id);
      }
      return;
    }
    bar.classList.remove('is-dragging');
    ctx.root.classList.remove('is-dragging-any');
    ghost?.remove();
    // Spring from the release point (and velocity) to the snapped day, then save.
    const a = samples[0], b = samples[samples.length - 1];
    const vDays = b.t > a.t ? ((b.x - a.x) / ((b.t - a.t) / 1000)) / ctx.gd : 0;
    const key = mode === 'end' ? 'l' : 's';
    const target = { ...snap };
    const fromVal = cur[key];
    const verb = mode === 'move' ? 'Moved' : 'Resized';
    spring({
      from: fromVal, to: target[key], velocity: ev.type === 'pointercancel' ? 0 : vDays,
      onUpdate: x => {
        const p = key === 's'
          ? (mode === 'move' ? { s: x, l: target.l } : { s: x, l: target.s + target.l - x })
          : { s: target.s, l: x };
        ctx.live.set(id, p);
        setBarPos(id, p.s, p.l);
        drawArrows();
      },
      onDone: () => {
        ctx.live.delete(id);
        if (ev.type === 'pointercancel') { setBarPos(id, s0, l0); drawArrows(); return; }
        if (target.s === s0 && target.l === l0) { setBarPos(id, s0, l0); drawArrows(); return; }
        commit(id, target.s, target.l, verb);
      },
    });
  };

  bar.setPointerCapture(e.pointerId);
  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerup', finish);
  bar.addEventListener('pointercancel', finish);
}
