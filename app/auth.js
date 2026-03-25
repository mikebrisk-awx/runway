/* ========================================
   Auth — Google OAuth via Firebase
   ======================================== */

import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Provision user doc in Firestore on first login ──
export async function provisionUser(firebaseUser) {
  try {
    const ref = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      // Existing user — return their stored data (role is already set)
      return snap.data();
    }

    // New user — determine their role dynamically:
    // 1. If they have a pending invite, honour that role.
    // 2. If they are the very first user in the system, make them admin.
    // 3. Otherwise, default to contributor.
    let role = 'contributor';
    let roleTitle = '';

    // Check for a pending invite
    try {
      const inviteRef  = doc(db, 'invites', firebaseUser.email.toLowerCase());
      const inviteSnap = await getDoc(inviteRef);
      if (inviteSnap.exists() && inviteSnap.data().status === 'pending') {
        role      = inviteSnap.data().role      || role;
        roleTitle = inviteSnap.data().roleTitle || '';
        await updateDoc(inviteRef, { status: 'accepted', acceptedAt: serverTimestamp() });
      }
    } catch {}

    // If no invite assigned a role, check if this is the first user in the system
    if (role === 'contributor') {
      try {
        const allUsersSnap = await getDocs(collection(db, 'users'));
        if (allUsersSnap.empty) role = 'admin'; // first user → admin
      } catch {}
    }

    const userData = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      photo: firebaseUser.photoURL || '',
      role,
      roleTitle,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, userData);
    return userData;
  } catch (err) {
    // Firestore rules may not be configured yet — fall back gracefully
    console.warn('Firestore provisionUser failed (check security rules):', err.message);
    return {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      photo: firebaseUser.photoURL || '',
      role: 'contributor',
    };
  }
}

// ── Build normalized user object ──
async function buildCurrentUser(firebaseUser) {
  if (!firebaseUser) return null;
  const userData = await provisionUser(firebaseUser);
  return {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName || userData.name || '',
    email: firebaseUser.email || '',
    photo: firebaseUser.photoURL || '',
    role: userData.role || 'contributor',
  };
}

// ── initAuth — resolves once auth state is known ──
export function initAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const user = await buildCurrentUser(firebaseUser);
          window._currentUser = user;
          resolve(user);
        } catch (err) {
          console.error('Auth provisioning error:', err);
          window._currentUser = null;
          resolve(null);
        }
      } else {
        window._currentUser = null;
        resolve(null);
      }
    });
  });
}

// ── Sign in with Google popup ──
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    // Reload so initAuth() re-runs from the top with the new user
    window.location.reload();
  } catch (err) {
    console.error('Google sign-in error:', err);
    // Surface the error to the login screen
    const errEl = document.getElementById('loginError');
    if (errEl) {
      errEl.textContent = err.code === 'auth/popup-closed-by-user'
        ? 'Sign-in cancelled.'
        : `Sign-in failed: ${err.message}`;
      errEl.style.display = 'block';
    }
  }
}

// ── Sign out and reload ──
export async function signOutUser() {
  await signOut(auth);
  window.location.reload();
}

// ── Get cached current user ──
export function getCurrentUser() {
  return window._currentUser || null;
}
