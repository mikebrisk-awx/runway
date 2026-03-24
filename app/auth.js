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
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const ADMIN_EMAIL = 'michael.brisk@accuweather.com';

// ── Provision user doc in Firestore on first login ──
export async function provisionUser(firebaseUser) {
  const ref = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data();
  }
  const role = firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'contributor';
  const userData = {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName || '',
    email: firebaseUser.email || '',
    photo: firebaseUser.photoURL || '',
    role,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, userData);
  return userData;
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
    // onAuthStateChanged will fire and reload logic is handled in main.js
  } catch (err) {
    console.error('Google sign-in error:', err);
    throw err;
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
