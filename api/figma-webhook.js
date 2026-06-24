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

  const comments = Array.isArray(body.comment) ? body.comment : [body.comment].filter(Boolean);

  for (const comment of comments) {
    if (!comment?.id) continue;

    if (comment.resolved_at) {
      // Mark resolved — removed from unresolved feed by the client query
      try {
        await db.collection('figmaComments').doc(comment.id).update({
          resolved_at: comment.resolved_at,
        });
      } catch (_) {
        // Doc may not exist if webhook fired for a comment we never stored
      }
    } else {
      // New comment or reply
      await db.collection('figmaComments').doc(comment.id).set({
        id: comment.id,
        fileKey: body.file_key || '',
        fileName: body.file_name || 'Untitled File',
        fileUrl: `https://www.figma.com/design/${body.file_key}/`,
        message: comment.message || '',
        author: {
          name: comment.user?.handle || comment.user?.name || 'Unknown',
          photo: comment.user?.img_url || '',
        },
        nodeId: comment.client_meta?.node_id || null,
        created_at: comment.created_at || new Date().toISOString(),
        resolved_at: null,
        parentId: comment.parent_id || null,
      });
    }
  }

  return res.status(200).json({ ok: true });
};
