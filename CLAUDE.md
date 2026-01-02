# Mukkaz - YouTube-Inspired Video Sharing Platform

## Project Overview

Mukkaz is a modern video sharing platform designed for the Jamaican community with global access. Built with vanilla JavaScript, HTML, CSS, and Supabase backend.

**Tech Stack:**
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Supabase (PostgreSQL, Authentication, Storage)
- Design: Dark theme, minimalistic, solid colors, custom SVG icons

## Database Schema

### Tables

#### `profiles`
- `id` (UUID, PK) - Matches auth.uid()
- `username` (TEXT, UNIQUE) - Display name
- `avatar_url` (TEXT) - Profile picture URL
- `subscribers_count` (INTEGER) - Cached count
- `created_at`, `updated_at` (TIMESTAMP)

#### `videos`
- `id` (UUID, PK)
- `user_id` (UUID, FK → profiles)
- `title` (TEXT)
- `description` (TEXT)
- `url` (TEXT) - Video file URL
- `thumbnail_url` (TEXT)
- `views_count` (INTEGER)
- `likes_count` (INTEGER)
- `dislikes_count` (INTEGER)
- `comments_count` (INTEGER)
- `created_at` (TIMESTAMP)

#### `comments`
- `id` (UUID, PK)
- `video_id` (UUID, FK → videos)
- `user_id` (UUID, FK → profiles)
- `parent_comment_id` (UUID, FK → comments) - For threading
- `text` (TEXT)
- `likes_count` (INTEGER)
- `created_at` (TIMESTAMP)

#### `video_votes`
- `id` (UUID, PK)
- `video_id` (UUID, FK → videos)
- `user_id` (UUID, FK → profiles)
- `vote_type` (TEXT) - 'like' or 'dislike'
- `created_at` (TIMESTAMP)
- UNIQUE(video_id, user_id)

#### `comment_likes`
- `id` (UUID, PK)
- `comment_id` (UUID, FK → comments)
- `user_id` (UUID, FK → profiles)
- `created_at` (TIMESTAMP)
- UNIQUE(comment_id, user_id)

#### `subscriptions`
- `id` (UUID, PK)
- `subscriber_id` (UUID, FK → profiles)
- `channel_id` (UUID, FK → profiles)
- `created_at` (TIMESTAMP)
- UNIQUE(subscriber_id, channel_id)

#### `bookmarks`
- `id` (UUID, PK)
- `user_id` (UUID, FK → profiles)
- `video_id` (UUID, FK → videos)
- `created_at` (TIMESTAMP)
- UNIQUE(user_id, video_id)

#### `notifications`
- `id` (UUID, PK)
- `user_id` (UUID, FK → profiles) - Recipient
- `type` (TEXT) - 'video_like', 'video_comment', 'comment_like', 'comment_reply', 'new_subscriber', 'new_video'
- `title` (TEXT)
- `message` (TEXT)
- `link` (TEXT) - URL to navigate
- `is_read` (BOOLEAN)
- `actor_id` (UUID, FK → profiles) - Who triggered it
- `related_video_id` (UUID, FK → videos)
- `related_comment_id` (UUID, FK → comments)
- `created_at` (TIMESTAMP)

#### `search_history`
- `id` (UUID, PK)
- `user_id` (UUID, FK → profiles)
- `query` (TEXT)
- `created_at` (TIMESTAMP)

### Storage Buckets

1. **videos** - Video files (public read, user-folder write)
2. **thumbnails** - Video thumbnails (public read, user-folder write)
3. **avatars** - Profile pictures (public read, user-folder write)

## File Structure

```
Mukkaz/
├── index.html              # Home page with video grid
├── watch.html              # Video player page
├── upload.html             # Simple upload page
├── upload-enhanced.html    # Enhanced upload with editor
├── profile.html            # User profile page
├── styles.css              # Global styles
├── app.js                  # Main application logic
├── supabase.js             # API functions
├── icons.js                # SVG icon library
├── utils.js                # Helper functions
├── video-editor.js         # Video editing classes
├── upload-enhanced-logic.js # Enhanced upload logic
├── logo.png                # Site logo
├── SETUP_POLICIES.sql      # RLS policies setup
├── DATABASE_UPDATES.sql    # Schema updates for new features
└── CLAUDE.md               # This file
```

## API Functions (supabase.js)

### Authentication
- `signUp(email, password, username)` - Create account + profile
- `signIn(email, password)` - Login
- `signOut()` - Logout
- `getCurrentUser()` - Get authenticated user
- `getProfile(userId)` - Get user profile
- `updateProfile(userId, updates)` - Update profile
- `uploadAvatar(file)` - Upload profile picture

### Videos
- `getVideos()` - Get all videos
- `getVideo(videoId)` - Get single video with details
- `uploadVideo(file, thumbnail, title, description)` - Upload video
- `incrementViews(videoId)` - Increment view count
- `voteVideo(videoId, voteType)` - Like/dislike video
- `removeVote(videoId)` - Remove vote
- `getVoteCounts(videoId)` - Get like/dislike counts

### Comments
- `addComment(videoId, text)` - Add top-level comment
- `addReply(commentId, videoId, text)` - Reply to comment
- `getComments(videoId)` - Get top-level comments
- `getReplies(commentId)` - Get replies to comment
- `likeComment(commentId)` - Like a comment
- `unlikeComment(commentId)` - Unlike a comment
- `isCommentLiked(commentId)` - Check if user liked comment

### Subscriptions
- `subscribe(channelId)` - Subscribe to channel
- `unsubscribe(channelId)` - Unsubscribe from channel
- `isSubscribed(channelId)` - Check subscription status
- `getSubscribers(channelId)` - Get channel subscribers
- `getSubscriptions()` - Get user's subscriptions

### Bookmarks
- `addBookmark(videoId)` - Bookmark video
- `removeBookmark(videoId)` - Remove bookmark
- `isBookmarked(videoId)` - Check if bookmarked
- `getBookmarks()` - Get user's bookmarks

### Notifications
- `createNotification(userId, type, title, message, link, actorId, relatedVideoId, relatedCommentId)` - Create notification
- `getNotifications(limit)` - Get user notifications
- `markAsRead(notificationId)` - Mark notification as read
- `markAllAsRead()` - Mark all as read
- `getUnreadCount()` - Get unread notification count

### Search
- `addSearchHistory(query)` - Save search query
- `getSearchHistory(limit)` - Get recent searches
- `clearSearchHistory()` - Clear search history

## Helper Functions (utils.js)

- `timeSince(timestamp)` - Format "2 hours ago"
- `formatNumber(num)` - Format "1.2K", "3.4M"
- `validateEmail(email)` - Email validation
- `validateUsername(username)` - Username validation
- `showNotification(message, type)` - Toast notification
- `saveCurrentUser(user)`, `getCurrentUser()`, `clearCurrentUser()` - Local storage

## Icon Library (icons.js)

Custom SVG icons:
- home, trending, upload, user, search
- hamburger, close, like, dislike, comment
- share, edit, delete, logout, history, library
- bookmark, bell (notifications), more

All white (#FFFFFF) for dark theme compatibility.

## Key Features & Implementation

### 1. Authentication Flow
- Modal-based login/signup
- Email verification required
- Auto-create profile on signup
- Graceful fallbacks if profile missing
- No forced login - guest browsing allowed

### 2. Video Upload (Enhanced)
**4-Step Wizard:**
1. Select video file (drag-and-drop, 100MB max)
2. Preview & trim (adjust start/end time)
3. Choose thumbnail (5 auto-generated + custom upload) + enter details
4. Upload with progress tracking (video → thumbnail → database)

**Classes:**
- `VideoEditor` - Video processing, thumbnail generation
- `UploadProgressTracker` - Multi-stage progress tracking

### 3. Sidebar Toggle
- Desktop: Always visible
- Mobile: Hidden by default, toggle with hamburger
- Overlay for mobile to close on outside click
- Auto-close on link click (mobile only)

### 4. Notifications System
**Triggers:**
- New subscriber → channel owner notified
- Video comment → video owner notified
- Comment reply → parent commenter notified
- Comment like → commenter notified
- Video like → video owner notified

**UI:**
- Bell icon with unread badge
- Dropdown panel with recent notifications
- Mark as read on click
- "Mark all as read" button

### 5. Comment Threading
- Nested replies (parent_comment_id)
- Expandable/collapsible threads
- Chevron icon to show/hide replies
- Tree-style connection graphics
- Individual like counters per comment

### 6. Subscribe Feature
- Subscribe button on profile & watch pages
- Notification when subscribed channel uploads
- Subscribers count display
- "Subscriptions" page with feed

### 7. Bookmarks
- Bookmark icon on video cards
- "Bookmarks" page in sidebar
- Quick add/remove toggle

### 8. Share Functionality
- Minimalistic share modal
- Copy link button
- Social share options (optional)
- Share icon on video cards & watch page

### 9. Search Enhancements
- Search suggestions as you type
- Recent search history dropdown
- Save searches to database
- Clear history option

### 10. Watch Page Layout
**Main area:**
- Video player (full width)
- Title, channel info, subscribe button
- Like/dislike/share buttons
- Expandable description ("See more")
- Comments section with threading

**Right Sidebar:**
- Suggested/related videos
- Thumbnails with titles
- View counts
- Channel names
- Auto-scroll infinite load

### 11. Home Page Grid
- YouTube-style card layout
- Hover animations (scale, shadow)
- Lazy loading thumbnails
- Skeleton loaders
- Infinite scroll pagination

## Design System

### Colors
```css
--bg-black: #0F0F0F
--bg-primary: #1A1A1A
--bg-secondary: #212121
--bg-tertiary: #2A2A2A
--text-primary: #FFFFFF
--text-secondary: #AAAAAA
--accent-red: #CC0000
--accent-blue: #3EA6FF
--accent-green: #00AA00
--border-color: #303030
```

### Typography
- Font: 'Fira Sans' (Google Fonts)
- Weights: 300, 400, 500, 600

### Spacing
- Base: 8px grid system
- Padding: 1rem, 1.5rem, 2rem
- Gaps: 0.5rem, 1rem, 1.5rem

### Border Radius
- Small: 4px
- Medium: 8px
- Large: 12px

### Transitions
- Standard: 300ms ease
- Hover: 200ms ease

## Mobile Responsiveness

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile Adaptations
- Sidebar: Hidden, toggle with hamburger
- Video grid: 1 column
- Watch page: Stack video + suggestions vertically
- Navbar: Compact with centered search
- Forms: Full-width inputs
- Buttons: Larger touch targets

## Best Practices

### Code Organization
1. **Consolidate Components** - Create reusable functions
2. **Single Source of Truth** - Reference, don't duplicate
3. **Consistent Naming** - camelCase for JS, kebab-case for CSS
4. **Error Handling** - Try/catch with user-friendly messages
5. **Loading States** - Show spinners/skeletons during async operations

### Performance
1. **Lazy Loading** - Images, videos, infinite scroll
2. **Debounce** - Search input, scroll events
3. **Caching** - Store frequently accessed data
4. **Optimize Queries** - Use indexes, limit results
5. **Minify** - CSS, JS for production

### Security
1. **RLS Policies** - Enforce at database level
2. **Input Validation** - Client and server-side
3. **XSS Prevention** - Sanitize user content
4. **CSRF Protection** - Supabase handles this
5. **File Upload Limits** - Size, type restrictions

## Development Workflow

### Adding a New Feature

1. **Database Changes**
   - Update `DATABASE_UPDATES.sql`
   - Run in Supabase SQL editor
   - Test RLS policies

2. **API Functions**
   - Add to `supabase.js`
   - Follow naming conventions
   - Add error handling
   - Test with console logs

3. **UI Components**
   - Add HTML structure
   - Style in `styles.css`
   - Add event listeners in page-specific JS or `app.js`

4. **Integration**
   - Connect UI to API functions
   - Add loading states
   - Show error/success notifications
   - Test edge cases

5. **Documentation**
   - Update this file
   - Add code comments
   - Document breaking changes

### Common Tasks

**Add a new page:**
1. Create HTML file (copy from existing)
2. Include same scripts (supabase, icons, utils, app)
3. Add page-specific script if needed
4. Link in sidebar/navbar

**Add a new icon:**
1. Add SVG to `icons.js`
2. Use `getIcon('iconName')` to render
3. Keep white color for dark theme

**Modify database schema:**
1. Update `DATABASE_UPDATES.sql`
2. Run in Supabase
3. Update relevant API functions
4. Test RLS policies

**Style a component:**
1. Add class to HTML
2. Define styles in `styles.css`
3. Use CSS variables for colors
4. Test mobile responsiveness

## Troubleshooting

### Common Errors

**Error: "new row violates row-level security policy"**
- **Cause:** Missing RLS policy
- **Fix:** Run `SETUP_POLICIES.sql` or `DATABASE_UPDATES.sql`

**Error: "Invalid login credentials"**
- **Cause:** Wrong email/password or account doesn't exist
- **Fix:** Check credentials, sign up if needed

**Error: 406 Not Acceptable**
- **Cause:** RLS enabled but no SELECT policy
- **Fix:** Add `CREATE POLICY ... FOR SELECT USING (true)`

**Error: Profile doesn't exist**
- **Cause:** Auth user created but profile insert failed
- **Fix:** `getProfile()` now auto-creates missing profiles

**Video upload fails**
- **Cause:** File too large or missing RLS policy on storage bucket
- **Fix:** Check file size (max 100MB), run storage policies

## Future Enhancements

### Planned Features
- [ ] Video editing studio (trim, filters, captions)
- [ ] Live streaming
- [ ] Playlists
- [ ] Video analytics (watch time, retention)
- [ ] Trending algorithm
- [ ] Community posts
- [ ] Shorts (vertical videos)
- [ ] Channel customization
- [ ] Revenue/monetization
- [ ] Report/moderation system

### Nice-to-Haves
- [ ] Dark/light theme toggle
- [ ] Custom video player controls
- [ ] Picture-in-picture mode
- [ ] Video download option
- [ ] Subtitle support
- [ ] Multiple audio tracks
- [ ] 4K/HDR support
- [ ] PWA (offline support)

## Support

For issues or questions:
1. Check this documentation
2. Review console errors
3. Check Supabase dashboard (logs, policies)
4. Test with simplified inputs
5. Search existing code for similar patterns

---

**Last Updated:** 2026-01-02
**Version:** 2.0.0
**Maintainer:** Ruel McNeil
