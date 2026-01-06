// Supabase Configuration and Client
// Load configuration from config.js (see config.local.js for credentials)
const SUPABASE_URL = window.APP_CONFIG?.supabase?.url || '';
const SUPABASE_PUBLISHABLE_KEY = window.APP_CONFIG?.supabase?.publishableKey || '';

// Validate configuration
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ FATAL: Supabase credentials not configured!');
  console.error('Please create config.local.js with your Supabase credentials.');
  console.error('See config.local.js.example for the required format.');
}

// Initialize Supabase client with persistent session
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

const CACHE_PREFIX = 'mukkaz_cache:';
const CACHE_TTLS = {
  profile: 5 * 60 * 1000,
  videos: 30 * 1000,
  subscriptions: 60 * 1000,
  watchHistory: 30 * 1000,
  clientIp: 12 * 60 * 60 * 1000
};

function getCacheKey(name, suffix = 'global') {
  return `${CACHE_PREFIX}${name}:${suffix}`;
}

function readCache(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== 'number') return null;
    if (Date.now() - parsed.t > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.v;
  } catch (error) {
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
  } catch (error) {
    // Ignore cache failures (storage full, private mode, etc.)
  }
}

function clearCache(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // Ignore cache clear failures.
  }
}

// Auth helpers
async function signUp(email, password, username) {
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username
      }
    }
  });

  if (authError) {
    // Handle rate limiting
    if (authError.message.includes('seconds')) {
      throw new Error('Too many attempts. Please wait a moment and try again.');
    }
    throw authError;
  }

  // Only create profile if auth user was created and session exists
  if (authData.user && authData.session) {
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert([{
        id: authData.user.id,
        username,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        updated_at: new Date().toISOString()
      }]);

    if (profileError) {
      console.error('Profile creation error:', profileError);

      // Handle specific errors
      if (profileError.code === '23505' || profileError.message.includes('duplicate')) {
        throw new Error('Username already taken. Please choose another.');
      }
      if (profileError.code === '42501') {
        throw new Error('Permission error. Please contact support.');
      }
      throw new Error('Error creating profile: ' + profileError.message);
    }
  } else if (authData.user && !authData.session) {
    // User created but needs email confirmation
    console.log('Account created, awaiting email confirmation');
  }

  return authData;
}

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  clearCache(getCacheKey('subscriptions', user.id));
  clearCache(getCacheKey('videos', 'all'));
  return data;
}

async function signInWithGoogle() {
  const redirectTo = window.location.origin + '/index.html';
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });

  if (error) throw error;
  clearCache(getCacheKey('subscriptions', user.id));
  return data;
}

async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getProfile(userId) {
  const cacheKey = getCacheKey('profile', userId);
  const cached = readCache(cacheKey, CACHE_TTLS.profile);
  if (cached) return cached;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  // If profile doesn't exist, create it
  if (!data) {
    console.log('Profile not found, creating one...');
    const user = await getCurrentUser();

    if (!user) throw new Error('Not authenticated');

    const username = user.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);

    const { data: newProfile, error: createError } = await supabaseClient
      .from('profiles')
      .insert([{
        id: userId,
        username: username,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      // Return a default profile object if creation fails
      const fallbackProfile = {
        id: userId,
        username: user.email.split('@')[0],
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userId)}`,
        updated_at: new Date().toISOString()
      };
      writeCache(cacheKey, fallbackProfile);
      return fallbackProfile;
    }

    writeCache(cacheKey, newProfile);
    return newProfile;
  }

  writeCache(cacheKey, data);
  return data;
}

async function updateProfile(userId, updates) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  writeCache(getCacheKey('profile', userId), data);
  return data;
}

async function getClientIp() {
  const url = window.APP_CONFIG?.security?.ipLookupUrl || 'https://api.ipify.org?format=json';
  const cacheKey = getCacheKey('clientIp', url);
  const cached = readCache(cacheKey, CACHE_TTLS.clientIp);
  if (cached) return cached;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    const ip = data?.ip || null;
    if (ip) writeCache(cacheKey, ip);
    return ip;
  } catch (error) {
    console.warn('Failed to fetch client IP:', error);
    return null;
  }
}

async function isIpBanned(ipAddress) {
  if (!ipAddress) return false;
  const { data, error } = await supabaseClient
    .rpc('check_ip_ban', { ip_address: ipAddress });

  if (error) {
    console.warn('IP ban check error:', error);
    return false;
  }

  return !!data;
}

// Video operations
async function getVideos() {
  const cacheKey = getCacheKey('videos', 'all');
  const cached = readCache(cacheKey, CACHE_TTLS.videos);
  if (cached) {
    const hiddenIds = typeof getHiddenVideoIds === 'function' ? getHiddenVideoIds() : [];
    return hiddenIds.length ? cached.filter(video => !hiddenIds.includes(video.id)) : cached;
  }

  const { data, error } = await supabaseClient
    .from('videos')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  writeCache(cacheKey, data);
  const hiddenIds = typeof getHiddenVideoIds === 'function' ? getHiddenVideoIds() : [];
  return hiddenIds.length ? data.filter(video => !hiddenIds.includes(video.id)) : data;
}

async function getVideo(videoId) {
  if (typeof isVideoHidden === 'function' && isVideoHidden(videoId)) {
    throw new Error('This video is hidden.');
  }
  const { data, error } = await supabaseClient
    .from('videos')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      ),
      comments (
        *,
        profiles:user_id (
          id,
          username,
          avatar_url,
          role,
          is_verified
        )
      ),
      video_votes (
        vote_type,
        user_id
      )
    `)
    .eq('id', videoId)
    .single();

  if (error) throw error;
  return data;
}

async function uploadVideo(file, thumbnail, title, description, tags = []) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  // Upload video file
  const videoFileName = `${user.id}/${Date.now()}_${file.name}`;
  const { data: videoData, error: videoError } = await supabaseClient.storage
    .from('videos')
    .upload(videoFileName, file);

  if (videoError) throw videoError;

  // Upload thumbnail
  const thumbnailFileName = `${user.id}/${Date.now()}_${thumbnail.name}`;
  const { data: thumbnailData, error: thumbnailError } = await supabaseClient.storage
    .from('thumbnails')
    .upload(thumbnailFileName, thumbnail);

  if (thumbnailError) throw thumbnailError;

  // Get public URLs
  const { data: { publicUrl: videoUrl } } = supabaseClient.storage
    .from('videos')
    .getPublicUrl(videoFileName);

  const { data: { publicUrl: thumbnailUrl } } = supabaseClient.storage
    .from('thumbnails')
    .getPublicUrl(thumbnailFileName);

  // Create video record with tags
  const { data, error } = await supabaseClient
    .from('videos')
    .insert([{
      user_id: user.id,
      title,
      description,
      url: videoUrl,
      thumbnail_url: thumbnailUrl,
      views_count: 0,
      tags: tags.join(',') // Store tags as comma-separated string
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateVideo(videoId, updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('videos')
    .update({
      title: updates.title,
      description: updates.description,
      tags: Array.isArray(updates.tags) ? updates.tags.join(',') : updates.tags
    })
    .eq('id', videoId)
    .eq('user_id', user.id) // Ensure user owns the video
    .select()
    .single();

  if (error) throw error;
  clearCache(getCacheKey('videos', 'all'));

  await notifySelf(
    'video_edit',
    'Video updated',
    `You updated your video "${data.title}".`,
    `watch.html?v=${videoId}`,
    videoId
  );
  return data;
}

function getViewerToken() {
  let token = localStorage.getItem('mukkaz_viewer_token');
  if (!token) {
    token = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem('mukkaz_viewer_token', token);
  }
  return token;
}

async function recordView(videoId) {
  const viewerToken = getViewerToken();
  const { data, error } = await supabaseClient.rpc('record_view', {
    video_id: videoId,
    viewer_token: viewerToken
  });

  if (error) {
    console.warn('record_view RPC failed, falling back to incrementViews', error);
    await incrementViews(videoId);
    return { counted: false };
  }

  return data;
}

async function incrementViews(videoId) {
  const { data, error } = await supabaseClient.rpc('increment_views', {
    video_id: videoId
  });

  if (error) {
    // Fallback if RPC doesn't exist
    const { data: video } = await supabaseClient
      .from('videos')
      .select('views_count')
      .eq('id', videoId)
      .single();

    await supabaseClient
      .from('videos')
      .update({ views_count: (video?.views_count || 0) + 1 })
      .eq('id', videoId);
  }

  return data;
}

async function getEarningsSummary() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('creator_earnings_summary')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data || { user_id: user.id, eligible_views: 0, earnings_jmd: 0, paid_jmd: 0 };
}

async function getVideoEarnings(videoIds) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) return [];

  const { data, error } = await supabaseClient
    .from('video_earnings')
    .select('video_id, eligible_views, earnings_jmd')
    .in('video_id', videoIds);

  if (error) throw error;
  return data || [];
}

async function getPayoutRequests() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('payout_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function requestPayout(method, details) {
  const { data, error } = await supabaseClient.rpc('request_payout', {
    payout_method: method,
    payout_details: details
  });

  if (error) throw error;
  return data;
}

async function reportVideo(videoId, reason, details = '') {
  const user = await getCurrentUser();
  if (!user) throw new Error('Please sign in to report videos.');

  const { data, error } = await supabaseClient
    .from('video_reports')
    .insert([{
      video_id: videoId,
      reporter_id: user.id,
      reason,
      details
    }])
    .select()
    .single();

  if (error) throw error;

  if (typeof hideReportedVideo === 'function') {
    hideReportedVideo(videoId);
  }

  try {
    await supabaseClient.rpc('notify_admins', {
      title: 'Video reported',
      message: `A video was reported for "${reason}".`,
      link: 'admin.html#videos'
    });
  } catch (notifyError) {
    console.warn('Failed to notify admins about report:', notifyError);
  }

  return data;
}

async function notifySelf(type, title, message, link = null, relatedVideoId = null) {
  const user = await getCurrentUser();
  if (!user) return;

  await createNotification(user.id, type, title, message, link, user.id, relatedVideoId);

  if (typeof updateNotificationBadge === 'function') {
    updateNotificationBadge();
  }
  if (typeof showNotification === 'function') {
    showNotification(message, 'success');
  }
}

// Comment operations
async function addComment(videoId, text) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('comments')
    .insert([{
      video_id: videoId,
      user_id: user.id,
      text
    }])
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      )
    `)
    .single();

  if (error) throw error;

  // Get video owner to send notification
  const { data: video } = await supabaseClient
    .from('videos')
    .select('user_id, title')
    .eq('id', videoId)
    .single();

  // Create notification for video owner (if not commenting on own video)
  if (video && video.user_id !== user.id) {
    await createNotification(
      video.user_id,
      'new_comment',
      'New Comment!',
      `${(await getProfile(user.id)).username} commented on your video: "${video.title}"`,
      `watch.html?v=${videoId}`,
      user.id,
      videoId,
      data.id
    );
  }

  return data;
}

async function getComments(videoId) {
  const { data, error } = await supabaseClient
    .from('comments')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      )
    `)
    .eq('video_id', videoId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// Vote operations
async function voteVideo(videoId, voteType) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('video_votes')
    .upsert([{
      video_id: videoId,
      user_id: user.id,
      vote_type: voteType
    }], {
      onConflict: 'video_id,user_id'
    })
    .select()
    .single();

  if (error) throw error;

  // Get video owner to send notification (only for likes)
  if (voteType === 'like') {
    const { data: video } = await supabaseClient
      .from('videos')
      .select('user_id, title')
      .eq('id', videoId)
      .single();

    // Create notification for video owner (if not liking own video)
    if (video && video.user_id !== user.id) {
      await createNotification(
        video.user_id,
        'video_like',
        'Someone liked your video!',
        `${(await getProfile(user.id)).username} liked your video: "${video.title}"`,
        `watch.html?v=${videoId}`,
        user.id,
        videoId
      );
    }
  }

  return data;
}

async function removeVote(videoId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('video_votes')
    .delete()
    .eq('video_id', videoId)
    .eq('user_id', user.id);

  if (error) throw error;
}

async function getVoteCounts(videoId) {
  const { data, error } = await supabaseClient
    .from('video_votes')
    .select('vote_type')
    .eq('video_id', videoId);

  if (error) throw error;

  const likes = data.filter(v => v.vote_type === 'like').length;
  const dislikes = data.filter(v => v.vote_type === 'dislike').length;

  return { likes, dislikes };
}

// Avatar upload
async function uploadAvatar(file) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const fileName = `${user.id}/${Date.now()}_${file.name}`;
  const { data, error} = await supabaseClient.storage
    .from('avatars')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabaseClient.storage
    .from('avatars')
    .getPublicUrl(fileName);

  await updateProfile(user.id, { avatar_url: publicUrl });

  return publicUrl;
}

// ============================================
// SUBSCRIPTION OPERATIONS
// ============================================

async function subscribe(channelId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('subscriptions')
    .insert([{
      subscriber_id: user.id,
      channel_id: channelId
    }])
    .select()
    .single();

  if (error) throw error;

  // Increment subscribers count
  await supabaseClient.rpc('increment_subscribers_count', { p_channel_id: channelId });

  // Create notification for channel owner
  await createNotification(
    channelId,
    'new_subscriber',
    'New Subscriber!',
    `${(await getProfile(user.id)).username} subscribed to your channel`,
    `profile.html?id=${user.id}`,
    user.id
  );

  const channelProfile = await getProfile(channelId);
  await notifySelf(
    'subscription',
    'Subscribed',
    `You subscribed to ${channelProfile?.username || 'a creator'}.`,
    `profile.html?id=${channelId}`
  );

  return data;
}

async function unsubscribe(channelId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('subscriptions')
    .delete()
    .eq('subscriber_id', user.id)
    .eq('channel_id', channelId);

  if (error) throw error;

  // Decrement subscribers count
  await supabaseClient.rpc('decrement_subscribers_count', { p_channel_id: channelId });
}

async function isSubscribed(channelId) {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabaseClient
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', user.id)
    .eq('channel_id', channelId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function getSubscribers(channelId) {
  const { data, error } = await supabaseClient
    .from('subscriptions')
    .select(`
      *,
      profiles:subscriber_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      )
    `)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

async function getSubscriptions() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const cacheKey = getCacheKey('subscriptions', user.id);
  const cached = readCache(cacheKey, CACHE_TTLS.subscriptions);
  if (cached) return cached;

  const { data, error } = await supabaseClient
    .from('subscriptions')
    .select(`
      *,
      profiles:channel_id (
        id,
        username,
        avatar_url,
        subscribers_count,
        role,
        is_verified
      )
    `)
    .eq('subscriber_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  writeCache(cacheKey, data);
  return data;
}

// ============================================
// BOOKMARK OPERATIONS
// ============================================

async function addBookmark(videoId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('bookmarks')
    .insert([{
      user_id: user.id,
      video_id: videoId
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function removeBookmark(videoId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('bookmarks')
    .delete()
    .eq('user_id', user.id)
    .eq('video_id', videoId);

  if (error) throw error;
}

async function setWatchHistorySaved(videoId, saved) {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: existing, error: existingError } = await supabaseClient
    .from('watch_history')
    .select('id')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .maybeSingle();

  if (existingError) {
    console.warn('Error checking watch history:', existingError);
    return;
  }

  const payload = {
    saved: saved,
    watched_at: new Date().toISOString()
  };

  if (existing) {
    const { error } = await supabaseClient
      .from('watch_history')
      .update(payload)
      .eq('id', existing.id);
    if (error) console.warn('Error updating watch history saved state:', error);
  } else {
    const { error } = await supabaseClient
      .from('watch_history')
      .insert([{
        user_id: user.id,
        video_id: videoId,
        watch_progress: 0,
        saved: saved
      }]);
    if (error) console.warn('Error inserting watch history saved state:', error);
  }

  clearCache(getCacheKey('watchHistory', `${user.id}:50`));
}

async function toggleBookmark(videoId, button) {
  const bookmarked = await isBookmarked(videoId);

  if (bookmarked) {
    await removeBookmark(videoId);
    if (button) button.classList.remove('active');
    await setWatchHistorySaved(videoId, false);
    await notifySelf(
      'bookmark_removed',
      'Bookmark removed',
      'Video removed from your saved list.',
      `watch.html?v=${videoId}`
    );
    return false;
  }

  await addBookmark(videoId);
  if (button) button.classList.add('active');
  await setWatchHistorySaved(videoId, true);
  await notifySelf(
    'bookmark_added',
    'Saved',
    'Video saved to your bookmarks.',
    `watch.html?v=${videoId}`
  );
  return true;
}

async function isBookmarked(videoId) {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabaseClient
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function getBookmarks() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('bookmarks')
    .select(`
      *,
      videos (
        *,
        profiles:user_id (
          id,
          username,
          avatar_url,
          role,
          is_verified
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ============================================
// COMMENT OPERATIONS (ENHANCED)
// ============================================

async function addReply(commentId, videoId, text) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('comments')
    .insert([{
      video_id: videoId,
      user_id: user.id,
      parent_comment_id: commentId,
      text
    }])
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      )
    `)
    .single();

  if (error) throw error;

  // Increment comments count
  await supabaseClient.rpc('increment_comments_count', { p_video_id: videoId });

  // Get parent comment to find owner
  const { data: parentComment } = await supabaseClient
    .from('comments')
    .select('user_id')
    .eq('id', commentId)
    .single();

  // Create notification for comment owner (if not replying to self)
  if (parentComment && parentComment.user_id !== user.id) {
    await createNotification(
      parentComment.user_id,
      'comment_reply',
      'New Reply!',
      `${(await getProfile(user.id)).username} replied to your comment`,
      `watch.html?v=${videoId}`,
      user.id,
      videoId,
      commentId
    );
  }

  return data;
}

async function getReplies(commentId) {
  const { data, error } = await supabaseClient
    .from('comments')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      )
    `)
    .eq('parent_comment_id', commentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

// ============================================
// COMMENT LIKE OPERATIONS
// ============================================

async function likeComment(commentId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('comment_likes')
    .insert([{
      user_id: user.id,
      comment_id: commentId
    }])
    .select()
    .single();

  if (error) throw error;

  // Increment like count
  await supabaseClient.rpc('increment_comment_likes', { p_comment_id: commentId });

  // Get comment to find owner
  const { data: comment } = await supabaseClient
    .from('comments')
    .select('user_id, video_id')
    .eq('id', commentId)
    .single();

  // Create notification for comment owner (if not liking own comment)
  if (comment && comment.user_id !== user.id) {
    await createNotification(
      comment.user_id,
      'comment_like',
      'Someone liked your comment!',
      `${(await getProfile(user.id)).username} liked your comment`,
      `watch.html?v=${comment.video_id}`,
      user.id,
      comment.video_id,
      commentId
    );
  }

  return data;
}

async function unlikeComment(commentId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('comment_likes')
    .delete()
    .eq('user_id', user.id)
    .eq('comment_id', commentId);

  if (error) throw error;

  // Decrement like count
  await supabaseClient.rpc('decrement_comment_likes', { p_comment_id: commentId });
}

async function isCommentLiked(commentId) {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabaseClient
    .from('comment_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('comment_id', commentId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// ============================================
// COMMENT DISLIKE OPERATIONS
// ============================================

async function dislikeComment(commentId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('comment_dislikes')
    .insert([{
      user_id: user.id,
      comment_id: commentId
    }])
    .select()
    .single();

  if (error) throw error;

  await supabaseClient.rpc('increment_comment_dislikes', { p_comment_id: commentId });
  return data;
}

async function undislikeComment(commentId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('comment_dislikes')
    .delete()
    .eq('user_id', user.id)
    .eq('comment_id', commentId);

  if (error) throw error;

  await supabaseClient.rpc('decrement_comment_dislikes', { p_comment_id: commentId });
}

async function isCommentDisliked(commentId) {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabaseClient
    .from('comment_dislikes')
    .select('id')
    .eq('user_id', user.id)
    .eq('comment_id', commentId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function getCommentReactions(commentIds) {
  if (!Array.isArray(commentIds) || commentIds.length === 0) {
    return {
      likesById: {},
      dislikesById: {},
      userLiked: new Set(),
      userDisliked: new Set()
    };
  }

  const user = await getCurrentUser();
  const userId = user?.id || null;

  const { data: likes, error: likesError } = await supabaseClient
    .from('comment_likes')
    .select('comment_id,user_id')
    .in('comment_id', commentIds);

  if (likesError) throw likesError;

  const { data: dislikes, error: dislikesError } = await supabaseClient
    .from('comment_dislikes')
    .select('comment_id,user_id')
    .in('comment_id', commentIds);

  if (dislikesError) throw dislikesError;

  const likesById = {};
  const dislikesById = {};
  const userLiked = new Set();
  const userDisliked = new Set();

  (likes || []).forEach(row => {
    likesById[row.comment_id] = (likesById[row.comment_id] || 0) + 1;
    if (userId && row.user_id === userId) {
      userLiked.add(row.comment_id);
    }
  });

  (dislikes || []).forEach(row => {
    dislikesById[row.comment_id] = (dislikesById[row.comment_id] || 0) + 1;
    if (userId && row.user_id === userId) {
      userDisliked.add(row.comment_id);
    }
  });

  return { likesById, dislikesById, userLiked, userDisliked };
}

// ============================================
// NOTIFICATION OPERATIONS
// ============================================

async function createNotification(userId, type, title, message, link = null, actorId = null, relatedVideoId = null, relatedCommentId = null) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  const { data, error } = await supabaseClient.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_link: link,
    p_actor_id: actorId || currentUser.id,
    p_related_video_id: relatedVideoId,
    p_related_comment_id: relatedCommentId
  });

  if (error) console.error('Error creating notification:', error);
  return data;
}

async function getNotifications(limit = 20) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabaseClient
    .from('notifications')
    .select(`
      *,
      actor:actor_id (
        id,
        username,
        avatar_url,
        role,
        is_verified
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

async function markAsRead(notificationId) {
  const { error } = await supabaseClient
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

async function markAllAsRead() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw error;
}

async function getUnreadCount() {
  const user = await getCurrentUser();
  if (!user) return 0;

  const { count, error } = await supabaseClient
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

// ============================================
// SEARCH HISTORY OPERATIONS
// ============================================

async function addSearchHistory(query) {
  const user = await getCurrentUser();
  if (!user) return; // Don't save if not logged in

  const { data, error } = await supabaseClient
    .from('search_history')
    .insert([{
      user_id: user.id,
      query
    }])
    .select()
    .single();

  if (error) console.error('Error saving search:', error);
  return data;
}

async function getSearchHistory(limit = 10) {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabaseClient
    .from('search_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Return unique queries only
  const uniqueQueries = [...new Set(data.map(item => item.query))];
  return uniqueQueries;
}

async function clearSearchHistory() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('search_history')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
}

// ============================================
// WATCH HISTORY OPERATIONS
// ============================================

async function addToWatchHistory(videoId, watchProgress = 0) {
  const user = await getCurrentUser();
  if (!user) return;

  // Check if entry exists, update if so
  const { data: existing } = await supabaseClient
    .from('watch_history')
    .select('id')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .single();

  if (existing) {
    // Update existing entry
    const { error } = await supabaseClient
      .from('watch_history')
      .update({
        watched_at: new Date().toISOString(),
        watch_progress: watchProgress
      })
      .eq('id', existing.id);

    if (error) console.error('Error updating watch history:', error);
  } else {
    // Create new entry
    const { error } = await supabaseClient
      .from('watch_history')
      .insert([{
        user_id: user.id,
        video_id: videoId,
        watch_progress: watchProgress
      }]);

    if (error) console.error('Error adding to watch history:', error);
  }
}

async function getWatchHistory(limit = 50) {
  const user = await getCurrentUser();
  if (!user) return [];

  const cacheKey = getCacheKey('watchHistory', `${user.id}:${limit}`);
  const cached = readCache(cacheKey, CACHE_TTLS.watchHistory);
  if (cached) return cached;

  const { data, error } = await supabaseClient
    .from('watch_history')
    .select(`
      *,
      videos (
        id,
        title,
        description,
        thumbnail_url,
        duration,
        views_count,
        created_at,
        user_id,
        profiles:profiles!videos_user_id_fkey (username, avatar_url, role, is_verified)
      )
    `)
    .eq('user_id', user.id)
    .order('watched_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching watch history:', error);
    return [];
  }

  writeCache(cacheKey, data || []);
  return data || [];
}

async function clearWatchHistory() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabaseClient
    .from('watch_history')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
}

async function removeFromWatchHistory(videoId) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { error} = await supabaseClient
    .from('watch_history')
    .delete()
    .eq('user_id', user.id)
    .eq('video_id', videoId);

  if (error) throw error;
}

async function searchWatchHistory(query) {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabaseClient
    .from('watch_history')
    .select(`
      *,
      videos (
        id,
        title,
        description,
        thumbnail_url,
        duration,
        views_count,
        created_at,
        user_id,
        profiles:profiles!videos_user_id_fkey (username, avatar_url, role, is_verified)
      )
    `)
    .eq('user_id', user.id)
    .order('watched_at', { ascending: false });

  if (error) {
    console.error('Error searching watch history:', error);
    return [];
  }

  // Filter by query
  return (data || []).filter(item =>
    item.videos?.title?.toLowerCase().includes(query.toLowerCase()) ||
    item.videos?.profiles?.username?.toLowerCase().includes(query.toLowerCase())
  );
}
