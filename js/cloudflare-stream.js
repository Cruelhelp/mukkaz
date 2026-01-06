// Cloudflare Stream integration (SAFE, CLASSIC SCRIPT)
// All Cloudflare API calls go through Vercel serverless routes.

/**
 * Upload video to Cloudflare Stream
 */
async function uploadToCloudflareStream(videoFile, metadata = {}, onProgress = null) {
  if (
    !window.CLOUDFLARE_CONFIG ||
    !CLOUDFLARE_CONFIG.accountId ||
    CLOUDFLARE_CONFIG.accountId === 'YOUR_ACCOUNT_ID'
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
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.success) {
          resolve(res.result);
        } else {
          reject(new Error(res.errors?.[0]?.message || 'Upload failed'));
        }
      } catch (e) {
        reject(e);
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    xhr.open('POST', '/api/cloudflare/upload');
    xhr.send(formData);
  });
}

/**
 * Get video status
 */
async function getStreamStatus(videoId) {
  const res = await fetch(`/api/cloudflare/status?id=${encodeURIComponent(videoId)}`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message);
  return data.result;
}

/**
 * Delete video
 */
async function deleteStream(videoId) {
  const res = await fetch(`/api/cloudflare/delete?id=${encodeURIComponent(videoId)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message);
  return true;
}

/**
 * Wait for processing
 */
async function waitForProcessing(videoId, onProgress = null, maxAttempts = 60) {
  let tries = 0;
  while (tries++ < maxAttempts) {
    const status = await getStreamStatus(videoId);
    if (onProgress) onProgress(status);
    if (status.readyToStream) return status;
    if (status.status?.state === 'error') {
      throw new Error(status.status.errorReasonText || 'Processing failed');
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error('Processing timeout');
}

/**
 * Public helpers
 */
function getThumbnailUrl(videoId, time = null, width = 640, height = 360) {
  let url = `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg`;
  const q = [];
  if (time !== null) q.push(`time=${time}s`);
  if (width) q.push(`width=${width}`);
  if (height) q.push(`height=${height}`);
  return q.length ? `${url}?${q.join('&')}` : url;
}

function getHLSUrl(videoId) {
  return `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
}

function getDASHUrl(videoId) {
  return `https://videodelivery.net/${videoId}/manifest/video.mpd`;
}

/**
 * Update metadata
 */
async function updateStreamMetadata(videoId, metadata) {
  const res = await fetch('/api/cloudflare/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, metadata })
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message);
  return data.result;
}

/**
 * Upload from URL
 */
async function uploadFromURL(url, metadata = {}) {
  const res = await fetch('/api/cloudflare/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, metadata })
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.errors?.[0]?.message);
  return data.result;
}

/* expose globally */
window.uploadToCloudflareStream = uploadToCloudflareStream;
window.getStreamStatus = getStreamStatus;
window.deleteStream = deleteStream;
window.waitForProcessing = waitForProcessing;
window.getThumbnailUrl = getThumbnailUrl;
window.getHLSUrl = getHLSUrl;
window.getDASHUrl = getDASHUrl;
window.updateStreamMetadata = updateStreamMetadata;
window.uploadFromURL = uploadFromURL;
