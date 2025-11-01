# Fix: API Key Service Blocked

## The Error

```
API_KEY_SERVICE_BLOCKED
"Requests to this API speech.googleapis.com method google.cloud.speech.v1.Speech.Recognize are blocked."
```

This means your API key has restrictions that are blocking access to the Speech-to-Text API.

## Solution: Update API Key Restrictions

### Step 1: Go to Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're signed in
3. Select project: **394354259656**

### Step 2: Find and Edit Your API Key

1. Go to **APIs & Services** → **Credentials**
   - Direct link: https://console.cloud.google.com/apis/credentials?project=394354259656
2. Find your API key: `AIzaSyD7Mli9b9OPjkcXPW4yVemdame4iNMwNDs`
3. Click on the API key to edit it

### Step 3: Fix API Restrictions

You'll see a section called **"API restrictions"**. You have two options:

#### Option A: Don't Restrict Key (Easiest - Recommended for Testing)

1. Select **"Don't restrict key"**
2. Click **"SAVE"** at the bottom
3. This allows the key to access all enabled APIs

#### Option B: Restrict Key Properly (More Secure)

1. Select **"Restrict key"**
2. Under **"API restrictions"**, select **"Restrict key"**
3. In the dropdown/search box, find and check:
   - ✅ **Cloud Speech-to-Text API**
4. Make sure NO other restrictions are blocking it
5. Click **"SAVE"**

### Step 4: Check Application Restrictions (If Any)

If you have **"Application restrictions"** set:
1. Make sure it's set to **"None"** (for testing)
2. OR ensure your domain/IP is properly configured

### Step 5: Verify API is Enabled

Double-check the API is still enabled:
1. Go to **APIs & Services** → **Library**
2. Search for **"Cloud Speech-to-Text API"**
3. Should show **"ENABLED"** with a checkmark
4. If not, click **"ENABLE"**

### Step 6: Wait and Test

1. Wait 1-2 minutes for changes to propagate
2. Restart your Next.js server (Ctrl+C, then `npm run dev`)
3. Try the meeting transcription again

## If Still Not Working

### Option 1: Regenerate API Key

Sometimes it's easier to create a new key:

1. Go to **APIs & Services** → **Credentials**
2. Find your current API key
3. Click the trash icon to delete it
4. Click **"CREATE CREDENTIALS"** → **"API Key"**
5. Copy the new key
6. **Important**: Immediately edit the new key and set restrictions (choose Option A or B above)
7. Update `.env.local` with the new key:
   ```bash
   GOOGLE_API_KEY=YOUR_NEW_KEY_HERE
   ```
8. Restart your server

### Option 2: Check Billing

Make sure billing is enabled:
1. Go to **Billing**
2. Ensure a billing account is linked to project **394354259656**
3. Even if you're using free tier, billing must be set up

## Quick Checklist

✅ API Key exists: `AIzaSyD7Mli9b9OPjkcXPW4yVemdame4iNMwNDs`
✅ API restrictions: Either "Don't restrict key" OR includes "Cloud Speech-to-Text API"
✅ Application restrictions: Either "None" OR properly configured
✅ Cloud Speech-to-Text API: Enabled
✅ Billing: Linked to project
✅ `.env.local`: Contains `GOOGLE_API_KEY=AIzaSyD7Mli9b9OPjkcXPW4yVemdame4iNMwNDs`
✅ Server: Restarted after changes

## Your Project Info

- **Project ID:** 394354259656
- **API Key:** AIzaSyD7Mli9b9OPjkcXPW4yVemdame4iNMwNDs
- **Issue:** API key service blocked
- **Fix:** Update API restrictions in Google Cloud Console

