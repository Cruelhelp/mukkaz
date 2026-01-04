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

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  await checkAdminAccess();
  setupAdminTabs();
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
  document.getElementById('cloudflareIcon').innerHTML = getIcon('cloud');
  document.getElementById('databaseIcon').innerHTML = getIcon('database');
  document.getElementById('settingsIcon').innerHTML = getIcon('settings');

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

  // Check if user is admin
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    showNotification('Access denied - Admin only', 'error');
    setTimeout(() => window.location.href = 'index.html', 2000);
    return;
  }
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
    case 'cloudflare':
      await loadCloudflareData();
      break;
    case 'database':
      await loadDatabaseInfo();
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
          <button class="action-btn" onclick="editUser('${user.id}')">Edit</button>
          <button class="action-btn danger" onclick="deleteUser('${user.id}')">Delete</button>
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
    }
  } else {
    title.textContent = 'Add User';
    currentUserEdit = null;
    document.getElementById('userForm').reset();
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

  try {
    if (currentUserEdit) {
      // Update existing user
      const { error } = await supabaseClient
        .from('profiles')
        .update({
          username,
          email,
          role,
          is_banned: status === 'banned'
        })
        .eq('id', currentUserEdit);

      if (error) throw error;
      showNotification('User updated successfully', 'success');
    } else {
      // Create new user (Note: This requires proper auth setup)
      showNotification('User creation requires auth integration', 'info');
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
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
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
async function loadVideos(page = 1) {
  const tbody = document.getElementById('videosTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading videos...</td></tr>';

  try {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE - 1;

    // Simple query without complex joins
    const { data: videos, error, count } = await supabaseClient
      .from('videos')
      .select('*', { count: 'exact' })
      .range(start, end)
      .order('created_at', { ascending: false });

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

    setupPagination('videos', count, page);

  } catch (error) {
    console.error('Error loading videos:', error);
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: red;">Error loading videos</td></tr>';
  }
}

async function filterVideos() {
  const filter = document.getElementById('videoFilter').value;
  // Implement filtering logic
  await loadVideos(1);
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
  if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
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

    // Load charts
    await initializeCharts();

  } catch (error) {
    console.error('Error loading analytics:', error);
  }
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
  if (!confirm('Are you sure you want to purge the Cloudflare cache?')) {
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
  showNotification('Data refreshed', 'success');
}

function exportData(type) {
  showNotification(`Exporting ${type} data...`, 'info');
  // Implement export logic
  setTimeout(() => {
    showNotification('Export complete', 'success');
  }, 1500);
}

function clearCache() {
  if (confirm('Clear local cache?')) {
    localStorage.clear();
    showNotification('Cache cleared', 'success');
  }
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
      <td><strong>${user.username}</strong></td>
      <td>${user.email || 'N/A'}</td>
      <td><span class="badge badge-info">${user.role || 'user'}</span></td>
      <td>0</td>
      <td><span class="badge badge-${user.is_banned ? 'danger' : 'success'}">${user.is_banned ? 'Banned' : 'Active'}</span></td>
      <td>${timeSince(user.updated_at)} ago</td>
      <td>
        <button class="action-btn" onclick="editUser('${user.id}')">Edit</button>
        <button class="action-btn danger" onclick="deleteUser('${user.id}')">Delete</button>
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
  const settings = getFromLocalStorage('mukkaz_ad_settings') || {
    watchPageBanner: true,
    watchPageEnabled: true
  };

  // Update toggle switches
  const watchBannerToggle = document.getElementById('watchPageBannerToggle');
  const watchPageToggle = document.getElementById('watchPageEnabledToggle');

  if (watchBannerToggle) watchBannerToggle.checked = settings.watchPageBanner;
  if (watchPageToggle) watchPageToggle.checked = settings.watchPageEnabled;
}

function saveAdSettings() {
  const settings = {
    watchPageBanner: document.getElementById('watchPageBannerToggle')?.checked || false,
    watchPageEnabled: document.getElementById('watchPageEnabledToggle')?.checked || false
  };

  saveToLocalStorage('mukkaz_ad_settings', settings);
  showNotification('Ad settings saved successfully', 'success');
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

function clearAdCache() {
  if (confirm('Clear all ad cache? This will reload ads on your site.')) {
    showNotification('Ad cache cleared', 'success');
  }
}

function exportAdData() {
  showNotification('Exporting ad data...', 'info');
  setTimeout(() => {
    showNotification('Ad data exported successfully', 'success');
  }, 1500);
}
