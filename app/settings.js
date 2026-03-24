/* ========================================
   Settings Panel
   ======================================== */

import { state, saveState, getCurrentBoard } from './state.js';
import { renderBoard } from './render.js';

export function openSettings() {
  document.getElementById('settingsOverlay').classList.add('show');
  // Update nav value labels
  document.getElementById('settingsNavProfileValue').textContent = state.profile.name;
  document.getElementById('settingsNavThemeValue').textContent = state.theme === 'dark' ? 'Dark' : 'Light';

  // Sync sub-page field values
  document.getElementById('settingsName').value = state.profile.name;
  document.getElementById('settingsRole').value = state.profile.role;
  document.getElementById('showSwimlanes').checked = state.showSwimlanes;
  document.getElementById('showWip').checked = state.showWip;
  document.getElementById('compactCards').checked = state.compactCards;
  document.getElementById('agingThreshold').value = state.agingThresholdDays;

  // WIP settings
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
  // Close all sub-pages
  document.querySelectorAll('.settings-subpage.show').forEach(p => p.classList.remove('show'));
}

export function initSettings() {
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('settingsOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('settingsOverlay')) closeSettings();
  });

  // Nav card → sub-page
  const subpageMap = {
    'openProfileSettings': 'profileSettingsPage',
    'openAppearanceSettings': 'appearanceSettingsPage',
    'openBoardSettings': 'boardSettingsPage',
    'openColumnsSettings': 'columnsSettingsPage',
    'openFieldOptions': 'fieldOptionsPage',
  };
  for (const [btnId, pageId] of Object.entries(subpageMap)) {
    document.getElementById(btnId)?.addEventListener('click', () => {
      if (pageId === 'fieldOptionsPage') renderFieldOptions();
      document.getElementById(pageId)?.classList.add('show');
    });
  }

  // Back buttons
  document.querySelectorAll('[data-back-settings]').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.settings-subpage')?.classList.remove('show');
    });
  });
  document.getElementById('backFromFieldOptions')?.addEventListener('click', () => {
    document.getElementById('fieldOptionsPage')?.classList.remove('show');
  });

  // Profile
  document.getElementById('settingsName').addEventListener('input', (e) => {
    state.profile.name = e.target.value;
    document.getElementById('settingsNavProfileValue').textContent = e.target.value;
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
      if (col) { col.wipLimit = parseInt(e.target.value) || 0; saveState(); renderBoard(); }
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

  // Field Options sub-page (keep existing renderFieldOptions wiring)
}

function renderFieldOptions() {
  const body = document.getElementById('fieldOptionsBody');
  const fields = [
    { key: 'requester', label: 'Requester' },
    { key: 'platform', label: 'Platform' },
    { key: 'type', label: 'Type' },
    { key: 'size', label: 'Size' },
  ];

  body.innerHTML = fields.map(f => `
    <div class="settings-section">
      <h3>${f.label}</h3>
      <div class="field-options-list" id="fieldList-${f.key}">
        ${(state.fieldOptions[f.key] || []).map((opt, i) => `
          <div class="field-option-item">
            <span>${opt}</span>
            <button class="field-option-delete" data-field="${f.key}" data-index="${i}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
      <div class="field-option-add-row">
        <input type="text" class="field-option-input" id="fieldInput-${f.key}" placeholder="Add option..." />
        <button class="field-option-add-btn" data-field="${f.key}">Add</button>
      </div>
    </div>
  `).join('');

  // Delete and Add (delegated — replace listener each render)
  const newBody = document.getElementById('fieldOptionsBody');
  const handler = (e) => {
    const del = e.target.closest('.field-option-delete');
    if (del) {
      const { field, index } = del.dataset;
      state.fieldOptions[field].splice(parseInt(index), 1);
      saveState();
      renderFieldOptions();
      return;
    }
    const add = e.target.closest('.field-option-add-btn');
    if (add) {
      const { field } = add.dataset;
      const input = document.getElementById(`fieldInput-${field}`);
      const val = input.value.trim();
      if (val && !state.fieldOptions[field].includes(val)) {
        state.fieldOptions[field].push(val);
        saveState();
        renderFieldOptions();
      }
    }
  };
  newBody.replaceWith(newBody.cloneNode(true)); // remove old listeners
  const freshBody = document.getElementById('fieldOptionsBody');
  freshBody.addEventListener('click', handler);

  // Re-render rebuilt the DOM, so re-attach enter key listeners
  freshBody.querySelectorAll('.field-option-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const field = input.id.replace('fieldInput-', '');
        const val = input.value.trim();
        if (val && !state.fieldOptions[field].includes(val)) {
          state.fieldOptions[field].push(val);
          saveState();
          renderFieldOptions();
        }
      }
    });
  });
}

export function updateProfile() {
  const name = state.profile.name || '';
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?';

  // Sidebar card
  const profileNameEl = document.getElementById('profileName');
  if (profileNameEl) profileNameEl.textContent = name;
  const profileRoleEl = document.getElementById('profileRole');
  if (profileRoleEl) profileRoleEl.textContent = state.profile.role || '';

  // Sidebar avatar initials + photo
  const initialsEl = document.getElementById('avatarInitials');
  if (initialsEl) initialsEl.textContent = initials;
  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) {
    if (state.profile.photo) {
      avatarEl.style.backgroundImage = `url(${state.profile.photo})`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      if (initialsEl) initialsEl.style.opacity = '0';
    } else {
      avatarEl.style.backgroundImage = '';
      if (initialsEl) initialsEl.style.opacity = '';
    }
  }

  // Settings panel — keep inputs in sync
  const settingsNameInput = document.getElementById('settingsName');
  if (settingsNameInput && document.activeElement !== settingsNameInput) {
    settingsNameInput.value = name;
  }
  const settingsNavVal = document.getElementById('settingsNavProfileValue');
  if (settingsNavVal) settingsNavVal.textContent = name;
}
