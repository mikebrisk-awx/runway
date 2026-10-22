/* ========================================
   My Work → Notes — personal rich-text notes
   ======================================== */

import { escapeHtml } from './utils.js';
import { state, savePrefs } from './state.js';
import { loadUserNotes, saveUserNote, deleteUserNote, deleteNoteLink } from './sync.js';
import { uploadImage } from './image-upload.js';
import { sanitizeNoteHtml, SAFE_URL } from './note-html.js';
import { startCoverReposition, coverPositionCss } from './cover-reposition.js';

// Notes live in userPrefs/{uid}/notes (see sync.js). They're fetched when the
// tab opens and kept here for the session; edits are written per note, debounced.
let notes = null;        // null until the first load finishes
let loadError = null;
let openNoteId = null;   // null → list, otherwise the note being edited
const pendingSaves = new Map(); // noteId → timeout

const SAVE_DELAY = 700;

function genId() {
  return 'note_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function generateShareToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function noteShareUrl(token) {
  return `${location.origin}/note-share.html#tkn=${token}`;
}

function todayTitle() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Persistence ──────────────────────────────

function scheduleSave(note, onSaved) {
  clearTimeout(pendingSaves.get(note.id)?.timer);
  const timer = setTimeout(async () => {
    pendingSaves.delete(note.id);
    await saveUserNote(note);
    onSaved?.();
  }, SAVE_DELAY);
  pendingSaves.set(note.id, { timer, note });
}

function cancelSave(noteId) {
  clearTimeout(pendingSaves.get(noteId)?.timer);
  pendingSaves.delete(noteId);
}

async function flushSaves() {
  const queued = [...pendingSaves.values()];
  pendingSaves.clear();
  queued.forEach(p => clearTimeout(p.timer));
  await Promise.all(queued.map(p => saveUserNote(p.note)));
}

async function refreshNotes() {
  await flushSaves();
  try {
    const remote = await loadUserNotes();
    // Keep the in-memory object when it's at least as new — the open editor
    // holds a reference to it and keeps writing through it.
    const local = new Map((notes || []).map(n => [n.id, n]));
    notes = remote.map(r => {
      const l = local.get(r.id);
      return l && (l.updated_at || '') >= (r.updated_at || '') ? l : r;
    });
    // A note created here whose first write hasn't landed yet.
    const open = local.get(openNoteId);
    if (open && !notes.includes(open) && !remote.some(r => r.id === open.id)) notes.push(open);
    loadError = null;
  } catch (err) {
    console.error('Failed to load notes:', err);
    loadError = err;
    if (!notes) notes = [];
  }
}

// ── HTML helpers ─────────────────────────────

function todoCounts(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const items = tpl.content.querySelectorAll('ul.note-todos > li');
  const done = [...items].filter(li => li.getAttribute('data-checked') === 'true').length;
  return { done, total: items.length };
}

function normalizeUrl(raw) {
  const url = raw.trim();
  if (!url) return null;
  if (SAFE_URL.test(url)) return url;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(url)) return 'mailto:' + url;
  if (/^[a-z][\w+.-]*:/i.test(url)) return null; // javascript:, data:, etc.
  return 'https://' + url;
}

function linkifyText(text) {
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1">$1</a>')
    .replace(/\r?\n/g, '<br>');
}

// ── Icons ────────────────────────────────────

function progressRing(done, total, size) {
  const stroke = size <= 16 ? 2 : 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const complete = total > 0 && done === total;
  return `
    <svg class="note-ring${complete ? ' complete' : ''}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="note-ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/>
      <circle class="note-ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${(c * pct).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
}

const ICONS = {
  heading:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 4v16M18 4v16M6 12h12"/></svg>',
  bold:     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>',
  italic:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  underline:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
  strike:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>',
  bullets:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>',
  numbers:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4M4 10h2" stroke-width="1.6"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke-width="1.6"/></svg>',
  todos:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="6" height="6" rx="1.5"/><polyline points="4.5 16.5 6 18 8.5 15" /><rect x="3" y="14" width="6" height="6" rx="1.5"/><line x1="13" y1="7" x2="21" y2="7"/><line x1="13" y1="17" x2="21" y2="17"/></svg>',
  link:     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  back:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>',
  plus:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  star:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starOn:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  image:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  grid:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  list:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>',
  sizeSm:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>',
  sizeLg:   '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>',
  clock:    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  chevron:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>',
  check:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="5 12 10 17 19 7"/></svg>',
  copy:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  copied:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  plusLg:   '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  trash:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
};

const TOOLBAR = [
  { cmd: 'heading',   title: 'Heading' },
  { cmd: 'bold',      title: 'Bold (⌘B)' },
  { cmd: 'italic',    title: 'Italic (⌘I)' },
  { cmd: 'underline', title: 'Underline (⌘U)' },
  { cmd: 'strike',    title: 'Strikethrough' },
  { sep: true },
  { cmd: 'bullets',   title: 'Bulleted list' },
  { cmd: 'numbers',   title: 'Numbered list' },
  { cmd: 'todos',     title: 'Checklist' },
  { sep: true },
  { cmd: 'link',      title: 'Link (⌘K)' },
];

// ── List (grid / list) ───────────────────────

const SORTS = [
  { id: 'recent',  label: 'Most recent',  compare: (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') },
  { id: 'created', label: 'Date created', compare: (a, b) => (b.created_at || '').localeCompare(a.created_at || '') },
  { id: 'title',   label: 'Title',        compare: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }) },
];

const FILTERS = [
  { id: 'all',        label: 'All notes',      test: () => true,                         empty: 'No notes yet.' },
  { id: 'starred',    label: 'Starred',        test: n => n.starred,                     empty: 'No starred notes.' },
  { id: 'checklists', label: 'Has checklist',  test: n => todoCounts(n.html).total > 0,  empty: 'No notes with a checklist.' },
];

const CARD_SIZE = { min: 200, max: 380 };

const getSort   = () => SORTS.find(s => s.id === state.notesSort) || SORTS[0];
const getFilter = () => FILTERS.find(f => f.id === state.notesFilter) || FILTERS[0];

// Starred notes stay pinned to the top whatever the sort.
function visibleNotes() {
  const { compare } = getSort();
  const { test } = getFilter();
  return (notes || []).filter(test).sort((a, b) => (!!b.starred - !!a.starred) || compare(a, b));
}

// url("…") for a cover set from JS, so a quote in the URL can't break out.
function coverCss(url) {
  return `url("${url.replace(/"/g, '%22')}")`;
}

function plainPreview(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  tpl.content.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  tpl.content.querySelectorAll('p,div,li,ul,ol,h1,h2,h3,blockquote,pre').forEach(el => {
    el.before('\n');
    el.after('\n');
  });
  return tpl.content.textContent.split('\n').map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ');
}

function fmtNoteDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function starButton(note, cls) {
  return `<button class="note-star ${cls}${note.starred ? ' on' : ''}" title="${note.starred ? 'Unstar' : 'Star'}">${note.starred ? ICONS.starOn : ICONS.star}</button>`;
}

function noteTile(note) {
  const { done, total } = todoCounts(note.html);
  const preview = sanitizeNoteHtml(note.html);
  const hasContent = preview.replace(/<[^>]*>/g, '').trim() || preview.includes('<li');
  return `
    <div class="note-tile${note.cover ? ' has-cover' : ''}" data-id="${note.id}" role="button" tabindex="0">
      ${note.cover ? `<div class="note-tile-cover" data-cover="${escapeHtml(note.cover)}" data-pos="${coverPositionCss(note.coverPos)}"></div>` : ''}
      <div class="note-tile-head">
        <span class="note-tile-title">${escapeHtml(note.title || 'Untitled')}</span>
        ${note.shareToken ? `<span class="note-tile-shared" title="Shared with a link">${ICONS.link}</span>` : ''}
        ${starButton(note, 'note-tile-star')}
      </div>
      <div class="note-body note-tile-preview">${hasContent ? preview : '<p class="note-tile-empty">No additional text</p>'}</div>
      ${total ? `<div class="note-tile-progress">${progressRing(done, total, 16)}<span>${done}/${total}</span></div>` : ''}
    </div>`;
}

function noteListRow(note) {
  const { done, total } = todoCounts(note.html);
  return `
    <div class="note-lrow" data-id="${note.id}" role="button" tabindex="0">
      <div class="note-lrow-thumb">${note.cover ? `<div class="note-tile-cover" data-cover="${escapeHtml(note.cover)}" data-pos="${coverPositionCss(note.coverPos)}"></div>` : ICONS.list}</div>
      <div class="note-lrow-text">
        <span class="note-lrow-title">${escapeHtml(note.title || 'Untitled')}</span>
        <span class="note-lrow-preview">${escapeHtml(plainPreview(note.html)) || 'No additional text'}</span>
      </div>
      ${total ? `<span class="note-tile-progress">${progressRing(done, total, 16)}<span>${done}/${total}</span></span>` : ''}
      <span class="note-lrow-date">${fmtNoteDate(note.updated_at)}</span>
      ${starButton(note, 'note-lrow-star')}
    </div>`;
}

function renderToolbar(body, onChange) {
  const bar = document.createElement('div');
  bar.className = 'note-listbar';
  const sort = getSort();
  const filter = getFilter();
  bar.innerHTML = `
    <div class="note-seg" role="group" aria-label="Layout">
      <button class="note-seg-btn${state.notesView !== 'list' ? ' active' : ''}" data-view="grid" title="Grid">${ICONS.grid}</button>
      <button class="note-seg-btn${state.notesView === 'list' ? ' active' : ''}" data-view="list" title="List">${ICONS.list}</button>
    </div>
    <label class="note-size${state.notesView === 'list' ? ' is-disabled' : ''}" title="Card size">
      ${ICONS.sizeSm}
      <input type="range" min="${CARD_SIZE.min}" max="${CARD_SIZE.max}" step="10" value="${state.notesCardSize}"
        ${state.notesView === 'list' ? 'disabled' : ''} aria-label="Card size" />
      ${ICONS.sizeLg}
    </label>
    <div class="note-sort">
      <button class="note-sort-btn" aria-haspopup="menu">
        ${ICONS.clock}<span>${sort.label}${filter.id !== 'all' ? ` · ${filter.label}` : ''}</span>${ICONS.chevron}
      </button>
      <div class="note-sort-menu" role="menu" hidden>
        <div class="note-sort-heading">Sort by</div>
        ${SORTS.map(o => `<button class="note-sort-opt${o.id === sort.id ? ' active' : ''}" data-sort="${o.id}" role="menuitemradio">${ICONS.check}${o.label}</button>`).join('')}
        <div class="note-sort-heading">Show</div>
        ${FILTERS.map(o => `<button class="note-sort-opt${o.id === filter.id ? ' active' : ''}" data-filter="${o.id}" role="menuitemradio">${ICONS.check}${o.label}</button>`).join('')}
      </div>
    </div>
  `;

  bar.querySelectorAll('.note-seg-btn').forEach(btn => btn.addEventListener('click', () => {
    state.notesView = btn.dataset.view;
    savePrefs();
    onChange();
  }));

  // Resize live while dragging; only persist when the drag ends.
  const slider = bar.querySelector('input[type="range"]');
  slider.addEventListener('input', () => {
    state.notesCardSize = Number(slider.value);
    body.querySelector('.note-grid')?.style.setProperty('--note-tile-w', `${state.notesCardSize}px`);
  });
  slider.addEventListener('change', savePrefs);

  const menu = bar.querySelector('.note-sort-menu');
  const closeMenu = e => {
    if (e && bar.querySelector('.note-sort').contains(e.target)) return;
    menu.hidden = true;
    document.removeEventListener('mousedown', closeMenu);
  };
  bar.querySelector('.note-sort-btn').addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    if (!menu.hidden) document.addEventListener('mousedown', closeMenu);
  });
  menu.querySelectorAll('.note-sort-opt').forEach(opt => opt.addEventListener('click', () => {
    if (opt.dataset.sort) state.notesSort = opt.dataset.sort;
    if (opt.dataset.filter) state.notesFilter = opt.dataset.filter;
    savePrefs();
    closeMenu();
    onChange();
  }));

  return bar;
}

function renderList(body) {
  const list = visibleNotes();
  const isList = state.notesView === 'list';
  const filter = getFilter();

  body.innerHTML = '';
  body.appendChild(renderToolbar(body, () => renderList(body)));

  const content = document.createElement('div');
  content.innerHTML = `
    ${loadError ? `<div class="note-error">Couldn't load your notes. Check your connection and reopen this tab.</div>` : ''}
    <div class="${isList ? 'note-lrows' : 'note-grid'}" style="--note-tile-w:${state.notesCardSize}px">
      <button class="${isList ? 'note-lrow note-lrow--new' : 'note-tile note-tile--new'}"${notes === null ? ' disabled' : ''}>
        ${isList ? ICONS.plus : ICONS.plusLg}<span>${notes === null ? 'Loading notes…' : 'New note'}</span>
      </button>
      ${list.map(isList ? noteListRow : noteTile).join('')}
    </div>
    ${notes !== null && !list.length && filter.id !== 'all' ? `<div class="note-filter-empty">${filter.empty}</div>` : ''}
  `;
  body.append(...content.childNodes);

  body.querySelectorAll('.note-tile-cover').forEach(el => {
    el.style.backgroundImage = coverCss(el.dataset.cover);
    el.style.backgroundPosition = el.dataset.pos;
  });

  body.querySelector('.note-tile--new, .note-lrow--new').addEventListener('click', () => {
    const now = new Date().toISOString();
    const note = { id: genId(), title: todayTitle(), html: '<p><br></p>', cover: null, starred: false, created_at: now, updated_at: now };
    notes.push(note);
    scheduleSave(note);
    openNoteId = note.id;
    renderNotesView(body, { focusBody: true });
  });

  body.querySelectorAll('[data-id]').forEach(item => {
    const open = () => {
      openNoteId = item.dataset.id;
      renderNotesView(body);
    };
    item.addEventListener('click', open);
    item.addEventListener('keydown', e => {
      if (e.target === item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); }
    });
    // Starring isn't an edit, so it leaves updated_at (and "Most recent") alone.
    item.querySelector('.note-star').addEventListener('click', e => {
      e.stopPropagation();
      const note = notes.find(n => n.id === item.dataset.id);
      if (!note) return;
      note.starred = !note.starred;
      scheduleSave(note);
      renderList(body);
    });
  });
}

// ── Detail / editor ──────────────────────────

function renderDetail(body, note, { focusBody, repositionCover } = {}) {
  body.innerHTML = `
    <div class="note-detail">
      <div class="note-detail-bar">
        <button class="note-back">${ICONS.back} All notes</button>
        <span class="note-status"></span>
        <label class="note-bar-btn" title="${note.cover ? 'Change cover' : 'Add cover'}">
          ${ICONS.image} ${note.cover ? 'Change cover' : 'Add cover'}
          <input type="file" accept="image/*" class="note-cover-input" hidden />
        </label>
        ${note.cover ? `<button class="note-bar-btn note-cover-reposition" title="Drag to choose which part of the image shows">Reposition</button>` : ''}
        ${note.cover ? `<button class="note-bar-btn note-cover-remove">Remove cover</button>` : ''}
        <div class="dp-public-link-wrap note-share-wrap">
          <button class="dp-public-link-btn${note.shareToken ? ' dp-public-link-btn--active' : ''} note-share-btn"
            title="${note.shareToken ? 'Shared — anyone with the link can view' : 'Create a view-only link'}">
            ${ICONS.link} ${note.shareToken ? 'Shared' : 'Share'}
          </button>
          ${note.shareToken ? `
            <div class="dp-public-link-panel note-share-panel" hidden>
              <div class="dp-public-link-panel-title">View-only link</div>
              <div class="dp-public-link-row">
                <input class="dp-public-link-input" readonly value="${escapeHtml(noteShareUrl(note.shareToken))}" />
                <button class="dp-public-link-copy" title="Copy link">${ICONS.copy}</button>
              </div>
              <span class="note-share-hint">Anyone with the link can read this note. They see your edits but can't change anything.</span>
              <button class="dp-public-link-remove">Stop sharing</button>
            </div>` : ''}
        </div>
        <button class="note-star note-bar-star${note.starred ? ' on' : ''}" title="${note.starred ? 'Unstar' : 'Star'}">${note.starred ? ICONS.starOn : ICONS.star}</button>
        <button class="note-delete" title="Delete note">${ICONS.trash}</button>
      </div>
      <div class="note-card${note.cover ? ' has-cover' : ''}">
        ${note.cover ? '<div class="note-cover"></div>' : ''}
        <div class="note-head">
          <input class="note-title-input" value="${escapeHtml(note.title || '')}" placeholder="Title" maxlength="200" />
          <div class="note-progress"></div>
        </div>
        <div class="note-toolbar" role="toolbar">
          ${TOOLBAR.map(t => t.sep
            ? '<span class="note-tb-sep"></span>'
            : `<button class="note-tb-btn" data-cmd="${t.cmd}" title="${t.title}">${ICONS[t.cmd]}</button>`
          ).join('')}
        </div>
        <div class="note-body" contenteditable="true" spellcheck="true"
          data-placeholder="Start writing — try “- ”, “1. ” or “[] ” for lists">${sanitizeNoteHtml(note.html) || '<p><br></p>'}</div>
      </div>
    </div>
  `;

  const titleInput = body.querySelector('.note-title-input');
  const editor = body.querySelector('.note-body');
  const statusEl = body.querySelector('.note-status');
  const progressEl = body.querySelector('.note-progress');

  // New blocks are <p>, matching what sanitizeNoteHtml and the previews expect.
  document.execCommand('defaultParagraphSeparator', false, 'p');

  function updateProgress() {
    const { done, total } = todoCounts(editor.innerHTML);
    progressEl.innerHTML = total
      ? `${progressRing(done, total, 30)}<span class="note-progress-badge">${total}</span>`
      : '';
    progressEl.title = total ? `${done} of ${total} done` : '';
  }

  function updateEmpty() {
    editor.classList.toggle('is-empty', !editor.textContent.trim() && !editor.querySelector('li'));
  }

  function changed() {
    note.html = sanitizeNoteHtml(editor.innerHTML);
    note.title = titleInput.value.trim();
    note.updated_at = new Date().toISOString();
    statusEl.textContent = 'Saving…';
    scheduleSave(note, () => { if (statusEl.isConnected) statusEl.textContent = 'Saved'; });
    updateProgress();
    updateEmpty();
  }

  updateProgress();
  updateEmpty();

  // ── Cover & star ──
  const coverEl = body.querySelector('.note-cover');
  if (coverEl) {
    coverEl.style.backgroundImage = coverCss(note.cover);
    coverEl.style.backgroundPosition = coverPositionCss(note.coverPos);
  }

  let repositioning = false;
  function repositionNoteCover() {
    if (!coverEl || repositioning) return;
    repositioning = true;
    startCoverReposition(coverEl, {
      url: note.cover,
      pos: note.coverPos,
      onSave: pos => {
        repositioning = false;
        note.coverPos = pos;
        changed();
      },
      onCancel: () => { repositioning = false; },
    });
  }
  body.querySelector('.note-cover-reposition')?.addEventListener('click', repositionNoteCover);
  if (repositionCover) repositionNoteCover();

  body.querySelector('.note-cover-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    statusEl.textContent = 'Uploading cover…';
    try {
      note.cover = await uploadImage(file, 'runway/notes');
      note.coverPos = null; // new image starts centred and opens into positioning
      changed();
      renderDetail(body, note, { repositionCover: true });
    } catch (err) {
      console.error('Note cover upload failed:', err);
      statusEl.textContent = '';
      alert('Failed to upload the cover image. Please try again.');
    }
  });

  body.querySelector('.note-cover-remove')?.addEventListener('click', () => {
    note.cover = null;
    note.coverPos = null;
    changed();
    renderDetail(body, note);
  });

  body.querySelector('.note-bar-star').addEventListener('click', e => {
    note.starred = !note.starred;
    scheduleSave(note);
    e.currentTarget.classList.toggle('on', note.starred);
    e.currentTarget.title = note.starred ? 'Unstar' : 'Star';
    e.currentTarget.innerHTML = note.starred ? ICONS.starOn : ICONS.star;
  });

  // ── Share ──
  const shareWrap = body.querySelector('.note-share-wrap');
  const sharePanel = shareWrap.querySelector('.note-share-panel');

  shareWrap.querySelector('.note-share-btn').addEventListener('click', async () => {
    if (sharePanel) { sharePanel.hidden = !sharePanel.hidden; return; }
    note.shareToken = generateShareToken();
    cancelSave(note.id);
    statusEl.textContent = 'Creating link…';
    await saveUserNote(note); // publishes the noteLinks snapshot
    if (!body.isConnected) return;
    renderDetail(body, note);
    body.querySelector('.note-share-panel')?.removeAttribute('hidden');
  });

  if (sharePanel) {
    sharePanel.querySelector('.dp-public-link-copy').addEventListener('click', e => {
      const btn = e.currentTarget;
      navigator.clipboard.writeText(noteShareUrl(note.shareToken)).then(() => {
        btn.innerHTML = ICONS.copied;
        setTimeout(() => { btn.innerHTML = ICONS.copy; }, 2000);
      });
    });
    sharePanel.querySelector('.dp-public-link-remove').addEventListener('click', () => {
      if (!confirm('Stop sharing? Anyone with the current link will lose access.')) return;
      const token = note.shareToken;
      note.shareToken = null;
      scheduleSave(note);
      deleteNoteLink(token);
      renderDetail(body, note);
    });
    document.addEventListener('mousedown', function closeShare(e) {
      if (!shareWrap.isConnected) { document.removeEventListener('mousedown', closeShare); return; }
      if (!shareWrap.contains(e.target)) sharePanel.hidden = true;
    });
  }

  // ── Selection helpers ──
  function closestInEditor(selector) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    let node = sel.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const el = node?.closest?.(selector);
    return el && editor.contains(el) ? el : null;
  }

  // Lists are restructured by hand rather than with insertUnorderedList,
  // which nests the new list inside an empty <p> and then can't exit it.
  const LIST_KINDS = { bullets: ['ul', ''], numbers: ['ol', ''], todos: ['ul', 'note-todos'] };

  function listKind(list) {
    if (list.tagName === 'OL') return 'numbers';
    return list.classList.contains('note-todos') ? 'todos' : 'bullets';
  }

  function setListKind(list, kind) {
    const [tag, cls] = LIST_KINDS[kind];
    let target = list;
    if (list.tagName.toLowerCase() !== tag) {
      target = document.createElement(tag);
      target.append(...list.childNodes);
      list.replaceWith(target);
    }
    if (cls) target.className = cls; else target.removeAttribute('class');
    target.querySelectorAll(':scope > li').forEach(li => {
      if (kind !== 'todos') li.removeAttribute('data-checked');
      else if (!li.hasAttribute('data-checked')) li.setAttribute('data-checked', 'false');
    });
  }

  function blockToList(block, kind) {
    const [tag, cls] = LIST_KINDS[kind];
    const li = document.createElement('li');
    if (kind === 'todos') li.setAttribute('data-checked', 'false');
    li.append(...block.childNodes);
    if (!li.firstChild) li.appendChild(document.createElement('br'));
    const prev = block.previousElementSibling;
    if (prev && prev.tagName.toLowerCase() === tag && listKind(prev) === kind) {
      prev.appendChild(li);
      block.remove();
    } else {
      const list = document.createElement(tag);
      if (cls) list.className = cls;
      list.appendChild(li);
      block.replaceWith(list);
    }
    return li;
  }

  // Turns one item back into a paragraph, splitting the list around it.
  function listItemToParagraph(li) {
    const list = li.parentElement;
    const items = [...list.children];
    const after = items.slice(items.indexOf(li) + 1);
    const p = document.createElement('p');
    p.append(...li.childNodes);
    if (!p.firstChild) p.appendChild(document.createElement('br'));
    li.remove();
    if (after.length) {
      const tail = list.cloneNode(false);
      tail.append(...after);
      list.after(tail);
    }
    list.after(p);
    if (!list.children.length) list.remove();
    return p;
  }

  // Moving nodes drops the selection; put the caret back where it was.
  function keepingCaret(fn) {
    const sel = window.getSelection();
    const node = sel.anchorNode;
    const offset = sel.anchorOffset;
    const fallback = fn();
    const range = document.createRange();
    if (node && editor.contains(node)) range.setStart(node, offset);
    else if (fallback) range.setStart(fallback, 0);
    else return;
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function toggleList(kind) {
    keepingCaret(() => {
      const li = closestInEditor('li');
      if (li) {
        if (listKind(li.parentElement) === kind) return listItemToParagraph(li);
        setListKind(li.parentElement, kind);
        return li;
      }
      const block = closestInEditor('p,div,h1,h2,h3');
      if (window.getSelection().isCollapsed && block && block !== editor) return blockToList(block, kind);
      // Selections spanning several blocks: let the browser build the list.
      document.execCommand(kind === 'numbers' ? 'insertOrderedList' : 'insertUnorderedList');
      const list = closestInEditor('ul,ol');
      if (list) setListKind(list, kind);
      return null;
    });
  }

  function toggleHeading() {
    const h = closestInEditor('h2');
    document.execCommand('formatBlock', false, h ? 'p' : 'h2');
  }

  function insertLink() {
    const existing = closestInEditor('a');
    const raw = prompt('Link URL:', existing?.getAttribute('href') || 'https://');
    if (raw === null) return;
    if (!raw.trim() && existing) {
      existing.replaceWith(...existing.childNodes);
      return;
    }
    const url = normalizeUrl(raw);
    if (!url) { alert('Links must start with http://, https:// or mailto:'); return; }
    if (existing) { existing.setAttribute('href', url); return; }
    const sel = window.getSelection();
    if (sel.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(raw.trim())}</a>&nbsp;`);
    } else {
      document.execCommand('createLink', false, url);
    }
  }

  const COMMANDS = {
    heading:   toggleHeading,
    bold:      () => document.execCommand('bold'),
    italic:    () => document.execCommand('italic'),
    underline: () => document.execCommand('underline'),
    strike:    () => document.execCommand('strikeThrough'),
    bullets:   () => toggleList('bullets'),
    numbers:   () => toggleList('numbers'),
    todos:     () => toggleList('todos'),
    link:      insertLink,
  };

  function runCommand(cmd) {
    editor.focus();
    COMMANDS[cmd]?.();
    changed();
    updateToolbarState();
  }

  // ── Toolbar ──
  const toolbarBtns = body.querySelectorAll('.note-tb-btn');
  toolbarBtns.forEach(btn => {
    // mousedown keeps the editor's selection; click would blur it first
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      runCommand(btn.dataset.cmd);
    });
  });

  function updateToolbarState() {
    const inEditor = editor.contains(window.getSelection().anchorNode);
    const list = inEditor && closestInEditor('ul,ol');
    const active = {
      heading:   inEditor && !!closestInEditor('h2'),
      bold:      inEditor && document.queryCommandState('bold'),
      italic:    inEditor && document.queryCommandState('italic'),
      underline: inEditor && document.queryCommandState('underline') && !closestInEditor('a'),
      strike:    inEditor && document.queryCommandState('strikeThrough'),
      bullets:   !!list && listKind(list) === 'bullets',
      numbers:   !!list && listKind(list) === 'numbers',
      todos:     !!list && listKind(list) === 'todos',
      link:      inEditor && !!closestInEditor('a'),
    };
    toolbarBtns.forEach(btn => btn.classList.toggle('active', !!active[btn.dataset.cmd]));
  }

  const onSelectionChange = () => {
    if (!editor.isConnected) { document.removeEventListener('selectionchange', onSelectionChange); return; }
    updateToolbarState();
  };
  document.addEventListener('selectionchange', onSelectionChange);

  // ── Editing behaviour ──
  titleInput.addEventListener('input', changed);
  titleInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); editor.focus(); }
  });

  // Markdown-style shortcuts at the start of a line: "- ", "* ", "1. ", "[] ", "# ".
  // Checked on input rather than keydown so IME and mobile keyboards work too.
  const SHORTCUTS = { '-': 'bullets', '*': 'bullets', '1.': 'numbers', '[]': 'todos', '[ ]': 'todos', '#': 'heading' };
  function applyShortcut() {
    if (closestInEditor('li')) return false;
    const sel = window.getSelection();
    if (!sel.isCollapsed) return false;
    const block = closestInEditor('p,div,h1,h2,h3');
    if (!block || block === editor) return false;
    const before = document.createRange();
    before.setStart(block, 0);
    before.setEnd(sel.anchorNode, sel.anchorOffset);
    const action = SHORTCUTS[before.toString().replace(/[\s\u00a0]$/, '')];
    if (!action) return false;
    before.deleteContents();
    if (!block.textContent && !block.querySelector('br')) block.appendChild(document.createElement('br'));
    runCommand(action);
    return true;
  }

  editor.addEventListener('input', e => {
    if (e.inputType === 'insertText' && e.data === ' ' && applyShortcut()) return;
    // A new checklist item copies the attributes of the one it was split from.
    if (e.inputType === 'insertParagraph') {
      const li = closestInEditor('li');
      if (li?.parentElement.classList.contains('note-todos')) li.setAttribute('data-checked', 'false');
    }
    changed();
  });

  editor.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      runCommand('link');
    }
  });

  // Checkbox hit area is the padding to the left of each checklist item.
  editor.addEventListener('mousedown', e => {
    const li = e.target.closest?.('li');
    if (!li || !li.parentElement?.classList.contains('note-todos')) return;
    if (e.clientX - li.getBoundingClientRect().left > 26) return;
    e.preventDefault();
    li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
    changed();
  });

  // Links open in a new tab, like Notes; use the toolbar or ⌘K to edit one.
  editor.addEventListener('click', e => {
    const a = e.target.closest?.('a[href]');
    if (!a || !window.getSelection().isCollapsed) return;
    e.preventDefault();
    window.open(a.getAttribute('href'), '_blank', 'noopener');
  });

  editor.addEventListener('paste', e => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    document.execCommand('insertHTML', false, html ? sanitizeNoteHtml(html) : linkifyText(text));
  });

  // ── Bar actions ──
  body.querySelector('.note-back').addEventListener('click', () => {
    openNoteId = null;
    flushSaves();
    renderNotesView(body);
  });

  body.querySelector('.note-delete').addEventListener('click', async () => {
    if (!confirm(`Delete “${note.title || 'Untitled'}”? This can't be undone.`)) return;
    cancelSave(note.id);
    notes = notes.filter(n => n.id !== note.id);
    openNoteId = null;
    // No refetch: it could land before the delete and bring the note back.
    renderNotesView(body, { skipRefresh: true });
    if (note.shareToken) deleteNoteLink(note.shareToken);
    await deleteUserNote(note.id);
  });

  if (focusBody) {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// ── Entry point ──────────────────────────────

// True while the user is typing in a note, so background refreshes of
// My Work don't rebuild the editor out from under them.
export function isEditingNote(container) {
  return !!container.querySelector('.note-detail')?.contains(document.activeElement);
}

export function renderNotesView(body, opts = {}) {
  body.className = 'mw-body notes-wrap';

  const note = openNoteId && notes?.find(n => n.id === openNoteId);
  if (note) {
    renderDetail(body, note, opts);
    return;
  }
  openNoteId = null;
  renderList(body);

  if (opts.skipRefresh) return;
  refreshNotes().then(() => {
    // Only redraw if the list is still what's on screen.
    if (body.isConnected && !openNoteId) renderNotesView(body, { skipRefresh: true });
  });
}
