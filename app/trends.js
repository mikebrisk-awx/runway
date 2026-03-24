/* ========================================
   Trends — Manager Dashboard
   ======================================== */

import { BOARDS, state } from './state.js';
import { escapeHtml } from './utils.js';

const activeCharts = [];

function destroyCharts() {
  activeCharts.forEach(c => c.destroy());
  activeCharts.length = 0;
}

function getTC() {
  const dark = state.theme !== 'light';
  return {
    text:          dark ? '#ededf0'               : '#1a1a2e',
    textSecondary: dark ? '#8b8a94'               : '#6b6880',
    gridLine:      dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
    tooltipBg:     dark ? '#1b1b1b'               : '#ffffff',
    tooltipBorder: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  };
}

function getAllTasks() {
  const all = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) all.push({ ...task, boardId });
  }
  return all;
}

const DONE_COLS  = new Set(['done', 'completed', 'shipped', 'delivered']);
const PALETTE    = ['#7c5cfc','#10b981','#f59e0b','#3b82f6','#ec4899','#ef4444','#8b5cf6','#06b6d4'];
const PRIORITY_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#10b981' };

const COL_META = {
  backlog:      { label: 'Backlog',      color: '#9ca3af' },
  ready:        { label: 'Ready',        color: '#3b82f6' },
  discovery:    { label: 'Discovery',    color: '#3b82f6' },
  planning:     { label: 'Planning',     color: '#3b82f6' },
  scoping:      { label: 'Scoping',      color: '#3b82f6' },
  'in-progress':{ label: 'In Progress',  color: '#f59e0b' },
  review:       { label: 'Review',       color: '#8b5cf6' },
  stakeholder:  { label: 'Stakeholder',  color: '#8b5cf6' },
  analysis:     { label: 'Analysis',     color: '#8b5cf6' },
  qa:           { label: 'QA',           color: '#8b5cf6' },
  done:         { label: 'Done',         color: '#10b981' },
  completed:    { label: 'Completed',    color: '#10b981' },
  shipped:      { label: 'Shipped',      color: '#10b981' },
  delivered:    { label: 'Delivered',    color: '#10b981' },
};

// ── Shared chart helpers ──────────────────────────────────────────────────────

function tooltip(tc, extra = {}) {
  return {
    backgroundColor: tc.tooltipBg,
    titleColor:      tc.text,
    bodyColor:       tc.textSecondary,
    borderColor:     tc.tooltipBorder,
    borderWidth:     1,
    padding:         10,
    cornerRadius:    8,
    ...extra,
  };
}

function scales(tc, overrides = {}) {
  return {
    x: {
      grid:  { color: tc.gridLine },
      ticks: { color: tc.textSecondary, font: { family: 'Work Sans', size: 11 } },
      ...overrides.x,
    },
    y: {
      grid:  { color: tc.gridLine },
      ticks: { color: tc.textSecondary, font: { family: 'Work Sans', size: 11 }, stepSize: 1 },
      beginAtZero: true,
      ...overrides.y,
    },
  };
}

function legendLabels(tc) {
  return { color: tc.text, font: { family: 'Work Sans', size: 12 }, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16 };
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function kpiCard(label, value, sub, color, delta) {
  const deltaHtml = delta !== undefined
    ? `<span class="trends-kpi-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}</span>`
    : '';
  return `
    <div class="trends-kpi-card">
      <div class="trends-kpi-value" style="color:${color}">${value}${deltaHtml}</div>
      <div class="trends-kpi-label">${label}</div>
      ${sub ? `<div class="trends-kpi-sub">${sub}</div>` : ''}
    </div>
  `;
}

// ── Icon SVGs ─────────────────────────────────────────────────────────────────

const ICONS = {
  clock:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  block:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  date:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  person: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  chart:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  check:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
};

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' },
  { id: 'velocity',   label: 'Velocity',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>' },
  { id: 'forecast',   label: 'Forecast',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
  { id: 'requesters', label: 'Requesters', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { id: 'blockers',   label: 'Blockers',   icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' },
];

let activeTab = 'overview';
let contentContainer = null;

// ── Topbar nav (rendered by main.js into the topbar) ─────────────────────────

export function renderTrendsTopbarNav(navContainer) {
  navContainer.innerHTML = '';
  TABS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = `view-tab${activeTab === t.id ? ' active' : ''}`;
    btn.innerHTML = `${t.icon} ${t.label}`;
    btn.addEventListener('click', () => {
      activeTab = t.id;
      renderTrendsTopbarNav(navContainer);
      if (contentContainer) {
        destroyCharts();
        renderTab(activeTab, contentContainer);
      }
    });
    navContainer.appendChild(btn);
  });
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function renderTrendsView(container) {
  destroyCharts();
  activeTab = 'overview';
  container.innerHTML = '<div class="trends-page"><div class="trends-tab-content" id="trendsTabContent"></div></div>';
  contentContainer = container.querySelector('#trendsTabContent');
  renderTab(activeTab, contentContainer);
}

function renderTab(tab, container) {
  const tasks = getAllTasks();
  container.innerHTML = '';
  switch (tab) {
    case 'overview':   renderOverviewTab(container, tasks); break;
    case 'velocity':   renderVelocityTab(container, tasks); break;
    case 'forecast':   renderForecastTab(container, tasks); break;
    case 'requesters': renderRequestersTab(container, tasks); break;
    case 'blockers':   renderBlockersTab(container, tasks); break;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB: OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════

function computeKPIs(tasks) {
  const active  = tasks.filter(t => !t.archived);
  const blocked = active.filter(t => t.blocked);
  const now     = new Date();
  const overdue = active.filter(t => t.due && new Date(t.due) < now && !DONE_COLS.has(t.column));
  const done    = active.filter(t => DONE_COLS.has(t.column));
  let totalAge = 0, ageCount = 0;
  for (const t of active) {
    if (t.column_entered_at) { totalAge += (now - new Date(t.column_entered_at)) / 86400000; ageCount++; }
  }
  return {
    active: active.length, blocked: blocked.length,
    blockedPct: active.length > 0 ? Math.round((blocked.length / active.length) * 100) : 0,
    overdue: overdue.length, done: done.length,
    avgAge: ageCount > 0 ? Math.round(totalAge / ageCount) : 0,
  };
}

function computeCallouts(tasks) {
  const callouts = [];
  const active   = tasks.filter(t => !t.archived);
  const now      = new Date();
  const agingMs  = (state.agingThresholdDays || 5) * 86400000;

  const aging = active.filter(t =>
    t.column_entered_at && !DONE_COLS.has(t.column) && t.column !== 'backlog' &&
    (now - new Date(t.column_entered_at)) > agingMs
  );
  if (aging.length > 0) callouts.push({ type: 'warning', icon: 'clock', text: `${aging.length} task${aging.length > 1 ? 's are' : ' is'} aging — stuck in the same column for ${state.agingThresholdDays || 5}+ days` });

  const blocked = active.filter(t => t.blocked);
  if (blocked.length > 0) callouts.push({ type: 'critical', icon: 'block', text: `${blocked.length} task${blocked.length > 1 ? 's are' : ' is'} blocked and need${blocked.length === 1 ? 's' : ''} immediate attention` });

  const overdue = active.filter(t => t.due && new Date(t.due) < now && !DONE_COLS.has(t.column));
  if (overdue.length > 0) callouts.push({ type: 'critical', icon: 'date', text: `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} past due date` });

  const assigneeCounts = {};
  for (const t of active) {
    if (t.assignee && !DONE_COLS.has(t.column)) assigneeCounts[t.assignee] = (assigneeCounts[t.assignee] || 0) + 1;
  }
  for (const [name, count] of Object.entries(assigneeCounts)) {
    if (count >= 5) callouts.push({ type: 'warning', icon: 'person', text: `${name} has ${count} active tasks — consider rebalancing` });
  }
  for (const board of Object.values(BOARDS)) {
    const ba = board.tasks.filter(t => !t.archived);
    if (ba.length > 3 && ba.filter(t => DONE_COLS.has(t.column)).length === 0)
      callouts.push({ type: 'info', icon: 'chart', text: `${board.title} has no completed tasks yet` });
  }
  if (callouts.length === 0) callouts.push({ type: 'good', icon: 'check', text: 'Everything looks healthy — no blockers, no aging tasks, no overdue items' });
  return callouts;
}

function computeAgingTasks(tasks) {
  const now     = new Date();
  const agingMs = (state.agingThresholdDays || 5) * 86400000;
  return tasks
    .filter(t => !t.archived && t.column_entered_at && !DONE_COLS.has(t.column) && t.column !== 'backlog')
    .map(t => ({ ...t, ageDays: Math.floor((now - new Date(t.column_entered_at)) / 86400000) }))
    .filter(t => t.ageDays * 86400000 > agingMs)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);
}

function renderOverviewTab(container, tasks) {
  const kpis     = computeKPIs(tasks);
  const callouts = computeCallouts(tasks);
  const aging    = computeAgingTasks(tasks);

  container.innerHTML = `
    <div class="trends-kpi-strip">
      ${kpiCard('Active Tasks',  kpis.active,        '',                              'var(--accent)')}
      ${kpiCard('Blocked',       kpis.blocked,       `${kpis.blockedPct}% of active`, '#ef4444')}
      ${kpiCard('Overdue',       kpis.overdue,       'past due date',                 '#f59e0b')}
      ${kpiCard('Avg Task Age',  kpis.avgAge + 'd',  'in current column',             '#8b5cf6')}
      ${kpiCard('Completed',     kpis.done,          'across all boards',             '#10b981')}
    </div>

    <div class="trends-row">
      <div class="trends-card trends-card-wide">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Pipeline Distribution</h3>
          <span class="trends-card-sub">Tasks by column across all workspaces</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:220px"><canvas id="trendsPipelineChart"></canvas></div>
      </div>
      <div class="trends-card">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Priority Mix</h3>
          <span class="trends-card-sub">Active task breakdown</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:220px"><canvas id="trendsPriorityChart"></canvas></div>
      </div>
    </div>

    <div class="trends-row">
      <div class="trends-card">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Team Load</h3>
          <span class="trends-card-sub">Active tasks per person (excl. done)</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:220px"><canvas id="trendsTeamChart"></canvas></div>
      </div>
      <div class="trends-card trends-card-wide">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Task Types</h3>
          <span class="trends-card-sub">In progress vs. completed by type</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:220px"><canvas id="trendsTypeChart"></canvas></div>
      </div>
    </div>

    <div class="trends-row">
      <div class="trends-card trends-full">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Key Callouts</h3>
          <span class="trends-card-sub">What needs your attention right now</span>
        </div></div>
        <div class="trends-callouts">
          ${callouts.map(c => `
            <div class="trends-callout trends-callout-${c.type}">
              <span class="trends-callout-icon">${ICONS[c.icon]}</span>
              <span class="trends-callout-text">${escapeHtml(c.text)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    ${aging.length > 0 ? `
      <div class="trends-row">
        <div class="trends-card trends-full">
          <div class="trends-card-header"><div>
            <h3 class="trends-card-title">Watch Out — Aging Tasks</h3>
            <span class="trends-card-sub">Stuck in the same column for ${state.agingThresholdDays || 5}+ days</span>
          </div></div>
          <div class="trends-aging-list">
            ${aging.map(t => {
              const ageColor = t.ageDays > 14 ? '#ef4444' : t.ageDays > 7 ? '#f59e0b' : '#8b5cf6';
              const barPct   = Math.min(100, Math.round((t.ageDays / 21) * 100));
              return `
                <div class="trends-aging-row">
                  <span class="trends-aging-title">${escapeHtml(t.title)}</span>
                  <span class="trends-aging-col">${COL_META[t.column]?.label || t.column}</span>
                  <div class="trends-aging-bar-track">
                    <div class="trends-aging-bar-fill" style="width:${barPct}%;background:${ageColor}"></div>
                  </div>
                  <span class="trends-aging-age" style="color:${ageColor}">${t.ageDays}d</span>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    ` : ''}
  `;

  requestAnimationFrame(() => {
    renderPipelineChart(tasks);
    renderPriorityChart(tasks);
    renderTeamChart(tasks);
    renderTypeChart(tasks);
  });
}

// Overview charts (unchanged from original)
function renderPipelineChart(tasks) {
  const canvas = document.getElementById('trendsPipelineChart');
  if (!canvas || !window.Chart) return;
  const tc = getTC();
  const counts = {};
  for (const t of tasks.filter(t => !t.archived)) counts[t.column] = (counts[t.column] || 0) + 1;
  const labels = [], data = [], colors = [];
  for (const [colId, count] of Object.entries(counts)) {
    const meta = COL_META[colId] || { label: colId, color: '#9ca3af' };
    labels.push(meta.label); data.push(count); colors.push(meta.color);
  }
  activeCharts.push(new window.Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 2, borderRadius: 6, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tooltip(tc), callbacks: { label: ctx => ` ${ctx.parsed.y} task${ctx.parsed.y !== 1 ? 's' : ''}` } } }, scales: scales(tc) },
  }));
}

function renderPriorityChart(tasks) {
  const canvas = document.getElementById('trendsPriorityChart');
  if (!canvas || !window.Chart) return;
  const tc     = getTC();
  const labels = ['Critical','High','Medium','Low'];
  const colors = ['#ef4444','#f59e0b','#3b82f6','#10b981'];
  const data   = ['critical','high','medium','low'].map(p => tasks.filter(t => !t.archived && t.priority === p).length);
  activeCharts.push(new window.Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 2, hoverOffset: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'right', labels: legendLabels(tc) }, tooltip: tooltip(tc) } },
  }));
}

function renderTeamChart(tasks) {
  const canvas = document.getElementById('trendsTeamChart');
  if (!canvas || !window.Chart) return;
  const tc     = getTC();
  const counts = {};
  for (const t of tasks.filter(t => !t.archived && !DONE_COLS.has(t.column))) {
    if (t.assignee) counts[t.assignee] = (counts[t.assignee] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!sorted.length) { emptyCanvas(canvas, tc, 'No assignees yet'); return; }
  const labels = sorted.map(([n]) => n), data = sorted.map(([,n]) => n);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
  activeCharts.push(new window.Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 2, borderRadius: 6, borderSkipped: false }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tooltip(tc), callbacks: { label: ctx => ` ${ctx.parsed.x} active task${ctx.parsed.x !== 1 ? 's' : ''}` } } }, scales: scales(tc, { y: { grid: { color: 'transparent' }, ticks: { color: tc.text, font: { family: 'Work Sans', size: 11 } } } }) },
  }));
}

function renderTypeChart(tasks) {
  const canvas = document.getElementById('trendsTypeChart');
  if (!canvas || !window.Chart) return;
  const tc     = getTC();
  const types  = ['design','research','prototype','review','development'];
  const labels = ['Design','Research','Prototype','Review','Development'];
  const inProg = types.map(type => tasks.filter(t => !t.archived && t.type === type && !DONE_COLS.has(t.column)).length);
  const done   = types.map(type => tasks.filter(t => !t.archived && t.type === type &&  DONE_COLS.has(t.column)).length);
  activeCharts.push(new window.Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'In Progress', data: inProg, backgroundColor: '#f59e0bbb', borderColor: '#f59e0b', borderWidth: 2, borderRadius: 6, borderSkipped: false },
      { label: 'Completed',   data: done,   backgroundColor: '#10b981bb', borderColor: '#10b981', borderWidth: 2, borderRadius: 6, borderSkipped: false },
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: legendLabels(tc) }, tooltip: tooltip(tc) }, scales: scales(tc) },
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB: VELOCITY
// ══════════════════════════════════════════════════════════════════════════════

function getWeekBuckets(n = 8) {
  const now    = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const buckets = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    buckets.push({ start, end, label, count: 0 });
  }
  return buckets;
}

function renderVelocityTab(container, tasks) {
  const buckets = getWeekBuckets(8);

  for (const t of tasks) {
    if (!t.archived && DONE_COLS.has(t.column) && t.column_entered_at) {
      const d = new Date(t.column_entered_at);
      for (const b of buckets) { if (d >= b.start && d < b.end) { b.count++; break; } }
    }
  }

  const thisWeek = buckets[buckets.length - 1].count;
  const lastWeek = buckets[buckets.length - 2].count;
  const delta    = thisWeek - lastWeek;
  const total4w  = buckets.slice(-4).reduce((s, b) => s + b.count, 0);
  const avg4w    = (total4w / 4).toFixed(1);

  // 3-week rolling average
  const rolling = buckets.map((_, i) => {
    if (i < 2) return null;
    return +((buckets[i].count + buckets[i-1].count + buckets[i-2].count) / 3).toFixed(1);
  });

  container.innerHTML = `
    <div class="trends-kpi-strip">
      ${kpiCard('This Week',      thisWeek,       'tasks completed',     'var(--accent)', delta)}
      ${kpiCard('Last Week',      lastWeek,       'tasks completed',     '#8b5cf6')}
      ${kpiCard('4-Week Avg',     avg4w,          'tasks per week',      '#10b981')}
      ${kpiCard('Last 4 Weeks',   total4w,        'total completed',     '#f59e0b')}
    </div>

    <div class="trends-row">
      <div class="trends-card trends-full">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Weekly Throughput</h3>
          <span class="trends-card-sub">Tasks completed per week + 3-week rolling average</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:280px"><canvas id="trendsVelocityChart"></canvas></div>
      </div>
    </div>

    <div class="trends-row">
      <div class="trends-card trends-full">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Completed Tasks — Last 8 Weeks</h3>
          <span class="trends-card-sub">Week-by-week breakdown</span>
        </div></div>
        <table class="trends-table">
          <thead><tr>
            <th>Week of</th><th>Completed</th><th>vs. Previous</th><th>Rolling Avg</th>
          </tr></thead>
          <tbody>
            ${buckets.map((b, i) => {
              const prev   = i > 0 ? buckets[i-1].count : null;
              const diff   = prev !== null ? b.count - prev : null;
              const diffHtml = diff === null ? '—'
                : diff > 0  ? `<span class="trend-up">↑ ${diff}</span>`
                : diff < 0  ? `<span class="trend-down">↓ ${Math.abs(diff)}</span>`
                : '<span class="trend-flat">—</span>';
              return `<tr>
                <td>${b.label}</td>
                <td><strong>${b.count}</strong></td>
                <td>${diffHtml}</td>
                <td>${rolling[i] !== null ? rolling[i] : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    const canvas = document.getElementById('trendsVelocityChart');
    if (!canvas || !window.Chart) return;
    const tc = getTC();
    activeCharts.push(new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [
          {
            label:           'Completed',
            data:            buckets.map(b => b.count),
            backgroundColor: 'var(--accent)' + '99',
            borderColor:     'var(--accent)',
            borderWidth:     2,
            borderRadius:    6,
            borderSkipped:   false,
            order:           2,
          },
          {
            label:       '3-Week Avg',
            data:        rolling,
            type:        'line',
            borderColor: '#10b981',
            borderWidth: 2,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
            tension:     0.4,
            fill:        false,
            order:       1,
            spanGaps:    true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: legendLabels(tc) }, tooltip: tooltip(tc) },
        scales: scales(tc),
      },
    }));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB: FORECAST
// ══════════════════════════════════════════════════════════════════════════════

function renderForecastTab(container, tasks) {
  const now    = new Date();
  const active = tasks.filter(t => !t.archived && !DONE_COLS.has(t.column));

  const buckets = {
    overdue:    { label: 'Overdue',         color: '#ef4444', tasks: [] },
    thisWeek:   { label: 'Due This Week',    color: '#f59e0b', tasks: [] },
    next2Weeks: { label: 'Due in 2 Weeks',   color: '#8b5cf6', tasks: [] },
    onTrack:    { label: 'Due This Month',   color: '#10b981', tasks: [] },
    noDue:      { label: 'No Due Date',      color: '#9ca3af', tasks: [] },
  };

  for (const t of active) {
    if (!t.due) { buckets.noDue.tasks.push(t); continue; }
    const diff = (new Date(t.due) - now) / 86400000;
    if      (diff < 0)   buckets.overdue.tasks.push(t);
    else if (diff <= 7)  buckets.thisWeek.tasks.push(t);
    else if (diff <= 14) buckets.next2Weeks.tasks.push(t);
    else                 buckets.onTrack.tasks.push(t);
  }

  const atRiskTasks = [...buckets.overdue.tasks, ...buckets.thisWeek.tasks]
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  container.innerHTML = `
    <div class="trends-kpi-strip" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard('Overdue',       buckets.overdue.tasks.length,    'need action now',     '#ef4444')}
      ${kpiCard('Due This Week', buckets.thisWeek.tasks.length,   'next 7 days',         '#f59e0b')}
      ${kpiCard('Due in 2 Wks',  buckets.next2Weeks.tasks.length, 'plan ahead',          '#8b5cf6')}
      ${kpiCard('No Due Date',   buckets.noDue.tasks.length,      'no deadline set',     '#9ca3af')}
    </div>

    <div class="trends-row">
      <div class="trends-card">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Due Date Distribution</h3>
          <span class="trends-card-sub">Active tasks by urgency bucket</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:240px"><canvas id="trendsForecastChart"></canvas></div>
      </div>
      <div class="trends-card trends-card-wide">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">${atRiskTasks.length > 0 ? '⚠ At-Risk Tasks' : 'At-Risk Tasks'}</h3>
          <span class="trends-card-sub">Overdue and due this week</span>
        </div></div>
        ${atRiskTasks.length === 0
          ? `<div class="trends-empty">No at-risk tasks — you're in good shape</div>`
          : `<div class="trends-risk-list">
              ${atRiskTasks.map(t => {
                const diff     = (new Date(t.due) - now) / 86400000;
                const isOver   = diff < 0;
                const badge    = isOver ? `<span class="risk-badge risk-overdue">Overdue ${Math.abs(Math.round(diff))}d</span>` : `<span class="risk-badge risk-soon">Due in ${Math.round(diff)}d</span>`;
                const colLabel = COL_META[t.column]?.label || t.column;
                return `
                  <div class="trends-risk-row">
                    <span class="risk-priority-dot" style="background:${PRIORITY_COLORS[t.priority] || '#9ca3af'}"></span>
                    <span class="risk-title">${escapeHtml(t.title)}</span>
                    <span class="risk-col">${colLabel}</span>
                    <span class="risk-assignee">${escapeHtml(t.assignee || '—')}</span>
                    ${badge}
                  </div>`;
              }).join('')}
            </div>`
        }
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    const canvas = document.getElementById('trendsForecastChart');
    if (!canvas || !window.Chart) return;
    const tc     = getTC();
    const bList  = Object.values(buckets);
    activeCharts.push(new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels:   bList.map(b => `${b.label} (${b.tasks.length})`),
        datasets: [{ data: bList.map(b => b.tasks.length), backgroundColor: bList.map(b => b.color + 'bb'), borderColor: bList.map(b => b.color), borderWidth: 2, hoverOffset: 6 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: legendLabels(tc) }, tooltip: tooltip(tc) } },
    }));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB: REQUESTERS
// ══════════════════════════════════════════════════════════════════════════════

function renderRequestersTab(container, tasks) {
  const active = tasks.filter(t => !t.archived);
  const map    = {};

  for (const t of active) {
    const req = t.requester || 'Unassigned';
    if (!map[req]) map[req] = { total: 0, done: 0, inProgress: 0, critical: 0, high: 0 };
    map[req].total++;
    if (DONE_COLS.has(t.column)) map[req].done++;
    else map[req].inProgress++;
    if (t.priority === 'critical') map[req].critical++;
    if (t.priority === 'high')     map[req].high++;
  }

  const rows = Object.entries(map)
    .filter(([k]) => k !== 'Unassigned')
    .sort((a, b) => b[1].total - a[1].total);

  const unassigned = map['Unassigned'];

  container.innerHTML = `
    <div class="trends-kpi-strip" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard('Requesters',       rows.length,                                      'active sources',     'var(--accent)')}
      ${kpiCard('Total Requests',   active.filter(t => t.requester).length,           'with a requester',   '#3b82f6')}
      ${kpiCard('Completion Rate',  active.length > 0 ? Math.round((active.filter(t => DONE_COLS.has(t.column)).length / active.length) * 100) + '%' : '0%', 'across all', '#10b981')}
      ${kpiCard('Unassigned',       unassigned?.total || 0,                           'no requester set',   '#9ca3af')}
    </div>

    <div class="trends-row">
      <div class="trends-card trends-card-wide">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Requests by Source</h3>
          <span class="trends-card-sub">Volume and completion by requester</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:260px"><canvas id="trendsRequesterChart"></canvas></div>
      </div>
      <div class="trends-card">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Completion Rate</h3>
          <span class="trends-card-sub">% done per requester</span>
        </div></div>
        <div class="trends-chart-wrap" style="height:260px"><canvas id="trendsCompletionChart"></canvas></div>
      </div>
    </div>

    <div class="trends-row">
      <div class="trends-card trends-full">
        <div class="trends-card-header"><div>
          <h3 class="trends-card-title">Requester Breakdown</h3>
          <span class="trends-card-sub">Full summary by source</span>
        </div></div>
        ${rows.length === 0
          ? `<div class="trends-empty">No requester data yet — add requesters when creating tasks</div>`
          : `<table class="trends-table">
              <thead><tr>
                <th>Requester</th><th>Total</th><th>In Progress</th><th>Done</th><th>Completion</th><th>Critical / High</th>
              </tr></thead>
              <tbody>
                ${rows.map(([name, d]) => {
                  const pct = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                  return `<tr>
                    <td><strong>${escapeHtml(name)}</strong></td>
                    <td>${d.total}</td>
                    <td>${d.inProgress}</td>
                    <td>${d.done}</td>
                    <td>
                      <div class="trends-pct-bar">
                        <div class="trends-pct-fill" style="width:${pct}%"></div>
                        <span>${pct}%</span>
                      </div>
                    </td>
                    <td>${d.critical > 0 ? `<span style="color:#ef4444">${d.critical} crit</span>` : ''}${d.critical > 0 && d.high > 0 ? ' / ' : ''}${d.high > 0 ? `<span style="color:#f59e0b">${d.high} high</span>` : ''}${d.critical === 0 && d.high === 0 ? '—' : ''}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    const tc = getTC();

    // Stacked bar: volume
    const reqCanvas = document.getElementById('trendsRequesterChart');
    if (reqCanvas && window.Chart && rows.length > 0) {
      activeCharts.push(new window.Chart(reqCanvas, {
        type: 'bar',
        data: {
          labels: rows.map(([n]) => n),
          datasets: [
            { label: 'In Progress', data: rows.map(([,d]) => d.inProgress), backgroundColor: '#f59e0bbb', borderColor: '#f59e0b', borderWidth: 2, borderRadius: 4, borderSkipped: false },
            { label: 'Completed',   data: rows.map(([,d]) => d.done),       backgroundColor: '#10b981bb', borderColor: '#10b981', borderWidth: 2, borderRadius: 4, borderSkipped: false },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: legendLabels(tc) }, tooltip: tooltip(tc) }, scales: { ...scales(tc), x: { ...scales(tc).x, stacked: false } } },
      }));
    } else if (reqCanvas) emptyCanvas(reqCanvas, tc, 'No requester data yet');

    // Doughnut: completion rate per requester
    const compCanvas = document.getElementById('trendsCompletionChart');
    if (compCanvas && window.Chart && rows.length > 0) {
      const colors = rows.map((_, i) => PALETTE[i % PALETTE.length]);
      activeCharts.push(new window.Chart(compCanvas, {
        type: 'doughnut',
        data: {
          labels: rows.map(([n, d]) => `${n} (${d.total > 0 ? Math.round((d.done/d.total)*100) : 0}%)`),
          datasets: [{ data: rows.map(([,d]) => d.done), backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 2, hoverOffset: 6 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: legendLabels(tc) }, tooltip: tooltip(tc) } },
      }));
    } else if (compCanvas) emptyCanvas(compCanvas, tc, 'No data yet');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB: BLOCKERS
// ══════════════════════════════════════════════════════════════════════════════

function renderBlockersTab(container, tasks) {
  const active   = tasks.filter(t => !t.archived);
  const blocked  = active.filter(t => t.blocked);
  const now      = new Date();

  // Blocked by board
  const byBoard = {};
  for (const t of blocked) {
    byBoard[t.boardId] = (byBoard[t.boardId] || 0) + 1;
  }

  // Blocked by column
  const byCol = {};
  for (const t of blocked) {
    byCol[t.column] = (byCol[t.column] || 0) + 1;
  }

  // Blocked by assignee
  const byAssignee = {};
  for (const t of blocked) {
    if (t.assignee) byAssignee[t.assignee] = (byAssignee[t.assignee] || 0) + 1;
  }

  // How long blocked (proxy: time since last updated_at)
  const blockedWithAge = blocked.map(t => ({
    ...t,
    blockedDays: t.updated_at ? Math.floor((now - new Date(t.updated_at)) / 86400000) : 0,
  })).sort((a, b) => b.blockedDays - a.blockedDays);

  const boardLabels = { 'product-design':'Product Design','business-dev':'Business Dev','ux':'UX Research','flagship':'Flagship','business-products':'Biz Products' };

  container.innerHTML = `
    <div class="trends-kpi-strip" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard('Blocked Tasks',   blocked.length,   'need unblocking',   '#ef4444')}
      ${kpiCard('Boards Affected', Object.keys(byBoard).length, 'of 5 boards', '#f59e0b')}
      ${kpiCard('People Blocked',  Object.keys(byAssignee).length, 'team members', '#8b5cf6')}
      ${kpiCard('% of Active',     active.length > 0 ? Math.round((blocked.length / active.length) * 100) + '%' : '0%', 'tasks blocked', '#3b82f6')}
    </div>

    ${blocked.length === 0
      ? `<div class="trends-card trends-full"><div class="trends-empty" style="padding:40px">No blocked tasks — the pipeline is clear</div></div>`
      : `
        <div class="trends-row">
          <div class="trends-card">
            <div class="trends-card-header"><div>
              <h3 class="trends-card-title">Blocked by Column</h3>
              <span class="trends-card-sub">Where blockers are concentrated</span>
            </div></div>
            <div class="trends-chart-wrap" style="height:220px"><canvas id="trendsBlockerColChart"></canvas></div>
          </div>
          <div class="trends-card">
            <div class="trends-card-header"><div>
              <h3 class="trends-card-title">Blocked by Board</h3>
              <span class="trends-card-sub">Which workspace is most affected</span>
            </div></div>
            <div class="trends-chart-wrap" style="height:220px"><canvas id="trendsBlockerBoardChart"></canvas></div>
          </div>
        </div>

        <div class="trends-row">
          <div class="trends-card trends-full">
            <div class="trends-card-header"><div>
              <h3 class="trends-card-title">Blocker Detail</h3>
              <span class="trends-card-sub">All blocked tasks sorted by time blocked</span>
            </div></div>
            <div class="trends-blocker-list">
              ${blockedWithAge.map(t => {
                const ageColor = t.blockedDays > 7 ? '#ef4444' : t.blockedDays > 3 ? '#f59e0b' : '#8b8a94';
                const colLabel = COL_META[t.column]?.label || t.column;
                const boardLabel = boardLabels[t.boardId] || t.boardId;
                return `
                  <div class="trends-blocker-row">
                    <span class="blocker-priority-dot" style="background:${PRIORITY_COLORS[t.priority] || '#9ca3af'}"></span>
                    <span class="blocker-title">${escapeHtml(t.title)}</span>
                    <span class="blocker-board">${boardLabel}</span>
                    <span class="blocker-col">${colLabel}</span>
                    <span class="blocker-assignee">${escapeHtml(t.assignee || '—')}</span>
                    <span class="blocker-age" style="color:${ageColor}">${t.blockedDays > 0 ? `${t.blockedDays}d` : 'today'}</span>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      `
    }
  `;

  if (blocked.length === 0) return;

  requestAnimationFrame(() => {
    const tc = getTC();

    const colCanvas = document.getElementById('trendsBlockerColChart');
    if (colCanvas && window.Chart) {
      const entries = Object.entries(byCol).sort((a, b) => b[1] - a[1]);
      const colors  = entries.map(([c]) => COL_META[c]?.color || '#9ca3af');
      activeCharts.push(new window.Chart(colCanvas, {
        type: 'bar',
        data: { labels: entries.map(([c]) => COL_META[c]?.label || c), datasets: [{ data: entries.map(([,n]) => n), backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 2, borderRadius: 6, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tooltip(tc), callbacks: { label: ctx => ` ${ctx.parsed.y} blocked` } } }, scales: scales(tc) },
      }));
    }

    const boardCanvas = document.getElementById('trendsBlockerBoardChart');
    if (boardCanvas && window.Chart) {
      const entries = Object.entries(byBoard).sort((a, b) => b[1] - a[1]);
      const colors  = entries.map((_, i) => PALETTE[i % PALETTE.length]);
      activeCharts.push(new window.Chart(boardCanvas, {
        type: 'doughnut',
        data: { labels: entries.map(([b]) => boardLabels[b] || b), datasets: [{ data: entries.map(([,n]) => n), backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 2, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: legendLabels(tc) }, tooltip: tooltip(tc) } },
      }));
    }
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

function emptyCanvas(canvas, tc, msg) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tc.textSecondary;
  ctx.font = '13px Work Sans';
  ctx.textAlign = 'center';
  ctx.fillText(msg, canvas.width / 2, 60);
}
