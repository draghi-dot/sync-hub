# Enable Google Speech-to-Text API - Step by Step Guide

## The Error You're Seeing

```
Failed to transcribe audio with Google API: API key invalid or missing permissions. 
Please check that your Google API key has Speech-to-Text API enabled.
```

This means your API key doesn't have access to the Speech-to-Text API yet.

## Quick Fix Steps

### Step 1: Go to Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure you're signed in with the account that created the API key

### Step 2: Select or Create a Project

1. Click the project dropdown at the top (next to "Google Cloud")
2. If you see your project, select it
3. If not, click "New Project"
   - Give it a name (e.g., "Meeting Transcription")
   - Click "Create"
   - Wait for it to be created, then select it

### Step 3: Enable Speech-to-Text API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
   - Or go directly to: https://console.cloud.google.com/apis/library
2. In the search box, type: **"Cloud Speech-to-Text API"**
3. Click on **"Cloud Speech-to-Text API"** from the results
4. Click the big blue **"ENABLE"** button
5. Wait a few seconds for it to enable (you'll see a checkmark)

### Step 4: Verify API Key Has Access

1. Still in Google Cloud Console, go to **"APIs & Services"** → **"Credentials"**
   - Or: https://console.cloud.google.com/apis/credentials
2. Find your API key: `AIzaSyDhTm-xtWd-9iLjjGyyXfB4MY1-yFwff9w`
3. Click on it to edit
4. Under **"API restrictions"**:
   - Option A: Select **"Don't restrict key"** (easiest, less secure)
   - Option B: Select **"Restrict key"** and check **"Cloud Speech-to-Text API"**
5. Click **"SAVE"** at the bottom

### Step 5: Set Up Billing (Required)

Even though Google provides 60 minutes free per month, a billing account must be linked:

1. Go to **"Billing"** in the left sidebar
   - Or: https://console.cloud.google.com/billing
2. Click **"LINK A BILLING ACCOUNT"**
3. If you don't have one:
   - Click **"CREATE BILLING ACCOUNT"**
   - Fill in your information
   - Add a payment method (credit card)
   - **Note**: You won't be charged unless you exceed the free tier
4. Select the billing account and click **"SET ACCOUNT"**

### Step 6: Wait a Few Minutes

After enabling the API, it may take 1-2 minutes to propagate. Then:

1. Restart your Next.js server (Ctrl+C, then `npm run dev`)
2. Try the meeting again

## Verify Everything is Set Up

After completing the steps, verify:

✅ **API Enabled**: Go to APIs & Services > Library, search "Speech-to-Text", should show "ENABLED"

✅ **API Key Has Access**: Go to APIs & Services > Credentials, click your key, under "API restrictions" it should either be unrestricted or include "Cloud Speech-to-Text API"

✅ **Billing Linked**: Go to Billing, should show your project with a linked billing account

## Still Not Working?

### Check Server Logs

When you run the meeting, check your terminal where Next.js is running. You should see:

```
Using Google Speech-to-Text API
Audio file size: [number] bytes
Google API response status: [number] [status]
```

If you see status `403`, the API key doesn't have permissions.
If you see status `400`, there's a format issue (less likely).
If you see status `200`, it worked! The issue is elsewhere.

### Try Regenerating the API Key

1. Go to APIs & Services > Credentials
2. Find your API key
3. Click the trash icon to delete it
4. Click "CREATE CREDENTIALS" > "API Key"
5. Copy the new key
6. Update `.env.local` with the new key
7. Restart your server

## Need More Help?

Check the server terminal output - it will show the exact error from Google's API. Look for lines starting with:
- "Google API response status:"
- "Google Speech-to-Text error:"

These will tell you exactly what's wrong.

