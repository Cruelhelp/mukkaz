// Cloudflare Stream integration patched to use Vercel serverless endpoints.
// Instead of calling the Cloudflare REST API directly from the browser (which
// violates CORS and exposes your API token), these functions now proxy
// uploads and metadata operations through API routes under `/api/cloudflare/*`.

/**
 * Upload video to Cloudflare Stream via serverless API.
 * @param {File|Blob} videoFile - The video file to upload
 * @param {Object} metadata - Optional metadata (title, description, etc.)
 * @param {Function} onProgress - Progress callback (percentage)
 * @returns {Promise<Object>} Stream video data with uid, playback URLs, thumbnail
 */
export async function uploadToCloudflareStream(videoFile, metadata = {}, onProgress = null) {
  // Basic sanity check for config; accountId is still required even though
  // uploads now go through your own API.
  if (!CLOUDFLARE_CONFIG.accountId || CLOUDFLARE_CONFIG.accountId === 'YOUR_ACCOUNT_ID') {
    throw new Error('Cloudflare Account ID not configured. Please update config.cloudflare.js');
  }

  const formData = new FormData();
  formData.append('file', videoFile);

  // Add metadata if provided
  if (metadata.title) {
    formData.append('meta', JSON.stringify({ name: metadata.title }));
  }

  // Add requireSignedURLs for private videos (optional)
  formData.append('requireSignedURLs', 'false');

  try {
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      // Progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentage = (e.loaded / e.total) * 100;
            onProgress(percentage);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          if (response.success) {
            resolve(response.result);
          } else {
            reject(new Error(response.errors?.[0]?.message || 'Upload failed'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      // Use your own API route instead of Cloudflare directly. This route
      // proxies the upload to Cloudflare on the server side.
      xhr.open('POST', '/api/cloudflare/upload');
      // Do NOT set the Authorization header here; it will be added server-side.
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Cloudflare Stream upload error:', error);
    throw error;
  }
}

/**
 * Get video status and details from Cloudflare Stream via serverless API.
 * @param {string} videoId - The Cloudflare Stream video UID
 * @returns {Promise<Object>} Video details including status, duration, etc.
 */
export async function getStreamStatus(videoId) {
  try {
    const response = await fetch(`/api/cloudflare/status?id=${encodeURIComponent(videoId)}`, {
      method: 'GET'
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to get video status');
    }

    return data.result;
  } catch (error) {
    console.error('Error getting stream status:', error);
    throw error;
  }
}

/**
 * Delete video from Cloudflare Stream via serverless API.
 * @param {string} videoId - The Cloudflare Stream video UID
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteStream(videoId) {
  try {
    const response = await fetch(`/api/cloudflare/delete?id=${encodeURIComponent(videoId)}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to delete video');
    }

    return true;
  } catch (error) {
    console.error('Error deleting stream:', error);
    throw error;
  }
}

/**
 * Wait for video to finish processing via repeated status checks.
 * @param {string} videoId - The Cloudflare Stream video UID
 * @param {Function} onProgress - Callback with status updates
 * @param {number} maxAttempts - Maximum polling attempts (default 60 = 5 minutes)
 * @returns {Promise<Object>} Final video details
 */
export async function waitForProcessing(videoId, onProgress = null, maxAttempts = 60) {
  let attempts = 0;

  const poll = async () => {
    attempts++;

    if (attempts > maxAttempts) {
      throw new Error('Video processing timeout');
    }

    const status = await getStreamStatus(videoId);

    if (onProgress) {
      onProgress(status);
    }

    // Check if ready
    if (status.readyToStream) {
      return status;
    }

    // Check for errors
    if (status.status?.state === 'error') {
      throw new Error(status.status.errorReasonText || 'Video processing failed');
    }

    // Wait 5 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return poll();
  };

  return poll();
}

/**
 * Get thumbnail URL for a specific timestamp. This still references the
 * videodelivery.net domain directly because thumbnails are publicly
 * accessible and do not require authentication or CORS.
 * @param {string} videoId - The Cloudflare Stream video UID
 * @param {number} time - Time in seconds (optional, defaults to middle)
 * @param {number} width - Thumbnail width (optional)
 * @param {number} height - Thumbnail height (optional)
 * @returns {string} Thumbnail URL
 */
export function getThumbnailUrl(videoId, time = null, width = 640, height = 360) {
  let url = `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg`;
  const params = [];

  if (time !== null) {
    params.push(`time=${time}s`);
  }

  if (width) {
    params.push(`width=${width}`);
  }

  if (height) {
    params.push(`height=${height}`);
  }

  if (params.length > 0) {
    url += '?' + params.join('&');
  }

  return url;
}

/**
 * Get HLS manifest URL for playback. Public and does not require auth.
 * @param {string} videoId - The Cloudflare Stream video UID
 * @returns {string} HLS manifest URL
 */
export function getHLSUrl(videoId) {
  return `https://videodelivery.net/${videoId}/manifest/video.m3u8`;
}

/**
 * Get DASH manifest URL for playback. Public and does not require auth.
 * @param {string} videoId - The Cloudflare Stream video UID
 * @returns {string} DASH manifest URL
 */
export function getDASHUrl(videoId) {
  return `https://videodelivery.net/${videoId}/manifest/video.mpd`;
}

/**
 * Update video metadata via serverless API.
 * @param {string} videoId - The Cloudflare Stream video UID
 * @param {Object} metadata - Metadata to update (name, requireSignedURLs, etc.)
 * @returns {Promise<Object>} Updated video details
 */
export async function updateStreamMetadata(videoId, metadata) {
  try {
    const response = await fetch('/api/cloudflare/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ videoId, metadata })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to update metadata');
    }

    return data.result;
  } catch (error) {
    console.error('Error updating stream metadata:', error);
    throw error;
  }
}

/**
 * Upload a video from a remote URL via serverless API.
 * @param {string} url - Video URL to copy from
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} Stream video data
 */
export async function uploadFromURL(url, metadata = {}) {
  if (!CLOUDFLARE_CONFIG.accountId || CLOUDFLARE_CONFIG.accountId === 'YOUR_ACCOUNT_ID') {
    throw new Error('Cloudflare Account ID not configured');
  }

  try {
    const response = await fetch('/api/cloudflare/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, metadata })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.errors?.[0]?.message || 'Upload from URL failed');
    }

    return data.result;
  } catch (error) {
    console.error('Error uploading from URL:', error);
    throw error;
  }
}
