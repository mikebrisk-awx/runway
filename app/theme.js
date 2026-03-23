/* ========================================
   Theme & Accent Color Management
   ======================================== */

import { state, saveState } from './state.js';

export function applyTheme() {
  // Dark is default (no attribute). Light is opt-in via data-theme="light"
  if (state.theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === state.theme);
  });
}

export function setAccentColor(color) {
  state.accentColor = color;
  document.documentElement.style.setProperty('--accent', color);
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  const lightBg = state.theme !== 'light'
    ? `rgba(${r},${g},${b},0.12)`
    : `rgba(${r},${g},${b},0.08)`;
  document.documentElement.style.setProperty('--accent-bg', lightBg);
  document.documentElement.style.setProperty('--accent-light', color);
  document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === color));
  saveState();
}

export function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme();
  setAccentColor(state.accentColor);
  saveState();
}

export function initThemeListeners() {
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      state.theme = btn.dataset.theme;
      applyTheme();
      setAccentColor(state.accentColor);
      saveState();
    });
  });

  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => setAccentColor(dot.dataset.color));
  });
}
