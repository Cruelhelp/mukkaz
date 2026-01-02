# Mukkaz

A modern video sharing platform built with vanilla JavaScript and Supabase.

## Features

- User authentication (sign up, sign in, sign out)
- Video upload with thumbnails
- Video playback with Video.js
- Comments system
- Like/Dislike functionality
- User profiles with avatar management
- Responsive design
- Clean, YouTube-inspired UI

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL, Storage, Auth)
- **Video Player**: Video.js
- **Icons**: Custom SVG icons

## Setup Instructions

### 1. Supabase Configuration

The Supabase project is already configured with:
- **URL**: `https://htoxqclnmzyuxxojkvwz.supabase.co`
- **Publishable Key**: (Already set in `supabase.js`)

### 2. Database Tables

Tables have been created with the following schema:

```sql
-- Profiles Table
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  updated_at timestamp with time zone
);

-- Videos Table
create table public.videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  description text,
  url text not null,
  thumbnail_url text,
  views_count bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Comments Table
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references public.videos(id) not null,
  user_id uuid references public.profiles(id) not null,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Video Votes Table
create table public.video_votes (
  video_id uuid references public.videos(id) not null,
  user_id uuid references public.profiles(id) not null,
  vote_type text check (vote_type in ('like', 'dislike')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (video_id, user_id)
);
```

### 3. Storage Buckets

Create the following storage buckets in Supabase Dashboard -> Storage:

1. **videos** - For video files
2. **thumbnails** - For video thumbnails
3. **avatars** - For user profile pictures

**Important**: Make all buckets **public** for read access:
- Go to each bucket settings
- Set policies to allow public read access
- Allow authenticated insert/update for own data

### 4. Row Level Security (RLS) Policies

Enable RLS and create policies in Supabase Dashboard -> Authentication -> Policies:

**Profiles:**
```sql
-- Allow public read
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true);

-- Allow users to update own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);
```

**Videos:**
```sql
-- Allow public read
CREATE POLICY "Videos are viewable by everyone"
ON videos FOR SELECT
USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can upload videos"
ON videos FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update own videos
CREATE POLICY "Users can update own videos"
ON videos FOR UPDATE
USING (auth.uid() = user_id);
```

**Comments:**
```sql
-- Allow public read
CREATE POLICY "Comments are viewable by everyone"
ON comments FOR SELECT
USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Authenticated users can comment"
ON comments FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```

**Video Votes:**
```sql
-- Allow users to view votes
CREATE POLICY "Votes are viewable by everyone"
ON video_votes FOR SELECT
USING (true);

-- Allow authenticated users to vote
CREATE POLICY "Authenticated users can vote"
ON video_votes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update/delete own votes
CREATE POLICY "Users can update own votes"
ON video_votes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
ON video_votes FOR DELETE
USING (auth.uid() = user_id);
```

### 5. Storage Policies

For each storage bucket (videos, thumbnails, avatars), add these policies:

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'BUCKET_NAME');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'BUCKET_NAME' AND auth.role() = 'authenticated');
```

Replace `BUCKET_NAME` with: `videos`, `thumbnails`, or `avatars`

### 6. Running the Application

Since this is a static site, you can run it in multiple ways:

**Option 1: Simple HTTP Server (Python)**
```bash
cd Mukkaz
python -m http.server 8000
```
Then open: http://localhost:8000

**Option 2: Live Server (VS Code Extension)**
- Install "Live Server" extension in VS Code
- Right-click `index.html` and select "Open with Live Server"

**Option 3: Direct File Access**
Simply open `index.html` in your browser (some features may not work due to CORS)

### 7. Logo Setup

Place your `logo.png` file in the root directory of the project. The logo should be:
- Square or horizontal format
- Transparent background (PNG)
- Recommended size: 200x200px or 400x100px

## File Structure

```
Mukkaz/
├── index.html          # Home page with video grid
├── watch.html          # Video player page
├── upload.html         # Video upload page
├── profile.html        # User profile page
├── styles.css          # All styling
├── app.js              # Main application logic
├── supabase.js         # Supabase client and API functions
├── utils.js            # Utility functions
├── icons.js            # SVG icon components
├── logo.png            # Site logo
└── README.md           # This file
```

## Usage

### Creating an Account
1. Click "Sign In" in the navbar
2. Click "Sign Up" in the modal
3. Enter username, email, and password
4. Check your email for verification link
5. Sign in with your credentials

### Uploading a Video
1. Sign in to your account
2. Click the upload icon in the navbar or go to Upload page
3. Select a video file (MP4, WebM, or AVI - max 100MB)
4. Select a thumbnail image (JPG, PNG, or WebP - max 5MB)
5. Enter video title and description
6. Click "Upload Video"
7. Wait for upload to complete

### Watching Videos
1. Click on any video card from the home page
2. Video will auto-load and play
3. Like/Dislike the video
4. Add comments (requires sign in)

### Managing Profile
1. Sign in and click your avatar in the navbar
2. View your uploaded videos
3. Click "Change Avatar" to update profile picture

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security Notes

- Never commit your Supabase keys to public repositories
- The publishable key is safe for client-side use
- Keep your Supabase service role key private
- Enable email verification in Supabase Auth settings

## Troubleshooting

**Videos not uploading:**
- Check storage bucket policies are set to public
- Verify file size limits (100MB for videos, 5MB for thumbnails)
- Check browser console for errors

**Comments not showing:**
- Ensure RLS policies are enabled for comments table
- Check if user is authenticated

**Authentication errors:**
- Verify Supabase URL and keys in `supabase.js`
- Check email verification settings in Supabase dashboard

## Future Enhancements

- Video categories/tags
- Search functionality
- User subscriptions
- Video recommendations
- Playlist support
- Video analytics
- Share to social media
- Video editing before upload

## License

MIT License - Feel free to use for personal or commercial projects

## Credits

Built by Ruel McNeil
Powered by Supabase
