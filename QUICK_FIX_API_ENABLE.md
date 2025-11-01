# Quick Fix: Enable Speech-to-Text API

## The Issue

Your Google API key is working, but the **Cloud Speech-to-Text API is not enabled** in your Google Cloud project.

## One-Click Fix

Google has provided a direct link to enable the API for your project:

👉 **[Click here to enable the API](https://console.developers.google.com/apis/api/speech.googleapis.com/overview?project=394354259656)**

## What to Do

1. **Click the link above** (or copy it into your browser)
2. You'll see the Cloud Speech-to-Text API page
3. Click the big blue **"ENABLE"** button
4. Wait 1-2 minutes for it to activate
5. **Restart your Next.js server** (Ctrl+C, then `npm run dev`)
6. Try the meeting transcription again

## Verify It's Enabled

After enabling, you can verify:
- The page should show "API Enabled" or a green checkmark
- The button should change from "ENABLE" to "MANAGE"

## Still Not Working?

If it's still giving errors after 2-3 minutes:
1. Make sure billing is enabled (Google requires it even for free tier)
2. Check that your API key has proper permissions (see `ENABLE_GOOGLE_SPEECH_API.md`)
3. Wait a few more minutes - sometimes it takes time to propagate

## Your Project Info

- **Project ID:** 394354259656
- **API:** Cloud Speech-to-Text API
- **Direct Activation URL:** https://console.developers.google.com/apis/api/speech.googleapis.com/overview?project=394354259656

