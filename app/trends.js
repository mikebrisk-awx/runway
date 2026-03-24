/* ========================================
   Trends — Manager Dashboard
   ======================================== */

import { BOARDS, state } from './state.js';
import { PRIORITY_COLORS } from './data.js';
import { escapeHtml } from './utils.js';

// Track active Chart.js instances so we can destroy on re-render
const activeCharts = [];

function destroyCharts() {
  activeCharts.forEach(c => c.destroy());
  activeCharts.length = 0;
}

function getThemeColors() {
  const isDark = state.theme !== 'light';
  return {
    text:          isDark ? '#ededf0' : '#1a1a2e',
    textSecondary: isDark ? '#8b8a94' : '#6b6880',
    gridLine:      isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)',
    tooltipBg:     isDark ? '#1b1b1b' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  };
}

function getAllTasks() {
  const all = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) {
      all.push({ ...task, boardId });
    }
  }
  return all;
}

const DONE_COLS = new Set(['done', 'completed', 'shipped', 'delivered']);
const PALETTE = ['#7c5cfc','#10b981','#f59e0b','#3b82f6','#ec4899','#ef4444','#8b5cf6','#06b6d4'];

// ── KPI Computations ──────────────────────────────────────────────────────────

function computeKPIs(tasks) {
  const active = tasks.filter(t => !t.archived);
  const blocked = active.filter(t => t.blocked);
  const now = new Date();
  const overdue = active.filter(t =>
    t.due && new Date(t.due) < now && !DONE_COLS.has(t.column)
  );
  const done = active.filter(t => DONE_COLS.has(t.column));

  let totalAge = 0, ageCount = 0;
  for (const t of active) {
    if (t.column_entered_at) {
      totalAge += (now - new Date(t.column_entered_at)) / 86400000;
      ageCount++;
    }
  }

  return {
    active:      active.length,
    blocked:     blocked.length,
    blockedPct:  active.length > 0 ? Math.round((blocked.length / active.length) * 100) : 0,
    overdue:     overdue.length,
    done:        done.length,
    avgAge:      ageCount > 0 ? Math.round(totalAge / ageCount) : 0,
  };
}

// ── Smart Callouts ────────────────────────────────────────────────────────────

function computeCallouts(tasks) {
  const callouts = [];
  const active = tasks.filter(t => !t.archived);
  const now = new Date();
  const agingMs = (state.agingThresholdDays || 5) * 86400000;

  // Aging tasks
  const aging = active.filter(t =>
    t.column_entered_at &&
    !DONE_COLS.has(t.column) &&
    t.column !== 'backlog' &&
    (now - new Date(t.column_entered_at)) > agingMs
  );
  if (aging.length > 0) {
    callouts.push({ type: 'warning', icon: 'clock', text: `${aging.length} task${aging.length > 1 ? 's are' : ' is'} aging — stuck in the same column for ${state.agingThresholdDays}+ days` });
  }

  // Blocked
  const blocked = active.filter(t => t.blocked);
  if (blocked.length > 0) {
    callouts.push({ type: 'critical', icon: 'block', text: `${blocked.length} task${blocked.length > 1 ? 's are' : ' is'} blocked and need${blocked.length === 1 ? 's' : ''} immediate attention` });
  }

  // Overdue
  const overdue = active.filter(t => t.due && new Date(t.due) < now && !DONE_COLS.has(t.column));
  if (overdue.length > 0) {
    callouts.push({ type: 'critical', icon: 'date', text: `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} past due date` });
  }

  // Overloaded assignees
  const assigneeCounts = {};
  for (const t of active) {
    if (t.assignee && !DONE_COLS.has(t.column)) {
      assigneeCounts[t.assignee] = (assigneeCounts[t.assignee] || 0) + 1;
    }
  }
  for (const [name, count] of Object.entries(assigneeCounts)) {
    if (count >= 5) {
      callouts.push({ type: 'warning', icon: 'person', text: `${name} has ${count} active tasks — consider rebalancing` });
    }
  }

  // Boards with no completions
  for (const board of Object.values(BOARDS)) {
    const boardActive = board.tasks.filter(t => !t.archived);
    const boardDone   = boardActive.filter(t => DONE_COLS.has(t.column));
    if (boardActive.length > 3 && boardDone.length === 0) {
      callouts.push({ type: 'info', icon: 'chart', text: `${board.title} has no completed tasks yet` });
    }
  }

  if (callouts.length === 0) {
    callouts.push({ type: 'good', icon: 'check', text: 'Everything looks healthy — no blockers, no aging tasks, no overdue items' });
  }

  return callouts;
}

// ── Aging Watch List ──────────────────────────────────────────────────────────

function computeAgingTasks(tasks) {
  const now = new Date();
  const agingMs = (state.agingThresholdDays || 5) * 86400000;
  return tasks
    .filter(t => !t.archived && t.column_entered_at && !DONE_COLS.has(t.column) && t.column !== 'backlog')
    .map(t => ({ ...t, ageDays: Math.floor((now - new Date(t.column_entered_at)) / 86400000) }))
    .filter(t => t.ageDays * 86400000 > agingMs)
    .sort((a, b) => b.ageDays - a.ageDays)
    .slice(0, 8);
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

// ── Column meta (normalized across all boards) ────────────────────────────────

const COL_META = {
  backlog:     { label: 'Backlog',      color: '#9ca3af' },
  ready:       { label: 'Ready',        color: '#3b82f6' },
  discovery:   { label: 'Discovery',    color: '#3b82f6' },
  planning:    { label: 'Planning',     color: '#3b82f6' },
  scoping:     { label: 'Scoping',      color: '#3b82f6' },
  'in-progress':{ label: 'In Progress', color: '#f59e0b' },
  review:      { label: 'Review',       color: '#8b5cf6' },
  stakeholder: { label: 'Stakeholder',  color: '#8b5cf6' },
  analysis:    { label: 'Analysis',     color: '#8b5cf6' },
  qa:          { label: 'QA',           color: '#8b5cf6' },
  done:        { label: 'Done',         color: '#10b981' },
  completed:   { label: 'Completed',    color: '#10b981' },
  shipped:     { label: 'Shipped',      color: '#10b981' },
  delivered:   { label: 'Delivered',    color: '#10b981' },
};

// ── Main render ───────────────────────────────────────────────────────────────

export function renderTrendsView(container) {
  destroyCharts();

  const tasks    = getAllTasks();
  const kpis     = computeKPIs(tasks);
  const callouts = computeCallouts(tasks);
  const aging    = computeAgingTasks(tasks);

  container.innerHTML = `
    <div class="trends-page">

      <!-- KPI Strip -->
      <div class="trends-kpi-strip">
        ${kpiCard('Active Tasks',  kpis.active,          '',                         'var(--accent)')}
        ${kpiCard('Blocked',       kpis.blocked,         `${kpis.blockedPct}% of active`, '#ef4444')}
        ${kpiCard('Overdue',       kpis.overdue,         'past due date',            '#f59e0b')}
        ${kpiCard('Avg Task Age',  kpis.avgAge + 'd',    'in current column',        '#8b5cf6')}
        ${kpiCard('Completed',     kpis.done,            'across all boards',        '#10b981')}
      </div>

      <!-- Row 1: Pipeline + Priority -->
      <div class="trends-row">
        <div class="trends-card trends-card-wide">
          <div class="trends-card-header">
            <div>
              <h3 class="trends-card-title">Pipeline Distribution</h3>
              <span class="trends-card-sub">Tasks by column across all workspaces</span>
            </div>
          </div>
          <div class="trends-chart-wrap" style="height:220px">
            <canvas id="trendsPipelineChart"></canvas>
          </div>
        </div>
        <div class="trends-card">
          <div class="trends-card-header">
            <div>
              <h3 class="trends-card-title">Priority Mix</h3>
              <span class="trends-card-sub">Active task breakdown</span>
            </div>
          </div>
          <div class="trends-chart-wrap" style="height:220px">
            <canvas id="trendsPriorityChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Row 2: Team Load + Task Types -->
      <div class="trends-row">
        <div class="trends-card">
          <div class="trends-card-header">
            <div>
              <h3 class="trends-card-title">Team Load</h3>
              <span class="trends-card-sub">Active tasks per person (excl. done)</span>
            </div>
          </div>
          <div class="trends-chart-wrap" style="height:220px">
            <canvas id="trendsTeamChart"></canvas>
          </div>
        </div>
        <div class="trends-card trends-card-wide">
          <div class="trends-card-header">
            <div>
              <h3 class="trends-card-title">Task Types</h3>
              <span class="trends-card-sub">In progress vs. completed by type</span>
            </div>
          </div>
          <div class="trends-chart-wrap" style="height:220px">
            <canvas id="trendsTypeChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Key Callouts -->
      <div class="trends-row">
        <div class="trends-card trends-full">
          <div class="trends-card-header">
            <div>
              <h3 class="trends-card-title">Key Callouts</h3>
              <span class="trends-card-sub">What needs your attention right now</span>
            </div>
          </div>
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

      <!-- Aging Watch List -->
      ${aging.length > 0 ? `
        <div class="trends-row">
          <div class="trends-card trends-full">
            <div class="trends-card-header">
              <div>
                <h3 class="trends-card-title">Watch Out — Aging Tasks</h3>
                <span class="trends-card-sub">Stuck in the same column for ${state.agingThresholdDays || 5}+ days</span>
              </div>
            </div>
            <div class="trends-aging-list">
              ${aging.map(t => {
                const ageColor = t.ageDays > 14 ? '#ef4444' : t.ageDays > 7 ? '#f59e0b' : '#8b5cf6';
                const barPct   = Math.min(100, Math.round((t.ageDays / 21) * 100));
                const colLabel = COL_META[t.column]?.label || t.column;
                return `
                  <div class="trends-aging-row">
                    <span class="trends-aging-title">${escapeHtml(t.title)}</span>
                    <span class="trends-aging-col">${colLabel}</span>
                    <div class="trends-aging-bar-track">
                      <div class="trends-aging-bar-fill" style="width:${barPct}%;background:${ageColor}"></div>
                    </div>
                    <span class="trends-aging-age" style="color:${ageColor}">${t.ageDays}d</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      ` : ''}

    </div>
  `;

  requestAnimationFrame(() => {
    renderPipelineChart(tasks);
    renderPriorityChart(tasks);
    renderTeamChart(tasks);
    renderTypeChart(tasks);
  });
}

// ── KPI card helper ───────────────────────────────────────────────────────────

function kpiCard(label, value, sub, color) {
  return `
    <div class="trends-kpi-card">
      <div class="trends-kpi-value" style="color:${color}">${value}</div>
      <div class="trends-kpi-label">${label}</div>
      ${sub ? `<div class="trends-kpi-sub">${sub}</div>` : ''}
    </div>
  `;
}

// ── Shared chart defaults ─────────────────────────────────────────────────────

function baseTooltip(tc) {
  return {
    backgroundColor: tc.tooltipBg,
    titleColor:      tc.text,
    bodyColor:       tc.textSecondary,
    borderColor:     tc.tooltipBorder,
    borderWidth:     1,
    padding:         10,
    cornerRadius:    8,
  };
}

function baseScales(tc) {
  return {
    x: {
      grid:  { color: tc.gridLine },
      ticks: { color: tc.textSecondary, font: { family: 'Work Sans', size: 11 } },
    },
    y: {
      grid:  { color: tc.gridLine },
      ticks: { color: tc.textSecondary, font: { family: 'Work Sans', size: 11 }, stepSize: 1 },
      beginAtZero: true,
    },
  };
}

// ── Chart: Pipeline Distribution ──────────────────────────────────────────────

function renderPipelineChart(tasks) {
  const canvas = document.getElementById('trendsPipelineChart');
  if (!canvas || !window.Chart) return;
  const tc = getThemeColors();

  const counts = {};
  for (const t of tasks.filter(t => !t.archived)) {
    counts[t.column] = (counts[t.column] || 0) + 1;
  }

  const labels = [], data = [], colors = [];
  for (const [colId, count] of Object.entries(counts)) {
    const meta = COL_META[colId] || { label: colId, color: '#9ca3af' };
    labels.push(meta.label);
    data.push(count);
    colors.push(meta.color);
  }

  activeCharts.push(new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor:     colors,
        borderWidth:     2,
        borderRadius:    6,
        borderSkipped:   false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(tc),
          callbacks: { label: ctx => ` ${ctx.parsed.y} task${ctx.parsed.y !== 1 ? 's' : ''}` },
        },
      },
      scales: baseScales(tc),
    },
  }));
}

// ── Chart: Priority Mix (Doughnut) ────────────────────────────────────────────

function renderPriorityChart(tasks) {
  const canvas = document.getElementById('trendsPriorityChart');
  if (!canvas || !window.Chart) return;
  const tc = getThemeColors();

  const priorities = ['critical', 'high', 'medium', 'low'];
  const labels     = ['Critical', 'High', 'Medium', 'Low'];
  const colors     = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const data       = priorities.map(p => tasks.filter(t => !t.archived && t.priority === p).length);

  activeCharts.push(new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor:     colors,
        borderWidth:     2,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color:           tc.text,
            font:            { family: 'Work Sans', size: 12 },
            padding:         14,
            usePointStyle:   true,
            pointStyleWidth: 8,
          },
        },
        tooltip: baseTooltip(tc),
      },
    },
  }));
}

// ── Chart: Team Load (Horizontal Bar) ─────────────────────────────────────────

function renderTeamChart(tasks) {
  const canvas = document.getElementById('trendsTeamChart');
  if (!canvas || !window.Chart) return;
  const tc = getThemeColors();

  const counts = {};
  for (const t of tasks.filter(t => !t.archived && !DONE_COLS.has(t.column))) {
    if (t.assignee) counts[t.assignee] = (counts[t.assignee] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (sorted.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = tc.textSecondary;
    ctx.font = '13px Work Sans';
    ctx.textAlign = 'center';
    ctx.fillText('No assignees yet', canvas.width / 2, 50);
    return;
  }

  const labels = sorted.map(([name]) => name);
  const data   = sorted.map(([, n])  => n);
  const colors = labels.map((_, i)   => PALETTE[i % PALETTE.length]);

  activeCharts.push(new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'bb'),
        borderColor:     colors,
        borderWidth:     2,
        borderRadius:    6,
        borderSkipped:   false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...baseTooltip(tc),
          callbacks: { label: ctx => ` ${ctx.parsed.x} active task${ctx.parsed.x !== 1 ? 's' : ''}` },
        },
      },
      scales: {
        x: {
          grid:  { color: tc.gridLine },
          ticks: { color: tc.textSecondary, font: { family: 'Work Sans', size: 11 }, stepSize: 1 },
          beginAtZero: true,
        },
        y: {
          grid:  { color: 'transparent' },
          ticks: { color: tc.text, font: { family: 'Work Sans', size: 11 } },
        },
      },
    },
  }));
}

// ── Chart: Task Types (Grouped Bar) ──────────────────────────────────────────

function renderTypeChart(tasks) {
  const canvas = document.getElementById('trendsTypeChart');
  if (!canvas || !window.Chart) return;
  const tc = getThemeColors();

  const types  = ['design', 'research', 'prototype', 'review', 'development'];
  const labels = ['Design', 'Research', 'Prototype', 'Review', 'Development'];

  const inProg = types.map(type => tasks.filter(t => !t.archived && t.type === type && !DONE_COLS.has(t.column)).length);
  const done   = types.map(type => tasks.filter(t => !t.archived && t.type === type &&  DONE_COLS.has(t.column)).length);

  activeCharts.push(new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'In Progress',
          data:            inProg,
          backgroundColor: '#f59e0bbb',
          borderColor:     '#f59e0b',
          borderWidth:     2,
          borderRadius:    6,
          borderSkipped:   false,
        },
        {
          label:           'Completed',
          data:            done,
          backgroundColor: '#10b981bb',
          borderColor:     '#10b981',
          borderWidth:     2,
          borderRadius:    6,
          borderSkipped:   false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color:           tc.text,
            font:            { family: 'Work Sans', size: 12 },
            usePointStyle:   true,
            pointStyleWidth: 8,
            padding:         16,
          },
        },
        tooltip: baseTooltip(tc),
      },
      scales: baseScales(tc),
    },
  }));
}
