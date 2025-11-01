# Deployment Guide for Sync Hub

This guide will help you deploy your Sync Hub application to Vercel (recommended for Next.js).

## Prerequisites

1. **GitHub Account** (or GitLab/Bitbucket)
2. **Vercel Account** (free tier available)
3. **Supabase Project** (already set up)
4. **Google API Key** (for transcription - optional)

## Step 1: Prepare Your Code

### 1.1 Initialize Git Repository (if not already done)

```bash
git init
git add .
git commit -m "Initial commit"
```

### 1.2 Push to GitHub

1. Create a new repository on GitHub
2. Push your code:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

### 2.1 Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with GitHub
3. Click "Add New Project"
4. Import your GitHub repository

### 2.2 Configure Project Settings

- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `./` (leave as default)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

### 2.3 Add Environment Variables

Add these environment variables in Vercel's project settings:

#### Required Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Optional (for transcription):

```
GOOGLE_API_KEY=your_google_api_key
# OR
OPENAI_API_KEY=your_openai_api_key
```

#### Optional (for WebRTC TURN servers):

```
NEXT_PUBLIC_TURN_URL=your_turn_server_url
NEXT_PUBLIC_TURN_USERNAME=your_turn_username
NEXT_PUBLIC_TURN_CREDENTIAL=your_turn_credential
```

**How to find Supabase credentials:**
1. Go to your Supabase project dashboard
2. Click "Settings" (gear icon) > "API"
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.4 Deploy

1. Click "Deploy"
2. Wait for the build to complete (usually 2-3 minutes)
3. Your app will be live at `https://your-project.vercel.app`

## Step 3: Configure Supabase

### 3.1 Update Supabase Redirect URLs

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your Vercel URL to **Site URL**: `https://your-project.vercel.app`
3. Add to **Redirect URLs**:
   - `https://your-project.vercel.app/auth/callback`
   - `https://your-project.vercel.app/feed`

### 3.2 Run Database Scripts

Make sure all SQL scripts in the `scripts/` folder have been run in Supabase SQL Editor:

**Critical Scripts (in order):**
1. `001_create_profiles.sql` - Creates profiles table
2. `002_create_chat_members.sql` - Creates chat members table
3. `009_create_chats.sql` or `001_create_chats.sql` - Creates chats table
4. `011_create_messages.sql` - Creates messages table
5. `027_create_user_departments.sql` - Creates user_departments table
6. `038_add_chat_avatar.sql` - Adds avatar_url to chats
7. `039_add_post_type_checkin.sql` - Adds post_type to posts
8. `042_fix_group_chat_rls.sql` - Fixes group chat RLS
9. `047_fix_all_recursion.sql` - Fixes recursion issues
10. `024_setup_storage_policies.sql` - Sets up storage RLS

**All scripts are in the `scripts/` folder. Run them in Supabase SQL Editor.**

### 3.3 Create Storage Buckets

1. Go to Supabase Dashboard > Storage
2. Create a bucket named `chat-files`
3. Make it **Public** (or set up proper RLS policies)
4. Run `scripts/024_setup_storage_policies.sql` in SQL Editor

## Step 4: Post-Deployment Checklist

- [ ] Environment variables added to Vercel
- [ ] Supabase redirect URLs updated
- [ ] All database scripts run
- [ ] Storage bucket created
- [ ] RLS policies configured
- [ ] Test login/signup
- [ ] Test group chat creation
- [ ] Test meeting transcription (if using)

## Step 5: Custom Domain (Optional)

1. In Vercel dashboard, go to your project > Settings > Domains
2. Add your domain
3. Follow Vercel's DNS configuration instructions
4. Update Supabase redirect URLs to include your custom domain

## Troubleshooting

### Build Fails

- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Check for TypeScript errors

### Authentication Not Working

- Verify redirect URLs in Supabase
- Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct

### Database Errors

- Ensure all SQL scripts have been run
- Check RLS policies are correctly set
- Verify user has proper permissions

### Storage Errors

- Ensure `chat-files` bucket exists
- Run storage RLS policies script
- Check bucket is public or RLS allows access

## Quick Deploy Command (Alternative)

You can also deploy via Vercel CLI:

```bash
npm i -g vercel
vercel login
vercel
```

Then add environment variables via Vercel dashboard or CLI.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Your Supabase anon/public key |
| `GOOGLE_API_KEY` | ⚠️ Optional | For meeting transcription (Google Speech-to-Text) |
| `OPENAI_API_KEY` | ⚠️ Optional | For meeting transcription (OpenAI Whisper) |
| `NEXT_PUBLIC_TURN_URL` | ⚠️ Optional | TURN server URL for WebRTC |
| `NEXT_PUBLIC_TURN_USERNAME` | ⚠️ Optional | TURN server username |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | ⚠️ Optional | TURN server credential |

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure all database scripts have been run

