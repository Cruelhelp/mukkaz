// Enhanced Upload Logic

let videoEditor = null;
let currentStep = 1;
let selectedThumbnailIndex = 0;
let generatedThumbnails = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();

  // Load upload icon
  const uploadIcon = document.getElementById('uploadIcon');
  if (uploadIcon) {
    uploadIcon.innerHTML = getIcon('upload');
  }

  const user = await getCurrentUser();
  if (!user) {
    const uploadContainer = document.querySelector('.upload-container');
    uploadContainer.innerHTML = `
      <h2 class="page-title">Upload Video</h2>
      <div style="text-align: center; padding: 4rem 2rem; background-color: var(--bg-secondary); border-radius: 12px;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">${getIcon('upload')}</div>
        <h3 style="font-size: 1.5rem; margin-bottom: 1rem;">Sign In to Upload Videos</h3>
        <p class="secondary" style="margin-bottom: 2rem; font-size: 1.1rem;">
          Join Mukkaz to share your videos with the world!
        </p>
        <button class="btn-primary" onclick="openModal()" style="font-size: 1.1rem; padding: 1rem 3rem;">
          Sign In / Sign Up
        </button>
      </div>
    `;
    return;
  }

  setupUploadHandlers();
});

function setupUploadHandlers() {
  const videoUploadArea = document.getElementById('videoUploadArea');
  const videoFileInput = document.getElementById('videoFileInput');

  // Video upload area
  videoUploadArea.addEventListener('click', () => videoFileInput.click());

  videoUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoUploadArea.classList.add('active');
  });

  videoUploadArea.addEventListener('dragleave', () => {
    videoUploadArea.classList.remove('active');
  });

  videoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    videoUploadArea.classList.remove('active');
    if (e.dataTransfer.files.length > 0) {
      handleVideoFile(e.dataTransfer.files[0]);
    }
  });

  videoFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleVideoFile(e.target.files[0]);
    }
  });

  // Custom thumbnail upload
  document.getElementById('uploadCustomThumbnail').addEventListener('click', () => {
    document.getElementById('customThumbnailInput').click();
  });

  document.getElementById('customThumbnailInput').addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      videoEditor.thumbnailFile = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        addCustomThumbnailOption(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  // Final upload
  document.getElementById('finalUploadBtn').addEventListener('click', handleFinalUpload);
}

async function handleVideoFile(file) {
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    showNotification('Video file must be less than 100MB', 'error');
    return;
  }

  try {
    showNotification('Loading video...', 'info');

    videoEditor = new VideoEditor();
    const metadata = await videoEditor.loadVideo(file);

    document.getElementById('videoFileInfo').classList.remove('hidden');
    document.getElementById('videoFileInfo').textContent =
      `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB, ${videoEditor.formatTime(metadata.duration)})`;

    showNotification('Video loaded successfully!', 'success');

    // Auto advance to next step
    setTimeout(() => goToStep(2), 500);

  } catch (error) {
    console.error('Error loading video:', error);
    showNotification('Error loading video', 'error');
  }
}

async function goToStep(step) {
  // Hide all steps
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`stepContent${i}`).classList.remove('active');
    document.getElementById(`step${i}`).classList.remove('active', 'complete');
  }

  // Show current step
  document.getElementById(`stepContent${step}`).classList.add('active');
  document.getElementById(`step${step}`).classList.add('active');

  // Mark previous steps as complete
  for (let i = 1; i < step; i++) {
    document.getElementById(`step${i}`).classList.add('complete');
  }

  currentStep = step;

  // Handle step-specific logic
  if (step === 2) {
    await setupVideoPreview();
  } else if (step === 3) {
    await generateThumbnailOptions();
  } else if (step === 4) {
    showUploadSummary();
  }
}

async function setupVideoPreview() {
  const videoPreview = document.getElementById('videoPreview');
  videoPreview.src = videoEditor.videoUrl;

  // Setup trim controls
  const trimStartSlider = document.getElementById('trimStartSlider');
  const trimEndSlider = document.getElementById('trimEndSlider');

  trimStartSlider.max = videoEditor.duration;
  trimEndSlider.max = videoEditor.duration;
  trimEndSlider.value = videoEditor.duration;

  const updateTrimDisplay = () => {
    const start = parseFloat(trimStartSlider.value);
    const end = parseFloat(trimEndSlider.value);

    document.getElementById('trimStartTime').textContent = videoEditor.formatTime(start);
    document.getElementById('trimEndTime').textContent = videoEditor.formatTime(end);
    document.getElementById('trimDuration').textContent = videoEditor.formatTime(end - start);

    videoEditor.setTrimPoints(start, end);
  };

  trimStartSlider.addEventListener('input', updateTrimDisplay);
  trimEndSlider.addEventListener('input', updateTrimDisplay);

  updateTrimDisplay();
}

async function generateThumbnailOptions() {
  const container = document.getElementById('thumbnailOptions');
  container.innerHTML = '<p class="secondary">Generating thumbnails...</p>';

  generatedThumbnails = [];

  try {
    // Generate thumbnails at different time points
    const timePoints = [
      videoEditor.duration * 0.1,
      videoEditor.duration * 0.3,
      videoEditor.duration * 0.5,
      videoEditor.duration * 0.7,
      videoEditor.duration * 0.9
    ];

    container.innerHTML = '';

    for (let i = 0; i < timePoints.length; i++) {
      const thumbnail = await videoEditor.generateThumbnail(timePoints[i]);
      generatedThumbnails.push(thumbnail);

      const option = document.createElement('div');
      option.className = `thumbnail-option ${i === 2 ? 'selected' : ''}`;
      option.innerHTML = `
        <img src="${thumbnail.dataUrl}" alt="Thumbnail ${i + 1}">
        <div class="thumbnail-time">${videoEditor.formatTime(timePoints[i])}</div>
      `;
      option.addEventListener('click', () => selectThumbnail(i));
      container.appendChild(option);
    }

    selectedThumbnailIndex = 2; // Default to middle thumbnail

  } catch (error) {
    console.error('Error generating thumbnails:', error);
    container.innerHTML = '<p class="secondary">Error generating thumbnails. Please upload a custom one.</p>';
  }
}

function selectThumbnail(index) {
  const options = document.querySelectorAll('.thumbnail-option');
  options.forEach((opt, i) => {
    opt.classList.toggle('selected', i === index);
  });
  selectedThumbnailIndex = index;
  if (generatedThumbnails[index]) {
    videoEditor.thumbnailFile = generatedThumbnails[index].file;
  }
}

function addCustomThumbnailOption(dataUrl) {
  const container = document.getElementById('thumbnailOptions');
  const option = document.createElement('div');
  option.className = 'thumbnail-option selected';
  option.innerHTML = `
    <img src="${dataUrl}" alt="Custom thumbnail">
    <div class="thumbnail-time">Custom</div>
  `;

  // Deselect others
  const options = document.querySelectorAll('.thumbnail-option');
  options.forEach(opt => opt.classList.remove('selected'));

  option.addEventListener('click', () => {
    options.forEach(opt => opt.classList.remove('selected'));
    option.classList.add('selected');
  });

  container.appendChild(option);
}

function showUploadSummary() {
  const title = document.getElementById('videoTitle').value.trim();
  const description = document.getElementById('videoDescription').value.trim();
  const trimData = videoEditor.getTrimData();

  const summaryContent = document.getElementById('summaryContent');
  summaryContent.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <strong>Title:</strong> ${title || '<em class="secondary">No title</em>'}
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>Description:</strong> ${description || '<em class="secondary">No description</em>'}
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>Duration:</strong> ${videoEditor.formatTime(trimData.duration)}
    </div>
    <div style="margin-bottom: 1rem;">
      <strong>Video File:</strong> ${videoEditor.videoFile.name} (${(videoEditor.videoFile.size / (1024 * 1024)).toFixed(2)} MB)
    </div>
    <div>
      <strong>Thumbnail:</strong> ${videoEditor.thumbnailFile ? 'Ready' : 'Not selected'}
    </div>
  `;
}

async function handleFinalUpload() {
  const title = document.getElementById('videoTitle').value.trim();
  const description = document.getElementById('videoDescription').value.trim();

  if (!title) {
    showNotification('Please enter a video title', 'error');
    goToStep(3);
    return;
  }

  if (!videoEditor.thumbnailFile) {
    showNotification('Please select or upload a thumbnail', 'error');
    goToStep(3);
    return;
  }

  // Hide summary, show progress
  document.getElementById('uploadSummary').style.display = 'none';
  document.getElementById('uploadProgressContainer').classList.remove('hidden');

  // Create progress tracker
  const progressTracker = new UploadProgressTracker((progressData) => {
    updateProgressUI(progressData);
  });

  try {
    const video = await uploadVideoWithProgress(
      videoEditor.videoFile,
      videoEditor.thumbnailFile,
      title,
      description,
      progressTracker
    );

    showNotification('Video uploaded successfully!', 'success');

    setTimeout(() => {
      window.location.href = `watch.html?v=${video.id}`;
    }, 1500);

  } catch (error) {
    console.error('Upload error:', error);
    showNotification(error.message || 'Error uploading video', 'error');

    // Show summary again
    document.getElementById('uploadSummary').style.display = 'block';
    document.getElementById('uploadProgressContainer').classList.add('hidden');
  }
}

function updateProgressUI(progressData) {
  // Update overall progress bar
  document.getElementById('progressFill').style.width = `${progressData.overallProgress}%`;
  document.getElementById('overallProgress').textContent = `${progressData.overallProgress}%`;

  // Update stage list
  const stagesContainer = document.getElementById('progressStages');
  stagesContainer.innerHTML = '';

  Object.keys(progressData.stages).forEach(stageKey => {
    const stage = progressData.stages[stageKey];
    const stageEl = document.createElement('div');
    stageEl.className = 'progress-stage';

    const statusIcon = stage.status === 'complete' ? '✓' :
                       stage.status === 'in_progress' ? '...' :
                       stage.status === 'error' ? '✗' : '○';

    stageEl.innerHTML = `
      <div class="stage-status ${stage.status}">${statusIcon}</div>
      <div style="flex: 1;">
        <div>${stage.name}</div>
        ${stage.status === 'in_progress' ? `<div class="secondary" style="font-size: 0.85rem;">${stage.progress}%</div>` : ''}
        ${stage.error ? `<div style="color: var(--accent-red); font-size: 0.85rem;">${stage.error}</div>` : ''}
      </div>
    `;

    stagesContainer.appendChild(stageEl);
  });
}
