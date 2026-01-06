// Video Editor Functionality for Mukkaz

class VideoEditor {
  constructor() {
    this.videoFile = null;
    this.thumbnailFile = null;
    this.videoElement = null;
    this.videoUrl = null;
    this.duration = 0;
    this.trimStart = 0;
    this.trimEnd = 0;
    this.autoThumbnailTime = 0;
  }

  async loadVideo(file) {
    this.videoFile = file;

    // Create object URL for preview
    if (this.videoUrl) {
      URL.revokeObjectURL(this.videoUrl);
    }
    this.videoUrl = URL.createObjectURL(file);

    // Create video element for processing
    this.videoElement = document.createElement('video');
    this.videoElement.src = this.videoUrl;
    this.videoElement.preload = 'metadata';

    return new Promise((resolve, reject) => {
      this.videoElement.addEventListener('loadedmetadata', () => {
        this.duration = this.videoElement.duration;
        this.trimEnd = this.duration;
        this.autoThumbnailTime = this.duration / 2; // Default to middle frame
        resolve({
          duration: this.duration,
          width: this.videoElement.videoWidth,
          height: this.videoElement.videoHeight
        });
      });

      this.videoElement.addEventListener('error', reject);
    });
  }

  async generateThumbnail(timeInSeconds = null) {
    if (!this.videoElement) {
      throw new Error('No video loaded');
    }

    const time = timeInSeconds !== null ? timeInSeconds : this.autoThumbnailTime;

    return new Promise((resolve, reject) => {
      this.videoElement.currentTime = time;

      this.videoElement.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = this.videoElement.videoWidth;
          canvas.height = this.videoElement.videoHeight;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

          canvas.toBlob((blob) => {
            const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            this.thumbnailFile = thumbnailFile;
            resolve({
              file: thumbnailFile,
              dataUrl: canvas.toDataURL('image/jpeg', 0.9)
            });
          }, 'image/jpeg', 0.9);
        } catch (error) {
          reject(error);
        }
      }, { once: true });
    });
  }

  setTrimPoints(startTime, endTime) {
    this.trimStart = Math.max(0, startTime);
    this.trimEnd = Math.min(this.duration, endTime);
  }

  getTrimData() {
    return {
      start: this.trimStart,
      end: this.trimEnd,
      duration: this.trimEnd - this.trimStart
    };
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  cleanup() {
    if (this.videoUrl) {
      URL.revokeObjectURL(this.videoUrl);
    }
  }
}

// Upload Progress Tracker
class UploadProgressTracker {
  constructor(onProgressUpdate) {
    this.onProgressUpdate = onProgressUpdate;
    this.stages = {
      VIDEO_UPLOAD: { name: 'Uploading video', progress: 0, status: 'pending' },
      THUMBNAIL_UPLOAD: { name: 'Uploading thumbnail', progress: 0, status: 'pending' },
      DATABASE_INSERT: { name: 'Creating video record', progress: 0, status: 'pending' },
      COMPLETE: { name: 'Upload complete', progress: 100, status: 'pending' }
    };
    this.currentStage = 'VIDEO_UPLOAD';
  }

  updateStage(stage, progress, status = 'in_progress') {
    this.stages[stage].progress = progress;
    this.stages[stage].status = status;
    this.currentStage = stage;

    if (this.onProgressUpdate) {
      this.onProgressUpdate({
        currentStage: stage,
        stages: this.stages,
        overallProgress: this.calculateOverallProgress()
      });
    }
  }

  calculateOverallProgress() {
    const stageWeights = {
      VIDEO_UPLOAD: 60,
      THUMBNAIL_UPLOAD: 20,
      DATABASE_INSERT: 15,
      COMPLETE: 5
    };

    let totalProgress = 0;
    Object.keys(this.stages).forEach(stage => {
      const weight = stageWeights[stage];
      const progress = this.stages[stage].progress;
      totalProgress += (weight * progress) / 100;
    });

    return Math.round(totalProgress);
  }

  complete() {
    Object.keys(this.stages).forEach(stage => {
      this.stages[stage].progress = 100;
      this.stages[stage].status = 'complete';
    });
    if (this.onProgressUpdate) {
      this.onProgressUpdate({
        currentStage: 'COMPLETE',
        stages: this.stages,
        overallProgress: 100
      });
    }
  }

  error(stage, message) {
    this.stages[stage].status = 'error';
    this.stages[stage].error = message;
    if (this.onProgressUpdate) {
      this.onProgressUpdate({
        currentStage: stage,
        stages: this.stages,
        overallProgress: this.calculateOverallProgress(),
        error: message
      });
    }
  }
}

// Enhanced upload with progress tracking
async function uploadVideoWithProgress(videoFile, thumbnailFile, title, description, progressTracker) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  try {
    // Stage 1: Upload video
    progressTracker.updateStage('VIDEO_UPLOAD', 0, 'in_progress');
    const videoFileName = `${user.id}/${Date.now()}_${videoFile.name}`;

    const { data: videoData, error: videoError } = await supabaseClient.storage
      .from('videos')
      .upload(videoFileName, videoFile, {
        onUploadProgress: (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          progressTracker.updateStage('VIDEO_UPLOAD', percent, 'in_progress');
        }
      });

    if (videoError) throw videoError;
    progressTracker.updateStage('VIDEO_UPLOAD', 100, 'complete');

    // Stage 2: Upload thumbnail
    progressTracker.updateStage('THUMBNAIL_UPLOAD', 0, 'in_progress');
    const thumbnailFileName = `${user.id}/${Date.now()}_thumbnail.jpg`;

    const { data: thumbnailData, error: thumbnailError } = await supabaseClient.storage
      .from('thumbnails')
      .upload(thumbnailFileName, thumbnailFile);

    if (thumbnailError) throw thumbnailError;
    progressTracker.updateStage('THUMBNAIL_UPLOAD', 100, 'complete');

    // Get public URLs
    const { data: { publicUrl: videoUrl } } = supabaseClient.storage
      .from('videos')
      .getPublicUrl(videoFileName);

    const { data: { publicUrl: thumbnailUrl } } = supabaseClient.storage
      .from('thumbnails')
      .getPublicUrl(thumbnailFileName);

    // Stage 3: Create database record
    progressTracker.updateStage('DATABASE_INSERT', 0, 'in_progress');
    const { data, error } = await supabaseClient
      .from('videos')
      .insert([{
        user_id: user.id,
        title,
        description,
        url: videoUrl,
        thumbnail_url: thumbnailUrl,
        views_count: 0
      }])
      .select()
      .single();

    if (error) throw error;
    progressTracker.updateStage('DATABASE_INSERT', 100, 'complete');

    await notifySelf(
      'video_upload',
      'Video uploaded',
      `Your video "${title}" is now live.`,
      `watch.html?v=${data.id}`,
      data.id
    );

    // Complete
    progressTracker.complete();

    return data;
  } catch (error) {
    const stage = progressTracker.currentStage;
    progressTracker.error(stage, error.message);
    throw error;
  }
}
