// Video Editor Wizard - FFmpeg.wasm Integration

// Global State
const editorState = {
  currentStep: 1,
  totalSteps: 7,
  originalFile: null,
  processedFile: null,
  videoElement: null,
  ffmpeg: null,
  ffmpegLoaded: false,

  // Video metadata
  duration: 0,
  width: 0,
  height: 0,
  fps: 30,

  // Edit parameters
  trim: { start: 0, end: 0, enabled: false },
  crop: { x: 0, y: 0, width: 0, height: 0, enabled: false },
  rotate: 0, // degrees: 0, 90, 180, 270
  flip: { horizontal: false, vertical: false },
  filters: {
    brightness: 0, // -1 to 1
    contrast: 1,   // 0 to 2
    saturation: 1, // 0 to 3
    blur: 0        // 0 to 10
  },
  compression: {
    quality: 'medium', // high, medium, low
    resolution: 'original', // original, 1080p, 720p, 480p
    crf: 23, // 18 (high quality) to 28 (low quality)
    targetBitrate: null
  },

  // Thumbnails
  thumbnails: [],
  selectedThumbnail: null,
  customThumbnail: null,

  // Metadata
  title: '',
  description: '',
  tags: []
};

/**
 * Initialize FFmpeg.wasm
 */
async function loadFFmpeg() {
  if (editorState.ffmpegLoaded) return editorState.ffmpeg;

  showNotification('Loading video editor...', 'info');

  try {
    const { FFmpeg } = FFmpegWASM;
    const { fetchFile, toBlobURL } = FFmpegUtil;

    editorState.ffmpeg = new FFmpeg();

    // Set up logging
    editorState.ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    // Load FFmpeg core
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
    await editorState.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });

    editorState.ffmpegLoaded = true;
    showNotification('Video editor loaded successfully', 'success');

    return editorState.ffmpeg;
  } catch (error) {
    console.error('Error loading FFmpeg:', error);
    showNotification('Failed to load video editor. You can still upload without editing.', 'error');
    throw error;
  }
}

/**
 * Initialize wizard navigation
 */
function initWizard() {
  // Step navigation buttons
  document.querySelectorAll('.wizard-next-btn').forEach(btn => {
    btn.addEventListener('click', () => nextStep());
  });

  document.querySelectorAll('.wizard-prev-btn').forEach(btn => {
    btn.addEventListener('click', () => prevStep());
  });

  document.querySelectorAll('.wizard-skip-btn').forEach(btn => {
    btn.addEventListener('click', () => nextStep());
  });

  // Jump to step buttons (in review step)
  document.querySelectorAll('[data-jump-to-step]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const step = parseInt(e.target.dataset.jumpToStep);
      goToStep(step);
    });
  });
}

/**
 * Navigate to specific step
 */
function goToStep(step) {
  if (step < 1 || step > editorState.totalSteps) return;

  // Hide current step
  const currentStepEl = document.getElementById(`step${editorState.currentStep}`);
  if (currentStepEl) currentStepEl.classList.add('hidden');

  // Show new step
  const newStepEl = document.getElementById(`step${step}`);
  if (newStepEl) newStepEl.classList.remove('hidden');

  // Update progress indicator
  updateStepIndicator(step);

  editorState.currentStep = step;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
  if (editorState.currentStep < editorState.totalSteps) {
    goToStep(editorState.currentStep + 1);
  }
}

function prevStep() {
  if (editorState.currentStep > 1) {
    goToStep(editorState.currentStep - 1);
  }
}

function updateStepIndicator(currentStep) {
  document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
    const stepNum = index + 1;
    if (stepNum < currentStep) {
      indicator.classList.add('completed');
      indicator.classList.remove('active');
    } else if (stepNum === currentStep) {
      indicator.classList.add('active');
      indicator.classList.remove('completed');
    } else {
      indicator.classList.remove('active', 'completed');
    }
  });
}

/**
 * Step 1: Handle video file selection
 */
async function handleVideoUpload(file) {
  if (!file) return;

  editorState.originalFile = file;
  editorState.processedFile = file;

  // Show file info
  const fileSize = (file.size / (1024 * 1024)).toFixed(2);
  document.getElementById('fileInfoName').textContent = file.name;
  document.getElementById('fileInfoSize').textContent = `${fileSize} MB`;

  // Load video metadata
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        editorState.duration = video.duration;
        editorState.width = video.videoWidth;
        editorState.height = video.videoHeight;
        editorState.trim.end = video.duration;

        document.getElementById('fileInfoDuration').textContent = formatTime(video.duration);
        document.getElementById('fileInfoResolution').textContent = `${video.videoWidth}x${video.videoHeight}`;

        // Show compression recommendation
        if (file.size > 100 * 1024 * 1024) {
          document.getElementById('compressionRecommendation').classList.remove('hidden');
        }

        resolve();
      };

      video.onerror = reject;
      video.src = URL.createObjectURL(file);
    });

    // Load into FFmpeg
    if (!editorState.ffmpegLoaded) {
      await loadFFmpeg();
    }

  } catch (error) {
    console.error('Error loading video:', error);
    showNotification('Error loading video file', 'error');
  }
}

/**
 * Step 2: Handle trim/cut
 */
function initTrimControls() {
  const video = document.getElementById('trimPreviewVideo');
  const timeline = document.getElementById('trimTimeline');
  const startHandle = document.getElementById('trimStartHandle');
  const endHandle = document.getElementById('trimEndHandle');
  const startTimeDisplay = document.getElementById('trimStartTime');
  const endTimeDisplay = document.getElementById('trimEndTime');

  // Load video
  video.src = URL.createObjectURL(editorState.originalFile);

  // Timeline scrubbing
  timeline.addEventListener('click', (e) => {
    const rect = timeline.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * editorState.duration;
    video.currentTime = time;
  });

  // Start handle dragging
  let draggingStart = false;
  startHandle.addEventListener('mousedown', () => draggingStart = true);

  document.addEventListener('mousemove', (e) => {
    if (!draggingStart) return;

    const rect = timeline.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * editorState.duration;

    if (time < editorState.trim.end) {
      editorState.trim.start = time;
      startHandle.style.left = `${percent * 100}%`;
      startTimeDisplay.textContent = formatTime(time);
      video.currentTime = time;
    }
  });

  document.addEventListener('mouseup', () => draggingStart = false);

  // End handle dragging
  let draggingEnd = false;
  endHandle.addEventListener('mousedown', () => draggingEnd = true);

  document.addEventListener('mousemove', (e) => {
    if (!draggingEnd) return;

    const rect = timeline.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * editorState.duration;

    if (time > editorState.trim.start) {
      editorState.trim.end = time;
      endHandle.style.left = `${percent * 100}%`;
      endTimeDisplay.textContent = formatTime(time);
      video.currentTime = time;
    }
  });

  document.addEventListener('mouseup', () => draggingEnd = false);

  // Apply trim button
  document.getElementById('applyTrimBtn').addEventListener('click', () => {
    if (editorState.trim.start > 0 || editorState.trim.end < editorState.duration) {
      editorState.trim.enabled = true;
      showNotification('Trim settings applied', 'success');
    }
  });
}

/**
 * Step 3: Handle crop/resize/rotate
 */
function initCropControls() {
  const video = document.getElementById('cropPreviewVideo');
  video.src = URL.createObjectURL(editorState.processedFile || editorState.originalFile);

  // Aspect ratio presets
  document.querySelectorAll('[data-aspect-ratio]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const ratio = e.target.dataset.aspectRatio;
      applyCropAspectRatio(ratio);
    });
  });

  // Rotate buttons
  document.getElementById('rotate90Btn').addEventListener('click', () => {
    editorState.rotate = (editorState.rotate + 90) % 360;
    updateRotatePreview();
  });

  document.getElementById('rotate180Btn').addEventListener('click', () => {
    editorState.rotate = (editorState.rotate + 180) % 360;
    updateRotatePreview();
  });

  document.getElementById('rotate270Btn').addEventListener('click', () => {
    editorState.rotate = (editorState.rotate + 270) % 360;
    updateRotatePreview();
  });

  // Flip buttons
  document.getElementById('flipHBtn').addEventListener('click', () => {
    editorState.flip.horizontal = !editorState.flip.horizontal;
    updateFlipPreview();
  });

  document.getElementById('flipVBtn').addEventListener('click', () => {
    editorState.flip.vertical = !editorState.flip.vertical;
    updateFlipPreview();
  });
}

function applyCropAspectRatio(ratio) {
  // Calculate crop dimensions based on aspect ratio
  // Implementation depends on Cropper.js integration
  showNotification(`Applied ${ratio} aspect ratio`, 'info');
}

function updateRotatePreview() {
  const video = document.getElementById('cropPreviewVideo');
  video.style.transform = `rotate(${editorState.rotate}deg)`;
}

function updateFlipPreview() {
  const video = document.getElementById('cropPreviewVideo');
  const scaleX = editorState.flip.horizontal ? -1 : 1;
  const scaleY = editorState.flip.vertical ? -1 : 1;
  video.style.transform = `rotate(${editorState.rotate}deg) scaleX(${scaleX}) scaleY(${scaleY})`;
}

/**
 * Step 4: Handle filters and effects
 */
function initFilterControls() {
  const video = document.getElementById('filterPreviewVideo');
  video.src = URL.createObjectURL(editorState.processedFile || editorState.originalFile);

  // Brightness slider
  const brightnessSlider = document.getElementById('brightnessSlider');
  brightnessSlider.addEventListener('input', (e) => {
    editorState.filters.brightness = parseFloat(e.target.value);
    applyFilterPreview();
  });

  // Contrast slider
  const contrastSlider = document.getElementById('contrastSlider');
  contrastSlider.addEventListener('input', (e) => {
    editorState.filters.contrast = parseFloat(e.target.value);
    applyFilterPreview();
  });

  // Saturation slider
  const saturationSlider = document.getElementById('saturationSlider');
  saturationSlider.addEventListener('input', (e) => {
    editorState.filters.saturation = parseFloat(e.target.value);
    applyFilterPreview();
  });

  // Reset button
  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    editorState.filters = {
      brightness: 0,
      contrast: 1,
      saturation: 1,
      blur: 0
    };
    brightnessSlider.value = 0;
    contrastSlider.value = 1;
    saturationSlider.value = 1;
    applyFilterPreview();
  });
}

function applyFilterPreview() {
  const video = document.getElementById('filterPreviewVideo');
  const { brightness, contrast, saturation, blur } = editorState.filters;

  const filter = `
    brightness(${1 + brightness})
    contrast(${contrast})
    saturate(${saturation})
    blur(${blur}px)
  `;

  video.style.filter = filter.trim();
}

/**
 * Step 5: Handle compression and quality
 */
function initCompressionControls() {
  // Quality presets
  document.querySelectorAll('[data-quality]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const quality = e.target.dataset.quality;
      setQualityPreset(quality);
    });
  });

  // Resolution options
  document.querySelectorAll('[data-resolution]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      editorState.compression.resolution = e.target.dataset.resolution;
      updateFileSizeEstimate();
    });
  });

  updateFileSizeEstimate();
}

function setQualityPreset(quality) {
  editorState.compression.quality = quality;

  switch (quality) {
    case 'high':
      editorState.compression.crf = 18;
      break;
    case 'medium':
      editorState.compression.crf = 23;
      break;
    case 'low':
      editorState.compression.crf = 28;
      break;
  }

  updateFileSizeEstimate();
}

function updateFileSizeEstimate() {
  // Rough estimate based on CRF and resolution
  const originalSize = editorState.originalFile.size;
  let estimatedSize = originalSize;

  // Resolution factor
  const resFactor = {
    'original': 1,
    '1080p': 0.5,
    '720p': 0.3,
    '480p': 0.15
  }[editorState.compression.resolution] || 1;

  // Quality factor
  const qualityFactor = editorState.compression.crf / 23; // Relative to medium

  estimatedSize = originalSize * resFactor * qualityFactor;

  document.getElementById('estimatedSize').textContent = `${(estimatedSize / (1024 * 1024)).toFixed(2)} MB`;
  document.getElementById('originalSizeDisplay').textContent = `${(originalSize / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Step 6: Generate thumbnails and collect metadata
 */
async function generateThumbnails() {
  const positions = [0.1, 0.3, 0.5, 0.7, 0.9]; // 10%, 30%, 50%, 70%, 90%
  const thumbnailsContainer = document.getElementById('thumbnailsGrid');
  thumbnailsContainer.innerHTML = '';

  const video = document.createElement('video');
  video.src = URL.createObjectURL(editorState.processedFile || editorState.originalFile);
  video.muted = true;

  await new Promise(resolve => {
    video.onloadedmetadata = resolve;
  });

  for (let i = 0; i < positions.length; i++) {
    const time = positions[i] * editorState.duration;
    video.currentTime = time;

    await new Promise(resolve => {
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 320, 180);

        canvas.toBlob(blob => {
          editorState.thumbnails.push(blob);

          // Add to UI
          const img = document.createElement('img');
          img.src = URL.createObjectURL(blob);
          img.className = 'thumbnail-option';
          img.dataset.index = i;
          img.addEventListener('click', () => selectThumbnail(i));
          thumbnailsContainer.appendChild(img);

          resolve();
        }, 'image/jpeg', 0.9);
      };
    });
  }

  // Auto-select middle thumbnail
  selectThumbnail(2);
}

function selectThumbnail(index) {
  editorState.selectedThumbnail = editorState.thumbnails[index];

  document.querySelectorAll('.thumbnail-option').forEach((img, i) => {
    img.classList.toggle('selected', i === index);
  });
}

/**
 * Step 7: Export video with all edits applied
 */
async function exportVideo() {
  if (!editorState.ffmpegLoaded) {
    await loadFFmpeg();
  }

  const ffmpeg = editorState.ffmpeg;

  try {
    showNotification('Processing video...', 'info');

    // Write input file
    await ffmpeg.writeFile('input.mp4', await fetchFile(editorState.originalFile));

    // Build FFmpeg command
    const cmd = buildFFmpegCommand();

    // Execute
    await ffmpeg.exec(cmd);

    // Read output
    const data = await ffmpeg.readFile('output.mp4');

    // Create blob
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    editorState.processedFile = new File([blob], 'processed_' + editorState.originalFile.name, { type: 'video/mp4' });

    // Clean up FFmpeg file system
    try {
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.mp4');
    } catch (e) {
      console.log('Cleanup error:', e);
    }

    showNotification('Video processed successfully', 'success');
    return editorState.processedFile;

  } catch (error) {
    console.error('Error processing video:', error);
    showNotification('Error processing video', 'error');
    throw error;
  }
}

function buildFFmpegCommand() {
  const cmd = ['-i', 'input.mp4'];
  const filters = [];

  // Trim
  if (editorState.trim.enabled) {
    cmd.push('-ss', editorState.trim.start.toString());
    cmd.push('-to', editorState.trim.end.toString());
  }

  // Crop
  if (editorState.crop.enabled) {
    filters.push(`crop=${editorState.crop.width}:${editorState.crop.height}:${editorState.crop.x}:${editorState.crop.y}`);
  }

  // Rotate
  if (editorState.rotate === 90) {
    filters.push('transpose=1');
  } else if (editorState.rotate === 180) {
    filters.push('transpose=1,transpose=1');
  } else if (editorState.rotate === 270) {
    filters.push('transpose=2');
  }

  // Flip
  if (editorState.flip.horizontal) {
    filters.push('hflip');
  }
  if (editorState.flip.vertical) {
    filters.push('vflip');
  }

  // Filters
  const { brightness, contrast, saturation } = editorState.filters;
  if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
    filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
  }

  // Resolution
  if (editorState.compression.resolution !== 'original') {
    const scales = {
      '1080p': 'scale=-2:1080',
      '720p': 'scale=-2:720',
      '480p': 'scale=-2:480'
    };
    filters.push(scales[editorState.compression.resolution]);
  }

  // Apply filters
  if (filters.length > 0) {
    cmd.push('-vf', filters.join(','));
  }

  // Compression
  cmd.push('-vcodec', 'libx264');
  cmd.push('-crf', editorState.compression.crf.toString());
  cmd.push('-preset', 'medium');

  // Audio
  cmd.push('-acodec', 'aac');

  cmd.push('output.mp4');

  return cmd;
}

/**
 * Upload final video to Cloudflare Stream
 */
async function uploadFinalVideo() {
  try {
    // Update metadata
    editorState.title = document.getElementById('videoTitle').value;
    editorState.description = document.getElementById('videoDescription').value;

    // Get selected tags
    editorState.tags = Array.from(document.querySelectorAll('input[name="tags"]:checked'))
      .map(cb => cb.value);

    if (!editorState.title) {
      showNotification('Please enter a video title', 'error');
      return;
    }

    if (editorState.tags.length === 0) {
      showNotification('Please select at least one tag', 'error');
      return;
    }

    // Export video if edits were made
    const hasEdits = editorState.trim.enabled || editorState.crop.enabled ||
                     editorState.rotate !== 0 || editorState.flip.horizontal ||
                     editorState.flip.vertical || editorState.filters.brightness !== 0 ||
                     editorState.filters.contrast !== 1 || editorState.filters.saturation !== 1 ||
                     editorState.compression.resolution !== 'original';

    let finalVideo = editorState.originalFile;

    if (hasEdits) {
      showNotification('Processing video with your edits...', 'info');
      finalVideo = await exportVideo();
    }

    // Upload to Cloudflare Stream
    showNotification('Uploading to Cloudflare Stream...', 'info');

    const streamData = await uploadToCloudflareStream(
      finalVideo,
      { title: editorState.title },
      (progress) => {
        document.getElementById('uploadProgress').value = progress;
        document.getElementById('uploadProgressText').textContent = `${Math.round(progress)}%`;
      }
    );

    // Wait for processing
    showNotification('Processing video on Cloudflare...', 'info');
    await waitForProcessing(streamData.uid, (status) => {
      console.log('Processing status:', status);
    });

    // Upload thumbnail to Supabase
    const thumbnail = editorState.customThumbnail || editorState.selectedThumbnail;

    // Save to database
    const video = await saveVideoToDatabase(streamData, thumbnail);

    showNotification('Video uploaded successfully!', 'success');

    // Redirect to watch page
    setTimeout(() => {
      window.location.href = `watch.html?v=${video.id}`;
    }, 2000);

  } catch (error) {
    console.error('Error uploading video:', error);
    showNotification('Error uploading video: ' + error.message, 'error');
  }
}

/**
 * Save video metadata to Supabase database
 */
async function saveVideoToDatabase(streamData, thumbnail) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  // Upload thumbnail to Supabase
  const thumbnailFileName = `${user.id}/${Date.now()}_thumb.jpg`;
  const { data: thumbnailData, error: thumbnailError } = await supabaseClient.storage
    .from('thumbnails')
    .upload(thumbnailFileName, thumbnail);

  if (thumbnailError) throw thumbnailError;

  const { data: { publicUrl: thumbnailUrl } } = supabaseClient.storage
    .from('thumbnails')
    .getPublicUrl(thumbnailFileName);

  // Insert video record
  const { data, error } = await supabaseClient
    .from('videos')
    .insert([{
      user_id: user.id,
      title: editorState.title,
      description: editorState.description,
      tags: editorState.tags.join(','),
      stream_id: streamData.uid,
      stream_url: getHLSUrl(streamData.uid),
      thumbnail_url: thumbnailUrl,
      duration: Math.round(editorState.duration),
      resolution: `${editorState.width}x${editorState.height}`,
      views_count: 0
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Utility: Format time in seconds to MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Utility: Fetch file for FFmpeg
 */
async function fetchFile(file) {
  return new Uint8Array(await file.arrayBuffer());
}
