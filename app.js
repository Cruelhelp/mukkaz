// Mukkaz - Main Application Logic

// Global state
let currentUserState = null;

// Initialize app
async function initializeApp() {
  loadIcons();
  setupSidebar();
  setupAuthModal();
  await checkAuthState();
  renderNavbar();
}

// Load all SVG icons
function loadIcons() {
  const iconElements = {
    hamburgerIcon: 'hamburger',
    searchIcon: 'search',
    homeIcon: 'home',
    trendingIcon: 'trending',
    uploadIcon: 'upload',
    userIcon: 'user',
    closeIcon: 'close',
    likeIcon: 'like',
    dislikeIcon: 'dislike',
    commentIcon: 'comment',
    shareIcon: 'share',
    editIcon: 'edit',
    deleteIcon: 'delete',
    logoutIcon: 'logout',
    historyIcon: 'history',
    libraryIcon: 'library'
  };

  Object.entries(iconElements).forEach(([elementId, iconName]) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = getIcon(iconName);
    }
  });
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
    currentUserState = await getCurrentUser();

    // Update sidebar based on auth state
    const authSection = document.getElementById('authSection');
    if (!authSection) return;

    if (currentUserState) {
      // Show auth options even if profile fetch fails
      authSection.innerHTML = `
        <a href="profile.html" class="sidebar-item">
          ${getIcon('user')}
          <span>My Profile</span>
        </a>
        <a href="upload.html" class="sidebar-item">
          ${getIcon('upload')}
          <span>Upload Video</span>
        </a>
        <div class="sidebar-item" id="logoutBtn" style="cursor: pointer;">
          ${getIcon('logout')}
          <span>Sign Out</span>
        </div>
      `;

      document.getElementById('logoutBtn').addEventListener('click', handleSignOut);
    } else {
      authSection.innerHTML = `
        <div class="sidebar-item" id="sidebarSignInBtn" style="cursor: pointer;">
          ${getIcon('user')}
          <span>Sign In</span>
        </div>
      `;

      const sidebarSignInBtn = document.getElementById('sidebarSignInBtn');
      if (sidebarSignInBtn) {
        sidebarSignInBtn.addEventListener('click', openModal);
      }
    }
  } catch (error) {
    console.error('Error checking auth state:', error);
    showNotification('Error loading user data. Some features may not work.', 'error');
  }
}

// Render navbar
async function renderNavbar() {
  const navbarRight = document.getElementById('navbarRight');
  if (!navbarRight) return;

  if (currentUserState) {
    try {
      const profile = await getProfile(currentUserState.id);

      if (profile && profile.avatar_url) {
        navbarRight.innerHTML = `
          <a href="upload.html" class="nav-icon">
            ${getIcon('upload')}
          </a>
          <div class="nav-icon notification-bell" id="notificationBell" style="position: relative; cursor: pointer;">
            ${getIcon('bell')}
            <span class="notification-count hidden" id="notificationBadge">0</span>
          </div>
          <a href="profile.html">
            <img src="${profile.avatar_url}" alt="${profile.username || 'User'}" class="avatar">
          </a>
        `;
      } else {
        // Profile exists but no avatar
        navbarRight.innerHTML = `
          <a href="upload.html" class="nav-icon">
            ${getIcon('upload')}
          </a>
          <div class="nav-icon notification-bell" id="notificationBell" style="position: relative; cursor: pointer;">
            ${getIcon('bell')}
            <span class="notification-count hidden" id="notificationBadge">0</span>
          </div>
          <a href="profile.html" class="nav-icon">
            ${getIcon('user')}
          </a>
        `;
      }

      // Setup notification bell
      setupNotificationBell();
      updateNotificationBadge();

      // Poll for new notifications every 30 seconds
      setInterval(updateNotificationBadge, 30000);

    } catch (error) {
      console.error('Error loading profile:', error);
      // Fallback if profile can't be loaded
      navbarRight.innerHTML = `
        <a href="upload.html" class="nav-icon">
          ${getIcon('upload')}
        </a>
        <a href="profile.html" class="nav-icon">
          ${getIcon('user')}
        </a>
        <button class="btn-secondary" onclick="handleSignOut()" style="margin-left: 1rem; padding: 0.5rem 1rem;">
          Sign Out
        </button>
      `;
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
      const unreadCount = notifications.filter(n => !n.is_read).length;

      dropdown.innerHTML = `
        <div class="notifications-header">
          <h3>Notifications</h3>
          ${unreadCount > 0 ? `
            <button class="btn-text" onclick="markAllNotificationsAsRead()">Mark all as read</button>
          ` : ''}
        </div>
        <div class="notifications-list">
          ${notifications.length === 0 ? `
            <div class="no-notifications">
              <div style="font-size: 3rem; opacity: 0.3;">${getIcon('bell')}</div>
              <p class="secondary">No notifications yet</p>
            </div>
          ` : notifications.map(n => createNotificationHTML(n)).join('')}
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

  return `
    <div class="notification-item ${notification.is_read ? '' : 'unread'}"
         data-notification-id="${notification.id}"
         data-link="${notificationLink}">
      <img src="${safeAvatarUrl}" alt="${actorName}" class="notification-avatar">
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
    const count = await getUnreadCount();
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
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

// Setup auth modal
function setupAuthModal() {
  const authModal = document.getElementById('authModal');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const showSignUpBtn = document.getElementById('showSignUpBtn');
  const showSignInBtn = document.getElementById('showSignInBtn');

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

// Log app version
console.log('Mukkaz v1.0.0 - Powered by Supabase');
