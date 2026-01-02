// Reusable UI Components for Mukkaz

// ============================================
// VIDEO CARD COMPONENT
// ============================================

function createVideoCard(video, layout = 'grid') {
  const card = document.createElement('div');
  card.className = layout === 'grid' ? 'video-card' : 'video-card-horizontal';

  const timeAgo = timeSince(new Date(video.created_at));
  const views = formatNumber(video.views_count || 0);
  const channelName = video.profiles?.username || 'Unknown';
  const channelAvatar = video.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(channelName)}`;
  const duration = formatDuration(video.duration || 0);

  if (layout === 'grid') {
    card.innerHTML = `
      <a href="watch.html?v=${video.id}" class="video-thumbnail-link">
        <div class="video-thumbnail-wrapper">
          <img src="${video.thumbnail_url}" alt="${escapeHtml(video.title)}" loading="lazy" class="video-thumb-img">
          <video
            class="video-preview"
            src="${video.url}"
            muted
            preload="none"
            playsinline
          ></video>
          ${duration ? `<span class="video-duration">${duration}</span>` : ''}
        </div>
      </a>
      <div class="video-info">
        <a href="profile.html?id=${video.user_id}" class="channel-avatar">
          <img src="${channelAvatar}" alt="${escapeHtml(channelName)}" class="avatar sm">
        </a>
        <div class="video-details">
          <a href="watch.html?v=${video.id}" class="video-title">${escapeHtml(video.title)}</a>
          <div class="video-meta">
            <a href="profile.html?id=${video.user_id}" class="channel-name">${escapeHtml(channelName)}</a>
            <div class="video-metadata">
              <span>${views} views</span>
              <span>•</span>
              <span>${timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add video preview on hover
    const thumbnailWrapper = card.querySelector('.video-thumbnail-wrapper');
    const videoPreview = card.querySelector('.video-preview');
    const durationElement = card.querySelector('.video-duration');
    let hoverTimeout = null;

    // Load video metadata to get duration if not already set
    if (videoPreview && (!duration || duration === '0:00')) {
      videoPreview.addEventListener('loadedmetadata', () => {
        if (videoPreview.duration && durationElement) {
          const calculatedDuration = formatDuration(videoPreview.duration);
          if (calculatedDuration) {
            durationElement.textContent = calculatedDuration;
            durationElement.style.display = 'block';
          }
        }
      });
      // Trigger metadata load
      videoPreview.load();
    }

    thumbnailWrapper.addEventListener('mouseenter', () => {
      hoverTimeout = setTimeout(() => {
        if (videoPreview) {
          videoPreview.currentTime = 0;
          videoPreview.play().catch(err => console.log('Preview play failed:', err));
        }
      }, 500); // 0.5 second delay before playing
    });

    thumbnailWrapper.addEventListener('mouseleave', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      if (videoPreview) {
        videoPreview.pause();
        videoPreview.currentTime = 0;
      }
    });

  } else {
    // Horizontal layout for suggested videos
    card.innerHTML = `
      <a href="watch.html?v=${video.id}" class="video-thumbnail-link-horizontal">
        <div class="video-thumbnail-wrapper-horizontal">
          <img src="${video.thumbnail_url}" alt="${escapeHtml(video.title)}" loading="lazy">
          <video
            class="video-preview"
            src="${video.url}"
            muted
            preload="none"
            playsinline
          ></video>
          <span class="video-duration" style="${duration ? '' : 'display: none;'}">${duration || ''}</span>
        </div>
      </a>
      <div class="video-info-horizontal">
        <a href="watch.html?v=${video.id}" class="video-title">${escapeHtml(video.title)}</a>
        <a href="profile.html?id=${video.user_id}" class="channel-name">${escapeHtml(channelName)}</a>
        <div class="video-metadata">
          <span>${views} views</span>
          <span>•</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    `;

    // Add video preview on hover for horizontal cards too
    const thumbnailWrapper = card.querySelector('.video-thumbnail-wrapper-horizontal');
    const videoPreview = card.querySelector('.video-preview');
    const durationElement = card.querySelector('.video-duration');
    let hoverTimeout = null;

    // Load video metadata to get duration if not already set
    if (videoPreview && (!duration || duration === '0:00')) {
      videoPreview.addEventListener('loadedmetadata', () => {
        if (videoPreview.duration && durationElement) {
          const calculatedDuration = formatDuration(videoPreview.duration);
          if (calculatedDuration) {
            durationElement.textContent = calculatedDuration;
            durationElement.style.display = 'block';
          }
        }
      });
      // Trigger metadata load
      videoPreview.load();
    }

    thumbnailWrapper.addEventListener('mouseenter', () => {
      hoverTimeout = setTimeout(() => {
        if (videoPreview) {
          videoPreview.currentTime = 0;
          videoPreview.play().catch(err => console.log('Preview play failed:', err));
        }
      }, 500);
    });

    thumbnailWrapper.addEventListener('mouseleave', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      if (videoPreview) {
        videoPreview.pause();
        videoPreview.currentTime = 0;
      }
    });
  }

  return card;
}

// ============================================
// SUBSCRIBE BUTTON COMPONENT
// ============================================

function createSubscribeButton(channelId, initialState = false) {
  const button = document.createElement('button');
  button.className = initialState ? 'btn-subscribed' : 'btn-subscribe';
  button.innerHTML = initialState ? 'Subscribed' : 'Subscribe';
  button.dataset.channelId = channelId;
  button.dataset.subscribed = initialState;

  button.addEventListener('click', async () => {
    const user = await getCurrentUser();
    if (!user) {
      openModal();
      return;
    }

    const isSubscribed = button.dataset.subscribed === 'true';

    try {
      button.disabled = true;
      if (isSubscribed) {
        await unsubscribe(channelId);
        button.className = 'btn-subscribe';
        button.innerHTML = 'Subscribe';
        button.dataset.subscribed = 'false';
        showNotification('Unsubscribed', 'info');
      } else {
        await subscribe(channelId);
        button.className = 'btn-subscribed';
        button.innerHTML = 'Subscribed';
        button.dataset.subscribed = 'true';
        showNotification('Subscribed!', 'success');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      showNotification('Error updating subscription', 'error');
    } finally {
      button.disabled = false;
    }
  });

  return button;
}

// ============================================
// BOOKMARK TOGGLE FUNCTION
// ============================================

async function toggleBookmark(videoId, buttonElement) {
  const user = await getCurrentUser();
  if (!user) {
    openModal();
    return;
  }

  try {
    const bookmarked = await isBookmarked(videoId);

    if (bookmarked) {
      await removeBookmark(videoId);
      buttonElement.classList.remove('active');
      showNotification('Removed from bookmarks', 'info');
    } else {
      await addBookmark(videoId);
      buttonElement.classList.add('active');
      showNotification('Added to bookmarks', 'success');
    }
  } catch (error) {
    console.error('Bookmark error:', error);
    showNotification('Error updating bookmark', 'error');
  }
}

// ============================================
// SHARE MODAL COMPONENT
// ============================================

function openShareModal(videoId, videoTitle) {
  const existing = document.getElementById('shareModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'shareModal';

  const videoUrl = window.location.origin + '/watch.html?v=' + videoId;

  modal.innerHTML = `
    <div class="modal-content modal-small">
      <div class="modal-header">
        <h3>Share</h3>
        <button class="btn-icon" onclick="closeShareModal()">
          <span id="shareCloseIcon"></span>
        </button>
      </div>
      <div class="modal-body">
        <div class="share-link">
          <input type="text" value="${escapeHtml(videoUrl)}" readonly id="shareLinkInput" class="form-input">
          <button class="btn-primary" onclick="copyShareLink()">Copy</button>
        </div>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeShareModal();
    }
  });

  document.body.appendChild(modal);

  // Load icon
  const closeIcon = modal.querySelector('#shareCloseIcon');
  if (closeIcon) closeIcon.innerHTML = getIcon('close');

  setTimeout(() => modal.classList.add('show'), 10);
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
}

function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  input.select();
  input.setSelectionRange(0, 99999);
  document.execCommand('copy');
  showNotification('Link copied!', 'success');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// SKELETON LOADERS
// ============================================

function createVideoCardSkeleton() {
  const skeleton = document.createElement('div');
  skeleton.className = 'video-card';
  skeleton.innerHTML = `
    <div class="video-thumbnail-wrapper skeleton">
      <div class="skeleton-thumbnail"></div>
    </div>
    <div class="video-info skeleton">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-details">
        <div class="skeleton-title"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text" style="width: 50%;"></div>
      </div>
    </div>
  `;
  return skeleton;
}

function showSkeletonGrid(container, count = 12) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    container.appendChild(createVideoCardSkeleton());
  }
}

// ============================================
// INIT BOOKMARK STATES
// ============================================

async function initBookmarkStates() {
  const user = await getCurrentUser();
  if (!user) return;

  const bookmarkBtns = document.querySelectorAll('.bookmark-btn');
  for (const btn of bookmarkBtns) {
    const videoId = btn.dataset.videoId;
    if (!videoId) continue;

    try {
      const bookmarked = await isBookmarked(videoId);
      if (bookmarked) {
        btn.classList.add('active');
      }
    } catch (error) {
      console.error('Error checking bookmark:', error);
    }
  }
}
