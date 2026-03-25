/* ========================================
   Firebase Storage – Review Image Upload
   ======================================== */

import { storage } from './firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

/**
 * Upload a review image to Firebase Storage and return a download URL.
 * Path: review-images/{boardId}/{taskId}/{imageId}_{filename}
 *
 * @param {File} file        – the image File object
 * @param {string} boardId   – board the task belongs to
 * @param {string} taskId    – task the image belongs to
 * @param {string} imageId   – unique image id (e.g. Date.now().toString())
 * @returns {Promise<string>} – public download URL
 */
export async function uploadReviewImage(file, boardId, taskId, imageId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `review-images/${boardId}/${taskId}/${imageId}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
