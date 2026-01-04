// Utility Functions

function timeSince(timestamp) {
  if (!timestamp) return "recently";

  const now = new Date();
  const then = new Date(timestamp);

  if (isNaN(then.getTime())) return "recently";

  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 0) return "recently";

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {
    return interval + (interval === 1 ? " year" : " years");
  }

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) {
    return interval + (interval === 1 ? " month" : " months");
  }

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) {
    return interval + (interval === 1 ? " day" : " days");
  }

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) {
    return interval + (interval === 1 ? " hour" : " hours");
  }

  interval = Math.floor(seconds / 60);
  if (interval >= 1) {
    return interval + (interval === 1 ? " minute" : " minutes");
  }

  return seconds + (seconds === 1 ? " second" : " seconds");
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

async function showNotification(message, type = 'info', persistent = false) {
  // For persistent notifications (important activities), create in database
  if (persistent && typeof createNotification === 'function') {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        await createNotification(
          currentUser.id,
          type,
          type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info',
          message,
          null,
          currentUser.id
        );
        // Update notification badge
        if (typeof updateNotificationBadge === 'function') {
          updateNotificationBadge();
        }
        return;
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  // For non-persistent notifications, show in notification dropdown temporarily
  const bellBtn = document.getElementById('notificationBellBtn');
  if (bellBtn && typeof showNotificationDropdown === 'function') {
    // Add temporary notification to dropdown
    addTemporaryNotification(message, type);

    // Flash the notification bell
    bellBtn.style.animation = 'pulse 0.5s ease';
    setTimeout(() => {
      bellBtn.style.animation = '';
    }, 500);
    return; // Don't show toast if dropdown shown
  }

  // Fallback to toast if notification system not available
  // Get or create toast container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); z-index: 2000; display: flex; flex-direction: column; gap: 0.5rem; pointer-events: none; max-width: 90vw;';
    document.body.appendChild(container);
  }

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = 'pointer-events: auto; margin: 0 auto; transform: translateY(100px); opacity: 0;';

  container.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
    notification.style.transition = 'all 0.3s ease';
  }, 10);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateY(100px)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (container.contains(notification)) {
        container.removeChild(notification);
      }
      // Remove container if empty
      if (container.children.length === 0 && document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }, 300);
  }, 3000);
}

function addTemporaryNotification(message, type) {
  // Check if dropdown exists
  let dropdown = document.getElementById('notificationsDropdown');

  if (!dropdown) {
    // Create dropdown if it doesn't exist
    dropdown = document.createElement('div');
    dropdown.className = 'notifications-dropdown';
    dropdown.id = 'notificationsDropdown';
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);
  }

  // Get or create notifications list
  let list = dropdown.querySelector('.notifications-list');
  if (!list) {
    dropdown.innerHTML = `
      <div class="notifications-header">
        <h3>Notifications</h3>
      </div>
      <div class="notifications-list"></div>
    `;
    list = dropdown.querySelector('.notifications-list');
  }

  // Create notification item
  const item = document.createElement('div');
  item.className = `notification-item notification-temp notification-temp-${type}`;
  item.innerHTML = `
    <div class="notification-content">
      <div class="notification-text">${message}</div>
      <div class="notification-time">Just now</div>
    </div>
  `;

  // Add to top of list
  list.insertBefore(item, list.firstChild);

  // Show dropdown briefly
  dropdown.style.display = 'block';

  // Remove after 5 seconds
  setTimeout(() => {
    item.style.opacity = '0';
    setTimeout(() => {
      if (list.contains(item)) {
        list.removeChild(item);
      }
      // Hide dropdown if no notifications
      if (list.children.length === 0) {
        dropdown.style.display = 'none';
      }
    }, 300);
  }, 5000);
}

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function setQueryParam(param, value) {
  const url = new URL(window.location);
  url.searchParams.set(param, value);
  window.history.pushState({}, '', url);
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

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

async function handleFileUpload(file, maxSize = 100 * 1024 * 1024) { // 100MB default
  if (file.size > maxSize) {
    throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }
  return file;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateUsername(username) {
  const re = /^[a-zA-Z0-9_]{3,20}$/;
  return re.test(username);
}

function showLoading(element) {
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.innerHTML = '<div class="spinner"></div>';
  element.appendChild(loader);
  return loader;
}

function hideLoading(loader) {
  if (loader && loader.parentNode) {
    loader.parentNode.removeChild(loader);
  }
}

// Local storage helpers
function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

function getFromLocalStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return null;
  }
}

function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error('Error removing from localStorage:', e);
  }
}

// Session helpers
function setCurrentUser(user) {
  saveToLocalStorage('mukkaz_user', user);
}

function getCurrentUserFromStorage() {
  return getFromLocalStorage('mukkaz_user');
}

function clearCurrentUser() {
  removeFromLocalStorage('mukkaz_user');
}

// Password visibility toggle
function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  const icon = button.querySelector('span');

  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = getIcon('eyeOff');
    button.title = 'Hide password';
  } else {
    input.type = 'password';
    icon.innerHTML = getIcon('eye');
    button.title = 'Show password';
  }
}

// HTML escaping for security
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
