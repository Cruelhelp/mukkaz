# 🚨 Quick Fix - Run This First!

## The Problem
Your videos table is missing required columns for the new upload system.

**Error you're seeing:**
```
Failed to load resource: 400 (Bad Request)
Upload error: Object
```

## The Solution (2 minutes)

### Step 1: Add Missing Database Columns

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project: `htoxqclnmzyuxxojkvwz`

2. **Run the Migration**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**
   - Copy **ALL** the contents of `ADD_MISSING_COLUMNS.sql`
   - Paste into the SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)

3. **Verify Success**
   You should see: `Success. No rows returned`

### Step 2: Test Upload Again

1. Refresh your upload page (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. Upload a test video
3. Check console - you should see:
   ```
   ⚠️ Cloudflare Stream failed, falling back to Supabase
   ✅ Supabase fallback upload successful
   Video uploaded successfully via Supabase Storage!
   ```
4. You'll be redirected to the watch page
5. Video should play perfectly!

## What Changed

### Columns Added to `videos` Table:
- ✅ `tags` - Video tags/categories
- ✅ `duration` - Video length in seconds
- ✅ `resolution` - Video resolution (e.g., "1920x1080")
- ✅ `is_public` - Visibility control (true/false)
- ✅ `stream_id` - Cloudflare Stream video ID (for CF videos)
- ✅ `stream_url` - Cloudflare HLS URL (for CF videos)

### Why These Are Needed:
- **Dual Upload Support**: Handle both Cloudflare Stream and Supabase videos
- **Better Metadata**: Store video properties for better UX
- **Flexibility**: Switch between upload providers seamlessly

## After Running Migration

### The Upload Flow Will Be:
1. ⚠️ Try Cloudflare Stream (will fail if token not set)
2. ✅ Fall back to Supabase Storage (always works)
3. ✅ Save video metadata to database
4. ✅ Redirect to watch page
5. ✅ Video plays perfectly

### Both Video Types Work:
- **Cloudflare videos**: Use `stream_id` + `stream_url`
- **Supabase videos**: Use `url` field
- **Video player**: Automatically detects and plays both types

## Troubleshooting

### Still Getting 400 Error?
1. Verify migration ran successfully in SQL Editor
2. Check for any SQL errors in the output
3. Refresh your browser (clear cache)
4. Try uploading again

### Migration Failed?
If you see errors:
1. Copy the error message
2. Check if columns already exist (safe to ignore)
3. Run each ALTER TABLE statement individually if needed

### Need to Verify Columns Exist?
Run this in SQL Editor:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'videos'
ORDER BY ordinal_position;
```

You should see all the new columns listed.

## Expected Console Output (After Fix)

### Successful Upload:
```
⚠️ Cloudflare Stream failed, falling back to Supabase: Unexpected end of JSON input
Uploading to Supabase (Cloudflare unavailable)...
✅ Supabase fallback upload successful
Uploading thumbnail...
Saving video data...
Video uploaded successfully via Supabase Storage!
```

Then redirects to watch page.

## Next Steps (Optional)

After uploads work:
1. ✅ Configure Cloudflare Stream (see `CLOUDFLARE_SETUP.md`)
2. ✅ Run full testing checklist (see `TESTING_CHECKLIST.md`)
3. ✅ Monitor which upload method is being used

## Support

If still having issues:
1. Check browser console for specific errors
2. Verify all SQL ran successfully
3. Check Supabase storage quota
4. Ensure you're logged in when uploading

**Database migration must be run first before uploads will work!**
