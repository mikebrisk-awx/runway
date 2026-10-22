/* ========================================
   Note HTML sanitizer — shared by the Notes editor
   and the public note-share page
   ======================================== */

// Everything that goes into the editor or Firestore passes through this
// allowlist, so pasted markup can't carry scripts, styles or event handlers.
const ALLOWED_TAGS = {
  P: [], DIV: [], BR: [], B: [], STRONG: [], I: [], EM: [], U: [], S: [], STRIKE: [], DEL: [],
  A: ['href'], UL: ['class'], OL: [], LI: ['data-checked'],
  H1: [], H2: [], H3: [], BLOCKQUOTE: [], CODE: [], PRE: [],
};
const DROP_TAGS = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|META|LINK|TEMPLATE|SVG|MATH|TITLE|HEAD)$/;
export const SAFE_URL = /^(https?:|mailto:)/i;

function cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }
    const tag = child.tagName.toUpperCase();
    if (DROP_TAGS.test(tag)) { child.remove(); continue; }
    cleanNode(child);
    // Google Docs wraps whole pastes in <b style="font-weight:normal">
    const fakeBold = tag === 'B' && /font-weight:\s*(normal|400)/.test(child.getAttribute('style') || '');
    const unsafeLink = tag === 'A' && !SAFE_URL.test(child.getAttribute('href') || '');
    const allowed = ALLOWED_TAGS[tag];
    if (!allowed || fakeBold || unsafeLink) { child.replaceWith(...child.childNodes); continue; }
    for (const attr of [...child.attributes]) {
      if (!allowed.includes(attr.name)) child.removeAttribute(attr.name);
    }
    if (tag === 'UL' && child.getAttribute('class') !== 'note-todos') child.removeAttribute('class');
    if (tag === 'LI' && child.hasAttribute('data-checked')) {
      child.setAttribute('data-checked', child.getAttribute('data-checked') === 'true' ? 'true' : 'false');
    }
  }
}

export function sanitizeNoteHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  cleanNode(tpl.content);
  return tpl.innerHTML;
}
