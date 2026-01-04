// Cloudflare Stream integration patched to use Vercel serverless endpoints.
// Uses classic browser JS (NO ES MODULES).
// All Cloudflare API calls are proxied via /api/cloudflare/* routes.

/**
 * Upload video to Cloudflare Stream via serverless API.
 */
async function uploadToCloudflareStream(videoFile, metadata = {}, onProgress = null) {
  if (
    !window.CLOUDFLARE_CONFIG ||
    !CLOUDFLARE_CONFIG.accountId ||
    CLOUDFLARE_CONFIG.accountId === '13faa7514f6b0dfd763ca79c8a3cc3f4'
  ) {
    throw new Error('Cloudflare Account ID not configured.');
  }

  const formData = new FormData();
  formData.append('file', videoFile);

  if (metadata.title) {
    formData.append('meta', JSON.stringify({ name: metadata.title }));
  }

  formData.append('requireSignedURLs', 'false');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            resolve(response.result);
          } else {
            reject(
              new Error(response.errors?.[0]?.message || 'Cloudflare upload failed')
            );
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    // IMPORTANT: call your Vercel serverless proxy
    xhr.open('POST', '/api/cloudflare/upload');
    xhr.send(formData);
  });
}

/**
 * Get video status
 */
async function getStreamStatus(videoId) {
  const response = await fetch(
    `/api/cloudflare/status?id=${encodeURIComponent(videoId)}`
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message || 'Failed to get video status');
  }

  return data.result;
}

/**
 * Delete video
 */
async function deleteStream(videoId) {
  const response = await fetch(
    `/api/cloudflare/delete?id=${encodeURIComponent(videoId)}`,
    { method: 'DELETE' }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message || 'Failed to delete video');
  }

  return true;
}

/**
 * Wait for processing
 */
async function waitForProcessing(videoId, onProgress = null, maxAttempts = 60) {
  let attempts = 0;

  async function poll() {
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('Video processing timeout');
    }

    const status = await getStreamStatus(videoId);
    if (onProgress) onProgress(status);

    if (status.readyToStream) return status;
    if (status.status?.state === 'error') {
      throw new Error(status.status.errorReasonText || 'Processing failed');
    }

    await new Promise((r) => setTimeout(r, 5000));
    return poll();
  }

  return poll();
}

/**
 * Public thumbnail URL
 */
function getThumbnailUrl(videoId, time = null, width = 640, height = 360) {
  let url = `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg`;
  const params = [];

  if (time !== null) params.push(`time=${time}s`);
  if (width) params.push(`width=${width}`);
  if (height) params.push(`height=${height}`);

  if (params.length) url += '?' + params.join('&');
  return url;
}

/**
 * HLS URL
 */
function getHLSUrl(videoId) {
  return `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
}

/**
 * DASH URL
 */
function getDASHUrl(videoId) {
  return `https://videodelivery.net/${videoId}/manifest/video.mpd`;
}

/**
 * Update metadata
 */
async function updateStreamMetadata(videoId, metadata) {
  const response = await fetch('/api/cloudflare/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, metadata })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message || 'Failed to update metadata');
  }

  return data.result;
}

/**
 * Upload from remote URL
 */
async function uploadFromURL(url, metadata = {}) {
  if (!CLOUDFLARE_CONFIG.accountId || CLOUDFLARE_CONFIG.accountId === 'YOUR_ACCOUNT_ID') {
    throw new Error('Cloudflare Account ID not configured');
  }

  const response = await fetch('/api/cloudflare/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, metadata })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.errors?.[0]?.message || 'Upload from URL failed');
  }

  return data.result;
}

/* ===============================
   EXPOSE FUNCTIONS GLOBALLY
   =============================== */
window.uploadToCloudflareStream = uploadToCloudflareStream;
window.getStreamStatus = getStreamStatus;
window.deleteStream = deleteStream;
window.waitForProcessing = waitForProcessing;
window.getThumbnailUrl = getThumbnailUrl;
window.getHLSUrl = getHLSUrl;
window.getDASHUrl = getDASHUrl;
window.updateStreamMetadata = updateStreamMetadata;
window.uploadFromURL = uploadFromURL;

