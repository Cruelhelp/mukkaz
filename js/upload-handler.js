/**
 * Upload Handler - Mukkaz
 * Handles video upload, compression, thumbnail generation, and form submission
 */

// Upload State
window.uploadState = window.uploadState || {
  originalFile: null,
  processedFile: null,
  thumbnails: [],
  thumbnailUrls: [],
  selectedThumbnail: null,
  customThumbnail: null,
  selectedThumbnailUrl: null,
  customThumbnailUrl: null,
  previewUrl: null,
  metadata: {
    duration: 0,
    width: 0,
    height: 0,
    quality: 'HD',
    needsCompression: false
  },
  ffmpeg: null,
  ffmpegLoaded: false,
  ffmpegDepsPromise: null,
  draftId: null
};

window.customTags = window.customTags || [];

// Initialize upload page
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupUploadHandlers();
  loadUploadIcons();
  generateTagsGrid();
  setupUploadTabs();
});

/**
 * Load icons for upload page
 */
function loadUploadIcons() {
  const uploadIcon = document.getElementById('uploadIcon');
  if (uploadIcon) uploadIcon.innerHTML = getIcon('upload');

  const publicIcon = document.getElementById('publicIcon');
  if (publicIcon) publicIcon.innerHTML = getIcon('world');

  const unlistedIcon = document.getElementById('unlistedIcon');
  if (unlistedIcon) unlistedIcon.innerHTML = getIcon('link');

  const privateIcon = document.getElementById('privateIcon');
  if (privateIcon) privateIcon.innerHTML = getIcon('lock');
}

/**
 * Generate predefined tags grid
 */
function normalizeTag(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function addTagPill(rawValue) {
  const tagPills = document.getElementById('tagPills');
  if (!tagPills) return;

  const normalized = normalizeTag(rawValue);
  if (!normalized) return;
  if (window.customTags.includes(normalized)) return;

  window.customTags.push(normalized);

  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'tag-pill';
  pill.innerHTML = `<span>${rawValue.trim()}</span><span class="tag-pill-remove" aria-hidden="true">×</span>`;
  pill.addEventListener('click', () => {
    window.customTags = window.customTags.filter(t => t !== normalized);
    pill.remove();
  });
  tagPills.appendChild(pill);
}

function clearTagPills() {
  const tagPills = document.getElementById('tagPills');
  if (tagPills) tagPills.innerHTML = '';
  window.customTags = [];
}

function generateTagsGrid() {
  const tagInput = document.getElementById('tagInput');
  if (!tagInput) return;

  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTagPill(tagInput.value);
      tagInput.value = '';
    }
  });
}

function loadScriptOnce(url, key) {
  const selector = `script[data-loader="${key}"]`;
  const existing = document.querySelector(selector);
  if (existing) {
    if (existing.dataset.loaded === 'true') return Promise.resolve();
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = url;
    script.dataset.loader = key;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${url}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function loadFFmpegDeps() {
  if (window.FFmpeg && window.FFmpegUtil) return;
  if (uploadState.ffmpegDepsPromise) return uploadState.ffmpegDepsPromise;

  uploadState.ffmpegDepsPromise = (async () => {
    await loadScriptOnce('https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/umd/ffmpeg.js', 'ffmpeg');
    await loadScriptOnce('https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js', 'ffmpeg-util');
  })();

  return uploadState.ffmpegDepsPromise;
}

async function setupUploadTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  const uploadContainer = document.getElementById('uploadContainer');
  const draftsContainer = document.getElementById('draftsContainer');
  if (!tabs.length || !uploadContainer || !draftsContainer) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(btn => btn.classList.remove('active'));
      tab.classList.add('active');

      if (tab.dataset.tab === 'drafts') {
        uploadContainer.style.display = 'none';
        draftsContainer.style.display = 'block';
        await loadDrafts();
      } else {
        draftsContainer.style.display = 'none';
        uploadContainer.style.display = 'block';
      }
    });
  });
}

async function loadDrafts() {
  const draftsList = document.getElementById('draftsList');
  if (!draftsList) return;

  draftsList.innerHTML = '<div class="drafts-loading">Loading drafts...</div>';

  try {
    const user = await getCurrentUser();
    if (!user) {
      draftsList.innerHTML = '<div class="drafts-empty">Please log in to view drafts.</div>';
      return;
    }

    const { data: drafts, error } = await supabaseClient
      .from('video_drafts')
      .select('id,title,description,tags,is_public,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    if (!drafts || drafts.length === 0) {
      draftsList.innerHTML = '<div class="drafts-empty">No drafts yet. Save a draft to continue later.</div>';
      return;
    }

    draftsList.innerHTML = '';
    drafts.forEach((draft) => {
      const item = document.createElement('div');
      item.className = 'draft-item';

      const title = document.createElement('h4');
      title.textContent = draft.title || 'Untitled Draft';

      const meta = document.createElement('div');
      meta.className = 'draft-meta';
      meta.textContent = `Saved ${timeSince(draft.updated_at)} ago`;

      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'draft-tags';
      if (draft.tags) {
        draft.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean)
          .slice(0, 6)
          .forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'draft-tag';
            tagEl.textContent = tag;
            tagsWrap.appendChild(tagEl);
          });
      }

      const actions = document.createElement('div');
      actions.className = 'draft-actions';

      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.className = 'btn btn-draft-item';
      loadBtn.textContent = 'Edit';
      loadBtn.addEventListener('click', () => loadDraft(draft.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-draft-delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteDraft(draft.id));

      actions.appendChild(loadBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(title);
      item.appendChild(meta);
      if (tagsWrap.childNodes.length) item.appendChild(tagsWrap);
      item.appendChild(actions);
      draftsList.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading drafts:', error);
    draftsList.innerHTML = '<div class="drafts-empty">Error loading drafts.</div>';
  }
}

async function loadDraft(draftId) {
  try {
    const { data: draft, error } = await supabaseClient
      .from('video_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (error) throw error;

    document.getElementById('videoTitle').value = draft.title || '';
    document.getElementById('videoDescription').value = draft.description || '';

    clearTagPills();
    if (draft.tags) {
      draft.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .forEach(tag => addTagPill(tag));
    }

    const visibilityValue = draft.is_public === false ? 'private' : 'public';
    const visibilityInput = document.querySelector(`input[name="visibility"][value="${visibilityValue}"]`);
    if (visibilityInput) visibilityInput.checked = true;

    uploadState.draftId = draftId;

    const tabs = document.querySelectorAll('[data-tab]');
    const uploadContainer = document.getElementById('uploadContainer');
    const draftsContainer = document.getElementById('draftsContainer');
    if (tabs.length && uploadContainer && draftsContainer) {
      tabs.forEach(btn => btn.classList.remove('active'));
      const uploadTab = Array.from(tabs).find(btn => btn.dataset.tab === 'upload');
      if (uploadTab) uploadTab.classList.add('active');
      draftsContainer.style.display = 'none';
      uploadContainer.style.display = 'block';
    }

    showNotification('Draft loaded', 'success');
  } catch (error) {
    console.error('Error loading draft:', error);
    showNotification('Error loading draft', 'error');
  }
}

async function deleteDraft(draftId) {
  const confirmed = await showConfirm('Delete this draft?', {
    title: 'Delete draft',
    confirmText: 'Delete',
    danger: true
  });
  if (!confirmed) return;

  try {
    const { error } = await supabaseClient
      .from('video_drafts')
      .delete()
      .eq('id', draftId);

    if (error) throw error;

    if (uploadState.draftId === draftId) {
      uploadState.draftId = null;
    }

    await loadDrafts();
    showNotification('Draft deleted', 'success');
  } catch (error) {
    console.error('Error deleting draft:', error);
    showNotification('Error deleting draft', 'error');
  }
}

// Global state for upload management
window.uploadManager = window.uploadManager || {
  isProcessing: false,
  lastProcessedFile: null,
  lastProcessedTime: 0,
  
  canProcessFile: function(file) {
    // Check if this is the same file that was just processed
    const isSameFile = this.lastProcessedFile && 
                      this.lastProcessedFile.name === file.name && 
                      this.lastProcessedFile.size === file.size &&
                      this.lastProcessedFile.lastModified === file.lastModified;
    
    // Check if we're still in the cooldown period (1 second)
    const isInCooldown = (Date.now() - this.lastProcessedTime) < 1000;
    
    return !this.isProcessing && !(isSameFile && isInCooldown);
  },
  
  startProcessing: function(file) {
    this.isProcessing = true;
    this.lastProcessedFile = file;
    this.lastProcessedTime = Date.now();
    console.log('Starting upload of:', file.name);
  },
  
  finishProcessing: function() {
    this.isProcessing = false;
    console.log('Finished processing');
  }
};

var uploadManager = window.uploadManager;

// Track if handlers are already set up
window.uploadHandlersInitialized = window.uploadHandlersInitialized || false;
var uploadHandlersInitialized = window.uploadHandlersInitialized;

/**
 * Setup upload event handlers
 */
function setupUploadHandlers() {
  // Prevent multiple initializations
  if (uploadHandlersInitialized) {
    console.log('Upload handlers already initialized');
    return;
  }
  
  console.log('Initializing upload handlers...');
  
  const dropzone = document.getElementById('uploadDropzone');
  const selectBtn = document.getElementById('selectVideoBtn');
  const videoFile = document.getElementById('videoFile');
  const customThumb = document.getElementById('customThumb');
  const uploadForm = document.getElementById('uploadForm');
  const commentsToggle = document.getElementById('commentsToggle');
  const draftBtn = document.querySelector('.btn-draft');
  
  // Reset file input to ensure clean state
  if (videoFile) videoFile.value = '';

  // Select video button
  if (selectBtn) {
    selectBtn.onclick = (e) => {
      e.stopPropagation();
      if (!uploadManager.isProcessing) {
        videoFile.click();
      }
    };
  }

  // Dropzone click
  if (dropzone) {
    dropzone.onclick = (e) => {
      e.stopPropagation();
      if (!uploadManager.isProcessing) {
        videoFile.click();
      }
    };

    // Drag and drop
    dropzone.ondragover = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!uploadManager.isProcessing) {
        dropzone.style.borderColor = 'var(--upload-accent)';
      }
    };

    dropzone.ondragleave = (e) => {
      e.stopPropagation();
      dropzone.style.borderColor = 'var(--upload-border)';
    };

    dropzone.ondrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.borderColor = 'var(--upload-border)';
      
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) {
        await processFileUpload(file);
      }
    };
  }

  // File input change
  if (videoFile) {
    videoFile.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await processFileUpload(file);
      }
      // Always clear the input after processing
      e.target.value = '';
    };
  }
  
  // Custom thumbnail upload
  if (customThumb) {
    customThumb.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleCustomThumbnail(file);
      }
    });
  }

  // Comments toggle
  if (commentsToggle) {
    commentsToggle.addEventListener('click', () => {
      commentsToggle.classList.toggle('active');
    });
  }

  // Draft button
  if (draftBtn) {
    draftBtn.addEventListener('click', saveDraft);
  }

  // Fixed draft button
  const draftBtnFixed = document.getElementById('draftBtnFixed');
  if (draftBtnFixed) {
    draftBtnFixed.addEventListener('click', saveDraft);
  }

  // Form submit
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });
  }
  
  // Mark as initialized
  uploadHandlersInitialized = true;
  window.uploadHandlersInitialized = true;
  console.log('Upload handlers initialized');
}

/**
 * Process file upload with proper state management
 */
async function processFileUpload(file) {
  // Check if we can process this file
  if (!uploadManager.canProcessFile(file)) {
    console.log('Skipping duplicate file processing:', file.name);
    return;
  }
  
  try {
    uploadManager.startProcessing(file);
    await handleVideoUpload(file);
  } catch (error) {
    console.error('Error processing file:', error);
    // Show error to user
    showNotification('Error uploading file: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    uploadManager.finishProcessing();
  }
}

/**
 * Show notification to user
 */
function showNotification(message, type = 'info') {
  const toast = document.getElementById('notificationToast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }
}

function dataURLToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  if (parts.length !== 2) return null;
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1]);
  const len = binary.length;
  const array = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function updateVideoPoster(url) {
  const videoPlayer = document.getElementById('videoPlayer');
  if (!videoPlayer) return;

  if (url) {
    videoPlayer.setAttribute('poster', url);
  } else {
    videoPlayer.removeAttribute('poster');
  }
}

/**
 * Handle video file upload
 */
async function handleVideoUpload(file) {
  uploadState.originalFile = file;
  uploadState.processedFile = file;
  if (uploadState.thumbnailUrls && uploadState.thumbnailUrls.length) {
    uploadState.thumbnailUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (err) {}
    });
  }
  uploadState.thumbnails = [];
  uploadState.thumbnailUrls = [];
  uploadState.selectedThumbnail = null;
  if (uploadState.selectedThumbnailUrl) {
    try { URL.revokeObjectURL(uploadState.selectedThumbnailUrl); } catch (err) {}
  }
  uploadState.selectedThumbnailUrl = null;
  if (uploadState.customThumbnailUrl) {
    try { URL.revokeObjectURL(uploadState.customThumbnailUrl); } catch (err) {}
  }
  uploadState.customThumbnail = null;
  uploadState.customThumbnailUrl = null;

  // Hide dropzone, show preview
  const dropzone = document.getElementById('uploadDropzone');
  const preview = document.getElementById('videoPreview');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  const progressText = document.getElementById('progressText');

  if (dropzone) {
    if (dropzone.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    dropzone.classList.add('hidden');
  }
  if (preview) {
    preview.classList.add('active');
    preview.style.display = 'block';
  }
  updateVideoPoster(null);
  if (uploadProgress) {
    uploadProgress.classList.remove('active');
  }
  if (progressFill) progressFill.style.width = '0%';
  if (progressPercent) progressPercent.textContent = '0%';
  if (progressText) progressText.textContent = 'Uploading...';

  // Load video player
  const videoPlayer = document.getElementById('videoPlayer');
  if (!videoPlayer) {
    showNotification('Video player not available.', 'error');
    return;
  }

  // Revoke previous preview URL to avoid leaks
  if (uploadState.previewUrl) {
    try { URL.revokeObjectURL(uploadState.previewUrl); } catch (err) {}
  }

  videoPlayer.pause();
  videoPlayer.removeAttribute('src');
  videoPlayer.load();

  const videoURL = URL.createObjectURL(file);
  uploadState.previewUrl = videoURL;
  videoPlayer.src = videoURL;
  videoPlayer.muted = true;
  videoPlayer.setAttribute('playsinline', 'true');
  videoPlayer.controls = true;
  videoPlayer.currentTime = 0;
  videoPlayer.load();

  // Ensure first frame renders while metadata loads
  videoPlayer.addEventListener('loadeddata', () => {
    if (preview) preview.classList.add('active');
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
  }, { once: true });
  videoPlayer.addEventListener('canplay', () => {
    videoPlayer.currentTime = 0;
    videoPlayer.pause();
  }, { once: true });

  try {
    await videoPlayer.play();
    videoPlayer.pause();
    videoPlayer.currentTime = 0;
  } catch (err) {
    // Autoplay might be blocked; rely on loadeddata handler
  }

  // Extract metadata
  await new Promise((resolve) => {
    const handleMetadata = async () => {
      uploadState.metadata.duration = videoPlayer.duration;
      uploadState.metadata.width = videoPlayer.videoWidth;
      uploadState.metadata.height = videoPlayer.videoHeight;

      const durationText = formatTime(videoPlayer.duration);
      const resolutionText = `${videoPlayer.videoWidth}x${videoPlayer.videoHeight}`;
      const quality = detectQuality(videoPlayer.videoWidth, videoPlayer.videoHeight);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

      uploadState.metadata.quality = quality;

      // Display metadata
      const videoMeta = document.getElementById('videoMeta');
      if (videoMeta) {
        videoMeta.textContent = `${durationText} | ${resolutionText} | ${quality} | ${fileSizeMB} MB`;
      }

      // Check if compression needed
      const needsCompression = file.size > 100 * 1024 * 1024; // > 100MB
      uploadState.metadata.needsCompression = needsCompression;

      if (needsCompression) {
        await autoCompressVideo(file);
      }

      // Generate thumbnails
      await generateThumbnails();

      resolve();
    };

    const onLoaded = () => {
      videoPlayer.removeEventListener('loadedmetadata', onLoaded);
      handleMetadata();
    };

    videoPlayer.addEventListener('loadedmetadata', onLoaded);

    if (videoPlayer.readyState >= 1 && isFinite(videoPlayer.duration) && videoPlayer.duration > 0) {
      onLoaded();
    }
  });
}

/**
 * Detect video quality based on resolution
 */
function detectQuality(width, height) {
  if (width >= 3840 || height >= 2160) return '4K Ultra HD';
  if (width >= 2560 || height >= 1440) return '2K QHD';
  if (width >= 1920 || height >= 1080) return 'Full HD 1080p';
  if (width >= 1280 || height >= 720) return 'HD 720p';
  if (width >= 854 || height >= 480) return 'SD 480p';
  return 'Low Quality';
}

/**
 * Auto-compress video if needed
 */
async function autoCompressVideo(file) {
  try {
    showNotification('Auto-compressing video for optimal quality...', 'info');

    // Show progress in video meta
    const videoMeta = document.getElementById('videoMeta');
    const originalMeta = videoMeta.textContent;

    await initFFmpeg((progress) => {
      const percent = Math.round(progress * 100);
      if (videoMeta) {
        videoMeta.textContent = `Compressing: ${percent}%`;
      }
    });

    const ffmpeg = uploadState.ffmpeg;

    if (uploadState.ffmpegApi === 'legacy') {
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));
      await ffmpeg.run(
        '-i', 'input.mp4',
        '-vcodec', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-vf', 'scale=-2:720',
        '-acodec', 'aac',
        'output.mp4'
      );
      const data = ffmpeg.FS('readFile', 'output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      uploadState.processedFile = new File([blob], 'compressed_' + file.name, { type: 'video/mp4' });
      try { ffmpeg.FS('unlink', 'input.mp4'); } catch (err) {}
      try { ffmpeg.FS('unlink', 'output.mp4'); } catch (err) {}
    } else {
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vcodec', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        '-vf', 'scale=-2:720',
        '-acodec', 'aac',
        'output.mp4'
      ]);
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      uploadState.processedFile = new File([blob], 'compressed_' + file.name, { type: 'video/mp4' });
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.mp4');
    }

    // Update metadata with compressed info
    const finalSizeMB = (uploadState.processedFile.size / (1024 * 1024)).toFixed(2);
    const savingsPercent = ((1 - uploadState.processedFile.size / file.size) * 100).toFixed(0);

    if (videoMeta) {
      videoMeta.textContent = `${originalMeta} (Compressed: ${finalSizeMB} MB, ${savingsPercent}% smaller)`;
      videoMeta.style.color = '#10b981';
    }

    showNotification(`Video compressed successfully! Saved ${savingsPercent}%`, 'success');
  } catch (error) {
    console.error('Compression error:', error);
    showNotification('Compression failed, uploading original video', 'warning');
    uploadState.processedFile = file;
  }
}

/**
 * Try to generate thumbnails with native <video>. If that fails (e.g. codec unsupported),
 * fall back to FFmpeg-wasm to extract the first frame so every file/browser gets at
 * least one snapshot.
 */
async function generateThumbnails() {
  const positions = [0.1, 0.3, 0.5, 0.7, 0.9];
  const thumbGrid = document.getElementById('thumbGridInline');
  const thumbnailSection = document.getElementById('thumbnailSection');

  if (!thumbGrid) return;

  thumbGrid.innerHTML = '';
  uploadState.thumbnails = [];
  if (uploadState.thumbnailUrls.length) {
    uploadState.thumbnailUrls.forEach(url => {
      try { URL.revokeObjectURL(url); } catch (err) {}
    });
  }
  uploadState.thumbnailUrls = [];

  // Show thumbnail section
  if (thumbnailSection) {
    thumbnailSection.classList.add('active');
    thumbnailSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Always add custom thumbnail option first so it is available even if auto snapshots fail
  const addCustomOption = () => {
    if (document.querySelector('.thumb-custom')) return; // already added
    const customOption = document.createElement('div');
    customOption.className = 'thumb-option thumb-custom';
    customOption.innerHTML = '<span style="font-size: 32px;">+</span><div style="font-size: 11px; margin-top: 4px;">Custom</div>';
    customOption.addEventListener('click', () => {
      document.getElementById('customThumb').click();
    });
    thumbGrid.appendChild(customOption);
  };
  addCustomOption();

  const video = document.createElement('video');
  video.src = URL.createObjectURL(uploadState.originalFile);
  video.muted = true;

  // Wait 4s for metadata; otherwise treat as unsupported codec
  const metadataLoaded = await Promise.race([
    new Promise(res => video.onloadedmetadata = () => res(true)),
    new Promise(res => setTimeout(() => res(false), 4000))
  ]);

  if (!metadataLoaded || !isFinite(video.duration) || video.duration <= 0) {
    console.warn('[upload] Native metadata failed, falling back to FFmpeg');
    await generateThumbnailWithFFmpeg();
    return;
  }

  for (let i = 0; i < positions.length; i++) {
    const duration = video.duration;
    const rawTime = positions[i] * duration;
    const time = Math.max(0, Math.min(duration - 0.1, rawTime));
    video.currentTime = time;

    await new Promise(resolve => {
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 320, 180);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const blob = dataURLToBlob(dataUrl);
        if (blob) {
          uploadState.thumbnails.push(blob);
          const url = dataUrl;
          uploadState.thumbnailUrls.push(url);

          const thumbOption = document.createElement('div');
          thumbOption.className = 'thumb-option';
          thumbOption.dataset.index = i;

          const img = document.createElement('img');
          img.src = url;
          thumbOption.appendChild(img);

          thumbOption.addEventListener('click', () => selectThumbnail(i));
          thumbGrid.appendChild(thumbOption);
        }

        resolve();
      };
    });
  }

  // Auto-select middle thumbnail if any were generated
  if (uploadState.thumbnailUrls.length) {
    const index = Math.min(2, uploadState.thumbnailUrls.length - 1);
    selectThumbnail(index);
  } else {
    // if none, ensure custom option visible
    showNotification('Unable to auto-generate snapshots; please upload a thumbnail manually', 'warning');
  }
}

/**
 * Select thumbnail
 */
// Fallback FFmpeg single-frame capture
async function generateThumbnailWithFFmpeg() {
  try {
    await initFFmpeg();
    const ffmpeg = uploadState.ffmpeg;
    let data;
    if (uploadState.ffmpegApi === 'legacy') {
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(uploadState.originalFile));
      await ffmpeg.run('-i', 'input.mp4', '-vf', 'select=eq(n\\,0)', '-frames:v', '1', 'thumb.jpg');
      data = ffmpeg.FS('readFile', 'thumb.jpg');
      try { ffmpeg.FS('unlink', 'input.mp4'); } catch (err) {}
      try { ffmpeg.FS('unlink', 'thumb.jpg'); } catch (err) {}
    } else {
      await ffmpeg.writeFile('input.mp4', await fetchFile(uploadState.originalFile));
      await ffmpeg.exec(['-i', 'input.mp4', '-vf', 'select=eq(n\\,0)', '-frames:v', '1', 'thumb.jpg']);
      data = await ffmpeg.readFile('thumb.jpg');
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('thumb.jpg');
    }
    const blob = new Blob([data.buffer], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    uploadState.thumbnails = [blob];
    uploadState.thumbnailUrls = [url];
    const thumbGrid = document.getElementById('thumbGridInline');
    if (thumbGrid) {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'thumb-option';
      imgDiv.dataset.index = 0;
      const img = document.createElement('img');
      img.src = url;
      imgDiv.appendChild(img);
      imgDiv.addEventListener('click', () => selectThumbnail(0));
      thumbGrid.insertBefore(imgDiv, thumbGrid.firstChild); // before custom tile
    }
    selectThumbnail(0);
  } catch (err) {
    console.error('FFmpeg fallback failed:', err);
  }
}

async function initFFmpeg(progressCallback) {
  if (uploadState.ffmpegLoaded) return;
  await loadFFmpegDeps();

  if (typeof FFmpeg !== 'undefined' && typeof FFmpeg.FFmpeg === 'function') {
    uploadState.ffmpeg = new FFmpeg.FFmpeg();
    uploadState.ffmpegApi = 'class';

    uploadState.ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    if (typeof progressCallback === 'function') {
      uploadState.ffmpeg.on('progress', ({ progress }) => {
        progressCallback(progress);
      });
    }

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
    const toBlobURL = FFmpegUtil?.toBlobURL;
    const coreURL = toBlobURL
      ? await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
      : `${baseURL}/ffmpeg-core.js`;
    const wasmURL = toBlobURL
      ? await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      : `${baseURL}/ffmpeg-core.wasm`;

    await uploadState.ffmpeg.load({ coreURL, wasmURL });
    uploadState.ffmpegLoaded = true;
    return;
  }

  if (typeof FFmpeg !== 'undefined' && typeof FFmpeg.createFFmpeg === 'function') {
    uploadState.ffmpeg = FFmpeg.createFFmpeg({ log: true });
    uploadState.ffmpegApi = 'legacy';
    if (typeof progressCallback === 'function' && typeof uploadState.ffmpeg.setProgress === 'function') {
      uploadState.ffmpeg.setProgress(({ ratio }) => {
        progressCallback(ratio);
      });
    }
    await uploadState.ffmpeg.load();
    uploadState.ffmpegLoaded = true;
    return;
  }

  throw new Error('FFmpeg is not available');
}

function selectThumbnail(index) {
  if (!uploadState.thumbnails[index]) return;

  uploadState.selectedThumbnail = uploadState.thumbnails[index];
  const url = uploadState.thumbnailUrls[index];
  uploadState.selectedThumbnailUrl = url;
  updateVideoPoster(url);

  document.querySelectorAll('.thumb-option').forEach((option, i) => {
    option.classList.toggle('selected', i === index);
  });
}

/**
 * Handle custom thumbnail upload
 */
function handleCustomThumbnail(file) {
  uploadState.customThumbnail = file;
  if (uploadState.customThumbnailUrl) {
    try { URL.revokeObjectURL(uploadState.customThumbnailUrl); } catch (err) {}
  }
  uploadState.customThumbnailUrl = URL.createObjectURL(file);
  uploadState.selectedThumbnail = file;
  uploadState.selectedThumbnailUrl = uploadState.customThumbnailUrl;
  updateVideoPoster(uploadState.customThumbnailUrl);

  // Create preview
  const img = document.createElement('img');
  img.src = uploadState.customThumbnailUrl;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';

  // Find and update custom option
  const customOptions = document.querySelectorAll('.thumb-custom');
  customOptions.forEach(customOption => {
    if (customOption) {
      customOption.classList.remove('thumb-custom');
      customOption.innerHTML = '';
      customOption.appendChild(img);
      customOption.classList.add('selected');

      // Deselect others
      document.querySelectorAll('.thumb-option').forEach(opt => {
        if (opt !== customOption) opt.classList.remove('selected');
      });
    }
  });

  showNotification('Custom thumbnail selected', 'success');
}

/**
 * Save draft
 */
async function saveDraft() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      showNotification('Please log in to save drafts', 'error');
      return;
    }

    const title = document.getElementById('videoTitle').value.trim();
    const description = document.getElementById('videoDescription').value.trim();
    const selectedTags = Array.isArray(window.customTags) ? window.customTags : [];
    const visibility = document.querySelector('input[name="visibility"]:checked').value;

    const draftData = {
      user_id: user.id,
      title: title || 'Untitled Draft',
      description,
      tags: selectedTags.join(','),
      is_public: visibility === 'public',
      updated_at: new Date().toISOString()
    };

    let result;
    if (uploadState.draftId) {
      result = await supabaseClient
        .from('video_drafts')
        .update(draftData)
        .eq('id', uploadState.draftId);
    } else {
      result = await supabaseClient
        .from('video_drafts')
        .insert([draftData])
        .select()
        .single();

      if (result.data) {
        uploadState.draftId = result.data.id;
      }
    }

    if (result.error) throw result.error;

    showNotification('Draft saved successfully', 'success');
  } catch (error) {
    console.error('Error saving draft:', error);
    showNotification('Error saving draft', 'error');
  }
}

/**
 * Handle form submission
 */
async function handleFormSubmit() {
  const title = document.getElementById('videoTitle').value.trim();
  const description = document.getElementById('videoDescription').value.trim();
  const selectedTags = Array.isArray(window.customTags) ? window.customTags : [];
  const visibility = document.querySelector('input[name="visibility"]:checked').value;
  const commentsEnabled = document.getElementById('commentsToggle').classList.contains('active');

  // Validation
  if (!title) {
    showNotification('Please enter a video title', 'error');
    return;
  }

  if (selectedTags.length === 0) {
    showNotification('Please select at least one tag', 'error');
    return;
  }

  if (!uploadState.processedFile) {
    showNotification('Please select a video file', 'error');
    return;
  }

  try {
    // Show progress
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');

    if (uploadProgress) uploadProgress.classList.add('active');

    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    let videoUrl = null;
    let streamId = null;
    let useCloudflare = true;

    // Try Cloudflare Stream first
    try {
      if (progressText) progressText.textContent = 'Uploading video...';

      const streamData = await uploadToCloudflareStream(
        uploadState.processedFile,
        { title },
        (progress) => {
          if (progressFill) progressFill.style.width = `${progress}%`;
          if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
        }
      );

      // Wait for processing
      if (progressText) progressText.textContent = 'Processing video...';
      await waitForProcessing(streamData.uid);

      streamId = streamData.uid;
      videoUrl = `https://videodelivery.net/${streamData.uid}/manifest/video.m3u8`;
    } catch (cloudflareError) {
      console.error('Cloudflare upload failed, using Supabase:', cloudflareError);
      useCloudflare = false;

      // Fallback to Supabase Storage
      if (progressText) progressText.textContent = 'Uploading video...';
      if (progressFill) progressFill.style.width = '0%';
      if (progressPercent) progressPercent.textContent = '0%';

      const videoFileName = `${user.id}/${Date.now()}_${uploadState.processedFile.name}`;
      const { data: videoData, error: videoError } = await supabaseClient.storage
        .from('videos')
        .upload(videoFileName, uploadState.processedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (videoError) throw new Error(`Supabase upload failed: ${videoError.message}`);

      const { data: { publicUrl: supabaseVideoUrl } } = supabaseClient.storage
        .from('videos')
        .getPublicUrl(videoFileName);

      videoUrl = supabaseVideoUrl;
      streamId = null;

      if (progressFill) progressFill.style.width = '100%';
      if (progressPercent) progressPercent.textContent = '100%';
    }

    // Upload thumbnail
    if (progressText) progressText.textContent = 'Uploading thumbnail...';
    const thumbnail = uploadState.customThumbnail || uploadState.selectedThumbnail;

    const thumbnailFileName = `${user.id}/${Date.now()}_thumb.jpg`;
    const { data: thumbnailData, error: thumbnailError } = await supabaseClient.storage
      .from('thumbnails')
      .upload(thumbnailFileName, thumbnail);

    if (thumbnailError) throw thumbnailError;

    const { data: { publicUrl: thumbnailUrl } } = supabaseClient.storage
      .from('thumbnails')
      .getPublicUrl(thumbnailFileName);

    // Save to database
    if (progressText) progressText.textContent = 'Saving video data...';

    const videoRecord = {
      user_id: user.id,
      title,
      description,
      tags: selectedTags.join(','),
      thumbnail_url: thumbnailUrl,
      views_count: 0,
      duration: Math.round(uploadState.metadata.duration),
      resolution: `${uploadState.metadata.width}x${uploadState.metadata.height}`,
      is_public: visibility === 'public'
    };

    if (useCloudflare && streamId) {
      videoRecord.stream_id = streamId;
      videoRecord.stream_url = videoUrl;
    } else {
      videoRecord.url = videoUrl;
    }

    const { data, error } = await supabaseClient
      .from('videos')
      .insert([videoRecord])
      .select()
      .single();

    if (error) throw error;

    await notifySelf(
      'video_upload',
      'Video uploaded',
      `Your video "${title}" is now live.`,
      `watch.html?v=${data.id}`,
      data.id
    );

    // Delete draft if it exists
    if (uploadState.draftId) {
      await supabaseClient
        .from('video_drafts')
        .delete()
        .eq('id', uploadState.draftId);
    }

    showNotification('Video uploaded successfully!', 'success');

    // Redirect to watch page
    setTimeout(() => {
      window.location.href = `watch.html?v=${data.id}`;
    }, 1500);

  } catch (error) {
    console.error('Upload error:', error);
    showNotification('Error uploading video: ' + error.message, 'error');

    const uploadProgress = document.getElementById('uploadProgress');
    if (uploadProgress) uploadProgress.classList.remove('active');
  }
}

/**
 * Format time in MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Fetch file as Uint8Array for FFmpeg
 */
async function fetchFile(file) {
  return new Uint8Array(await file.arrayBuffer());
}
