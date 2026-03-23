/* ========================================
   Drag & Drop with Intra-Column Reorder
   ======================================== */

import { state, saveState, getCurrentBoard, isLastColumn, BOARDS } from './state.js';
import { logTaskMoved } from './activity.js';
import { renderBoard } from './render.js';

export function setupDropZone(zone) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.closest('.column').classList.add('drag-over');

    // Show drop indicator
    const cards = [...zone.querySelectorAll('.task-card:not(.dragging)')];
    const indicator = zone.querySelector('.drop-indicator-line');
    if (indicator) indicator.remove();

    const afterEl = getDragAfterElement(zone, e.clientY);
    const line = document.createElement('div');
    line.className = 'drop-indicator-line';

    if (afterEl) {
      zone.insertBefore(line, afterEl);
    } else {
      zone.appendChild(line);
    }
  });

  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) {
      zone.closest('.column').classList.remove('drag-over');
      zone.querySelectorAll('.drop-indicator-line').forEach(l => l.remove());
    }
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.closest('.column').classList.remove('drag-over');
    zone.querySelectorAll('.drop-indicator-line').forEach(l => l.remove());

    const taskId = e.dataTransfer.getData('text/plain');
    const columnId = zone.dataset.columnId;
    const board = getCurrentBoard();
    const task = board.tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldColumn = task.column;
    const oldColumnName = board.columns.find(c => c.id === oldColumn)?.name || oldColumn;
    const newColumnName = board.columns.find(c => c.id === columnId)?.name || columnId;

    // Dependency check
    if (task.depends_on && task.depends_on.length > 0 && oldColumn !== columnId) {
      const newColIdx = board.columns.findIndex(c => c.id === columnId);
      const warnings = [];
      for (const depId of task.depends_on) {
        const dep = board.tasks.find(t => t.id === depId);
        if (dep) {
          const depColIdx = board.columns.findIndex(c => c.id === dep.column);
          if (depColIdx < newColIdx && depColIdx < board.columns.length - 1) {
            // dep is behind the target column and not done
            const depColName = board.columns[depColIdx]?.name || dep.column;
            warnings.push(`"${dep.title}" is still in ${depColName}`);
          }
        }
      }
      if (warnings.length > 0) {
        const proceed = confirm(`Dependency warning:\n${warnings.join('\n')}\n\nMove anyway?`);
        if (!proceed) return;
      }
    }

    // Handoff checklist check
    if (isLastColumn(state.currentBoard, columnId) && oldColumn !== columnId) {
      if (task.checklist && task.checklist.length > 0) {
        const incomplete = task.checklist.filter(c => !c.done);
        if (incomplete.length > 0) {
          const proceed = confirm(`This task has ${incomplete.length} incomplete checklist item(s).\n\nMove to ${newColumnName} anyway?`);
          if (!proceed) return;
        }
      }
    }

    // Calculate position
    const afterEl = getDragAfterElement(zone, e.clientY);
    let newPosition;
    if (afterEl) {
      const afterTaskId = afterEl.dataset.taskId;
      const afterTask = board.tasks.find(t => t.id === afterTaskId);
      newPosition = afterTask ? afterTask.position : 0;
    } else {
      // Place at end
      const colTasks = board.tasks.filter(t => t.column === columnId && t.id !== taskId && !t.archived);
      newPosition = colTasks.length;
    }

    // Update column history if column changed
    if (oldColumn !== columnId) {
      const now = new Date().toISOString();
      if (task.column_entered_at) {
        task.column_history.push({
          column: oldColumn,
          entered_at: task.column_entered_at,
          exited_at: now,
        });
      }
      task.column_entered_at = now;
      task.column = columnId;
      logTaskMoved(taskId, oldColumnName, newColumnName);
    }

    // Reindex positions in target column
    task.position = newPosition;
    task.updated_at = new Date().toISOString();

    // Reindex all positions in affected columns
    reindexColumn(board, columnId, taskId, newPosition);
    if (oldColumn !== columnId) {
      reindexColumn(board, oldColumn);
    }

    saveState();
    renderBoard();
  });
}

function reindexColumn(board, columnId, insertedTaskId, insertPosition) {
  const colTasks = board.tasks
    .filter(t => t.column === columnId && !t.archived)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  if (insertedTaskId !== undefined) {
    // Move inserted task to correct position
    const idx = colTasks.findIndex(t => t.id === insertedTaskId);
    if (idx !== -1) {
      const [task] = colTasks.splice(idx, 1);
      colTasks.splice(Math.min(insertPosition, colTasks.length), 0, task);
    }
  }

  colTasks.forEach((t, i) => t.position = i);
}

function getDragAfterElement(zone, y) {
  const cards = [...zone.querySelectorAll('.task-card:not(.dragging)')];
  let closest = null;
  let closestOffset = Number.NEGATIVE_INFINITY;

  for (const card of cards) {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closest = card;
    }
  }

  return closest;
}
