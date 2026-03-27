/* ========================================
   Download Utilities — image download + zip
   ======================================== */

async function fetchImageBlob(img) {
  if (img.dataUrl) {
    const res = await fetch(img.dataUrl);
    return res.blob();
  }
  if (img.url) {
    const res = await fetch(img.url);
    return res.blob();
  }
  return null;
}

function sanitizeFilename(name) {
  return (name || 'image').replace(/[/\\?%*:|"<>]/g, '-');
}

// Download all images for a task — zipped if more than one
export async function downloadTaskImages(task, btn) {
  const images = (task.reviewImages || []).filter(img => img.dataUrl || img.url);
  if (!images.length) return;

  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  try {
    if (images.length === 1) {
      // Single image — download directly
      const img = images[0];
      const filename = sanitizeFilename(img.name || `${task.title}-image.png`);
      const blob = await fetchImageBlob(img);
      if (!blob) { if (img.url) window.open(img.url, '_blank'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } else {
      // Multiple images — zip them
      const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
      const zip = new JSZip();

      await Promise.all(images.map(async (img, i) => {
        const filename = sanitizeFilename(img.name || `image-${i + 1}.png`);
        try {
          const blob = await fetchImageBlob(img);
          if (blob) zip.file(filename, blob);
        } catch {
          // Skip images that fail to fetch
        }
      }));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipName = sanitizeFilename(task.title || 'images') + '.zip';
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}
