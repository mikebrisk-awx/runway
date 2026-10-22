/* ========================================
   Note Share — Public read-only note viewer
   No auth required. Accessed via #tkn=xxx
   ======================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { sanitizeNoteHtml } from './note-html.js';
import { coverPositionCss } from './cover-reposition.js';

const firebaseConfig = {
  apiKey: "AIzaSyCkiOqdK9ng8P41lZktjP9yITS-3Kva4uU",
  authDomain: "runway-40912.firebaseapp.com",
  projectId: "runway-40912",
  storageBucket: "runway-40912.firebasestorage.app",
  messagingSenderId: "15308554422",
  appId: "1:15308554422:web:dce572304cefe74ef42617",
};

const app = initializeApp(firebaseConfig, 'note-share');
const db  = getFirestore(app);

// ── Boot ─────────────────────────────────────────────────
(async function init() {
  const token = new URLSearchParams(location.hash.slice(1)).get('tkn');
  if (!token) return showError('No link token', 'This URL is missing a share token.');

  // noteLinks/{token} is a self-contained snapshot written by the owner
  let note;
  try {
    const snap = await getDoc(doc(db, 'noteLinks', token));
    if (!snap.exists()) return showError('Link not found', 'This link is invalid or has been removed by the note owner.');
    note = snap.data();
  } catch (err) {
    if (err?.code === 'permission-denied') {
      return showError('Link not available', 'This note link can’t be opened right now. It may have been removed by the note owner.');
    }
    return showError('Unable to load', 'Could not reach Runway. Please check your connection and try again.');
  }

  hide('nsLoading');
  renderNote(note);
})();

// ── Helpers ──────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if (el) el.hidden = false; }
function hide(id) { const el = document.getElementById(id); if (el) el.hidden = true; }

function showError(title, msg) {
  hide('nsLoading');
  document.getElementById('nsErrorTitle').textContent = title;
  document.getElementById('nsErrorMsg').textContent   = msg;
  show('nsError');
}

// ── Renderer ─────────────────────────────────────────────
function renderNote(note) {
  const title = note.title || 'Untitled';
  document.title = `${title} — Runway`;
  document.getElementById('nsHeaderOwner').textContent = note.ownerName ? `${note.ownerName}’s notes` : 'Notes';
  document.getElementById('nsHeaderTitle').textContent = title;
  document.getElementById('nsTitle').textContent = title;

  if (note.updated_at) {
    const d = new Date(note.updated_at);
    if (!isNaN(d)) {
      document.getElementById('nsUpdated').textContent =
        `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  }

  if (note.cover && /^https?:/i.test(note.cover)) {
    const cover = document.getElementById('nsCover');
    cover.style.backgroundImage = `url("${note.cover.replace(/"/g, '%22')}")`;
    cover.style.backgroundPosition = coverPositionCss(note.coverPos);
    cover.hidden = false;
    document.getElementById('nsCard').classList.add('has-cover');
  }

  // The snapshot is written by a signed-in client, so clean it again here
  // rather than trusting what's stored.
  const body = document.getElementById('nsBody');
  body.innerHTML = sanitizeNoteHtml(note.html);
  body.querySelectorAll('a[href]').forEach(a => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  show('nsViewer');
}
