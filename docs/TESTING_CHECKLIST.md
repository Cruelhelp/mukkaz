# Upload Fix Testing Checklist

## Pre-Testing Setup

### Check Supabase Configuration
- [ ] Verify Supabase buckets exist:
  - Navigate to: Project → Storage
  - Confirm `videos` bucket exists
  - Confirm `thumbnails` bucket exists
- [ ] Verify storage policies applied (run `SETUP_POLICIES.sql` if needed)
- [ ] Check storage quota/limits in Supabase dashboard

### Optional: Cloudflare Configuration
- [ ] Set `CF_STREAM_TOKEN` in Vercel (see `CLOUDFLARE_SETUP.md`)
- [ ] Redeploy Vercel project after adding env variables
- [ ] Wait 2-3 minutes for deployment to complete

## Test 1: Supabase Fallback Upload (Default)

### Upload Test
1. [ ] Navigate to `/upload.html`
2. [ ] Ensure you're logged in
3. [ ] Select a test video file (recommend <50MB for faster testing)
4. [ ] Fill in required fields:
   - [ ] Video title
   - [ ] Description
   - [ ] At least one tag
   - [ ] Select visibility
5. [ ] Select/upload thumbnail
6. [ ] Click "Upload Video"

### Expected Behavior (Console Monitoring)
Open browser console (F12) and watch for:
- [ ] `⚠️ Cloudflare Stream failed, falling back to Supabase` message
- [ ] Progress bar shows upload progress
- [ ] Status text shows: "Uploading to Supabase (Cloudflare unavailable)..."
- [ ] `✅ Supabase fallback upload successful` message
- [ ] Status changes to "Uploading thumbnail..."
- [ ] Status changes to "Saving video data..."
- [ ] Success notification shows "Video uploaded successfully via Supabase Storage!"
- [ ] Redirects to watch page after 2 seconds

### Database Verification
Check the video record in Supabase:
1. [ ] Go to Supabase → Table Editor → videos
2. [ ] Find your uploaded video
3. [ ] Verify fields:
   - [ ] `url` field contains Supabase storage URL
   - [ ] `stream_id` is NULL
   - [ ] `thumbnail_url` contains Supabase storage URL
   - [ ] All other metadata is correct

### Playback Test
1. [ ] Video player loads correctly on watch page
2. [ ] Video plays without errors
3. [ ] Thumbnail displays correctly
4. [ ] Video metadata (title, description, tags) displays correctly
5. [ ] Video controls work (play, pause, seek, volume)

## Test 2: Cloudflare Stream Upload (If Configured)

### Upload Test
Same steps as Test 1 above

### Expected Behavior (Console Monitoring)
Open browser console (F12) and watch for:
- [ ] Status text shows: "Uploading to Cloudflare Stream..."
- [ ] Progress bar shows upload progress
- [ ] Status changes to "Processing video..."
- [ ] `✅ Cloudflare Stream upload successful` message
- [ ] Status changes to "Uploading thumbnail..."
- [ ] Status changes to "Saving video data..."
- [ ] Success notification shows "Video uploaded successfully via Cloudflare Stream!"
- [ ] Redirects to watch page after 2 seconds

### Database Verification
Check the video record in Supabase:
1. [ ] Go to Supabase → Table Editor → videos
2. [ ] Find your uploaded video
3. [ ] Verify fields:
   - [ ] `stream_id` contains Cloudflare video UID
   - [ ] `stream_url` contains `https://videodelivery.net/[uid]/manifest/video.m3u8`
   - [ ] `url` is NULL or empty
   - [ ] `thumbnail_url` contains Supabase storage URL
   - [ ] All other metadata is correct

### Playback Test
1. [ ] Video player loads correctly on watch page
2. [ ] Video uses HLS streaming (adaptive quality)
3. [ ] Thumbnail displays correctly
4. [ ] Video metadata displays correctly
5. [ ] Video controls work
6. [ ] Adaptive quality works (check network panel)

## Test 3: Mixed Video Types Display

### Homepage Test
1. [ ] Navigate to index.html
2. [ ] Verify both Cloudflare and Supabase videos display in feed
3. [ ] Click on Cloudflare video → plays correctly
4. [ ] Click on Supabase video → plays correctly

### My Videos Test
1. [ ] Navigate to my-videos.html
2. [ ] Verify all your videos display correctly
3. [ ] Check both video types in your list

### Profile Page Test
1. [ ] Navigate to profile page
2. [ ] Verify uploaded videos display in user's video list

## Test 4: Error Handling

### Network Error Test
1. [ ] Open DevTools → Network tab
2. [ ] Start uploading a video
3. [ ] Set network to "Offline" mid-upload
4. [ ] Verify error message displays
5. [ ] Verify upload can be retried

### Invalid File Test
1. [ ] Try uploading a non-video file
2. [ ] Verify proper error message
3. [ ] Verify UI doesn't break

### Large File Test
1. [ ] Upload a very large video (>500MB if quota allows)
2. [ ] Verify progress bar updates smoothly
3. [ ] Verify upload completes or shows quota error

## Test 5: Browser Compatibility

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on Mac/iOS)
- [ ] Mobile browser (Chrome/Safari)

## Common Issues & Solutions

### Issue: 403 Error Still Appears
**Solution**:
- Clear browser cache
- Check Vercel environment variables are set
- Ensure Vercel project was redeployed after adding variables

### Issue: Supabase Upload Fails
**Solution**:
- Check Supabase storage quota not exceeded
- Verify storage policies are applied
- Check browser console for specific error
- Ensure `videos` and `thumbnails` buckets exist

### Issue: Video Doesn't Play
**Solution**:
- Check browser console for errors
- Verify video URL in database is accessible
- Check CSP headers allow video sources
- Try different browser

### Issue: Upload Progress Stuck
**Solution**:
- Check network connection
- Verify file size within limits
- Check browser console for errors
- Try smaller test file

## Success Criteria

All tests pass if:
- ✅ Videos upload successfully via Supabase (default)
- ✅ Videos upload successfully via Cloudflare (if configured)
- ✅ Both video types play correctly
- ✅ Mixed video types display correctly across all pages
- ✅ Error handling works as expected
- ✅ Progress tracking works smoothly
- ✅ Database records are correct

## Reporting Issues

If tests fail:
1. Note which test failed
2. Copy error messages from console
3. Screenshot the issue
4. Check database record for the failed upload
5. Verify Supabase storage policies
6. Check Supabase storage quota
