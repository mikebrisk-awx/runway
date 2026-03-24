/* ========================================
   Utility Functions
   ======================================== */

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
// Pass the state object to check the current user's photo.
export function assigneeAvatarContent(assignee, profileState) {
  const initials = getInitials(assignee || '?');
  if (
    profileState?.photo &&
    profileState.name &&
    getInitials(profileState.name) === initials
  ) {
    return `<img src="${profileState.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" alt="${initials}" />`;
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
    return members.filter(m => m.name.toLowerCase().includes(q));
  }

  function showDropdown(filtered) {
    if (dropdown) { dropdown.remove(); dropdown = null; }
    if (!filtered.length) return;

    dropdown = document.createElement('div');
    dropdown.className = 'assignee-dropdown';

    filtered.forEach(member => {
      const item = document.createElement('div');
      item.className = 'assignee-option';
      const avatar = document.createElement('div');
      avatar.className = 'assignee-option-avatar';
      avatar.style.background = member.color || '#6366f1';
      avatar.textContent = member.initials || getInitials(member.name);
      const label = document.createElement('span');
      label.textContent = member.name;
      item.appendChild(avatar);
      item.appendChild(label);
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        inputEl.value = member.name;
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        if (dropdown) { dropdown.remove(); dropdown = null; }
      });
      dropdown.appendChild(item);
    });

    const anchor = inputEl.closest('.dp-prop-row') || inputEl.closest('.modal-field') || inputEl.parentElement;
    anchor.style.position = 'relative';
    anchor.appendChild(dropdown);
  }

  inputEl.addEventListener('focus', () => showDropdown(getFiltered(inputEl.value)));
  inputEl.addEventListener('input', () => showDropdown(getFiltered(inputEl.value)));
  inputEl.addEventListener('blur', () => setTimeout(() => {
    if (dropdown) { dropdown.remove(); dropdown = null; }
  }, 150));
}
