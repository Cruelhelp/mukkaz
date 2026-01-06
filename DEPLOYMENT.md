# 🚀 Mukkaz Deployment Guide

Modern video sharing platform built with vanilla JavaScript and Supabase.

## 📋 Prerequisites

- [Supabase](https://supabase.com) account
- [Vercel](https://vercel.com) account (for Cloudflare Stream API proxy)
- (Optional) [Cloudflare Stream](https://cloudflare.com/products/cloudflare-stream/) account

## 🎯 Quick Deployment

### 1. Database Setup (Supabase)

1. **Create Supabase Project**
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Create new project
   - Note your project URL and anon key

2. **Run Database Migrations**
   - Go to SQL Editor in Supabase
   - Run scripts in order:
     1. `sql/SETUP_POLICIES.sql` - Base tables and policies
     2. `sql/DATABASE_UPDATES.sql` - Additional features
     3. `sql/ADD_MISSING_COLUMNS.sql` - Upload system columns

3. **Create Storage Buckets**
   - Go to Storage in Supabase
   - Create these buckets (all public):
     - `videos` - Video files
     - `thumbnails` - Video thumbnails
     - `avatars` - User avatars

4. **Configure App**
   - Copy `config.local.js.example` to `config.local.js`
   - Add your Supabase credentials:
     ```javascript
     window.APP_CONFIG = {
       supabase: {
         url: 'your_supabase_url',
         publishableKey: 'your_anon_key'
       }
     };
     ```

### 2. Deploy to Vercel

1. **Install Vercel CLI** (optional)
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```
   Or connect your GitHub repo to Vercel dashboard

3. **Set Environment Variables** (for Cloudflare Stream)
   - Go to Project Settings → Environment Variables
   - Add:
     - `CF_ACCOUNT_ID` - Your Cloudflare account ID
     - `CF_STREAM_TOKEN` - Your Cloudflare Stream API token
   - See `docs/CLOUDFLARE_SETUP.md` for details

### 3. (Optional) Cloudflare Stream

If you want professional video hosting with adaptive streaming:

1. Follow `docs/CLOUDFLARE_SETUP.md`
2. Add credentials to Vercel environment variables
3. Redeploy

**Note:** App works without Cloudflare - it automatically falls back to Supabase Storage.

## 📁 Project Structure

```
mukkaz-main/
├── api/                    # Vercel serverless functions
│   └── cloudflare/        # Cloudflare Stream API proxy
├── assets/                # Images and icons
│   ├── favicon.ico
│   ├── favicon.png
│   └── logo.png
├── css/                   # Stylesheets
│   ├── styles.css
│   └── youtube-redesign.css
├── docs/                  # Documentation
│   ├── CLOUDFLARE_SETUP.md
│   ├── QUICK_FIX.md
│   ├── TESTING_CHECKLIST.md
│   └── UPLOAD_FIX_SUMMARY.md
├── js/                    # JavaScript modules
│   ├── age-gate.js       # Age verification
│   ├── analytics.js      # Analytics integration
│   ├── app.js            # Main app logic
│   ├── admin.js          # Admin panel
│   ├── cloudflare-stream.js  # Cloudflare Stream SDK
│   ├── components.js     # UI components
│   ├── config.js         # App configuration
│   ├── config.cloudflare.js  # Cloudflare config
│   ├── growthbook.js     # Feature flags
│   ├── icons.js          # SVG icons
│   ├── supabase.js       # Supabase client
│   ├── utils.js          # Utility functions
│   └── video-editor*.js  # Video editing tools
├── sql/                   # Database scripts
│   ├── ADD_MISSING_COLUMNS.sql
│   ├── DATABASE_UPDATES.sql
│   └── SETUP_POLICIES.sql
├── index.html            # Homepage
├── upload.html           # Video upload page
├── watch.html            # Video player
├── profile.html          # User profile
├── admin.html            # Admin panel
├── .env.example          # Environment variables template
├── config.local.js.example  # Local config template
└── package.json          # Dependencies
```

## 🔧 Configuration Files

### Required Files to Create

1. **config.local.js** (copy from `config.local.js.example`)
   ```javascript
   window.APP_CONFIG = {
     supabase: {
       url: 'YOUR_SUPABASE_URL',
       publishableKey: 'YOUR_SUPABASE_ANON_KEY'
     }
   };
   ```

2. **.env** (for Vercel, optional for Cloudflare)
   ```bash
   CF_ACCOUNT_ID=your_cloudflare_account_id
   CF_STREAM_TOKEN=your_cloudflare_stream_token
   ```

## 🧪 Testing

1. **Run Locally**
   - Use a local server (not `file://`)
   - Python: `python -m http.server 8000`
   - Node: `npx serve`

2. **Test Checklist**
   - [ ] User registration/login
   - [ ] Video upload (Supabase fallback)
   - [ ] Video playback
   - [ ] Comments system
   - [ ] Like/dislike
   - [ ] User profiles
   - [ ] (Optional) Cloudflare Stream upload

See `docs/TESTING_CHECKLIST.md` for detailed testing guide.

## 🐛 Troubleshooting

### Upload Fails with 400 Error
**Solution:** Run `sql/ADD_MISSING_COLUMNS.sql` in Supabase SQL Editor

### Videos Don't Play
**Solution:**
1. Check Supabase Storage buckets are public
2. Verify storage policies are applied
3. Check browser console for errors

### Cloudflare 403 Error
**Solution:**
1. Verify `CF_STREAM_TOKEN` is set in Vercel
2. Check token has `Stream:Edit` permission
3. Redeploy Vercel project
4. App will auto-fallback to Supabase if Cloudflare fails

### Database Permission Errors
**Solution:**
1. Run `sql/SETUP_POLICIES.sql`
2. Verify RLS is enabled on all tables
3. Check bucket policies in Storage settings

## 📚 Additional Documentation

- `docs/CLOUDFLARE_SETUP.md` - Cloudflare Stream setup
- `docs/QUICK_FIX.md` - Common issues and fixes
- `docs/TESTING_CHECKLIST.md` - Testing guide
- `docs/UPLOAD_FIX_SUMMARY.md` - Upload system details
- `README.md` - Project overview

## 🔐 Security Notes

- Never commit `config.local.js` or `.env` files
- Supabase anon key is safe for client-side use
- Cloudflare Stream token must be in Vercel env vars (server-side only)
- All sensitive operations use Supabase RLS policies

## 📝 License

See LICENSE file for details.

## 🤝 Support

For issues and questions:
1. Check `docs/` folder for detailed guides
2. Review Supabase dashboard for errors
3. Check browser console for client-side errors
4. Verify all SQL migrations have been run

## 🎉 Post-Deployment

After successful deployment:
1. ✅ Test user registration
2. ✅ Upload a test video
3. ✅ Verify video playback
4. ✅ Check responsive design on mobile
5. ✅ Monitor Supabase storage quota
6. ✅ (Optional) Configure Cloudflare Stream

**Your video platform is now live! 🚀**
