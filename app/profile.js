/* ========================================
   Profile Page
   ======================================== */

import { state, saveState, BOARDS } from './state.js';
import { updateProfile } from './settings.js';
import { updateAvatarStrip } from './team.js';

const SKILL_PRESETS = [
  'Figma', 'Prototyping', 'User Research', 'Design Systems',
  'Accessibility', 'Motion Design', 'Illustration', 'Wireframing',
  'Interaction Design', 'Visual Design', 'iOS', 'Android', 'Web',
];

function getStats() {
  let total = 0, inProgress = 0, done = 0, overdue = 0;
  const now = new Date(); now.setHours(0,0,0,0);
  for (const board of Object.values(BOARDS)) {
    for (const t of board.tasks) {
      if (t.archived) continue;
      const name = state.profile.name.split(' ');
      const initials = name.map(n => n[0]).join('').toUpperCase();
      const assigneeInitials = t.assignee ? t.assignee.split(' ').map(n => n[0]).join('').toUpperCase() : '';
      if (assigneeInitials !== initials && t.assignee !== state.profile.name) continue;
      total++;
      if (t.column === 'done') done++;
      else if (t.column === 'in-progress') inProgress++;
      if (t.due && new Date(t.due) < now && t.column !== 'done') overdue++;
    }
  }
  return { total, inProgress, done, overdue, backlog: total - inProgress - done };
}

function ensureProfileFields() {
  if (!state.profile.bio)      state.profile.bio = '';
  if (!state.profile.location) state.profile.location = '';
  if (!state.profile.timezone) state.profile.timezone = '';
  if (!state.profile.skills)   state.profile.skills = [];
  if (!state.profile.photo)    state.profile.photo = '';
}

function avatarHTML(size = 96) {
  if (state.profile.photo) {
    return `<img src="${state.profile.photo}" class="profile-avatar-img" style="width:${size}px;height:${size}px" alt="Profile photo" />`;
  }
  const initials = state.profile.name.split(' ').map(n => n[0]).join('').toUpperCase();
  return `<div class="profile-avatar-initials" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.33)}px">${initials}</div>`;
}

export function renderProfileView(container) {
  ensureProfileFields();
  const stats = getStats();
  const skills = state.profile.skills;

  container.innerHTML = `
    <div class="profile-view">
      <!-- Header card -->
      <div class="profile-hero">
        <div class="profile-hero-left">
          <div class="profile-avatar-wrap" id="profileAvatarWrap" title="Change photo">
            ${avatarHTML(96)}
            <div class="profile-avatar-overlay">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <input type="file" id="profilePhotoInput" accept="image/*" style="display:none" />
          </div>
          <div class="profile-hero-info">
            <input class="profile-name-input" id="profileNameInput" value="${state.profile.name}" placeholder="Your name" />
            <input class="profile-role-input" id="profileRoleInput" value="${state.profile.role}" placeholder="Your role" />
            <div class="profile-meta-row">
              <div class="profile-meta-field">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <input class="profile-meta-input" id="profileLocationInput" value="${state.profile.location}" placeholder="Location" />
              </div>
              <div class="profile-meta-field">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <input class="profile-meta-input" id="profileTimezoneInput" value="${state.profile.timezone}" placeholder="Timezone" />
              </div>
            </div>
          </div>
        </div>
        <div class="profile-hero-right">
          <div class="profile-stat-card">
            <span class="profile-stat-num">${stats.total}</span>
            <span class="profile-stat-label">Assigned</span>
          </div>
          <div class="profile-stat-card">
            <span class="profile-stat-num" style="color:#f59e0b">${stats.inProgress}</span>
            <span class="profile-stat-label">In Progress</span>
          </div>
          <div class="profile-stat-card">
            <span class="profile-stat-num" style="color:#10b981">${stats.done}</span>
            <span class="profile-stat-label">Completed</span>
          </div>
          <div class="profile-stat-card">
            <span class="profile-stat-num" style="color:#ef4444">${stats.overdue}</span>
            <span class="profile-stat-label">Overdue</span>
          </div>
        </div>
      </div>

      <!-- Bio -->
      <div class="profile-section">
        <h3 class="profile-section-title">About</h3>
        <textarea class="profile-bio-input" id="profileBioInput" placeholder="Write a short bio…" rows="3">${state.profile.bio}</textarea>
      </div>

      <!-- Skills -->
      <div class="profile-section">
        <h3 class="profile-section-title">Skills & Expertise</h3>
        <div class="profile-skills" id="profileSkills">
          ${skills.map(s => `
            <span class="profile-skill-tag">
              ${s}
              <button class="profile-skill-remove" data-skill="${s}">×</button>
            </span>
          `).join('')}
          <div class="profile-skill-add-wrap">
            <input class="profile-skill-input" id="profileSkillInput" placeholder="Add skill…" list="skillPresets" />
            <datalist id="skillPresets">
              ${SKILL_PRESETS.map(p => `<option value="${p}">`).join('')}
            </datalist>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Photo upload ──
  const wrap = container.querySelector('#profileAvatarWrap');
  const fileInput = container.querySelector('#profilePhotoInput');
  wrap.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      state.profile.photo = e.target.result;
      saveState();
      updateProfile();
      updateAvatarStrip();
      // Re-render avatar in place
      wrap.querySelector('.profile-avatar-img, .profile-avatar-initials').outerHTML = avatarHTML(96);
      // Re-render to pick up new img
      const newAvatar = document.createElement('div');
      newAvatar.innerHTML = avatarHTML(96);
      const existing = wrap.querySelector('.profile-avatar-img, .profile-avatar-initials');
      if (existing) existing.replaceWith(newAvatar.firstElementChild);
    };
    reader.readAsDataURL(file);
  });

  // ── Text fields ──
  container.querySelector('#profileNameInput').addEventListener('input', e => {
    state.profile.name = e.target.value;
    saveState(); updateProfile();
  });
  container.querySelector('#profileRoleInput').addEventListener('input', e => {
    state.profile.role = e.target.value;
    saveState(); updateProfile();
  });
  container.querySelector('#profileLocationInput').addEventListener('input', e => {
    state.profile.location = e.target.value;
    saveState();
  });
  container.querySelector('#profileTimezoneInput').addEventListener('input', e => {
    state.profile.timezone = e.target.value;
    saveState();
  });
  container.querySelector('#profileBioInput').addEventListener('input', e => {
    state.profile.bio = e.target.value;
    saveState();
  });

  // ── Skills ──
  function refreshSkills() {
    const skillsEl = container.querySelector('#profileSkills');
    const inputWrap = skillsEl.querySelector('.profile-skill-add-wrap');
    // Remove old tags, keep input wrap
    skillsEl.querySelectorAll('.profile-skill-tag').forEach(t => t.remove());
    state.profile.skills.forEach(s => {
      const tag = document.createElement('span');
      tag.className = 'profile-skill-tag';
      tag.innerHTML = `${s}<button class="profile-skill-remove" data-skill="${s}">×</button>`;
      skillsEl.insertBefore(tag, inputWrap);
    });
    skillsEl.querySelectorAll('.profile-skill-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        state.profile.skills = state.profile.skills.filter(s => s !== btn.dataset.skill);
        saveState(); refreshSkills();
      });
    });
  }

  // Initial remove bindings
  container.querySelectorAll('.profile-skill-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.profile.skills = state.profile.skills.filter(s => s !== btn.dataset.skill);
      saveState(); refreshSkills();
    });
  });

  const skillInput = container.querySelector('#profileSkillInput');
  skillInput.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.value.trim()) {
      e.preventDefault();
      const val = skillInput.value.trim().replace(/,$/, '');
      if (val && !state.profile.skills.includes(val)) {
        state.profile.skills.push(val);
        saveState();
        refreshSkills();
      }
      skillInput.value = '';
    }
  });
}
