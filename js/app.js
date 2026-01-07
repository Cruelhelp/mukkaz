// Mukkaz - Main Application Logic

// Global state
let currentUserState = null;
let appInitStarted = false;

function runWhenIdle(task, timeout = 1200) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(task, { timeout });
  } else {
    setTimeout(task, 0);
  }
}

// Initialize app
async function initializeApp() {
  if (appInitStarted) return;
  appInitStarted = true;

  const perfStart = performance.now();
  console.log('[perf] app init start');

  loadIcons();
  setupSidebar();
  setupAuthModal();
  showNavbarSkeleton();
  const authStart = performance.now();
  await checkAuthState();
  console.log(`[perf] checkAuthState ${(performance.now() - authStart).toFixed(1)}ms`);
  renderNavbar();
  applyGlobalAdVisibility();
  runWhenIdle(applyWatchAds);

  console.log(`[perf] app init ${(performance.now() - perfStart).toFixed(1)}ms`);
}

// Load all SVG icons
function loadIcons() {
  const iconElements = {
    hamburgerIcon: 'hamburger',
    searchIcon: 'search',
    mobileSearchIcon: 'search',
    homeIcon: 'home',
    trendingIcon: 'trending',
    uploadIcon: 'upload',
    myVideosIcon: 'myVideos',
    userIcon: 'user',
    closeIcon: 'close',
    signInPasswordToggleIcon: 'eye',
    signUpPasswordToggleIcon: 'eye',
    likeIcon: 'like',
    dislikeIcon: 'dislike',
    commentIcon: 'comment',
    shareIcon: 'share',
    reportIcon: 'flag',
    editIcon: 'edit',
    deleteIcon: 'delete',
    logoutIcon: 'logout',
    historyIcon: 'history',
    libraryIcon: 'library',
    subscriptionsIcon: 'library'
  };

  Object.entries(iconElements).forEach(([elementId, iconName]) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = getIcon(iconName);
    }
  });
}

function showNavbarSkeleton() {
  const navbarRight = document.getElementById('navbarRight');
  if (!navbarRight) return;

  if (document.getElementById('navbarSkeleton')) return;
  if (navbarRight.childElementCount > 0) return;

  navbarRight.innerHTML = `
    <div class="navbar-skeleton" id="navbarSkeleton">
      <div class="skeleton-nav-icon"></div>
      <div class="skeleton-nav-icon"></div>
      <div class="skeleton-avatar"></div>
    </div>
  `;
}

function getAdSettings() {
  const defaults = {
    adsEnabled: true,
    watchPageBanner: true,
    watchPageEnabled: true,
    watchPageAdType: 'banner',
    watchPageAdPosition: 'below_player',
    popunderEnabled: true,
    popunderCooldownMinutes: 20,
    homePageEnabled: true,
    homePageAdType: 'native',
    homePageAdPosition: 'top',
    smartlinkEnabled: false,
    smartlinkUrl: 'https://www.effectivegatecpm.com/p2u70j6d?key=197ddf5b21bb59ffc3436fb0c7cd959d'
  };

  const stored = getFromLocalStorage('mukkaz_ad_settings') || {};
  return { ...defaults, ...stored };
}

function applyGlobalAdVisibility() {
  const settings = getAdSettings();
  const hideAds = settings.adsEnabled === false;
  const slots = document.querySelectorAll('.watch-ad-slot, .inline-ad-slot, .home-ad-card');

  slots.forEach(slot => {
    slot.style.display = hideAds ? 'none' : '';
  });
}

function createSmartlinkCard(url) {
  if (!url) return null;

  const card = document.createElement('a');
  card.className = 'smartlink-card';
  card.href = url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.innerHTML = `
    <span class="smartlink-label">Sponsored</span>
    <span class="smartlink-title">Visit our partner</span>
    <span class="smartlink-url">${url}</span>
  `;

  return card;
}

function ensureAdsterraBannerScript() {
  const src = 'https://pl28394065.effectivegatecpm.com/ce630968429585fc33b1cd2e0f35d06a/invoke.js';
  if (document.querySelector(`script[data-adsterra="banner"][src="${src}"]`)) return;

  const script = document.createElement('script');
  script.async = true;
  script.setAttribute('data-cfasync', 'false');
  script.setAttribute('data-adsterra', 'banner');
  script.src = src;
  document.body.appendChild(script);
}

function positionWatchAdSlot(slot, position) {
  const player = document.querySelector('.video-player-container');
  const sidebar = document.querySelector('.watch-sidebar');
  const suggestedList = document.getElementById('suggestedVideosList');

  if (!slot) return;

  if (position === 'below_player' && player) {
    player.insertAdjacentElement('afterend', slot);
    return;
  }

  if ((position === 'above_recs' || position === 'sidebar_top') && sidebar) {
    if (suggestedList && suggestedList.parentElement) {
      suggestedList.parentElement.insertBefore(slot, suggestedList);
    } else {
      sidebar.insertBefore(slot, sidebar.firstChild);
    }
    return;
  }

  if (position === 'sidebar_bottom' && sidebar) {
    sidebar.appendChild(slot);
  }
}

function applyWatchAds() {
  const slot = document.getElementById('watchAdSlot');
  if (!slot) return;

  const settings = getAdSettings();

  if (settings.adsEnabled === false) {
    slot.style.display = 'none';
    return;
  }

  if (!settings.watchPageEnabled) {
    slot.style.display = 'none';
    return;
  }

  slot.style.display = '';
  positionWatchAdSlot(slot, settings.watchPageAdPosition);

  if (slot.dataset.staticAd === 'true') {
    if (!slot.dataset.fallbackScheduled) {
      slot.dataset.fallbackScheduled = 'true';
      setTimeout(() => {
        if (!document.body.contains(slot)) return;
        if (settings.adsEnabled === false || !settings.watchPageEnabled) return;
        const hasIframe = slot.querySelector('iframe');
        if (!hasIframe) {
          slot.innerHTML = '';
          const container = document.createElement('div');
          container.id = 'container-ce630968429585fc33b1cd2e0f35d06a';
          slot.appendChild(container);
          ensureAdsterraBannerScript();
        }
      }, 3000);
    }
    return;
  }

  slot.innerHTML = '';

  if (settings.watchPageAdType === 'banner' && settings.watchPageBanner) {
    const container = document.createElement('div');
    container.id = 'container-ce630968429585fc33b1cd2e0f35d06a';
    slot.appendChild(container);
    ensureAdsterraBannerScript();
    return;
  }

  if (settings.smartlinkEnabled && settings.smartlinkUrl) {
    const smartlinkCard = createSmartlinkCard(settings.smartlinkUrl);
    if (smartlinkCard) {
      slot.appendChild(smartlinkCard);
      return;
    }
  }

  slot.style.display = 'none';
}

function renderHomeAdSlot() {
  const grid = document.getElementById('videoGrid');
  if (!grid) return;

  const existing = document.getElementById('homeAdSlot');
  if (existing) existing.remove();

  const settings = getAdSettings();
  if (settings.adsEnabled === false) return;
  if (!settings.homePageEnabled) return;

  const videoCards = grid.querySelectorAll('.video-card');
  if (!videoCards.length) return;

  const adCard = document.createElement('div');
  adCard.className = 'home-ad-card';
  adCard.id = 'homeAdSlot';

  if (settings.homePageAdType === 'banner') {
    adCard.innerHTML = `
      <span class="home-ad-label">Sponsored</span>
      <div id="container-ce630968429585fc33b1cd2e0f35d06a"></div>
    `;
    ensureAdsterraBannerScript();
  } else if (settings.smartlinkEnabled && settings.smartlinkUrl) {
    const smartlinkCard = createSmartlinkCard(settings.smartlinkUrl);
    if (smartlinkCard) {
      adCard.appendChild(smartlinkCard);
    }
  }

  if (!adCard.innerHTML && !adCard.querySelector('.smartlink-card')) {
    return;
  }

  const position = settings.homePageAdPosition;
  if (position === 'top') {
    grid.insertBefore(adCard, grid.firstChild);
  } else if (position === 'mid') {
    const midIndex = Math.floor(videoCards.length / 2);
    grid.insertBefore(adCard, videoCards[midIndex]);
  } else {
    grid.appendChild(adCard);
  }
}

// Setup sidebar toggle
function setupSidebar() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');

  // Create overlay for mobile
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebarOverlay';
  document.body.appendChild(overlay);

  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    // Close sidebar when clicking overlay
    overlay.addEventListener('click', () => {
      closeSidebar();
    });

    // Close sidebar when clicking links on mobile
    const sidebarItems = sidebar.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          closeSidebar();
        }
      });
    });
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  // On mobile: toggle open/close
  if (window.innerWidth <= 1024) {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  } else {
    // On desktop: toggle collapsed/expanded
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');
  }
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar && overlay) {
    sidebar.classList.add('open');
    if (window.innerWidth <= 1024) {
      overlay.classList.add('show');
    }
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (sidebar && overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
}


// Check authentication state
async function checkAuthState() {
  try {
    const ipBlocked = await checkIpBan();
    if (ipBlocked) {
      return;
    }

    currentUserState = await getCurrentUser();
    const profile = currentUserState ? await getProfile(currentUserState.id) : null;

    if (profile?.is_banned) {
      await signOut();
      showAccessBlocked('Account banned', profile.ban_reason || 'Your account has been banned.');
      return;
    }

    // Check if user is admin and redirect to admin panel
    if (currentUserState && window.location.pathname.includes('index.html')) {
      if (profile && ['admin', 'moderator'].includes(profile.role)) {
        // Check if user just logged in (using sessionStorage flag)
        const justLoggedIn = sessionStorage.getItem('justLoggedIn');
        if (justLoggedIn === 'true') {
          sessionStorage.removeItem('justLoggedIn');
          showNotification(`Welcome back, ${profile.role === 'admin' ? 'Admin' : 'Moderator'}!`, 'success');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 1000);
          return;
        }
      }
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
    showNotification('Error loading user data. Some features may not work.', 'error');
  }

  // Load subscriptions
  await loadSubscriptions();
}

async function checkIpBan() {
  try {
    const ip = await getClientIp();
    if (!ip) return false;

    const banned = await isIpBanned(ip);
    if (!banned) return false;

    await signOut();
    showAccessBlocked('Access blocked', 'This network has been blocked from accessing Mukkaz.');
    return true;
  } catch (error) {
    console.warn('IP ban check failed:', error);
    return false;
  }
}

function showAccessBlocked(title, message) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.85)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div style="max-width: 520px; padding: 28px; background: #1a1a1a; border: 1px solid #333; border-radius: 14px; text-align: center;">
      <h2 style="margin: 0 0 10px; color: #fff;">${escapeHtml(title)}</h2>
      <p style="margin: 0; color: #bdbdbd;">${escapeHtml(message)}</p>
    </div>
  `;
  document.body.innerHTML = '';
  document.body.appendChild(overlay);
}

// Load and display subscriptions
async function loadSubscriptions() {
  const subscriptionsList = document.getElementById('subscriptionsList');
  const subscriptionsSection = document.getElementById('subscriptionsSidebarSection');

  if (!subscriptionsList || !subscriptionsSection) return;

  // Hide section if not logged in
  if (!currentUserState) {
    subscriptionsSection.style.display = 'none';
    return;
  }

  subscriptionsSection.style.display = 'block';

  try {
    const subscriptions = await getSubscriptions();

    if (!subscriptions || subscriptions.length === 0) {
      subscriptionsList.innerHTML = '';
      return;
    }

    // Render subscription items
    subscriptionsList.innerHTML = subscriptions.map(sub => {
      const profile = sub.profiles;
      if (!profile) return '';

      return `
        <a href="profile.html?id=${profile.id}" class="sidebar-item subscription-item">
          ${renderAvatarWithBadge(profile, { imgClass: 'subscription-avatar' })}
          <span class="subscription-username">${escapeHtml(profile.username)}</span>
        </a>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading subscriptions:', error);
    subscriptionsList.innerHTML = '';
  }
}

// Render navbar
async function renderNavbar() {
  const navbarRight = document.getElementById('navbarRight');
  if (!navbarRight) return;

  // Hide skeleton loader
  const skeleton = document.getElementById('navbarSkeleton');
  if (skeleton) skeleton.style.display = 'none';

  if (currentUserState) {
    try {
      const profile = await getProfile(currentUserState.id);
      const isStaff = profile && ['admin', 'moderator'].includes(profile.role);
      const adminLabel = profile?.role === 'moderator' ? 'Moderator Panel' : 'Admin Panel';
      const adminButton = isStaff ? `
        <a href="admin.html" class="nav-icon" title="${adminLabel}" style="color: var(--accent-red); display: inline-flex; align-items: center; justify-content: center;">
          <span id="adminPanelIcon">${getIcon('shield')}</span>
        </a>
      ` : '';

      if (profile && profile.avatar_url) {
        navbarRight.innerHTML = `
          ${adminButton}
          <a href="upload.html" class="nav-icon" title="Upload">
            ${getIcon('upload')}
          </a>
          <div class="nav-icon notification-bell" id="notificationBell" style="position: relative; cursor: pointer;">
            ${getIcon('bell')}
            <span class="notification-count" id="notificationBadge"></span>
          </div>
          <div class="avatar-dropdown-container">
            ${renderAvatarWithBadge(profile, { imgClass: 'avatar', wrapperClass: 'avatar-clickable', wrapperId: 'avatarDropdownBtn' })}
            <div class="avatar-dropdown hidden" id="avatarDropdown">
              ${isStaff ? `<a href="admin.html" class="dropdown-item" style="color: var(--accent-red); font-weight: 600;">
                ${getIcon('shield')}
                <span>${adminLabel}</span>
              </a>
              <div class="dropdown-divider"></div>` : ''}
              <a href="profile.html" class="dropdown-item">
                ${getIcon('user')}
                <span>My Profile</span>
              </a>
              <a href="my-videos.html" class="dropdown-item">
                ${getIcon('library')}
                <span>My Videos</span>
              </a>
              <a href="upload.html" class="dropdown-item">
                ${getIcon('upload')}
                <span>Upload Video</span>
              </a>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item" id="dropdownLogout">
                ${getIcon('logout')}
                <span>Logout</span>
              </div>
            </div>
          </div>
        `;
      } else {
        // Profile exists but no avatar
        navbarRight.innerHTML = `
          ${adminButton}
          <a href="upload.html" class="nav-icon" title="Upload">
            ${getIcon('upload')}
          </a>
          <div class="nav-icon notification-bell" id="notificationBell" style="position: relative; cursor: pointer;">
            ${getIcon('bell')}
            <span class="notification-count" id="notificationBadge"></span>
          </div>
          <div class="avatar-dropdown-container">
            ${renderAvatarWithBadge(profile, { imgClass: 'avatar', wrapperClass: 'avatar-clickable', wrapperId: 'avatarDropdownBtn' })}
            <div class="avatar-dropdown hidden" id="avatarDropdown">
              ${isAdmin ? `<a href="admin.html" class="dropdown-item" style="color: var(--accent-red); font-weight: 600;">
                ${getIcon('shield')}
                <span>Admin Panel</span>
              </a>
              <div class="dropdown-divider"></div>` : ''}
              <a href="profile.html" class="dropdown-item">
                ${getIcon('user')}
                <span>My Profile</span>
              </a>
              <a href="my-videos.html" class="dropdown-item">
                ${getIcon('library')}
                <span>My Videos</span>
              </a>
              <a href="upload.html" class="dropdown-item">
                ${getIcon('upload')}
                <span>Upload Video</span>
              </a>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item" id="dropdownLogout">
                ${getIcon('logout')}
                <span>Logout</span>
              </div>
            </div>
          </div>
        `;
      }

      // Setup notification bell
      setupNotificationBell();
      updateNotificationBadge();

        // Poll for new notifications every 30 seconds
        if (!window.notificationIntervalId) {
          window.notificationIntervalId = setInterval(updateNotificationBadge, 30000);
        }

      // Setup avatar dropdown
      setupAvatarDropdown();

    } catch (error) {
      console.error('Error loading profile:', error);
      // Fallback if profile can't be loaded
      navbarRight.innerHTML = `
        <div class="avatar-dropdown-container">
          ${renderAvatarWithBadge({}, { imgClass: 'avatar', wrapperClass: 'avatar-clickable', wrapperId: 'avatarDropdownBtn' })}
          <div class="avatar-dropdown hidden" id="avatarDropdown">
            <a href="profile.html" class="dropdown-item">
              ${getIcon('user')}
              <span>My Profile</span>
            </a>
            <a href="my-videos.html" class="dropdown-item">
              ${getIcon('library')}
              <span>My Videos</span>
            </a>
            <a href="upload.html" class="dropdown-item">
              ${getIcon('upload')}
              <span>Upload Video</span>
            </a>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" id="dropdownLogout">
              ${getIcon('logout')}
              <span>Logout</span>
            </div>
          </div>
        </div>
      `;

      // Setup avatar dropdown for fallback
      setupAvatarDropdown();
    }
  } else {
    navbarRight.innerHTML = `
      <button class="btn-primary" id="navSignInBtn">Sign In</button>
    `;

    document.getElementById('navSignInBtn').addEventListener('click', openModal);
  }
}

// Setup notification bell
function setupNotificationBell() {
  const bell = document.getElementById('notificationBell');
  if (!bell) return;
  if (bell.dataset.bound === 'true') return;
  bell.dataset.bound = 'true';

  let dropdownOpen = false;

  bell.addEventListener('click', async (e) => {
    e.stopPropagation();

    // Remove existing dropdown
    const existing = document.getElementById('notificationsDropdown');
    if (existing) {
      existing.remove();
      dropdownOpen = false;
      return;
    }

    // Create and show dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'notifications-dropdown';
    dropdown.id = 'notificationsDropdown';

    try {
      const notifications = await getNotifications(20);
      const filtered = filterNotificationsBySettings(notifications);
      const unreadCount = filtered.filter(n => !n.is_read).length;

      dropdown.innerHTML = `
        <div class="notifications-header">
          <h3>Notifications</h3>
          ${unreadCount > 0 ? `
            <button class="btn-text" onclick="markAllNotificationsAsRead()">Mark all as read</button>
          ` : ''}
        </div>
        <div class="notifications-list">
          ${filtered.length === 0 ? `
            <div class="no-notifications">
              <div style="font-size: 3rem; opacity: 0.3;">${getIcon('bell')}</div>
              <p class="secondary">No notifications yet</p>
            </div>
          ` : filtered.map(n => createNotificationHTML(n)).join('')}
        </div>
      `;

      bell.parentElement.style.position = 'relative';
      bell.parentElement.appendChild(dropdown);
      dropdownOpen = true;

      // Setup notification click handlers
      dropdown.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          const notifId = item.dataset.notificationId;
          const link = item.dataset.link;

          await markAsRead(notifId);
          updateNotificationBadge();

          if (link && link !== '#') {
            window.location.href = link;
          }
        });
      });

    } catch (error) {
      console.error('Error loading notifications:', error);
      dropdown.innerHTML = `
        <div class="notifications-header">
          <h3>Notifications</h3>
        </div>
        <div class="notifications-list">
          <p class="secondary" style="text-align: center; padding: 2rem;">Error loading notifications</p>
        </div>
      `;
      bell.parentElement.appendChild(dropdown);
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (dropdownOpen && !bell.contains(e.target)) {
      const dropdown = document.getElementById('notificationsDropdown');
      if (dropdown) {
        dropdown.remove();
        dropdownOpen = false;
      }
    }
  });
}

// Create notification HTML
function createNotificationHTML(notification) {
  const timeAgo = escapeHtml(timeSince(new Date(notification.created_at)));
  const actorUsername = notification.actor?.username || 'Someone';
  const actorAvatar = notification.actor?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(actorUsername)}`;
  const actorName = escapeHtml(actorUsername);
  const notificationLink = escapeHtml(notification.link || '#');

  // Validate avatar URL to prevent javascript: protocol injection
  const safeAvatarUrl = actorAvatar.startsWith('http://') || actorAvatar.startsWith('https://') || actorAvatar.startsWith('data:image/')
    ? actorAvatar
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(actorUsername)}`;
  const safeActor = {
    ...(notification.actor || {}),
    avatar_url: safeAvatarUrl,
    username: actorUsername
  };

  return `
    <div class="notification-item ${notification.is_read ? '' : 'unread'}"
         data-notification-id="${notification.id}"
         data-link="${notificationLink}">
      ${renderAvatarWithBadge(safeActor, { imgClass: 'notification-avatar' })}
      <div class="notification-content">
        <div class="notification-text">${escapeHtml(notification.message)}</div>
        <div class="notification-time">${timeAgo}</div>
      </div>
      ${!notification.is_read ? '<div class="notification-badge"></div>' : ''}
    </div>
  `;
}

// Update notification badge
async function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;

  try {
    const notifications = await getNotifications(20);
    const filtered = filterNotificationsBySettings(notifications);
    const count = filtered.filter(n => !n.is_read).length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
      badge.classList.add('has-notifications');
    } else {
      badge.classList.add('hidden');
      badge.classList.remove('has-notifications');
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

function createSubscribeButton(channelId, isSubscribed) {
  const button = document.createElement('button');
  button.className = isSubscribed ? 'btn-subscribed' : 'btn-subscribe';
  button.textContent = isSubscribed ? 'Subscribed' : 'Subscribe';

  button.addEventListener('click', async () => {
    try {
      button.disabled = true;
      if (button.classList.contains('btn-subscribed')) {
        await unsubscribe(channelId);
        button.classList.remove('btn-subscribed');
        button.classList.add('btn-subscribe');
        button.textContent = 'Subscribe';
      } else {
        await subscribe(channelId);
        button.classList.remove('btn-subscribe');
        button.classList.add('btn-subscribed');
        button.textContent = 'Subscribed';
      }

      const updatedProfile = await getProfile(channelId);
      const subscriberCount = document.getElementById('subscriberCount');
      if (subscriberCount) {
        subscriberCount.textContent = `${formatNumber(updatedProfile?.subscribers_count || 0)} subscribers`;
      }

      if (typeof loadSubscriptions === 'function') {
        await loadSubscriptions();
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      showNotification(error.message || 'Error updating subscription', 'error');
    } finally {
      button.disabled = false;
    }
  });

  return button;
}

function getNotificationSettingsLocal() {
  const settings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
  return {
    notifySubscribers: settings.notifySubscribers !== false,
    notifyComments: settings.notifyComments !== false,
    notifyLikes: settings.notifyLikes === true,
    notifyUploads: settings.notifyUploads !== false
  };
}

function filterNotificationsBySettings(notifications) {
  const settings = getNotificationSettingsLocal();
  const typeMap = {
    new_subscriber: settings.notifySubscribers,
    subscription: settings.notifySubscribers,
    video_like: settings.notifyLikes,
    comment_like: settings.notifyLikes,
    new_comment: settings.notifyComments,
    comment_reply: settings.notifyComments,
    video_upload: settings.notifyUploads,
    video_edit: settings.notifyUploads,
    video_delete: settings.notifyUploads
  };

  return (notifications || []).filter(notification => {
    if (notification.type in typeMap) {
      return typeMap[notification.type];
    }
    return true;
  });
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
  try {
    await markAllAsRead();
    showNotification('All notifications marked as read', 'success');

    // Refresh dropdown
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
      dropdown.remove();
    }

    // Update badge
    updateNotificationBadge();
  } catch (error) {
    console.error('Error marking all as read:', error);
    showNotification('Error updating notifications', 'error');
  }
}

// Setup avatar dropdown
function setupAvatarDropdown() {
  const avatarBtn = document.getElementById('avatarDropdownBtn');
  const dropdown = document.getElementById('avatarDropdown');
  const logoutBtn = document.getElementById('dropdownLogout');

  if (!avatarBtn || !dropdown) return;

  let dropdownOpen = false;

  // Toggle dropdown on avatar click
  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;

    if (dropdownOpen) {
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (dropdownOpen && !dropdown.contains(e.target) && !avatarBtn.contains(e.target)) {
      dropdown.classList.add('hidden');
      dropdownOpen = false;
    }
  });

  // Handle logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      dropdown.classList.add('hidden');
      dropdownOpen = false;
      await handleSignOut();
    });
  }
}

// Setup auth modal
function setupAuthModal() {
  const authModal = document.getElementById('authModal');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const showSignUpBtn = document.getElementById('showSignUpBtn');
  const showSignInBtn = document.getElementById('showSignInBtn');
  const signInGoogleBtn = document.getElementById('signInGoogleBtn');
  const signUpGoogleBtn = document.getElementById('signUpGoogleBtn');

  if (closeAuthModal) {
    closeAuthModal.addEventListener('click', () => {
      closeModal();
    });
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        closeModal();
      }
    });
  }

  if (showSignUpBtn) {
    showSignUpBtn.addEventListener('click', () => {
      signInForm.classList.add('hidden');
      signUpForm.classList.remove('hidden');
      document.getElementById('authModalTitle').textContent = 'Join Mukkaz';
    });
  }

  if (showSignInBtn) {
    showSignInBtn.addEventListener('click', () => {
      signUpForm.classList.add('hidden');
      signInForm.classList.remove('hidden');
      document.getElementById('authModalTitle').textContent = 'Welcome to Mukkaz';
    });
  }

  if (signInForm) {
    signInForm.addEventListener('submit', handleSignIn);
  }

  if (signUpForm) {
    signUpForm.addEventListener('submit', handleSignUp);
  }

  if (signInGoogleBtn) {
    signInGoogleBtn.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error('Google sign-in error:', error);
        showNotification('Error signing in with Google', 'error');
      }
    });
  }

  if (signUpGoogleBtn) {
    signUpGoogleBtn.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error('Google sign-in error:', error);
        showNotification('Error signing in with Google', 'error');
      }
    });
  }
}

// Open modal with animation
function openModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.remove('hidden');
    setTimeout(() => {
      authModal.classList.add('show');
    }, 10);
  }
}

// Close modal with animation
function closeModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.remove('show');
    setTimeout(() => {
      authModal.classList.add('hidden');
    }, 300);
  }
}

// Handle sign in
async function handleSignIn(e) {
  e.preventDefault();

  const email = document.getElementById('signInEmail').value.trim();
  const password = document.getElementById('signInPassword').value;

  if (!validateEmail(email)) {
    showNotification('Please enter a valid email address', 'error');
    return;
  }

  if (!password) {
    showNotification('Please enter your password', 'error');
    return;
  }

  try {
    await signIn(email, password);
    currentUserState = await getCurrentUser();

    // Set flag for admin redirect
    sessionStorage.setItem('justLoggedIn', 'true');

    showNotification('Signed in successfully!', 'success');
    closeModal();

    // Reload page to update UI
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    console.error('Sign in error:', error);

    // Better error messages
    let errorMessage = 'Error signing in';

    if (error.message.includes('Invalid login credentials') ||
        error.message.includes('invalid_grant')) {
      errorMessage = 'Invalid email or password. Please try again or sign up.';
    } else if (error.message.includes('Email not confirmed')) {
      errorMessage = 'Please verify your email before signing in.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    showNotification(errorMessage, 'error');
  }
}

// Handle sign up
async function handleSignUp(e) {
  e.preventDefault();

  const username = document.getElementById('signUpUsername').value.trim();
  const email = document.getElementById('signUpEmail').value.trim();
  const password = document.getElementById('signUpPassword').value;

  if (!validateUsername(username)) {
    showNotification('Username must be 3-20 characters (letters, numbers, underscores only)', 'error');
    return;
  }

  if (!validateEmail(email)) {
    showNotification('Please enter a valid email address', 'error');
    return;
  }

  // Get password requirements from config
  const minLength = window.APP_CONFIG?.security?.passwordMinLength || 12;
  const requireUppercase = window.APP_CONFIG?.security?.passwordRequireUppercase !== false;
  const requireLowercase = window.APP_CONFIG?.security?.passwordRequireLowercase !== false;
  const requireNumber = window.APP_CONFIG?.security?.passwordRequireNumber !== false;
  const requireSpecial = window.APP_CONFIG?.security?.passwordRequireSpecial || false;

  // Validate password length
  if (password.length < minLength) {
    showNotification(`Password must be at least ${minLength} characters`, 'error');
    return;
  }

  // Validate password complexity
  if (requireUppercase && !/[A-Z]/.test(password)) {
    showNotification('Password must contain at least one uppercase letter', 'error');
    return;
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    showNotification('Password must contain at least one lowercase letter', 'error');
    return;
  }

  if (requireNumber && !/[0-9]/.test(password)) {
    showNotification('Password must contain at least one number', 'error');
    return;
  }

  if (requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    showNotification('Password must contain at least one special character', 'error');
    return;
  }

  try {
    await signUp(email, password, username);

    showNotification('Account created! Check your email to verify and sign in.', 'success');

    // Switch to sign in form
    document.getElementById('signUpForm').classList.add('hidden');
    document.getElementById('signInForm').classList.remove('hidden');
    document.getElementById('authModalTitle').textContent = 'Welcome to Mukkaz';

    // Pre-fill email and focus password
    document.getElementById('signInEmail').value = email;
    document.getElementById('signInPassword').focus();
  } catch (error) {
    console.error('Sign up error:', error);

    // Better error messages
    let errorMessage = 'Error creating account';

    if (error.message.includes('Too many attempts') ||
        error.message.includes('seconds')) {
      errorMessage = 'Too many signup attempts. Please wait 60 seconds and try again.';
    } else if (error.message.includes('Username already taken')) {
      errorMessage = 'This username is taken. Please choose a different one.';
    } else if (error.message.includes('already registered') ||
        error.message.includes('User already registered')) {
      errorMessage = 'This email is already registered. Please sign in instead.';
    } else if (error.message.includes('Invalid email')) {
      errorMessage = 'Please enter a valid email address.';
    } else if (error.message.includes('Password')) {
      errorMessage = 'Password must be at least 6 characters.';
    } else if (error.message.includes('Permission error')) {
      errorMessage = 'Database permission error. Please contact support.';
    } else if (error.message.includes('profile')) {
      errorMessage = 'Error creating profile. Please try a different username.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    showNotification(errorMessage, 'error');
  }
}

// Handle sign out
async function handleSignOut() {
  try {
    await signOut();
    currentUserState = null;
    clearCurrentUser();

    showNotification('Signed out successfully', 'success');

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  } catch (error) {
    console.error('Sign out error:', error);
    showNotification('Error signing out', 'error');
  }
}

// Listen for auth state changes
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN') {
    currentUserState = session?.user || null;
  } else if (event === 'SIGNED_OUT') {
    currentUserState = null;
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Escape to close modals
  if (e.key === 'Escape') {
    const authModal = document.getElementById('authModal');
    if (authModal && authModal.classList.contains('show')) {
      closeModal();
    }
  }

  // Ctrl/Cmd + K to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.focus();
    }
  }
});

// Handle online/offline status
window.addEventListener('online', () => {
  showNotification('Connection restored', 'success');
});

window.addEventListener('offline', () => {
  showNotification('No internet connection', 'error');
});

// Prevent default drag and drop on document
document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
});

// ========================================
// GLOBAL SEARCH FUNCTIONALITY
// ========================================

// Available tags for search suggestions
const availableTags = [
  'big_batty', 'phat_pussy', 'backshot', 'hood_gyal', 'tight_pussy',
  'kingston', 'st_andrew', 'st_catherine', 'portmore', 'spanish_town',
  'montego_bay', 'mandeville', 'ocho_rios', 'bumper', 'cocky',
  'fuck', 'breed', 'suck', 'badman'
];

// Initialize global search suggestions
function initGlobalSearchSuggestions() {
  if (window.searchSuggestionsInitialized) return;
  window.searchSuggestionsInitialized = true;

  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchClearBtn = document.getElementById('searchClearBtn');

  if (!searchInput || !searchBtn) return;

  // Create suggestions dropdown if it doesn't exist
  let searchSuggestions = document.getElementById('searchSuggestions');
  if (!searchSuggestions) {
    searchSuggestions = document.createElement('div');
    searchSuggestions.id = 'searchSuggestions';
    searchSuggestions.className = 'search-suggestions hidden';
    searchInput.parentElement.appendChild(searchSuggestions);
  }

  // Setup clear button
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.style.display = 'none';
      searchInput.focus();
      searchSuggestions.classList.add('hidden');
    });
  }

  // Show suggestions as user types
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();

    // Show/hide clear button
    if (searchClearBtn) {
      searchClearBtn.style.display = e.target.value ? 'block' : 'none';
    }

    if (query.length < 2) {
      searchSuggestions.classList.add('hidden');
      return;
    }

    // Filter tags that match the query
    const matchingTags = availableTags.filter(tag =>
      tag.toLowerCase().includes(query)
    );

    if (matchingTags.length === 0) {
      searchSuggestions.classList.add('hidden');
      return;
    }

    // Populate suggestions dropdown
    searchSuggestions.innerHTML = matchingTags.map(tag => {
      const displayName = tag.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      return `
        <div class="suggestion-item" data-tag="${tag}">
          <span class="suggestion-label">Tag:</span>
          <span class="suggestion-tag">${displayName}</span>
        </div>
      `;
    }).join('');

    // Add click handlers to suggestion items
    searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const tag = item.dataset.tag;
        const displayName = tag.split('_').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        searchInput.value = displayName;
        searchSuggestions.classList.add('hidden');
        handleGlobalSearch();
      });
    });

    searchSuggestions.classList.remove('hidden');
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
      searchSuggestions.classList.add('hidden');
    }
  });

  // Hide suggestions on escape key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchSuggestions.classList.add('hidden');
    }
  });

  // Search button click
  searchBtn.addEventListener('click', handleGlobalSearch);

  // Enter key to search
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleGlobalSearch();
    }
  });
}

// Global search handler - redirects to index.html with search query
function handleGlobalSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  const searchTerm = searchInput.value.trim();
  if (!searchTerm) return;

  // Store search query in sessionStorage
  sessionStorage.setItem('searchQuery', searchTerm);

  // If on index.html, trigger search directly
  if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
    // Check if handleSearch function exists (from index.html)
    if (typeof handleSearch === 'function') {
      handleSearch();
    }
  } else {
    // Redirect to index.html with search query
    window.location.href = `index.html?search=${encodeURIComponent(searchTerm)}`;
  }
}

// Initialize global search on page load
document.addEventListener('DOMContentLoaded', () => {
  runWhenIdle(initGlobalSearchSuggestions);

  // Check for search query in URL or sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const searchFromUrl = urlParams.get('search');
  const searchFromSession = sessionStorage.getItem('searchQuery');

  if (searchFromUrl || searchFromSession) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = searchFromUrl || searchFromSession;

      // If on index.html, trigger search
      if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
        if (typeof handleSearch === 'function') {
          setTimeout(() => handleSearch(), 500);
        }
      }
    }

    // Clear sessionStorage after using it
    sessionStorage.removeItem('searchQuery');
  }
});

// Log app version
console.log('Mukkaz v1.0.0 - Powered by Supabase');
