/* ========================================
   Cover reposition — drag a `background-size: cover` image to choose
   which part of it shows. Used by the My Work hero and note covers.
   Positions are stored as { x, y } percentages (background-position).
   ======================================== */

const clampPct = n => Math.min(100, Math.max(0, Math.round(n * 10) / 10));

export function coverPositionCss(pos) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return 'center';
  return `${clampPct(pos.x)}% ${clampPct(pos.y)}%`;
}

function loadImageSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

// Puts `el` into reposition mode: an overlay captures drags (and arrow keys)
// and moves the background until Save or Cancel. Returns a function that
// cancels, for when the surrounding view goes away mid-edit.
export function startCoverReposition(el, { url, pos, onSave, onCancel }) {
  const start = { x: pos?.x ?? 50, y: pos?.y ?? 50 };
  let current = { ...start };
  let natural = null;
  let done = false;
  loadImageSize(url).then(size => { natural = size; }).catch(() => {});

  const apply = () => { el.style.backgroundPosition = coverPositionCss(current); };

  // How far the scaled image overhangs the box on each axis, in px. Dragging
  // across the whole overhang moves that axis from 0% to 100%.
  function overhang() {
    const box = el.getBoundingClientRect();
    if (!natural) return { x: box.width, y: box.height };
    const scale = Math.max(box.width / natural.w, box.height / natural.h);
    return { x: natural.w * scale - box.width, y: natural.h * scale - box.height };
  }

  el.classList.add('cover-repositioning');
  const overlay = document.createElement('div');
  overlay.className = 'cover-reposition-overlay';
  overlay.tabIndex = 0;
  overlay.setAttribute('aria-label', 'Drag or use the arrow keys to reposition the cover');
  overlay.innerHTML = `
    <span class="cover-reposition-hint">Drag image to reposition</span>
    <div class="cover-reposition-actions">
      <button class="cover-reposition-btn" data-act="cancel">Cancel</button>
      <button class="cover-reposition-btn cover-reposition-btn--save" data-act="save">Save position</button>
    </div>
  `;
  el.appendChild(overlay);
  overlay.focus({ preventScroll: true });
  apply();

  let drag = null;
  overlay.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || e.button !== 0) return;
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, from: { ...current }, overhang: overhang() };
    overlay.classList.add('is-dragging');
  });
  overlay.addEventListener('pointermove', e => {
    if (!drag) return;
    const { overhang: o } = drag;
    // Dragging the image right reveals more of its left edge → lower x%.
    if (o.x > 0.5) current.x = clampPct(drag.from.x - ((e.clientX - drag.x) / o.x) * 100);
    if (o.y > 0.5) current.y = clampPct(drag.from.y - ((e.clientY - drag.y) / o.y) * 100);
    apply();
  });
  const endDrag = () => { drag = null; overlay.classList.remove('is-dragging'); };
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);

  const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
    if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); finish(true); return; }
    const nudge = NUDGE[e.key];
    if (!nudge) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 2;
    current = { x: clampPct(current.x + nudge[0] * step), y: clampPct(current.y + nudge[1] * step) };
    apply();
  });

  overlay.querySelectorAll('.cover-reposition-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      finish(btn.dataset.act === 'save');
    });
  });

  function finish(save) {
    if (done) return;
    done = true;
    overlay.remove();
    el.classList.remove('cover-repositioning');
    if (save) {
      onSave?.({ ...current });
    } else {
      current = start;
      apply();
      onCancel?.();
    }
  }

  return () => finish(false);
}
