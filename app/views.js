/* ========================================
   Analytical Views: Capacity, Charts, Digest
   ======================================== */

import { state, getAllTasks, getCurrentBoard, BOARDS } from './state.js';
import { PRIORITY_COLORS, PRIORITY_LABELS } from './data.js';
import { escapeHtml, capitalize, formatDate, getInitials, timeAgo } from './utils.js';

// ── Capacity View ──
export function renderCapacityView(container) {
  const allTasks = [];
  for (const [boardId, board] of Object.entries(BOARDS)) {
    for (const task of board.tasks) {
      if (!task.archived) {
        allTasks.push({ ...task, boardId, boardTitle: board.title });
      }
    }
  }

  // Group by assignee
  const byAssignee = {};
  for (const t of allTasks) {
    if (!byAssignee[t.assignee]) byAssignee[t.assignee] = [];
    byAssignee[t.assignee].push(t);
  }

  // Sort by task count descending
  const sorted = Object.entries(byAssignee).sort((a, b) => b[1].length - a[1].length);
  const maxTasks = Math.max(...sorted.map(([, tasks]) => tasks.length), 1);

  container.innerHTML = `
    <div class="view-content">
      <div class="view-header">
        <h2>Team Capacity</h2>
        <p class="view-subtitle">Workload distribution across all boards</p>
      </div>
      <div class="capacity-grid">
        ${sorted.map(([name, tasks]) => {
          const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
          const byBoard = {};
          const sizeMap = { S: 1, M: 2, L: 3, XL: 5 };
          let totalEffort = 0;
          for (const t of tasks) {
            byPriority[t.priority]++;
            if (!byBoard[t.boardTitle]) byBoard[t.boardTitle] = 0;
            byBoard[t.boardTitle]++;
            totalEffort += sizeMap[t.size] || 2;
          }
          const pct = (tasks.length / maxTasks) * 100;
          const isOverloaded = tasks.length > 8;
          return `
            <div class="capacity-person ${isOverloaded ? 'overloaded' : ''}">
              <div class="capacity-person-header">
                <div class="capacity-avatar">${getInitials(name)}</div>
                <div class="capacity-person-info">
                  <span class="capacity-name">${escapeHtml(name)}</span>
                  <span class="capacity-stats">${tasks.length} tasks &middot; ${totalEffort} effort pts</span>
                </div>
              </div>
              <div class="capacity-bar-container">
                <div class="capacity-bar">
                  ${Object.entries(byPriority).filter(([,v]) => v > 0).map(([p, count]) => `
                    <div class="capacity-segment" style="width:${(count/tasks.length)*100}%;background:${PRIORITY_COLORS[p]}" title="${PRIORITY_LABELS[p]}: ${count}"></div>
                  `).join('')}
                </div>
                <span class="capacity-pct">${tasks.length}</span>
              </div>
              <div class="capacity-boards">
                ${Object.entries(byBoard).map(([b, c]) => `<span class="capacity-board-tag">${escapeHtml(b)} (${c})</span>`).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ── Charts View ──
export function renderChartsView(container) {
  const board = getCurrentBoard();
  if (!board) return;

  // Cycle time from column_history
  const cycleData = {};
  for (const col of board.columns) {
    cycleData[col.name] = [];
  }

  for (const task of board.tasks) {
    for (const entry of (task.column_history || [])) {
      const col = board.columns.find(c => c.id === entry.column);
      if (col && entry.entered_at && entry.exited_at) {
        const ms = new Date(entry.exited_at) - new Date(entry.entered_at);
        const hours = ms / (1000 * 60 * 60);
        if (hours > 0) cycleData[col.name].push(hours);
      }
    }
    // Add current column time
    if (task.column_entered_at && !task.archived) {
      const col = board.columns.find(c => c.id === task.column);
      if (col) {
        const ms = Date.now() - new Date(task.column_entered_at).getTime();
        const hours = ms / (1000 * 60 * 60);
        cycleData[col.name].push(hours);
      }
    }
  }

  const cycleAvgs = {};
  for (const [name, times] of Object.entries(cycleData)) {
    cycleAvgs[name] = times.length > 0 ? times.reduce((a,b) => a+b, 0) / times.length : 0;
  }
  const maxCycle = Math.max(...Object.values(cycleAvgs), 1);

  // Throughput: tasks completed per week (last 8 weeks)
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weeks.push({ start: weekStart, end: weekEnd, count: 0 });
  }

  for (const task of board.tasks) {
    for (const entry of (task.column_history || [])) {
      const lastCol = board.columns[board.columns.length - 1];
      if (entry.column === lastCol?.id) continue;
      // Check if exited to last column
    }
    // Check activity for "moved to Done/Shipped/etc" entries
    for (const act of (task.activity || [])) {
      if (act.action === 'moved') {
        const lastCol = board.columns[board.columns.length - 1];
        if (act.detail.includes(lastCol?.name)) {
          const date = new Date(act.timestamp);
          for (const w of weeks) {
            if (date >= w.start && date < w.end) {
              w.count++;
              break;
            }
          }
        }
      }
    }
  }

  const maxThroughput = Math.max(...weeks.map(w => w.count), 1);

  // SVG throughput chart
  const svgW = 600, svgH = 200, padding = 40;
  const barW = (svgW - padding * 2) / weeks.length - 4;
  const chartBars = weeks.map((w, i) => {
    const x = padding + i * ((svgW - padding * 2) / weeks.length) + 2;
    const h = maxThroughput > 0 ? (w.count / maxThroughput) * (svgH - padding * 2) : 0;
    const y = svgH - padding - h;
    const month = w.start.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="var(--accent)" opacity="0.7"/>
      <text x="${x + barW/2}" y="${svgH - 10}" text-anchor="middle" font-size="10" fill="var(--text-tertiary)">${month}</text>
      ${w.count > 0 ? `<text x="${x + barW/2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-primary)">${w.count}</text>` : ''}
    `;
  }).join('');

  container.innerHTML = `
    <div class="view-content">
      <div class="view-header">
        <h2>Charts &amp; Analytics</h2>
        <p class="view-subtitle">${board.title} — Performance metrics</p>
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3>Average Cycle Time by Column</h3>
          <div class="cycle-bars">
            ${board.columns.map(col => {
              const avg = cycleAvgs[col.name] || 0;
              const pct = maxCycle > 0 ? (avg / maxCycle) * 100 : 0;
              const display = avg < 24 ? `${avg.toFixed(1)}h` : `${(avg/24).toFixed(1)}d`;
              return `
                <div class="cycle-row">
                  <span class="cycle-label">${col.name}</span>
                  <div class="cycle-bar-track">
                    <div class="cycle-bar-fill" style="width:${pct}%;background:${col.color}"></div>
                  </div>
                  <span class="cycle-value">${display}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="chart-card">
          <h3>Weekly Throughput</h3>
          <svg class="throughput-chart" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">
            <line x1="${padding}" y1="${svgH - padding}" x2="${svgW - padding}" y2="${svgH - padding}" stroke="var(--bg-badge)" stroke-width="1"/>
            ${chartBars}
          </svg>
        </div>
      </div>
    </div>
  `;
}

// ── Digest View ──
export function renderDigestView(container) {
  const board = getCurrentBoard();
  if (!board) return;

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const threeDays = new Date(now);
  threeDays.setDate(threeDays.getDate() + 3);

  const lastCol = board.columns[board.columns.length - 1];
  const firstCol = board.columns[0];

  // Completed this week
  const completed = board.tasks.filter(t => {
    if (t.column !== lastCol?.id && !t.archived) return false;
    // Check if recently completed via activity
    return (t.activity || []).some(a =>
      a.action === 'moved' && a.detail.includes(lastCol?.name) && new Date(a.timestamp) > weekAgo
    ) || (t.archived && new Date(t.updated_at) > weekAgo);
  });

  // In progress (middle columns)
  const middleCols = board.columns.slice(1, -1).map(c => c.id);
  const inProgress = board.tasks.filter(t => middleCols.includes(t.column) && !t.archived);

  // Blocked
  const blocked = board.tasks.filter(t => t.blocked && !t.archived);

  // Aging
  const agingMs = state.agingThresholdDays * 24 * 60 * 60 * 1000;
  const aging = board.tasks.filter(t => {
    if (t.archived) return false;
    const colIdx = board.columns.findIndex(c => c.id === t.column);
    if (colIdx === 0 || colIdx === board.columns.length - 1) return false;
    const timeSince = t.column_entered_at ? Date.now() - new Date(t.column_entered_at).getTime() : 0;
    return timeSince > agingMs;
  });

  // Upcoming due
  const upcoming = board.tasks.filter(t =>
    !t.archived && t.due && new Date(t.due) <= threeDays && new Date(t.due) >= now && t.column !== lastCol?.id
  );

  // Overdue
  const overdue = board.tasks.filter(t =>
    !t.archived && t.due && new Date(t.due) < now && t.column !== lastCol?.id
  );

  container.innerHTML = `
    <div class="view-content digest-view">
      <div class="view-header">
        <h2>Weekly Digest</h2>
        <p class="view-subtitle">${board.title} — Week of ${now.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
      </div>

      <div class="digest-grid">
        <div class="digest-card completed">
          <div class="digest-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            <h3>Completed</h3>
            <span class="digest-count">${completed.length}</span>
          </div>
          <div class="digest-list">
            ${completed.length > 0 ? completed.map(t => digestItem(t)).join('') : '<p class="digest-empty">Nothing completed this week</p>'}
          </div>
        </div>

        <div class="digest-card in-progress">
          <div class="digest-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <h3>In Progress</h3>
            <span class="digest-count">${inProgress.length}</span>
          </div>
          <div class="digest-list">
            ${inProgress.map(t => digestItem(t)).join('')}
          </div>
        </div>

        ${blocked.length > 0 ? `
          <div class="digest-card blocked">
            <div class="digest-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <h3>Blocked</h3>
              <span class="digest-count">${blocked.length}</span>
            </div>
            <div class="digest-list">
              ${blocked.map(t => `
                <div class="digest-item">
                  <div class="card-priority-bar-mini" style="background:${PRIORITY_COLORS[t.priority]}"></div>
                  <div class="digest-item-content">
                    <span class="digest-item-title">${escapeHtml(t.title)}</span>
                    <span class="digest-item-reason">${escapeHtml(t.blocked.reason)}</span>
                  </div>
                  <span class="digest-item-assignee">${escapeHtml(t.assignee)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${aging.length > 0 ? `
          <div class="digest-card aging">
            <div class="digest-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h3>Aging (${state.agingThresholdDays}+ days)</h3>
              <span class="digest-count">${aging.length}</span>
            </div>
            <div class="digest-list">
              ${aging.map(t => {
                const days = Math.floor((Date.now() - new Date(t.column_entered_at).getTime()) / (1000*60*60*24));
                const col = board.columns.find(c => c.id === t.column)?.name || '';
                return `
                  <div class="digest-item">
                    <div class="card-priority-bar-mini" style="background:${PRIORITY_COLORS[t.priority]}"></div>
                    <div class="digest-item-content">
                      <span class="digest-item-title">${escapeHtml(t.title)}</span>
                      <span class="digest-item-sub">${days} days in ${col}</span>
                    </div>
                    <span class="digest-item-assignee">${escapeHtml(t.assignee)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${(overdue.length > 0 || upcoming.length > 0) ? `
          <div class="digest-card due-soon">
            <div class="digest-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <h3>Due Soon / Overdue</h3>
              <span class="digest-count">${overdue.length + upcoming.length}</span>
            </div>
            <div class="digest-list">
              ${overdue.map(t => `
                <div class="digest-item overdue">
                  <div class="card-priority-bar-mini" style="background:${PRIORITY_COLORS[t.priority]}"></div>
                  <div class="digest-item-content">
                    <span class="digest-item-title">${escapeHtml(t.title)}</span>
                    <span class="digest-item-sub overdue-text">Overdue: ${formatDate(t.due)}</span>
                  </div>
                  <span class="digest-item-assignee">${escapeHtml(t.assignee)}</span>
                </div>
              `).join('')}
              ${upcoming.map(t => `
                <div class="digest-item">
                  <div class="card-priority-bar-mini" style="background:${PRIORITY_COLORS[t.priority]}"></div>
                  <div class="digest-item-content">
                    <span class="digest-item-title">${escapeHtml(t.title)}</span>
                    <span class="digest-item-sub">Due: ${formatDate(t.due)}</span>
                  </div>
                  <span class="digest-item-assignee">${escapeHtml(t.assignee)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function digestItem(t) {
  return `
    <div class="digest-item">
      <div class="card-priority-bar-mini" style="background:${PRIORITY_COLORS[t.priority]}"></div>
      <div class="digest-item-content">
        <span class="digest-item-title">${escapeHtml(t.title)}</span>
        ${t.size ? `<span class="size-badge-mini">${t.size}</span>` : ''}
      </div>
      <span class="digest-item-assignee">${escapeHtml(t.assignee)}</span>
    </div>
  `;
}
