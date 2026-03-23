/* ========================================
   Keyboard Shortcuts
   ======================================== */

import { closeDetailPanel } from './detail-panel.js';
import { closeModal, openModal } from './modal.js';
import { closeSettings } from './settings.js';
import { hideContextMenu } from './context-menu.js';

let helpVisible = false;

export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Skip if focus is in an input
    const tag = document.activeElement?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Escape always works
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAll();
      return;
    }

    // Other shortcuts only when not in an input
    if (isInput) return;

    switch(e.key) {
      case 'n':
        e.preventDefault();
        openModal();
        break;
      case '/':
        e.preventDefault();
        document.getElementById('searchInput')?.focus();
        break;
      case '?':
        e.preventDefault();
        toggleHelp();
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigateCards(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigateCards(-1);
        break;
    }
  });
}

function closeAll() {
  hideContextMenu();
  if (document.getElementById('addTaskModal')?.classList.contains('show')) {
    closeModal();
    return;
  }
  if (document.getElementById('detailOverlay')?.classList.contains('show')) {
    closeDetailPanel();
    return;
  }
  if (document.getElementById('settingsOverlay')?.classList.contains('show')) {
    closeSettings();
    return;
  }
  if (helpVisible) {
    toggleHelp();
    return;
  }
}

function navigateCards(direction) {
  const cards = [...document.querySelectorAll('.task-card')];
  if (cards.length === 0) return;

  const current = document.activeElement;
  const idx = cards.indexOf(current);

  if (idx === -1) {
    cards[0].focus();
  } else {
    const next = idx + direction;
    if (next >= 0 && next < cards.length) {
      cards[next].focus();
    }
  }
}

function toggleHelp() {
  let overlay = document.getElementById('shortcutsHelp');
  if (helpVisible) {
    overlay?.remove();
    helpVisible = false;
    return;
  }

  overlay = document.createElement('div');
  overlay.id = 'shortcutsHelp';
  overlay.className = 'shortcuts-overlay';
  overlay.innerHTML = `
    <div class="shortcuts-panel">
      <div class="shortcuts-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="icon-btn" id="closeShortcuts">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="shortcuts-body">
        <div class="shortcut-row"><kbd>N</kbd><span>New task</span></div>
        <div class="shortcut-row"><kbd>/</kbd><span>Focus search</span></div>
        <div class="shortcut-row"><kbd>Esc</kbd><span>Close panel / modal</span></div>
        <div class="shortcut-row"><kbd>&uarr; &darr;</kbd><span>Navigate cards</span></div>
        <div class="shortcut-row"><kbd>Enter</kbd><span>Open card details</span></div>
        <div class="shortcut-row"><kbd>?</kbd><span>Show this help</span></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  helpVisible = true;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) toggleHelp();
  });
  overlay.querySelector('#closeShortcuts').addEventListener('click', toggleHelp);
}
