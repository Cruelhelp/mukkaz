# Cloudflare Stream Setup Guide

## Overview
Mukkaz supports two video hosting options:
1. **Cloudflare Stream** (Primary) - Professional CDN with adaptive streaming
2. **Supabase Storage** (Fallback) - Automatic fallback if Cloudflare is unavailable

## Setting Up Cloudflare Stream

### Step 1: Get Your Account ID
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Your Account ID is displayed in the right sidebar
3. Copy this ID (format: `13faa7514f6b0dfd763ca79c8a3cc3f4`)

### Step 2: Create Stream API Token
1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use the **Edit Cloudflare Stream** template
4. Configure permissions:
   - **Permissions**: `Stream:Edit`
   - **Account Resources**: Select your account
5. Click **Continue to Summary** → **Create Token**
6. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### Step 3: Configure Vercel Environment Variables
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Mukkaz project
3. Navigate to **Settings** → **Environment Variables**
4. Add these variables:
   - **Name**: `CF_ACCOUNT_ID`
     - **Value**: Your Cloudflare Account ID
   - **Name**: `CF_STREAM_TOKEN`
     - **Value**: Your Cloudflare Stream API token
5. Select all environments (Production, Preview, Development)
6. Click **Save**

### Step 4: Redeploy
1. Go to **Deployments** tab
2. Click the **...** menu on your latest deployment
3. Select **Redeploy**
4. Check "Use existing Build Cache" is OFF
5. Click **Redeploy**

## Verifying Setup

### Test Cloudflare Connection
Upload a test video and check the browser console:
- ✅ **Success**: You'll see `✅ Cloudflare Stream upload successful`
- ⚠️ **Fallback**: You'll see `⚠️ Cloudflare Stream failed, falling back to Supabase`

### Common Issues

#### 403 Authorization Error
**Cause**: Invalid or missing `CF_STREAM_TOKEN`
**Fix**:
1. Verify token is correctly copied (no extra spaces)
2. Ensure token has `Stream:Edit` permission
3. Check token hasn't expired
4. Create a new token if needed

#### 404 Not Found
**Cause**: Invalid `CF_ACCOUNT_ID`
**Fix**: Double-check your Account ID from Cloudflare dashboard

#### Upload Still Failing
**Cause**: Environment variables not loaded
**Fix**:
1. Ensure you redeployed after adding variables
2. Check variables are set for the correct environment
3. Wait 2-3 minutes after deployment for changes to propagate

## Supabase Fallback

If Cloudflare Stream fails or is not configured, uploads automatically use Supabase Storage:

### Advantages
- ✅ No additional configuration needed
- ✅ Integrated with existing Supabase setup
- ✅ Works immediately out of the box

### Considerations
- ⚠️ No adaptive streaming (fixed quality)
- ⚠️ Higher bandwidth costs for large traffic
- ⚠️ Less CDN optimization

## Cost Comparison

### Cloudflare Stream
- $5/month per 1,000 minutes stored
- $1 per 1,000 minutes delivered
- Unlimited viewers
- Built-in CDN

### Supabase Storage
- Free tier: 1GB storage + 2GB bandwidth
- Pro: $25/month (100GB storage + 200GB bandwidth)
- Additional: $0.021/GB storage, $0.09/GB bandwidth

## Best Practice
**Use Cloudflare Stream for production** - It's optimized for video delivery and provides better user experience with adaptive streaming.
