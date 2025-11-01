# Simple Fix for Google API Blocked Error

## What You Need to Do (5 Steps)

Your API key is **blocked** from using the Speech API. Here's how to fix it:

### Step 1: Open This Link
👉 **[Click here](https://console.cloud.google.com/apis/credentials?project=394354259656)**

### Step 2: Find Your API Key
Look for: `AIzaSyD7Mli9b9OPjkcXPW4yVemdame4iNMwNDs`
Click on it.

### Step 3: Fix the Restriction
Scroll down to **"API restrictions"** section.
- Click **"Don't restrict key"** (the radio button)
- OR click **"Restrict key"** and make sure **"Cloud Speech-to-Text API"** is checked

### Step 4: Save
Click the blue **"SAVE"** button at the bottom.

### Step 5: Wait & Restart
- Wait 1-2 minutes
- Restart your Next.js server (Ctrl+C, then `npm run dev`)
- Try the meeting again

## That's It!

After saving, the API should work. The error you're seeing means the key exists but is blocked from using this specific API.

---

## Alternative: Use OpenAI Instead

If you prefer not to fix Google API, add OpenAI key to `.env.local`:

```bash
OPENAI_API_KEY=sk-your-key-here
```

Then restart your server. The system will automatically fall back to OpenAI if Google fails.

