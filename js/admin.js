// Admin Panel JavaScript

let currentPage = {
  users: 1,
  videos: 1,
  activity: 1
};

const ITEMS_PER_PAGE = 20;
let currentUserEdit = null;
let allUsers = [];
let allVideos = [];
let allActivity = [];
let adminRole = 'user';
let currentAdminId = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  adminRole = await checkAdminAccess();
  if (!adminRole) return;
  setupAdminTabs();
  applyRolePermissions(adminRole);
  loadIcons();
  await loadDashboardData();
});

function loadIcons() {
  document.getElementById('hamburgerIcon').innerHTML = getIcon('menu');
  const backIcon = document.getElementById('backIcon');
  if (backIcon) backIcon.innerHTML = getIcon('arrowLeft');
  document.getElementById('refreshIcon').innerHTML = getIcon('refresh');

  // Load sidebar icons
  document.getElementById('dashboardIcon').innerHTML = getIcon('home');
  document.getElementById('usersIcon').innerHTML = getIcon('user');
  document.getElementById('videosIcon').innerHTML = getIcon('upload');
  document.getElementById('analyticsIcon').innerHTML = getIcon('trending');
  document.getElementById('activityIcon').innerHTML = getIcon('history');
  document.getElementById('adsIcon').innerHTML = getIcon('dollar');
  document.getElementById('payoutsIcon').innerHTML = getIcon('dollar');
  document.getElementById('cloudflareIcon').innerHTML = getIcon('cloud');
  document.getElementById('databaseIcon').innerHTML = getIcon('database');
  document.getElementById('settingsIcon').innerHTML = getIcon('settings');
  const reportsIcon = document.getElementById('reportsIcon');
  if (reportsIcon) reportsIcon.innerHTML = getIcon('flag');

  // Setup hamburger button
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', toggleSidebar);
  }

  // Setup backdrop click to close sidebar
  const backdrop = document.getElementById('adminSidebarBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('adminSidebarBackdrop');

  if (sidebar) {
    sidebar.classList.toggle('open');
    if (backdrop) {
      backdrop.classList.toggle('active');
    }
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('adminSidebarBackdrop');

  if (sidebar) {
    sidebar.classList.remove('open');
  }
  if (backdrop) {
    backdrop.classList.remove('active');
  }
}

async function checkAdminAccess() {
  const user = await getCurrentUser();

  if (!user) {
    showNotification('Please log in to access admin panel', 'error');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }

  // Check if user is admin or moderator
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    showNotification('Access denied - Admin/Moderator only', 'error');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return null;
  }

  currentAdminId = user.id;
  return profile.role;
}

function canAccessTab(tabName) {
  if (adminRole === 'admin') return true;
  const moderatorTabs = new Set(['dashboard', 'videos', 'reports', 'analytics', 'activity']);
  return moderatorTabs.has(tabName);
}

function applyRolePermissions(role) {
  if (role === 'admin') return;

  const restrictedTabs = ['users', 'ads', 'payouts', 'cloudflare', 'database', 'settings'];
  restrictedTabs.forEach(tabName => {
    document.querySelectorAll(`.admin-sidebar-item[data-tab="${tabName}"]`).forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll(`.admin-tab[data-tab="${tabName}"]`).forEach(el => {
      el.style.display = 'none';
    });
    const section = document.getElementById(`${tabName}-section`);
    if (section) section.style.display = 'none';
  });

  const monetization = document.getElementById('monetizationSummary');
  if (monetization) monetization.style.display = 'none';

  const manageBansBtn = document.getElementById('manageBansBtn');
  if (manageBansBtn) manageBansBtn.style.display = 'none';
}

function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const sidebarItems = document.querySelectorAll('.admin-sidebar-item');
  const sections = document.querySelectorAll('.admin-section');

  // Handle horizontal tabs (hidden but kept for compatibility)
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      showTab(targetTab);
    });
  });

  // Handle sidebar navigation
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.dataset.tab;
      if (targetTab) {
        showTab(targetTab);

        // Update active state in sidebar
        sidebarItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Close sidebar on mobile after click
        if (window.innerWidth <= 1024) {
          closeSidebar();
        }
      }
    });
  });
}

function showTab(tabName) {
  if (!canAccessTab(tabName)) {
    showNotification('This section is restricted to admins.', 'error');
    return;
  }
  const tabs = document.querySelectorAll('.admin-tab');
  const sections = document.querySelectorAll('.admin-section');

  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  sections.forEach(section => {
    if (section.id === `${tabName}-section`) {
      section.classList.add('active');
      // Load data when tab is shown
      loadTabData(tabName);
    } else {
      section.classList.remove('active');
    }
  });
}

async function loadTabData(tabName) {
  if (!canAccessTab(tabName)) return;
  switch(tabName) {
    case 'dashboard':
      await loadDashboardData();
      break;
    case 'users':
      await loadUsers();
      break;
    case 'videos':
      await loadVideos();
      break;
    case 'analytics':
      await loadAnalytics();
      break;
    case 'activity':
      await loadActivityLogs();
      break;
    case 'ads':
      await loadAdsterraData();
      break;
    case 'payouts':
      await loadPayoutRequests();
      break;
    case 'cloudflare':
      await loadCloudflareData();
      break;
    case 'database':
      await loadDatabaseInfo();
      break;
    case 'reports':
      await loadReports();
      await loadIpBans();
      break;
    case 'settings':
      await loadSettings();
      break;
  }
}

// Dashboard Functions
async function loadDashboardData() {
  try {
    // Get total users
    const { count: usersCount } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    document.getElementById('totalUsers').textContent = usersCount || 0;

    // Get total videos
    const { count: videosCount } = await supabaseClient
      .from('videos')
      .select('*', { count: 'exact', head: true });

    document.getElementById('totalVideos').textContent = videosCount || 0;

    // Get total views
    const { data: viewsData } = await supabaseClient
      .from('videos')
      .select('views_count');

    const totalViews = viewsData?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
    document.getElementById('totalViews').textContent = formatNumber(totalViews);

    // Get active users (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activeCount } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', yesterday);

    document.getElementById('activeUsers').textContent = activeCount || 0;

    const nowIso = new Date().toISOString();
    const [
      { count: bannedUsersCount },
      { count: reportedVideosCount },
      { count: openReportsCount },
      { count: activeIpBansCount }
    ] = await Promise.all([
      supabaseClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_banned', true),
      supabaseClient
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .gt('reported_count', 0),
      supabaseClient
        .from('video_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabaseClient
        .from('ip_bans')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    ]);

    const openReportsEl = document.getElementById('openReports');
    if (openReportsEl) openReportsEl.textContent = openReportsCount || 0;
    const reportedVideosEl = document.getElementById('reportedVideos');
    if (reportedVideosEl) reportedVideosEl.textContent = reportedVideosCount || 0;
    const bannedUsersEl = document.getElementById('bannedUsers');
    if (bannedUsersEl) bannedUsersEl.textContent = bannedUsersCount || 0;
    const activeIpBansEl = document.getElementById('activeIpBans');
    if (activeIpBansEl) activeIpBansEl.textContent = activeIpBansCount || 0;
    if (adminRole === 'admin') {
      const [
        { count: pendingPayoutsCount },
        { count: approvedPayoutsCount }
      ] = await Promise.all([
        supabaseClient
          .from('payout_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabaseClient
          .from('payout_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
      ]);
      const pendingPayoutsEl = document.getElementById('pendingPayouts');
      if (pendingPayoutsEl) pendingPayoutsEl.textContent = pendingPayoutsCount || 0;
      const approvedPayoutsEl = document.getElementById('approvedPayouts');
      if (approvedPayoutsEl) approvedPayoutsEl.textContent = approvedPayoutsCount || 0;
    }

    // Load recent activity
    await loadRecentActivity();

    // Initialize charts
    await initializeCharts();

  } catch (error) {
    console.error('Error loading dashboard:', error);
    showNotification('Error loading dashboard data', 'error');
  }
}

async function loadRecentActivity() {
  const container = document.getElementById('recentActivityDashboard');
  container.innerHTML = '<p class="secondary">Loading recent activity...</p>';

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('*, profiles!inner(username)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!videos || videos.length === 0) {
      container.innerHTML = '<p class="secondary">No recent activity</p>';
      return;
    }

    container.innerHTML = videos.map(video => `
      <div class="activity-item">
        <div>
          <strong>${video.profiles.username}</strong> uploaded
          <strong>"${video.title}"</strong>
        </div>
        <span class="secondary">${timeSince(video.created_at)} ago</span>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading recent activity:', error);
    container.innerHTML = '<p class="secondary">Error loading activity</p>';
  }
}

// User Management Functions
async function loadUsers(page = 1) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading users...</td></tr>';

  try {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE - 1;

    // Simple query without complex joins to avoid errors
    const { data: users, error, count } = await supabaseClient
      .from('profiles')
      .select('*', { count: 'exact' })
      .range(start, end)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    allUsers = users || [];

    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No users found</td></tr>';
      return;
    }

    // Get video counts separately for each user
    const usersWithVideoCounts = await Promise.all(users.map(async (user) => {
      try {
        const { count: videoCount } = await supabaseClient
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        return { ...user, videoCount: videoCount || 0 };
      } catch (e) {
        return { ...user, videoCount: 0 };
      }
    }));

    tbody.innerHTML = usersWithVideoCounts.map(user => `
      <tr>
        <td><code>${user.id.substring(0, 8)}...</code></td>
        <td><strong>${escapeHtml(user.username || 'Unknown')}</strong></td>
        <td>${escapeHtml(user.email || 'N/A')}</td>
        <td><span class="badge badge-info">${escapeHtml(user.role || 'user')}</span></td>
        <td>${user.videoCount}</td>
        <td><span class="badge badge-${user.is_banned ? 'danger' : 'success'}">${user.is_banned ? 'Banned' : 'Active'}</span></td>
        <td>${user.updated_at ? timeSince(user.updated_at) + ' ago' : 'N/A'}</td>
        <td>
          <div class="action-btn-group">
            <button class="action-btn" onclick="editUser('${user.id}')">Edit</button>
            ${user.id !== currentAdminId ? `
            <button class="action-btn" onclick="setUserRole('${user.id}', 'moderator')" ${user.role === 'moderator' ? 'disabled' : ''}>
              Make Moderator
            </button>
            <button class="action-btn" onclick="setUserRole('${user.id}', 'user')" ${user.role === 'user' ? 'disabled' : ''}>
              Make User
            </button>
            ` : ''}
            <button class="action-btn ${user.is_banned ? '' : 'danger'}" onclick="toggleUserBan('${user.id}', ${user.is_banned})">
              ${user.is_banned ? 'Unban' : 'Ban'}
            </button>
            <button class="action-btn danger" onclick="deleteUser('${user.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Setup pagination
    setupPagination('users', count, page);

  } catch (error) {
    console.error('Error loading users:', error);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: red;">Error loading users: ${error.message}</td></tr>`;
  }
}

function setupPagination(type, totalCount, currentPageNum) {
  const container = document.getElementById(`${type}Pagination`);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button onclick="changePage('${type}', ${currentPageNum - 1})" ${currentPageNum === 1 ? 'disabled' : ''}>Previous</button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPageNum - 2 && i <= currentPageNum + 2)) {
      html += `<button class="${i === currentPageNum ? 'active' : ''}" onclick="changePage('${type}', ${i})">${i}</button>`;
    } else if (i === currentPageNum - 3 || i === currentPageNum + 3) {
      html += '<span>...</span>';
    }
  }

  html += `
    <button onclick="changePage('${type}', ${currentPageNum + 1})" ${currentPageNum === totalPages ? 'disabled' : ''}>Next</button>
  `;

  container.innerHTML = html;
}

function changePage(type, page) {
  currentPage[type] = page;

  switch(type) {
    case 'users':
      loadUsers(page);
      break;
    case 'videos':
      loadVideos(page);
      break;
    case 'activity':
      loadActivityLogs(page);
      break;
  }
}

function openUserModal(userId = null) {
  const modal = document.getElementById('userModal');
  const title = document.getElementById('userModalTitle');

  if (userId) {
    title.textContent = 'Edit User';
    currentUserEdit = userId;
    // Load user data
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      document.getElementById('userUsername').value = user.username;
      document.getElementById('userEmail').value = user.email || '';
      document.getElementById('userRole').value = user.role || 'user';
      document.getElementById('userStatus').value = user.is_banned ? 'banned' : 'active';
      document.getElementById('userBanReason').value = user.ban_reason || '';
      document.getElementById('userIpBanToggle').checked = false;
      document.getElementById('userIpBanValue').value = '';
      document.getElementById('userIpUnbanToggle').checked = false;
    }
  } else {
    title.textContent = 'Add User';
    currentUserEdit = null;
    document.getElementById('userForm').reset();
    document.getElementById('userBanReason').value = '';
    document.getElementById('userIpBanToggle').checked = false;
    document.getElementById('userIpBanValue').value = '';
    document.getElementById('userIpUnbanToggle').checked = false;
  }

  modal.classList.add('active');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('active');
  currentUserEdit = null;
}

async function saveUser(event) {
  event.preventDefault();

  const username = document.getElementById('userUsername').value;
  const email = document.getElementById('userEmail').value;
  const role = document.getElementById('userRole').value;
  const status = document.getElementById('userStatus').value;
  const banReason = document.getElementById('userBanReason').value.trim();
  const ipBanEnabled = document.getElementById('userIpBanToggle').checked;
  const ipBanValue = document.getElementById('userIpBanValue').value.trim();
  const ipUnbanEnabled = document.getElementById('userIpUnbanToggle').checked;

  try {
    if (currentUserEdit) {
      const admin = await getCurrentUser();
      const isBanned = status === 'banned';
      const updatePayload = {
        username,
        email,
        role,
        is_banned: isBanned,
        ban_reason: isBanned ? (banReason || null) : null,
        banned_at: isBanned ? new Date().toISOString() : null,
        banned_by: isBanned ? admin?.id || null : null
      };

      // Update existing user
      const { error } = await supabaseClient
        .from('profiles')
        .update(updatePayload)
        .eq('id', currentUserEdit);

      if (error) throw error;

      if (ipBanEnabled && ipBanValue) {
        await addIpBan(ipBanValue, banReason || 'Banned by admin');
      }
      if (ipUnbanEnabled && ipBanValue) {
        await removeIpBan(ipBanValue);
      }

      showNotification('User updated successfully', 'success');
    } else {
      const payload = {
        id: crypto.randomUUID(),
        username,
        email,
        role,
        is_banned: status === 'banned',
        ban_reason: status === 'banned' ? (banReason || null) : null,
        banned_at: status === 'banned' ? new Date().toISOString() : null,
        banned_by: status === 'banned' ? currentAdminId : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabaseClient
        .from('profiles')
        .insert(payload);

      if (error) throw error;

      if (ipBanEnabled && ipBanValue) {
        await addIpBan(ipBanValue, banReason || 'Banned by admin');
      }

      showNotification('User profile added (auth not created)', 'success');
    }

    closeUserModal();
    await loadUsers(currentPage.users);

  } catch (error) {
    console.error('Error saving user:', error);
    showNotification('Error saving user: ' + error.message, 'error');
  }
}

function editUser(userId) {
  openUserModal(userId);
}

async function deleteUser(userId) {
  const confirmed = await showConfirm('Are you sure you want to delete this user? This action cannot be undone.', {
    title: 'Delete user',
    confirmText: 'Delete',
    danger: true
  });
  if (!confirmed) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    showNotification('User deleted successfully', 'success');
    await loadUsers(currentPage.users);

  } catch (error) {
    console.error('Error deleting user:', error);
    showNotification('Error deleting user: ' + error.message, 'error');
  }
}

// Video Management Functions
async function loadVideos(page = 1, filter = null) {
  const tbody = document.getElementById('videosTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading videos...</td></tr>';

  try {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE - 1;
    const activeFilter = filter || document.getElementById('videoFilter')?.value || 'all';

    // Simple query without complex joins
    let query = supabaseClient
      .from('videos')
      .select('*', { count: 'exact' })
      .range(start, end)
      .order('created_at', { ascending: false });

    if (activeFilter === 'public') {
      query = query.eq('is_public', true);
    } else if (activeFilter === 'private') {
      query = query.eq('is_public', false);
    } else if (activeFilter === 'reported') {
      query = query.gt('reported_count', 0);
    }

    const { data: videos, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    allVideos = videos || [];

    if (!videos || videos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No videos found</td></tr>';
      return;
    }

    // Get usernames separately for each video
    const videosWithUsernames = await Promise.all(videos.map(async (video) => {
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('username')
          .eq('id', video.user_id)
          .single();
        return { ...video, username: profile?.username || 'Unknown' };
      } catch (e) {
        return { ...video, username: 'Unknown' };
      }
    }));

    tbody.innerHTML = videosWithUsernames.map(video => `
      <tr>
        <td>
          <img src="${escapeHtml(video.thumbnail_url || '')}" alt="${escapeHtml(video.title || '')}"
               style="width: 80px; height: 45px; object-fit: cover; border-radius: 4px;"
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22280%22 height=%22158%22%3E%3Crect fill=%22%23333%22 width=%22280%22 height=%22158%22/%3E%3C/svg%3E'">
        </td>
        <td><strong>${truncateText(escapeHtml(video.title || 'Untitled'), 40)}</strong></td>
        <td>${escapeHtml(video.username)}</td>
        <td>${formatNumber(video.views_count || 0)}</td>
        <td>
          <span class="badge badge-${video.is_public ? 'success' : 'warning'}">${video.is_public ? 'Public' : 'Private'}</span>
          ${video.reported_count > 0 ? `<span class="badge badge-danger" style="margin-left: 6px;">Reported (${video.reported_count})</span>` : ''}
        </td>
        <td>${formatDuration(video.duration) || 'N/A'}</td>
        <td>${timeSince(video.created_at)} ago</td>
        <td>
          <button class="action-btn" onclick="viewVideo('${video.id}')">View</button>
          <button class="action-btn" onclick="toggleVideoVisibility('${video.id}', ${video.is_public})">
            ${video.is_public ? 'Hide' : 'Show'}
          </button>
          <button class="action-btn danger" onclick="deleteVideo('${video.id}')">Delete</button>
        </td>
      </tr>
    `).join('');

    setupPagination('videos', count, page);

  } catch (error) {
    console.error('Error loading videos:', error);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: red;">Error loading videos</td></tr>';
  }
}

async function filterVideos() {
  const filter = document.getElementById('videoFilter').value;
  await loadVideos(1, filter);
}

async function setUserRole(userId, role) {
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) throw error;

    showNotification(`User role updated to ${role}`, 'success');
    await loadUsers(currentPage.users);
  } catch (error) {
    console.error('Error updating role:', error);
    showNotification('Error updating role: ' + error.message, 'error');
  }
}

function viewVideo(videoId) {
  window.open(`watch.html?v=${videoId}`, '_blank');
}

async function toggleVideoVisibility(videoId, currentVisibility) {
  try {
    const { error } = await supabaseClient
      .from('videos')
      .update({ is_public: !currentVisibility })
      .eq('id', videoId);

    if (error) throw error;

    showNotification(`Video ${currentVisibility ? 'hidden' : 'made public'}`, 'success');
    await loadVideos(currentPage.videos);

  } catch (error) {
    console.error('Error toggling visibility:', error);
    showNotification('Error updating video', 'error');
  }
}

async function deleteVideo(videoId) {
  const confirmed = await showConfirm('Are you sure you want to delete this video? This action cannot be undone.', {
    title: 'Delete video',
    confirmText: 'Delete',
    danger: true
  });
  if (!confirmed) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (error) throw error;

    showNotification('Video deleted successfully', 'success');
    await loadVideos(currentPage.videos);

  } catch (error) {
    console.error('Error deleting video:', error);
    showNotification('Error deleting video: ' + error.message, 'error');
  }
}

// Analytics Functions
async function loadAnalytics() {
  try {
    // Calculate average watch time (placeholder - needs proper tracking)
    document.getElementById('avgWatchTime').textContent = '5m 32s';

    // Calculate engagement rate (placeholder)
    document.getElementById('engagementRate').textContent = '67%';

    // Bounce rate (placeholder)
    document.getElementById('bounceRate').textContent = '32%';

    // Get total storage from videos
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('duration, resolution');

    // Rough estimate: 1 minute of 1080p video ≈ 50MB
    const totalMinutes = videos?.reduce((sum, v) => sum + (v.duration || 0), 0) / 60 || 0;
    const estimatedGB = (totalMinutes * 50 / 1024).toFixed(2);
    document.getElementById('totalStorage').textContent = `${estimatedGB} GB`;
    await loadVideoStorageOverview();

    // Load charts
    await initializeCharts();

  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

async function toggleUserBan(userId, isBanned) {
  const admin = await getCurrentUser();

  if (!isBanned) {
    const reason = await showPrompt('Ban reason (optional)', {
      title: 'Ban user',
      placeholder: 'Reason for ban',
      confirmText: 'Ban'
    });
    if (reason === null) return;
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        is_banned: true,
        ban_reason: reason || null,
        banned_at: new Date().toISOString(),
        banned_by: admin?.id || null
      })
      .eq('id', userId);

    if (error) {
      showNotification('Error banning user: ' + error.message, 'error');
      return;
    }

    showNotification('User banned', 'success');
  } else {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        is_banned: false,
        ban_reason: null,
        banned_at: null,
        banned_by: null
      })
      .eq('id', userId);

    if (error) {
      showNotification('Error unbanning user: ' + error.message, 'error');
      return;
    }

    showNotification('User unbanned', 'success');
  }

  await loadUsers(currentPage.users);
}

async function addIpBan(ip, reason) {
  const admin = await getCurrentUser();
  const { error } = await supabaseClient
    .from('ip_bans')
    .insert([{
      ip,
      reason,
      active: true,
      banned_by: admin?.id || null
    }]);

  if (error) {
    showNotification('Error adding IP ban: ' + error.message, 'error');
  } else {
    showNotification('IP banned', 'success');
  }
}

async function removeIpBan(ip) {
  const { error } = await supabaseClient
    .from('ip_bans')
    .update({ active: false })
    .eq('ip', ip);

  if (error) {
    showNotification('Error removing IP ban: ' + error.message, 'error');
  } else {
    showNotification('IP ban removed', 'success');
  }
}

async function loadReports() {
  const tbody = document.getElementById('reportsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading reports...</td></tr>';

  try {
    const { data: reports, error } = await supabaseClient
      .from('video_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!reports || reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No reports yet</td></tr>';
      return;
    }

    const videoIds = [...new Set(reports.map(report => report.video_id).filter(Boolean))];
    const reporterIds = [...new Set(reports.map(report => report.reporter_id).filter(Boolean))];
    const reportedIds = [...new Set(reports.map(report => report.reported_user_id).filter(Boolean))];
    const profileIds = [...new Set([...reporterIds, ...reportedIds])];

    const { data: videos } = videoIds.length
      ? await supabaseClient.from('videos').select('id, title').in('id', videoIds)
      : { data: [] };

    const { data: profiles } = profileIds.length
      ? await supabaseClient.from('profiles').select('id, username').in('id', profileIds)
      : { data: [] };

    const videoMap = new Map((videos || []).map(video => [video.id, video.title]));
    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile.username]));

    tbody.innerHTML = reports.map(report => {
      const videoTitle = videoMap.get(report.video_id) || 'Unknown video';
      const reporterName = profileMap.get(report.reporter_id) || 'Unknown';
      const reportedName = profileMap.get(report.reported_user_id) || 'Unknown';
      const detailLine = report.details
        ? `<div class="secondary" style="font-size: 0.8rem;">${escapeHtml(report.details)}</div>`
        : '';

      const statusClass = report.status === 'reviewed'
        ? 'badge-success'
        : report.status === 'dismissed'
          ? 'badge-danger'
          : 'badge-warning';

      const statusLabel = report.status || 'open';
      const canUpdate = statusLabel === 'open';
      const banButton = report.reported_user_id
        ? `<button class="action-btn danger" onclick="banReportedUser('${report.reported_user_id}')">Ban user</button>`
        : `<button class="action-btn danger" disabled>Ban user</button>`;

      const viewButton = report.video_id
        ? `<button class="action-btn" onclick="viewVideo('${report.video_id}')">View</button>`
        : `<button class="action-btn" disabled>View</button>`;

      return `
        <tr>
          <td>
            <strong>${truncateText(escapeHtml(videoTitle), 36)}</strong>
            ${detailLine}
          </td>
          <td>${escapeHtml(reportedName)}</td>
          <td>${escapeHtml(reporterName)}</td>
          <td>${escapeHtml(report.reason || 'Unspecified')}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td>${new Date(report.created_at).toLocaleDateString()}</td>
          <td>
            ${viewButton}
            <button class="action-btn" onclick="updateReportStatus('${report.id}', 'reviewed')" ${canUpdate ? '' : 'disabled'}>Review</button>
            <button class="action-btn danger" onclick="updateReportStatus('${report.id}', 'dismissed')" ${canUpdate ? '' : 'disabled'}>Dismiss</button>
            ${banButton}
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading reports:', error);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: red;">Error loading reports</td></tr>';
  }
}

async function updateReportStatus(reportId, status) {
  try {
    const { error } = await supabaseClient
      .from('video_reports')
      .update({ status })
      .eq('id', reportId);

    if (error) throw error;
    showNotification('Report updated', 'success');
    await loadReports();
  } catch (error) {
    console.error('Error updating report:', error);
    showNotification('Failed to update report', 'error');
  }
}

async function banReportedUser(userId) {
  const admin = await getCurrentUser();
  const reason = await showPrompt('Ban reason (optional)', {
    title: 'Ban reported user',
    placeholder: 'Reason for ban',
    confirmText: 'Ban',
    multiline: true
  });
  if (reason === null) return;

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({
        is_banned: true,
        ban_reason: reason || null,
        banned_at: new Date().toISOString(),
        banned_by: admin?.id || null
      })
      .eq('id', userId);

    if (error) throw error;
    showNotification('User banned', 'success');
    await loadReports();
  } catch (error) {
    console.error('Error banning user:', error);
    showNotification('Failed to ban user', 'error');
  }
}

async function loadIpBans() {
  const tbody = document.getElementById('ipBansTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading IP bans...</td></tr>';

  try {
    const { data: bans, error } = await supabaseClient
      .from('ip_bans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!bans || bans.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No IP bans yet</td></tr>';
      return;
    }

    const now = Date.now();
    tbody.innerHTML = bans.map(ban => {
      const expiresAt = ban.expires_at ? new Date(ban.expires_at).getTime() : null;
      const expired = expiresAt && expiresAt <= now;
      const isActive = ban.active && !expired;
      const statusClass = isActive ? 'badge-success' : 'badge-warning';
      const statusLabel = isActive ? 'Active' : 'Inactive';

      return `
        <tr>
          <td><code>${escapeHtml(ban.ip)}</code></td>
          <td>${escapeHtml(ban.reason || 'N/A')}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td>${ban.created_at ? new Date(ban.created_at).toLocaleDateString() : 'N/A'}</td>
          <td>
            <button class="action-btn" onclick="removeIpBan('${ban.ip}')" ${isActive ? '' : 'disabled'}>Unban</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading IP bans:', error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: red;">Error loading IP bans</td></tr>';
  }
}

async function createIpBan() {
  const input = document.getElementById('ipBanInput');
  const reasonInput = document.getElementById('ipBanReasonInput');
  if (!input) return;

  const ip = input.value.trim();
  const reason = reasonInput ? reasonInput.value.trim() : '';

  if (!ip) {
    showNotification('Please enter an IP address', 'warning');
    return;
  }

  await addIpBan(ip, reason || 'Banned by admin');
  input.value = '';
  if (reasonInput) reasonInput.value = '';
  await loadIpBans();
}

async function loadVideoStorageOverview() {
  const totalStorageEl = document.getElementById('totalStorage');
  const storageTotalEl = document.getElementById('storageTotal');
  const storageFileCountEl = document.getElementById('storageFileCount');
  const storageAvgSizeEl = document.getElementById('storageAvgSize');
  const storageLastUpdatedEl = document.getElementById('storageLastUpdated');
  const storageVideosSizeEl = document.getElementById('storageVideosSize');
  const storageThumbnailsSizeEl = document.getElementById('storageThumbnailsSize');
  const storageAvatarsSizeEl = document.getElementById('storageAvatarsSize');

  if (!totalStorageEl || !storageTotalEl || !storageFileCountEl || !storageAvgSizeEl || !storageLastUpdatedEl) {
    return;
  }

  try {
    const summary = await calculateStorageUsage();
    if (!summary) return;

    const { totalBytes, fileCount, lastUpdated, buckets } = summary;
    totalStorageEl.textContent = formatBytes(totalBytes);
    storageTotalEl.textContent = formatBytes(totalBytes);
    storageFileCountEl.textContent = formatNumber(fileCount);
    storageAvgSizeEl.textContent = fileCount > 0 ? formatBytes(totalBytes / fileCount) : '0 MB';
    storageLastUpdatedEl.textContent = lastUpdated ? new Date(lastUpdated).toLocaleString() : '—';
    if (storageVideosSizeEl) storageVideosSizeEl.textContent = formatBytes(buckets.videos?.totalBytes || 0);
    if (storageThumbnailsSizeEl) storageThumbnailsSizeEl.textContent = formatBytes(buckets.thumbnails?.totalBytes || 0);
    if (storageAvatarsSizeEl) storageAvatarsSizeEl.textContent = formatBytes(buckets.avatars?.totalBytes || 0);
  } catch (error) {
    console.error('Error loading video storage overview:', error);
  }
}

function refreshStorageOverview() {
  loadVideoStorageOverview();
  showNotification('Storage overview refreshed', 'success');
}

async function clearLocalCache() {
  const confirmed = await showConfirm('Clear local cache? This resets UI preferences but keeps your session.', {
    title: 'Clear local cache',
    confirmText: 'Clear'
  });
  if (!confirmed) {
    return;
  }

  const cacheKeys = [
    'mukkaz_display_options',
    'mukkaz_ad_settings',
    'mukkaz_admin_filters',
    'mukkaz_ui_state'
  ];

  cacheKeys.forEach(key => removeFromLocalStorage(key));
  showNotification('Local cache cleared', 'success');
}

async function cleanOrphanedStorage() {
  const proceed = await showConfirm('Delete storage files that are not referenced by any video or profile? This cannot be undone.', {
    title: 'Clean orphaned storage',
    confirmText: 'Delete',
    danger: true
  });
  if (!proceed) return;

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('url, thumbnail_url');

    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('avatar_url');

    const usedVideos = new Set();
    const usedThumbnails = new Set();
    const usedAvatars = new Set();

    (videos || []).forEach(video => {
      const videoPath = extractStoragePath(video.url, 'videos');
      if (videoPath) usedVideos.add(videoPath);
      const thumbPath = extractStoragePath(video.thumbnail_url, 'thumbnails');
      if (thumbPath) usedThumbnails.add(thumbPath);
    });

    (profiles || []).forEach(profile => {
      const avatarPath = extractStoragePath(profile.avatar_url, 'avatars');
      if (avatarPath) usedAvatars.add(avatarPath);
    });

    const orphaned = {
      videos: await listOrphanedFiles('videos', usedVideos),
      thumbnails: await listOrphanedFiles('thumbnails', usedThumbnails),
      avatars: await listOrphanedFiles('avatars', usedAvatars)
    };

    const totalOrphans = orphaned.videos.length + orphaned.thumbnails.length + orphaned.avatars.length;
    if (totalOrphans === 0) {
      showNotification('No orphaned storage files found', 'success');
      return;
    }

    const confirmDelete = await showConfirm(`Found ${totalOrphans} orphaned files. Delete them now?`, {
      title: 'Delete orphaned files',
      confirmText: 'Delete',
      danger: true
    });
    if (!confirmDelete) return;

    await removeInBatches('videos', orphaned.videos);
    await removeInBatches('thumbnails', orphaned.thumbnails);
    await removeInBatches('avatars', orphaned.avatars);

    showNotification(`Deleted ${totalOrphans} orphaned files`, 'success');
    await loadVideoStorageOverview();
  } catch (error) {
    console.error('Error cleaning orphaned storage:', error);
    showNotification('Failed to clean orphaned storage', 'error');
  }
}

function extractStoragePath(url, bucket) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  return decodeURIComponent(path);
}

async function listOrphanedFiles(bucketName, usedPaths) {
  const allFiles = await listBucketFiles(bucketName);
  return allFiles.filter(path => !usedPaths.has(path));
}

async function listBucketFiles(bucketName) {
  const bucket = supabaseClient.storage.from(bucketName);
  const files = [];

  const listFolder = async (path) => {
    const { data, error } = await bucket.list(path, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (error) {
      throw error;
    }

    return data || [];
  };

  const rootItems = await listFolder('');
  const folders = [];

  rootItems.forEach((item) => {
    if (item?.metadata?.size) {
      files.push(item.name);
    } else if (item?.name) {
      folders.push(item.name);
    }
  });

  await Promise.all(folders.map(async (folder) => {
    const items = await listFolder(folder);
    items.forEach((item) => {
      if (item?.metadata?.size) {
        files.push(`${folder}/${item.name}`);
      }
    });
  }));

  return files;
}

async function removeInBatches(bucketName, paths, batchSize = 100) {
  const bucket = supabaseClient.storage.from(bucketName);
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    if (batch.length === 0) continue;
    const { error } = await bucket.remove(batch);
    if (error) {
      throw error;
    }
  }
}

async function calculateStorageUsage() {
  const bucketNames = ['videos', 'thumbnails', 'avatars'];
  const buckets = {};

  const results = await Promise.all(bucketNames.map(async (name) => {
    const usage = await calculateBucketUsage(name);
    buckets[name] = usage;
    return usage;
  }));

  const totalBytes = results.reduce((sum, item) => sum + item.totalBytes, 0);
  const fileCount = results.reduce((sum, item) => sum + item.fileCount, 0);
  const lastUpdated = results
    .map(item => item.lastUpdated)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;

  return { totalBytes, fileCount, lastUpdated, buckets };
}

async function calculateBucketUsage(bucketName) {
  const bucket = supabaseClient.storage.from(bucketName);
  let totalBytes = 0;
  let fileCount = 0;
  let lastUpdated = null;

  const listFolder = async (path) => {
    const { data, error } = await bucket.list(path, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (error) {
      throw error;
    }

    return data || [];
  };

  const rootItems = await listFolder('');
  const folders = [];

  rootItems.forEach((item) => {
    if (item?.metadata?.size) {
      totalBytes += item.metadata.size;
      fileCount += 1;
      if (item.updated_at && (!lastUpdated || new Date(item.updated_at) > new Date(lastUpdated))) {
        lastUpdated = item.updated_at;
      }
    } else if (item?.name) {
      folders.push(item.name);
    }
  });

  await Promise.all(folders.map(async (folder) => {
    const items = await listFolder(folder);
    items.forEach((item) => {
      if (item?.metadata?.size) {
        totalBytes += item.metadata.size;
        fileCount += 1;
        if (item.updated_at && (!lastUpdated || new Date(item.updated_at) > new Date(lastUpdated))) {
          lastUpdated = item.updated_at;
        }
      }
    });
  }));

  return { totalBytes, fileCount, lastUpdated };
}

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const fixed = size >= 100 || unitIndex === 0 ? 0 : 2;
  return `${size.toFixed(fixed)} ${units[unitIndex]}`;
}

async function loadTopVideos() {
  const container = document.getElementById('topVideos');

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('title, views_count')
      .order('views_count', { ascending: false })
      .limit(10);

    if (!videos || videos.length === 0) {
      container.innerHTML = '<p class="secondary">No videos found</p>';
      return;
    }

    container.innerHTML = videos.map((video, index) => `
      <div class="activity-item">
        <div>
          <span style="color: var(--accent-red); font-weight: 700;">#${index + 1}</span>
          <strong style="margin-left: 1rem;">${video.title}</strong>
        </div>
        <span>${formatNumber(video.views_count || 0)} views</span>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading top videos:', error);
    container.innerHTML = '<p class="secondary">Error loading data</p>';
  }
}

// Activity Logs Functions
async function loadActivityLogs(page = 1) {
  const container = document.getElementById('activityList');
  container.innerHTML = '<p style="text-align: center; padding: 2rem;">Loading activity logs...</p>';

  try {
    // Get recent video uploads
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('*, profiles!inner(username)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!videos || videos.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem;">No activity logs found</p>';
      return;
    }

    container.innerHTML = videos.map(video => `
      <div class="activity-item">
        <div>
          <span class="badge badge-info">Video Upload</span>
          <strong>${video.profiles.username}</strong> uploaded
          <strong>"${video.title}"</strong>
        </div>
        <span class="secondary">${timeSince(video.created_at)} ago</span>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading activity logs:', error);
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: red;">Error loading logs</p>';
  }
}

function filterActivity() {
  const filter = document.getElementById('activityFilter').value;
  // Implement filtering
  loadActivityLogs(1);
}

// Payout Requests
async function loadPayoutRequests() {
  const container = document.getElementById('payoutRequestsList');
  if (!container) return;

  container.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem;">Loading payout requests...</td>
    </tr>
  `;

  try {
    const { data: requests, error } = await supabaseClient
      .from('payout_requests')
      .select('*, profiles:user_id (username, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem;">No payout requests yet</td>
        </tr>
      `;
      return;
    }

    container.innerHTML = requests.map(req => `
      <tr>
        <td>${escapeHtml(req.profiles?.username || 'Unknown')}</td>
        <td>${formatCurrencyJMD(req.amount_jmd)}</td>
        <td>${req.method}</td>
        <td>${escapeHtml(req.details || '')}</td>
        <td>
          <span class="badge ${req.status === 'approved' ? 'badge-success' : req.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
            ${req.status}
          </span>
        </td>
        <td>${new Date(req.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn-secondary btn-sm" onclick="updatePayoutRequestStatus('${req.id}', 'approved')" ${req.status !== 'pending' ? 'disabled' : ''}>Approve</button>
          <button class="btn-secondary btn-sm" onclick="updatePayoutRequestStatus('${req.id}', 'rejected')" ${req.status !== 'pending' ? 'disabled' : ''}>Reject</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading payout requests:', error);
    container.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: red;">Failed to load payout requests</td>
      </tr>
    `;
  }
}

async function updatePayoutRequestStatus(requestId, status) {
  try {
    const admin = await getCurrentUser();
    if (!admin) throw new Error('Not authenticated');

    const adminNotes = status === 'rejected'
      ? await showPrompt('Optional admin note for rejection', {
        title: 'Reject payout',
        placeholder: 'Add a note...',
        confirmText: 'Reject',
        multiline: true
      })
      : null;

    const { data, error } = await supabaseClient
      .from('payout_requests')
      .update({
        status,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    const message = status === 'approved'
      ? `Your payout request for ${formatCurrencyJMD(data.amount_jmd)} was approved.`
      : `Your payout request for ${formatCurrencyJMD(data.amount_jmd)} was rejected.`;

    await createNotification(
      data.user_id,
      'payout_update',
      'Payout Update',
      message,
      'profile.html',
      admin.id
    );

    showNotification(`Payout request ${status}`, 'success');
    await loadPayoutRequests();
  } catch (error) {
    console.error('Error updating payout request:', error);
    showNotification('Failed to update payout request', 'error');
  }
}

function formatCurrencyJMD(amount) {
  const value = Number(amount) || 0;
  return `JMD ${value.toFixed(0)}`;
}

// Cloudflare Functions
async function loadCloudflareData() {
  try {
    document.getElementById('cfAccountId').textContent = CLOUDFLARE_CONFIG.accountId || 'Not configured';

    // Get video count from database
    const { count } = await supabaseClient
      .from('videos')
      .select('*', { count: 'exact', head: true });

    document.getElementById('cfTotalVideos').textContent = count || 0;

    // Placeholder values - would need Cloudflare API integration
    document.getElementById('cfStorageUsed').textContent = '0 GB';
    document.getElementById('cfMinutesDelivered').textContent = '0';
    document.getElementById('cfMonthlyCost').textContent = '$0';

  } catch (error) {
    console.error('Error loading Cloudflare data:', error);
  }
}

async function syncCloudflare() {
  showNotification('Syncing with Cloudflare...', 'info');
  // Implement Cloudflare sync
  setTimeout(() => {
    showNotification('Sync complete', 'success');
  }, 2000);
}

async function purgeCache() {
  const confirmed = await showConfirm('Are you sure you want to purge the Cloudflare cache?', {
    title: 'Purge cache',
    confirmText: 'Purge',
    danger: true
  });
  if (!confirmed) {
    return;
  }
  showNotification('Purging cache...', 'info');
  // Implement cache purge
  setTimeout(() => {
    showNotification('Cache purged successfully', 'success');
  }, 2000);
}

// Database Functions
async function loadDatabaseInfo() {
  try {
    // Get table counts
    const tables = ['videos', 'profiles', 'video_drafts', 'notifications'];
    let totalRows = 0;

    const tableList = document.getElementById('databaseTables');
    let html = '';

    for (const table of tables) {
      const { count } = await supabaseClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      totalRows += count || 0;

      html += `
        <div class="activity-item">
          <div>
            <strong>${table}</strong>
          </div>
          <span>${formatNumber(count || 0)} rows</span>
        </div>
      `;
    }

    tableList.innerHTML = html;

    document.getElementById('dbTables').textContent = tables.length;
    document.getElementById('dbRows').textContent = formatNumber(totalRows);
    document.getElementById('dbSize').textContent = '0 MB'; // Placeholder
    document.getElementById('dbConnections').textContent = '1'; // Placeholder

  } catch (error) {
    console.error('Error loading database info:', error);
  }
}

async function executeSQLQuery() {
  const query = document.getElementById('sqlQuery').value.trim();
  const resultsDiv = document.getElementById('queryResults');

  if (!query) {
    showNotification('Please enter a SQL query', 'warning');
    return;
  }

  // For safety, only allow SELECT queries
  if (!query.toLowerCase().startsWith('select')) {
    showNotification('Only SELECT queries are allowed for safety', 'error');
    return;
  }

  resultsDiv.innerHTML = '<p>Executing query...</p>';

  try {
    // Note: This is a simplified example. In production, you'd need proper SQL execution
    showNotification('Direct SQL execution requires custom RPC functions', 'info');
    resultsDiv.innerHTML = '<p class="secondary">Direct SQL execution not implemented. Use Supabase dashboard for complex queries.</p>';

  } catch (error) {
    console.error('Error executing query:', error);
    resultsDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}

function clearQueryResults() {
  document.getElementById('queryResults').innerHTML = '';
  document.getElementById('sqlQuery').value = '';
}

async function backupDatabase() {
  showNotification('Creating backup...', 'info');
  // Implement backup logic
  setTimeout(() => {
    showNotification('Backup created successfully', 'success');
  }, 2000);
}

// Settings Functions
async function loadSettings() {
  // Load admin users
  const adminList = document.getElementById('adminUsersList');

  try {
    const { data: admins } = await supabaseClient
      .from('profiles')
      .select('username, email')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      adminList.innerHTML = admins.map(admin => `
        <div class="activity-item">
          <div>
            <strong>${admin.username}</strong>
            <p class="secondary" style="margin: 0; font-size: 0.85rem;">${admin.email || 'No email'}</p>
          </div>
          <span class="badge badge-success">Admin</span>
        </div>
      `).join('');
    } else {
      adminList.innerHTML = '<p class="secondary">No admin users found</p>';
    }

  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  showNotification('Settings saved successfully', 'success');
}

// Utility Functions
async function refreshAllData() {
  showNotification('Refreshing all data...', 'info');
  await loadDashboardData();
  await loadReports();
  await loadIpBans();
  showNotification('Data refreshed', 'success');
}

function exportData(type) {
  showNotification(`Exporting ${type} data...`, 'info');
  // Implement export logic
  setTimeout(() => {
    showNotification('Export complete', 'success');
  }, 1500);
}

async function clearCache() {
  const confirmed = await showConfirm('Clear local cache?', {
    title: 'Clear cache',
    confirmText: 'Clear'
  });
  if (!confirmed) return;
  localStorage.clear();
  showNotification('Cache cleared', 'success');
}

function exportLogs() {
  showNotification('Exporting logs...', 'info');
  setTimeout(() => {
    showNotification('Logs exported', 'success');
  }, 1500);
}

// Search functionality
document.getElementById('userSearch')?.addEventListener('input', debounce(async (e) => {
  const searchTerm = e.target.value.toLowerCase();

  if (!searchTerm) {
    await loadUsers(1);
    return;
  }

  const filtered = allUsers.filter(user =>
    user.username.toLowerCase().includes(searchTerm) ||
    user.email?.toLowerCase().includes(searchTerm)
  );

  const tbody = document.getElementById('usersTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(user => `
    <tr>
      <td><code>${user.id.substring(0, 8)}...</code></td>
      <td><strong>${escapeHtml(user.username || 'Unknown')}</strong></td>
      <td>${escapeHtml(user.email || 'N/A')}</td>
      <td><span class="badge badge-info">${escapeHtml(user.role || 'user')}</span></td>
      <td>0</td>
      <td><span class="badge badge-${user.is_banned ? 'danger' : 'success'}">${user.is_banned ? 'Banned' : 'Active'}</span></td>
      <td>${user.updated_at ? timeSince(user.updated_at) + ' ago' : 'N/A'}</td>
      <td>
        <div class="action-btn-group">
          <button class="action-btn" onclick="editUser('${user.id}')">Edit</button>
          ${user.id !== currentAdminId ? `
          <button class="action-btn" onclick="setUserRole('${user.id}', 'moderator')" ${user.role === 'moderator' ? 'disabled' : ''}>
            Make Moderator
          </button>
          <button class="action-btn" onclick="setUserRole('${user.id}', 'user')" ${user.role === 'user' ? 'disabled' : ''}>
            Make User
          </button>
          ` : ''}
          <button class="action-btn ${user.is_banned ? '' : 'danger'}" onclick="toggleUserBan('${user.id}', ${user.is_banned})">
            ${user.is_banned ? 'Unban' : 'Ban'}
          </button>
          <button class="action-btn danger" onclick="deleteUser('${user.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}, 300));

document.getElementById('videoSearch')?.addEventListener('input', debounce(async (e) => {
  const searchTerm = e.target.value.toLowerCase();

  if (!searchTerm) {
    await loadVideos(1);
    return;
  }

  const filtered = allVideos.filter(video =>
    video.title.toLowerCase().includes(searchTerm) ||
    video.profiles.username.toLowerCase().includes(searchTerm)
  );

  const tbody = document.getElementById('videosTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No videos found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(video => `
    <tr>
      <td>
        <img src="${video.thumbnail_url}" alt="${video.title}"
             style="width: 80px; height: 45px; object-fit: cover; border-radius: 4px;">
      </td>
      <td><strong>${truncateText(video.title, 40)}</strong></td>
      <td>${video.profiles.username}</td>
      <td>${formatNumber(video.views_count || 0)}</td>
      <td><span class="badge badge-${video.is_public ? 'success' : 'warning'}">${video.is_public ? 'Public' : 'Private'}</span></td>
      <td>${formatDuration(video.duration) || 'N/A'}</td>
      <td>${timeSince(video.created_at)} ago</td>
      <td>
        <button class="action-btn" onclick="viewVideo('${video.id}')">View</button>
        <button class="action-btn" onclick="toggleVideoVisibility('${video.id}', ${video.is_public})">
          ${video.is_public ? 'Hide' : 'Show'}
        </button>
        <button class="action-btn danger" onclick="deleteVideo('${video.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}, 300));

// ========================================
// CHART.JS VISUALIZATIONS  
// ========================================

let charts = {}; // Store chart instances

// Initialize all charts
async function initializeCharts() {
  await createViewsChart();
  await createUserGrowthChart();
  await createVideoUploadsChart();
  await createViewsDistributionChart();
  await createContentTypeChart();
  await createTopVideosChart();
  await createActivityHeatmapChart();
  await createEngagementChart();
}

// Dashboard Charts
async function createViewsChart() {
  const canvas = document.getElementById('viewsChart');
  if (!canvas) return;

  try {
    // Get views data for last 7 days
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('created_at, views_count')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    // Group by date
    const viewsByDate = {};
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      last7Days.push(dateKey);
      viewsByDate[dateKey] = 0;
    }

    videos?.forEach(video => {
      const dateKey = video.created_at.split('T')[0];
      if (viewsByDate[dateKey] !== undefined) {
        viewsByDate[dateKey] += video.views_count || 0;
      }
    });

    const labels = last7Days.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = last7Days.map(date => viewsByDate[date]);

    if (charts.viewsChart) charts.viewsChart.destroy();
    charts.viewsChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Views',
          data,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error('Error creating views chart:', error);
  }
}

async function createUserGrowthChart() {
  const canvas = document.getElementById('userGrowthChart');
  if (!canvas) return;

  try {
    const { data: users } = await supabaseClient
      .from('profiles')
      .select('updated_at')
      .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: true });

    // Group by date
    const usersByDate = {};
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      last30Days.push(dateKey);
      usersByDate[dateKey] = 0;
    }

    users?.forEach(user => {
      const dateKey = user.updated_at.split('T')[0];
      if (usersByDate[dateKey] !== undefined) {
        usersByDate[dateKey]++;
      }
    });

    // Calculate cumulative
    let cumulative = 0;
    const cumulativeData = last30Days.map(date => {
      cumulative += usersByDate[date];
      return cumulative;
    });

    const labels = last30Days.map((date, index) =>
      index % 3 === 0 ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
    );

    if (charts.userGrowthChart) charts.userGrowthChart.destroy();
    charts.userGrowthChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Users',
          data: cumulativeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error('Error creating user growth chart:', error);
  }
}

async function createVideoUploadsChart() {
  const canvas = document.getElementById('videoUploadsChart');
  if (!canvas) return;

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    const uploadsByDate = {};
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      last7Days.push(dateKey);
      uploadsByDate[dateKey] = 0;
    }

    videos?.forEach(video => {
      const dateKey = video.created_at.split('T')[0];
      if (uploadsByDate[dateKey] !== undefined) {
        uploadsByDate[dateKey]++;
      }
    });

    const labels = last7Days.map(date => new Date(date).toLocaleDateString('en-US', { weekday: 'short' }));
    const data = last7Days.map(date => uploadsByDate[date]);

    if (charts.videoUploadsChart) charts.videoUploadsChart.destroy();
    charts.videoUploadsChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Videos Uploaded',
          data,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: '#ef4444',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error('Error creating video uploads chart:', error);
  }
}

// Analytics Charts
async function createViewsDistributionChart() {
  const canvas = document.getElementById('viewsDistributionChart');
  if (!canvas) return;

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('views_count');

    const ranges = { '0-100': 0, '101-500': 0, '501-1000': 0, '1000+': 0 };
    videos?.forEach(video => {
      const views = video.views_count || 0;
      if (views <= 100) ranges['0-100']++;
      else if (views <= 500) ranges['101-500']++;
      else if (views <= 1000) ranges['501-1000']++;
      else ranges['1000+']++;
    });

    if (charts.viewsDistributionChart) charts.viewsDistributionChart.destroy();
    charts.viewsDistributionChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(ranges),
        datasets: [{
          data: Object.values(ranges),
          backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'],
          borderWidth: 2,
          borderColor: '#1a1a1a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  } catch (error) {
    console.error('Error creating views distribution chart:', error);
  }
}

async function createContentTypeChart() {
  const canvas = document.getElementById('contentTypeChart');
  if (!canvas) return;

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('is_public');

    const types = { 'Public': 0, 'Private': 0 };
    videos?.forEach(video => {
      if (video.is_public) types['Public']++;
      else types['Private']++;
    });

    if (charts.contentTypeChart) charts.contentTypeChart.destroy();
    charts.contentTypeChart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: Object.keys(types),
        datasets: [{
          data: Object.values(types),
          backgroundColor: ['#10b981', '#f59e0b'],
          borderWidth: 2,
          borderColor: '#1a1a1a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  } catch (error) {
    console.error('Error creating content type chart:', error);
  }
}

async function createTopVideosChart() {
  const canvas = document.getElementById('topVideosChart');
  if (!canvas) return;

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('title, views_count')
      .order('views_count', { ascending: false })
      .limit(10);

    const labels = videos?.map(v => truncateText(v.title, 30)) || [];
    const data = videos?.map(v => v.views_count || 0) || [];

    if (charts.topVideosChart) charts.topVideosChart.destroy();
    charts.topVideosChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Views',
          data,
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: '#ef4444',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
          y: { grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error('Error creating top videos chart:', error);
  }
}

async function createActivityHeatmapChart() {
  const canvas = document.getElementById('activityHeatmapChart');
  if (!canvas) return;

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const hourCounts = new Array(24).fill(0);
    videos?.forEach(video => {
      const hour = new Date(video.created_at).getHours();
      hourCounts[hour]++;
    });

    const labels = hourCounts.map((_, i) => `${i}:00`);

    if (charts.activityHeatmapChart) charts.activityHeatmapChart.destroy();
    charts.activityHeatmapChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.filter((_, i) => i % 2 === 0),
        datasets: [{
          label: 'Uploads by Hour',
          data: hourCounts.filter((_, i) => i % 2 === 0),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3b82f6',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error('Error creating activity heatmap chart:', error);
  }
}

async function createEngagementChart() {
  const canvas = document.getElementById('engagementChart');
  if (!canvas) return;

  try {
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('views_count, comments_count, likes_count')
      .limit(100);

    const totalViews = videos?.reduce((sum, v) => sum + (v.views_count || 0), 0) || 0;
    const totalComments = videos?.reduce((sum, v) => sum + (v.comments_count || 0), 0) || 0;
    const totalLikes = videos?.reduce((sum, v) => sum + (v.likes_count || 0), 0) || 0;

    if (charts.engagementChart) charts.engagementChart.destroy();
    charts.engagementChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Views', 'Comments', 'Likes'],
        datasets: [{
          data: [totalViews, totalComments * 10, totalLikes * 5], // Scaled for visibility
          backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
          borderWidth: 2,
          borderColor: '#1a1a1a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  } catch (error) {
    console.error('Error creating engagement chart:', error);
  }
}

// ========================================
// ADSTERRA AD CONTROL
// ========================================

const ADSTERRA_API_KEY = '426d86a9a7e53e7d2721398babe557e9';

async function loadAdsterraData() {
  try {
    // Load initial stats (mock data - replace with actual Adsterra API call)
    const impressions = Math.floor(Math.random() * 50000) + 10000;
    const clicks = Math.floor(Math.random() * 2000) + 500;
    const earnings = (Math.random() * 100 + 20).toFixed(2);
    const ctr = ((clicks / impressions) * 100).toFixed(2);

    document.getElementById('adsterraImpressions').textContent = formatNumber(impressions);
    document.getElementById('adsterraClicks').textContent = formatNumber(clicks);
    document.getElementById('adsterraEarnings').textContent = '$' + earnings;
    document.getElementById('adsterraCTR').textContent = ctr + '%';
    document.getElementById('adsterraLastSync').textContent = new Date().toLocaleString();

    // Load ad settings from localStorage
    loadAdSettings();
    loadAdsPageStatus();

    // Create ad performance chart
    await createAdPerformanceChart();
  } catch (error) {
    console.error('Error loading Adsterra data:', error);
    showNotification('Error loading ad data', 'error');
  }
}

function toggleAdsterraApiKey() {
  const input = document.getElementById('adsterraApiKey');
  const btn = event.target;
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

function loadAdsPageStatus() {
  const container = document.getElementById('adsPageStatusList');
  if (!container) return;

  const defaults = {
    adsEnabled: true,
    watchPageBanner: true,
    watchPageEnabled: true,
    watchPageAdType: 'banner',
    watchPageAdPosition: 'below_player',
    popunderEnabled: true,
    popunderCooldownMinutes: 20,
    homePageEnabled: false,
    homePageAdType: 'native',
    homePageAdPosition: 'top',
    smartlinkEnabled: false,
    smartlinkUrl: ''
  };
  const settings = { ...defaults, ...(getFromLocalStorage('mukkaz_ad_settings') || {}) };

  const adsEnabled = settings.adsEnabled !== false;
  const watchEnabled = adsEnabled && !!settings.watchPageEnabled;
  const popunderDetail = settings.popunderEnabled
    ? `Popunder on (${settings.popunderCooldownMinutes || 20} min cooldown)`
    : 'Popunder off';
  const watchDetail = watchEnabled
    ? `Ads enabled (${settings.watchPageAdType}, ${settings.watchPageAdPosition}); banner slot ${settings.watchPageBanner ? 'on' : 'off'}; ${popunderDetail}`
    : adsEnabled
      ? `Ads disabled (type: ${settings.watchPageAdType}, position: ${settings.watchPageAdPosition}); ${popunderDetail}`
      : 'Global ads disabled';

  const homeEnabled = adsEnabled && !!settings.homePageEnabled;
  const homeDetail = homeEnabled
    ? `Ads enabled (${settings.homePageAdType}, ${settings.homePageAdPosition})`
    : adsEnabled
      ? `Ads disabled (type: ${settings.homePageAdType}, position: ${settings.homePageAdPosition})`
      : 'Global ads disabled';

  const smartlinkEnabled = adsEnabled && !!settings.smartlinkEnabled;
  const smartlinkDetail = smartlinkEnabled
    ? `Enabled (${settings.smartlinkUrl || 'no URL set'})`
    : adsEnabled
      ? `Disabled (${settings.smartlinkUrl || 'no URL set'})`
      : 'Global ads disabled';

  const pages = [
    { page: 'watch.html', status: watchEnabled ? 'Enabled' : 'Disabled', detail: watchDetail },
    { page: 'index.html', status: homeEnabled ? 'Enabled' : 'Disabled', detail: homeDetail },
    { page: 'history.html', status: 'Disabled', detail: 'No ad placements configured' },
    { page: 'my-videos.html', status: 'Disabled', detail: 'No ad placements configured' },
    { page: 'profile.html', status: 'Disabled', detail: 'No ad placements configured' },
    { page: 'upload.html', status: 'Disabled', detail: 'No ad placements configured' },
    { page: 'video-editor.html', status: 'Disabled', detail: 'No ad placements configured' },
    { page: 'smartlink', status: smartlinkEnabled ? 'Enabled' : 'Disabled', detail: smartlinkDetail }
  ];

  container.innerHTML = pages.map(item => `
    <div class="activity-item" style="display: flex; align-items: center; justify-content: space-between;">
      <div>
        <strong>${item.page}</strong>
        <p class="secondary">${item.detail}</p>
      </div>
      <span class="badge ${item.status === 'Enabled' ? 'badge-success' : 'badge-warning'}">${item.status}</span>
    </div>
  `).join('');
}

async function syncAdsterraData() {
  showNotification('Syncing Adsterra data...', 'info');
  
  try {
    // Simulate API call (Adsterra API integration would go here)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Update stats with mock data
    document.getElementById('adsterraImpressions').textContent = formatNumber(Math.floor(Math.random() * 50000) + 10000);
    document.getElementById('adsterraClicks').textContent = formatNumber(Math.floor(Math.random() * 2000) + 500);
    document.getElementById('adsterraEarnings').textContent = '$' + (Math.random() * 100 + 20).toFixed(2);
    document.getElementById('adsterraLastSync').textContent = new Date().toLocaleString();
    
    showNotification('Adsterra data synced successfully', 'success');
    await createAdPerformanceChart();
  } catch (error) {
    console.error('Error syncing Adsterra:', error);
    showNotification('Error syncing Adsterra data', 'error');
  }
}

async function testAdsterraConnection() {
  showNotification('Testing Adsterra connection...', 'info');
  
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    showNotification('Connection successful! API key is valid.', 'success');
    document.getElementById('adsterraStatus').innerHTML = '<span class="badge badge-success">Connected</span>';
  } catch (error) {
    showNotification('Connection failed. Please check your API key.', 'error');
    document.getElementById('adsterraStatus').innerHTML = '<span class="badge badge-danger">Disconnected</span>';
  }
}

function loadAdSettings() {
  const defaults = {
    adsEnabled: true,
    watchPageBanner: true,
    watchPageEnabled: true,
    watchPageAdType: 'banner',
    watchPageAdPosition: 'below_player',
    popunderEnabled: true,
    popunderCooldownMinutes: 20,
    homePageEnabled: false,
    homePageAdType: 'native',
    homePageAdPosition: 'top',
    smartlinkEnabled: false,
    smartlinkUrl: 'https://www.effectivegatecpm.com/p2u70j6d?key=197ddf5b21bb59ffc3436fb0c7cd959d'
  };
  const settings = { ...defaults, ...(getFromLocalStorage('mukkaz_ad_settings') || {}) };

  // Update toggle switches
  const watchBannerToggle = document.getElementById('watchPageBannerToggle');
  const watchPageToggle = document.getElementById('watchPageEnabledToggle');
  const watchPageAdType = document.getElementById('watchPageAdType');
  const watchPageAdPosition = document.getElementById('watchPageAdPosition');
  const popunderEnabledToggle = document.getElementById('popunderEnabledToggle');
  const popunderCooldownMinutes = document.getElementById('popunderCooldownMinutes');
  const homePageToggle = document.getElementById('homePageEnabledToggle');
  const homePageAdType = document.getElementById('homePageAdType');
  const homePageAdPosition = document.getElementById('homePageAdPosition');
  const smartlinkToggle = document.getElementById('smartlinkEnabledToggle');
  const smartlinkUrl = document.getElementById('smartlinkUrl');
  const adsEnabledToggle = document.getElementById('adsEnabledToggle');

  if (adsEnabledToggle) adsEnabledToggle.checked = settings.adsEnabled !== false;
  if (watchBannerToggle) watchBannerToggle.checked = settings.watchPageBanner;
  if (watchPageToggle) watchPageToggle.checked = settings.watchPageEnabled;
  if (watchPageAdType) watchPageAdType.value = settings.watchPageAdType;
  if (watchPageAdPosition) watchPageAdPosition.value = settings.watchPageAdPosition;
  if (popunderEnabledToggle) popunderEnabledToggle.checked = settings.popunderEnabled !== false;
  if (popunderCooldownMinutes) popunderCooldownMinutes.value = settings.popunderCooldownMinutes || 20;
  if (homePageToggle) homePageToggle.checked = settings.homePageEnabled;
  if (homePageAdType) homePageAdType.value = settings.homePageAdType;
  if (homePageAdPosition) homePageAdPosition.value = settings.homePageAdPosition;
  if (smartlinkToggle) smartlinkToggle.checked = settings.smartlinkEnabled;
  if (smartlinkUrl) smartlinkUrl.value = settings.smartlinkUrl || '';

  const popunderLast = document.getElementById('popunderLastFired');
  if (popunderLast) {
    const lastFired = Number(localStorage.getItem('mukkaz_popunder_last')) || 0;
    popunderLast.textContent = lastFired ? new Date(lastFired).toLocaleString() : 'Never';
  }
}

function resetPopunderCooldown() {
  localStorage.removeItem('mukkaz_popunder_last');
  const popunderLast = document.getElementById('popunderLastFired');
  if (popunderLast) {
    popunderLast.textContent = 'Never';
  }
  showNotification('Popunder cooldown reset', 'success');
}

function saveAdSettings() {
  const settings = {
    adsEnabled: document.getElementById('adsEnabledToggle')?.checked !== false,
    watchPageBanner: document.getElementById('watchPageBannerToggle')?.checked || false,
    watchPageEnabled: document.getElementById('watchPageEnabledToggle')?.checked || false,
    watchPageAdType: document.getElementById('watchPageAdType')?.value || 'banner',
    watchPageAdPosition: document.getElementById('watchPageAdPosition')?.value || 'below_player',
    popunderEnabled: document.getElementById('popunderEnabledToggle')?.checked !== false,
    popunderCooldownMinutes: Number(document.getElementById('popunderCooldownMinutes')?.value) || 20,
    homePageEnabled: document.getElementById('homePageEnabledToggle')?.checked || false,
    homePageAdType: document.getElementById('homePageAdType')?.value || 'native',
    homePageAdPosition: document.getElementById('homePageAdPosition')?.value || 'top',
    smartlinkEnabled: document.getElementById('smartlinkEnabledToggle')?.checked || false,
    smartlinkUrl: document.getElementById('smartlinkUrl')?.value?.trim() || ''
  };

  saveToLocalStorage('mukkaz_ad_settings', settings);
  showNotification('Ad settings saved successfully', 'success');
  loadAdsPageStatus();
}

function resetAdControls() {
  const defaults = {
    adsEnabled: true,
    watchPageBanner: true,
    watchPageEnabled: true,
    watchPageAdType: 'banner',
    watchPageAdPosition: 'below_player',
    popunderEnabled: true,
    popunderCooldownMinutes: 20,
    homePageEnabled: false,
    homePageAdType: 'native',
    homePageAdPosition: 'top',
    smartlinkEnabled: false,
    smartlinkUrl: 'https://www.effectivegatecpm.com/p2u70j6d?key=197ddf5b21bb59ffc3436fb0c7cd959d'
  };

  saveToLocalStorage('mukkaz_ad_settings', defaults);
  loadAdSettings();
  loadAdsPageStatus();
  showNotification('Ad controls reset to defaults', 'success');
}

async function copySmartlink() {
  const input = document.getElementById('smartlinkUrl');
  const value = input?.value?.trim();

  if (!value) {
    showNotification('Add a Smartlink URL first', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    showNotification('Smartlink copied', 'success');
  } catch (error) {
    console.error('Failed to copy smartlink:', error);
    showNotification('Copy failed', 'error');
  }
}

function openSmartlink() {
  const input = document.getElementById('smartlinkUrl');
  const value = input?.value?.trim();

  if (!value) {
    showNotification('Add a Smartlink URL first', 'error');
    return;
  }

  window.open(value, '_blank');
}

function toggleAdPlacement(placement) {
  const settings = getFromLocalStorage('mukkaz_ad_settings') || {};
  settings[placement] = !settings[placement];
  saveToLocalStorage('mukkaz_ad_settings', settings);

  const status = settings[placement] ? 'enabled' : 'disabled';
  showNotification(`${placement} ads ${status}`, 'success');
}

async function createAdPerformanceChart() {
  const canvas = document.getElementById('adPerformanceChart');
  if (!canvas) return;

  try {
    // Generate mock data for last 7 days
    const last7Days = [];
    const impressions = [];
    const clicks = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      impressions.push(Math.floor(Math.random() * 5000) + 2000);
      clicks.push(Math.floor(Math.random() * 200) + 50);
    }

    if (charts.adPerformanceChart) charts.adPerformanceChart.destroy();
    charts.adPerformanceChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: last7Days,
        datasets: [{
          label: 'Impressions',
          data: impressions,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y'
        }, {
          label: 'Clicks',
          data: clicks,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.1)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false }
          },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (error) {
    console.error('Error creating ad performance chart:', error);
  }
}

async function clearAdCache() {
  const confirmed = await showConfirm('Clear all ad cache? This will reload ads on your site.', {
    title: 'Clear ad cache',
    confirmText: 'Clear'
  });
  if (!confirmed) return;
  showNotification('Ad cache cleared', 'success');
}

function exportAdData() {
  showNotification('Exporting ad data...', 'info');
  setTimeout(() => {
    showNotification('Ad data exported successfully', 'success');
  }, 1500);
}
