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

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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
      return {
        id: userId,
        username: user.email.split('@')[0],
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userId)}`,
        updated_at: new Date().toISOString()
      };
    }

    return newProfile;
  }

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
  return data;
}

// Video operations
async function getVideos() {
  const { data, error } = await supabaseClient
    .from('videos')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

async function getVideo(videoId) {
  const { data, error } = await supabaseClient
    .from('videos')
    .select(`
      *,
      profiles:user_id (
        id,
        username,
        avatar_url
      ),
      comments (
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
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

async function uploadVideo(file, thumbnail, title, description) {
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

  // Create video record
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
        avatar_url
      )
    `)
    .single();

  if (error) throw error;
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
        avatar_url
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
        avatar_url
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

  const { data, error } = await supabaseClient
    .from('subscriptions')
    .select(`
      *,
      profiles:channel_id (
        id,
        username,
        avatar_url,
        subscribers_count
      )
    `)
    .eq('subscriber_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
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
          avatar_url
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
        avatar_url
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
        avatar_url
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
        avatar_url
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
