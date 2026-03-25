/* ========================================
   Cloudinary – Image Upload
   ======================================== */

const CLOUDINARY_CLOUD_NAME = 'dbhzxhfvz';
const CLOUDINARY_UPLOAD_PRESET = 'runway_uploads';

/**
 * Upload a review image to Cloudinary and return a secure download URL.
 *
 * @param {File} file        – the image File object
 * @param {string} boardId   – board the task belongs to (used as folder)
 * @param {string} taskId    – task the image belongs to (used as folder)
 * @param {string} imageId   – unique image id
 * @returns {Promise<string>} – public secure URL
 */
export async function uploadReviewImage(file, boardId, taskId, imageId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `runway/${boardId}/${taskId}`);
  formData.append('public_id', imageId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  return data.secure_url;
}

/**
 * Upload any image to Cloudinary and return a secure URL.
 *
 * @param {File} file        – the image File object
 * @param {string} folder    – Cloudinary folder path (e.g. 'runway/banners')
 * @returns {Promise<string>} – public secure URL
 */
export async function uploadImage(file, folder) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  return data.secure_url;
}
