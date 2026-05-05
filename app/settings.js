/* ========================================
   Settings Panel
   ======================================== */

import { state, saveState, getCurrentBoard, getActiveFieldOptions, setWorkspaceFieldOptions } from './state.js';
import { COMPANY_WORKSPACES } from './home.js';
import { renderBoard } from './render.js';
import { notifySlack } from './slack.js';

export function openSettings() {
  document.getElementById('settingsOverlay').classList.add('show');
  // Update nav value labels
  document.getElementById('settingsNavProfileValue').textContent = state.profile.name;
  document.getElementById('settingsNavThemeValue').textContent = state.theme === 'dark' ? 'Dark' : 'Light';
  document.getElementById('settingsNavSlackValue').textContent = state.slackWebhookUrl ? 'Connected' : '';

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
  document.querySelectorAll('.settings-subpage.show').forEach(p => p.classList.remove('show'));
  _fieldOptionsWsId = null; // reset so next open defaults to current board
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
    'openIntegrationsSettings': 'integrationsSettingsPage',
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

  // Integrations — populate input when sub-page opens
  document.getElementById('openIntegrationsSettings')?.addEventListener('click', () => {
    document.getElementById('slackWebhookInput').value = state.slackWebhookUrl || '';
  });

  // Slack — save
  document.getElementById('saveSlackWebhook')?.addEventListener('click', () => {
    const url = document.getElementById('slackWebhookInput').value.trim();
    state.slackWebhookUrl = url;
    saveState();
    document.getElementById('settingsNavSlackValue').textContent = url ? 'Connected' : '';
    document.getElementById('saveSlackWebhook').textContent = 'Saved!';
    setTimeout(() => { document.getElementById('saveSlackWebhook').textContent = 'Save'; }, 1500);
  });

  // Slack — test
  document.getElementById('testSlackWebhook')?.addEventListener('click', () => {
    const url = document.getElementById('slackWebhookInput').value.trim();
    if (!url) { alert('Enter a webhook URL first.'); return; }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Runway kanban is connected to Slack.' }),
    })
      .then(() => alert('Test message sent!'))
      .catch(() => alert('Failed to send — check the webhook URL.'));
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

let _fieldOptionsWsId = null; // tracks which workspace is selected in the picker

function renderFieldOptions() {
  // Default to current board, fall back to __global__
  if (!_fieldOptionsWsId) {
    _fieldOptionsWsId = (state.currentBoard && state.currentBoard !== 'home')
      ? state.currentBoard
      : '__global__';
  }

  const allWorkspaces = [...(COMPANY_WORKSPACES || []), ...(state.customWorkspaces || [])];
  const fo = getActiveFieldOptions(_fieldOptionsWsId);
  const fields = [
    { key: 'requester', label: 'Requester' },
    { key: 'platform', label: 'Platform' },
    { key: 'type', label: 'Type' },
    { key: 'size', label: 'Size' },
  ];

  const body = document.getElementById('fieldOptionsBody');
  body.innerHTML = `
    <div class="settings-section field-options-ws-picker-section">
      <label style="font-size:11px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.04em;display:block;margin-bottom:8px;">Workspace</label>
      <select id="fieldOptionsWsPicker" class="fo-ws-picker">
        <option value="__global__" ${_fieldOptionsWsId === '__global__' ? 'selected' : ''}>Global defaults</option>
        ${allWorkspaces.map(w => `<option value="${w.id}" ${_fieldOptionsWsId === w.id ? 'selected' : ''}>${w.name}</option>`).join('')}
      </select>
      ${_fieldOptionsWsId !== '__global__' && !state.workspaceFieldOptions[_fieldOptionsWsId]
        ? `<p class="fo-inherit-note">Using global defaults — any change you make will create a custom set for this workspace only.</p>`
        : ''}
    </div>
    ${fields.map(f => `
      <div class="settings-section">
        <h3>${f.label}</h3>
        <div class="field-options-list" id="fieldList-${f.key}">
          ${(fo[f.key] || []).map((opt, i) => `
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
    `).join('')}
  `;

  // Workspace picker change
  document.getElementById('fieldOptionsWsPicker').addEventListener('change', (e) => {
    _fieldOptionsWsId = e.target.value;
    renderFieldOptions();
  });

  function getOrInitWsOptions() {
    if (!state.workspaceFieldOptions[_fieldOptionsWsId]) {
      // Clone from __global__ or legacy fieldOptions as starting point
      const base = state.workspaceFieldOptions['__global__'] || state.fieldOptions || {};
      state.workspaceFieldOptions[_fieldOptionsWsId] = JSON.parse(JSON.stringify(base));
    }
    return state.workspaceFieldOptions[_fieldOptionsWsId];
  }

  // Delegated delete + add
  const newBody = document.getElementById('fieldOptionsBody');
  const handler = (e) => {
    const del = e.target.closest('.field-option-delete');
    if (del) {
      const { field, index } = del.dataset;
      const opts = getOrInitWsOptions();
      opts[field].splice(parseInt(index), 1);
      saveState();
      renderFieldOptions();
      return;
    }
    const add = e.target.closest('.field-option-add-btn');
    if (add) {
      const { field } = add.dataset;
      const input = document.getElementById(`fieldInput-${field}`);
      const val = input.value.trim();
      if (!val) return;
      const opts = getOrInitWsOptions();
      if (!opts[field].includes(val)) {
        opts[field].push(val);
        saveState();
        renderFieldOptions();
      }
    }
  };
  newBody.replaceWith(newBody.cloneNode(true));
  const freshBody = document.getElementById('fieldOptionsBody');
  freshBody.addEventListener('click', handler);

  freshBody.querySelectorAll('.field-option-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const field = input.id.replace('fieldInput-', '');
      const val = input.value.trim();
      if (!val) return;
      const opts = getOrInitWsOptions();
      if (!opts[field].includes(val)) {
        opts[field].push(val);
        saveState();
        renderFieldOptions();
      }
    });
  });

  // Re-attach workspace picker after replaceWith
  const picker = document.getElementById('fieldOptionsWsPicker');
  if (picker) {
    picker.addEventListener('change', (e) => {
      _fieldOptionsWsId = e.target.value;
      renderFieldOptions();
    });
  }
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
