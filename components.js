/**
 * Component Loader System - DRY Approach
 * Loads reusable components like navbar, sidebar
 */

// Component templates
const Components = {
  // Loading Skeleton for Video Cards
  videoSkeleton() {
    return `
      <div class="video-card">
        <div class="video-thumbnail-container">
          <div class="skeleton skeleton-thumbnail"></div>
        </div>
        <div class="video-info">
          <div class="video-avatar">
            <div class="skeleton skeleton-avatar"></div>
          </div>
          <div class="video-details">
            <div class="skeleton skeleton-text" style="width: 90%; height: 18px; margin-bottom: 8px;"></div>
            <div class="skeleton skeleton-text" style="width: 60%; height: 14px; margin-bottom: 4px;"></div>
            <div class="skeleton skeleton-text" style="width: 50%; height: 14px;"></div>
          </div>
        </div>
      </div>
    `;
  },

  // Show loading skeletons
  showLoadingSkeletons(container, count = 12) {
    const skeletons = Array(count).fill(0).map(() => this.videoSkeleton()).join('');
    container.innerHTML = skeletons;
  }
};

/**
 * Global helper function for backward compatibility
 */
function showSkeletonGrid(container, count = 12) {
  Components.showLoadingSkeletons(container, count);
}

/**
 * Create Video Card Element
 * @param {Object} video - Video object from database
 * @param {String} layout - 'grid' or 'list' layout
 * @returns {HTMLElement} Video card element
 */
function createVideoCard(video, layout = 'grid') {
  const profile = video.profiles || {};
  const username = profile.username || 'Unknown';
  const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const thumbnailUrl = video.thumbnail_url || 'https://via.placeholder.com/320x180?text=No+Thumbnail';
  const videoUrl = video.url || '';

  const card = document.createElement('div');
  card.className = `video-card ${layout === 'list' ? 'video-card-list' : ''} fade-in`;

  card.innerHTML = `
    <a href="watch.html?v=${video.id}" style="display: block; text-decoration: none; color: inherit;">
      <div class="video-thumbnail-container">
        <img
          data-src="${thumbnailUrl}"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'%3E%3Crect fill='%23222' width='320' height='180'/%3E%3C/svg%3E"
          alt="${escapeHtml(video.title)}"
          class="video-thumbnail"
          loading="lazy"
        >
        ${videoUrl ? `<video class="video-preview-hover" muted loop preload="none" playsinline><source src="${videoUrl}" type="video/mp4"></video>` : ''}
        ${video.duration ? `<div class="video-duration">${formatDuration(video.duration)}</div>` : ''}
      </div>
      <div class="video-info">
        <div class="video-avatar">
          <img src="${avatarUrl}" alt="${escapeHtml(username)}" class="avatar">
        </div>
        <div class="video-details">
          <h3 class="video-title">${escapeHtml(video.title)}</h3>
          <div class="video-meta">
            <div class="secondary">${escapeHtml(username)}</div>
            <div class="secondary">
              <span>${formatNumber(video.views_count || 0)} views</span>
              <span>•</span>
              <span>${timeSince(video.created_at)} ago</span>
            </div>
          </div>
        </div>
      </div>
    </a>
  `;

  // Initialize lazy loading for this card's image
  setTimeout(() => {
    const lazyLoader = new LazyLoader();
    lazyLoader.observe(`img[data-src]`);
  }, 0);

  // Add hover preview functionality
  if (videoUrl) {
    const thumbnailContainer = card.querySelector('.video-thumbnail-container');
    const previewVideo = card.querySelector('.video-preview-hover');
    const thumbnail = card.querySelector('.video-thumbnail');
    let hoverTimeout;

    thumbnailContainer.addEventListener('mouseenter', () => {
      // Delay preview by 500ms (like YouTube)
      hoverTimeout = setTimeout(() => {
        if (previewVideo) {
          previewVideo.style.opacity = '1';
          previewVideo.play().catch(err => {
            console.log('Preview autoplay failed:', err);
          });
          thumbnail.style.opacity = '0';
        }
      }, 500);
    });

    thumbnailContainer.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      if (previewVideo) {
        previewVideo.pause();
        previewVideo.currentTime = 0;
        previewVideo.style.opacity = '0';
        thumbnail.style.opacity = '1';
      }
    });
  }

  return card;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
  if (!seconds) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Initialize Bookmark States (stub for future implementation)
 */
async function initBookmarkStates() {
  // TODO: Implement bookmark functionality
  // This function will check which videos are bookmarked by the current user
  // and update the UI accordingly
  return Promise.resolve();
}

/**
 * Lazy Loading for Images
 */
class LazyLoader {
  constructor() {
    this.imageObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            observer.unobserve(img);
          }
        });
      },
      { rootMargin: '50px' }
    );
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;
    img.src = src;
    img.classList.add('fade-in');
    img.removeAttribute('data-src');
  }

  observe(selector = 'img[data-src]') {
    const images = document.querySelectorAll(selector);
    images.forEach(img => this.imageObserver.observe(img));
  }
}

/**
 * Debounce Utility
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Toast Notifications (YouTube style)
 */
class Toast {
  static show(message, duration = 3000) {
    const existing = document.getElementById('toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(255, 255, 255, 0.95);
      color: #000;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      transition: transform 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

/**
 * Keyboard Shortcuts (YouTube-style)
 */
class KeyboardShortcuts {
  static init() {
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;

      switch(e.key) {
        case '/':
          e.preventDefault();
          document.getElementById('searchInput')?.focus();
          break;
        case 'k':
          e.preventDefault();
          const video = document.querySelector('video');
          if (video) video.paused ? video.play() : video.pause();
          break;
      }
    });
  }
}
