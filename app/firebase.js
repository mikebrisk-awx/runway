/* ========================================
   Firebase Initialization
   ======================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCkiOqdK9ng8P41lZktjP9yITS-3Kva4uU",
  authDomain: "runway-40912.firebaseapp.com",
  projectId: "runway-40912",
  storageBucket: "runway-40912.firebasestorage.app",
  messagingSenderId: "15308554422",
  appId: "1:15308554422:web:dce572304cefe74ef42617",
  measurementId: "G-T267WSQE9D"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
