const admin = require('firebase-admin');

// Lazy singleton — survives warm Vercel invocations
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Cache passcode across warm invocations — busted on mismatch
let _cachedPasscode = null;

async function getPasscode() {
  if (_cachedPasscode) return _cachedPasscode;
  const snap = await db.collection('settings').doc('figmaSecret').get();
  _cachedPasscode = snap.data()?.passcode || null;
  return _cachedPasscode;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body;
  const passcode = await getPasscode();

  if (!passcode || body.passcode !== passcode) {
    _cachedPasscode = null; // Bust cache — passcode may have changed
    return res.status(400).json({ error: 'Invalid passcode' });
  }

  if (body.event_type !== 'FILE_COMMENT') {
    return res.status(200).json({ ok: true }); // Ignore ping and other events
  }

  const commentId = body.comment_id;
  if (!commentId) return res.status(200).json({ ok: true });

  // comment[] is an array of text segments — join them for the full message
  const segments = Array.isArray(body.comment) ? body.comment : [];
  const message = segments.map(s => s.text || '').join('');

  const resolvedAt = body.resolved_at || null;

  if (resolvedAt) {
    // Mark resolved — removed from unresolved feed by the client query
    try {
      await db.collection('figmaComments').doc(commentId).update({ resolved_at: resolvedAt });
    } catch (_) {
      // Doc may not exist if we never stored it
    }
  } else {
    const author = body.triggered_by || {};
    await db.collection('figmaComments').doc(commentId).set({
      id: commentId,
      fileKey: body.file_key || '',
      fileName: body.file_name || 'Untitled File',
      fileUrl: `https://www.figma.com/design/${body.file_key}/`,
      message,
      author: {
        name: author.handle || author.name || 'Unknown',
        photo: author.img_url || '',
      },
      nodeId: body.client_meta?.node_id || null,
      created_at: body.created_at || new Date().toISOString(),
      resolved_at: null,
      parentId: body.parent_id || null,
    });
  }

  return res.status(200).json({ ok: true });
};
