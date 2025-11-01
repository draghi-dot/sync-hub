# Quick Deployment Checklist

## 🚀 Deploy to Vercel in 5 Steps

### Step 1: Push Code to GitHub
```bash
git init
git add .
git commit -m "Ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2: Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up
2. Click "Add New Project"
3. Import your GitHub repository
4. Click "Deploy" (we'll add env vars after)

### Step 3: Get Supabase Credentials
1. Go to [supabase.com](https://supabase.com) > Your Project
2. Settings > API
3. Copy:
   - **Project URL**
   - **anon public** key

### Step 4: Add Environment Variables in Vercel
1. In Vercel project > Settings > Environment Variables
2. Add these:

```
NEXT_PUBLIC_SUPABASE_URL=paste_your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste_your_anon_key
```

**Optional** (for transcription):
```
GOOGLE_API_KEY=your_google_api_key
```

3. Click "Save"
4. Go to Deployments tab > Click "..." on latest deployment > "Redeploy"

### Step 5: Update Supabase Settings
1. Supabase Dashboard > Authentication > URL Configuration
2. **Site URL**: `https://your-project.vercel.app`
3. **Redirect URLs**: Add:
   - `https://your-project.vercel.app/auth/callback`
   - `https://your-project.vercel.app/feed`

## ✅ Final Checklist

- [ ] Code pushed to GitHub
- [ ] Deployed to Vercel
- [ ] Environment variables added
- [ ] Supabase redirect URLs updated
- [ ] Test the live site!

## 🔧 Need Help?

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

