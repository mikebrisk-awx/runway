/* ========================================
   Utility Functions
   ======================================== */

import { state } from './state.js';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function generateId() {
  return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

export function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

// Returns either a photo <img> or initials string for an assignee.
// Checks the current user's profile first, then all team members.
export function assigneeAvatarContent(assignee, profileState, teamMembers) {
  if (!assignee) return '?';
  const initials = getInitials(assignee);

  // Current user
  if (profileState?.photo && profileState.name && profileState.name === assignee) {
    return `<img src="${profileState.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" alt="${initials}" />`;
  }

  // Any other team member with a photo
  const members = teamMembers || state.teamMembers || [];
  const member = members.find(m => m.name === assignee);
  if (member?.photo) {
    return `<img src="${member.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" alt="${initials}" />`;
  }

  return initials;
}

export function attachAssigneeAutocomplete(inputEl, getMembers) {
  if (!inputEl) return;
  let dropdown = null;

  function getFiltered(query) {
    const members = getMembers();
    if (!query) return members;
    const q = query.toLowerCase();
    return members.filter(m => (m.name || '').toLowerCase().includes(q));
  }

  function showDropdown(filtered) {
    if (dropdown) { dropdown.remove(); dropdown = null; }
    if (!filtered.length) return;

    dropdown = document.createElement('div');
    dropdown.className = 'assignee-dropdown';

    filtered.forEach(member => {
      const item = document.createElement('div');
      item.className = 'assignee-option';

      // Avatar — show Google photo if available, otherwise initials
      const avatar = document.createElement('div');
      avatar.className = 'assignee-option-avatar';
      if (member.photo) {
        avatar.style.background = 'transparent';
        const img = document.createElement('img');
        img.src = member.photo;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
        img.onerror = () => { img.remove(); avatar.textContent = member.initials || getInitials(member.name); avatar.style.background = member.color || '#6366f1'; };
        avatar.appendChild(img);
      } else {
        avatar.style.background = member.color || '#6366f1';
        avatar.textContent = member.initials || getInitials(member.name);
      }

      // Name + optional role label
      const info = document.createElement('div');
      info.className = 'assignee-option-info';
      const nameEl = document.createElement('span');
      nameEl.className = 'assignee-option-name';
      nameEl.textContent = member.name;
      info.appendChild(nameEl);
      if (member.role) {
        const roleEl = document.createElement('span');
        roleEl.className = 'assignee-option-role';
        roleEl.textContent = member.roleTitle || member.role;
        info.appendChild(roleEl);
      }

      item.appendChild(avatar);
      item.appendChild(info);
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        inputEl.value = member.name;
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        if (dropdown) { dropdown.remove(); dropdown = null; }
      });
      dropdown.appendChild(item);
    });

    // Anchor to nearest field wrapper — works in both modal and detail panel
    const anchor = inputEl.closest('.dp-prop-row') || inputEl.closest('.dp-field') || inputEl.closest('.modal-field') || inputEl.parentElement;
    anchor.style.position = 'relative';
    anchor.appendChild(dropdown);
  }

  inputEl.addEventListener('focus', () => showDropdown(getFiltered(inputEl.value)));
  inputEl.addEventListener('input', () => showDropdown(getFiltered(inputEl.value)));
  inputEl.addEventListener('blur', () => setTimeout(() => {
    if (dropdown) { dropdown.remove(); dropdown = null; }
  }, 150));
}

// ── @mention helpers (shared by detail-panel and reviews) ──

// Renders comment text: escapes HTML then wraps @mentions in a styled chip
export function renderCommentText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/@([\w.\-]+(?:\s[\w.\-]+)?)/g, '<span class="mention-chip">@$1</span>');
}

// Attaches @mention autocomplete to a textarea.
// dropdownId: unique id for the dropdown element (must exist as a sibling inside a position:relative wrapper)
export function attachMentionAutocomplete(textarea, dropdownEl, getMembers) {
  if (!textarea || !dropdownEl) return;

  function showDropdown(query) {
    const members = getMembers();
    const filtered = members.filter(m => m.name.toLowerCase().includes(query.toLowerCase()));
    if (!filtered.length) { dropdownEl.hidden = true; return; }

    dropdownEl.innerHTML = filtered.map((m, i) => {
      const initials = m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const avatarHtml = m.photo
        ? `<img src="${escapeHtml(m.photo)}" class="mention-option-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <span class="mention-option-initials" style="display:none">${initials}</span>`
        : `<span class="mention-option-initials">${initials}</span>`;
      return `<div class="mention-option${i === 0 ? ' active' : ''}" data-name="${escapeHtml(m.name)}">
        <span class="mention-option-avatar">${avatarHtml}</span>
        <span class="mention-option-name">${escapeHtml(m.name)}</span>
        ${m.role ? `<span class="mention-option-role">${escapeHtml(m.role)}</span>` : ''}
      </div>`;
    }).join('');
    dropdownEl.hidden = false;

    dropdownEl.querySelectorAll('.mention-option').forEach(opt => {
      opt.addEventListener('mousedown', ev => {
        ev.preventDefault();
        insertMention(opt.dataset.name);
      });
    });
  }

  function insertMention(name) {
    const val = textarea.value;
    const cursor = textarea.selectionStart;
    const before = val.slice(0, cursor).replace(/@[\w.]*$/, `@${name} `);
    const after = val.slice(cursor);
    textarea.value = before + after;
    textarea.selectionStart = textarea.selectionEnd = before.length;
    dropdownEl.hidden = true;
    textarea.focus();
  }

  textarea.addEventListener('input', () => {
    const val = textarea.value;
    const cursor = textarea.selectionStart;
    const match = val.slice(0, cursor).match(/@([\w.]*)$/);
    if (!match) { dropdownEl.hidden = true; return; }
    showDropdown(match[1]);
  });

  textarea.addEventListener('keydown', e => {
    if (dropdownEl.hidden) return;
    const items = dropdownEl.querySelectorAll('.mention-option');
    const active = dropdownEl.querySelector('.mention-option.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = active?.nextElementSibling || items[0];
      active?.classList.remove('active'); next?.classList.add('active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = active?.previousElementSibling || items[items.length - 1];
      active?.classList.remove('active'); prev?.classList.add('active');
    } else if (e.key === 'Enter' && active) {
      e.preventDefault();
      insertMention(active.dataset.name);
    } else if (e.key === 'Escape') {
      dropdownEl.hidden = true;
    }
  });

  textarea.addEventListener('blur', () => {
    setTimeout(() => { dropdownEl.hidden = true; }, 150);
  });
}
