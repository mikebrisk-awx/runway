/* ========================================
   Settings Panel
   ======================================== */

import { state, saveState, getCurrentBoard } from './state.js';
import { renderBoard } from './render.js';

export function openSettings() {
  document.getElementById('settingsOverlay').classList.add('show');
  document.getElementById('settingsName').value = state.profile.name;
  document.getElementById('settingsRole').value = state.profile.role;
  document.getElementById('showSwimlanes').checked = state.showSwimlanes;
  document.getElementById('showWip').checked = state.showWip;
  document.getElementById('compactCards').checked = state.compactCards;
  document.getElementById('agingThreshold').value = state.agingThresholdDays;

  // WIP settings + column policies
  const wipContainer = document.getElementById('wipSettings');
  wipContainer.innerHTML = '';
  const board = getCurrentBoard();
  for (const col of board.columns) {
    const row = document.createElement('div');
    row.className = 'wip-row-extended';
    row.innerHTML = `
      <div class="wip-row">
        <label>${col.name}</label>
        <input type="number" min="0" max="20" value="${col.wipLimit}" data-col-id="${col.id}" class="wip-input" />
      </div>
      <div class="policy-fields">
        <div class="policy-field">
          <label>Def. of Ready</label>
          <input type="text" class="policy-input" data-col-id="${col.id}" data-policy="ready" value="${col.policy?.ready || ''}" placeholder="Criteria to enter this column..." />
        </div>
        <div class="policy-field">
          <label>Def. of Done</label>
          <input type="text" class="policy-input" data-col-id="${col.id}" data-policy="done" value="${col.policy?.done || ''}" placeholder="Criteria to exit this column..." />
        </div>
      </div>
    `;
    wipContainer.appendChild(row);
  }
}

export function closeSettings() {
  document.getElementById('settingsOverlay').classList.remove('show');
}

export function initSettings() {
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('settingsOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settingsOverlay')) closeSettings();
  });

  // Profile
  document.getElementById('settingsName').addEventListener('input', (e) => {
    state.profile.name = e.target.value;
    updateProfile();
    saveState();
  });

  document.getElementById('settingsRole').addEventListener('input', (e) => {
    state.profile.role = e.target.value;
    updateProfile();
    saveState();
  });

  // Toggles
  document.getElementById('showSwimlanes').addEventListener('change', (e) => {
    state.showSwimlanes = e.target.checked;
    saveState();
    renderBoard();
  });

  document.getElementById('showWip').addEventListener('change', (e) => {
    state.showWip = e.target.checked;
    saveState();
    renderBoard();
  });

  document.getElementById('compactCards').addEventListener('change', (e) => {
    state.compactCards = e.target.checked;
    saveState();
    renderBoard();
  });

  document.getElementById('agingThreshold').addEventListener('change', (e) => {
    state.agingThresholdDays = parseInt(e.target.value) || 5;
    saveState();
    renderBoard();
  });

  // WIP limit changes (delegated)
  document.getElementById('wipSettings').addEventListener('input', (e) => {
    if (e.target.classList.contains('wip-input') && e.target.dataset.colId) {
      const board = getCurrentBoard();
      const col = board.columns.find(c => c.id === e.target.dataset.colId);
      if (col) {
        col.wipLimit = parseInt(e.target.value) || 0;
        saveState();
        renderBoard();
      }
    }
    if (e.target.classList.contains('policy-input') && e.target.dataset.colId) {
      const board = getCurrentBoard();
      const col = board.columns.find(c => c.id === e.target.dataset.colId);
      if (col) {
        if (!col.policy) col.policy = { ready: '', done: '' };
        col.policy[e.target.dataset.policy] = e.target.value;
        saveState();
      }
    }
  });
}

export function updateProfile() {
  document.getElementById('profileName').textContent = state.profile.name;
  document.getElementById('profileRole').textContent = state.profile.role;
  const initials = state.profile.name.split(' ').map(n => n[0]).join('').toUpperCase();
  document.getElementById('avatarInitials').textContent = initials;
  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) {
    if (state.profile.photo) {
      avatarEl.style.backgroundImage = `url(${state.profile.photo})`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      document.getElementById('avatarInitials').style.opacity = '0';
    } else {
      avatarEl.style.backgroundImage = '';
      document.getElementById('avatarInitials').style.opacity = '';
    }
  }
}
