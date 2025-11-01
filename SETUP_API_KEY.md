# Setup API Key for Meeting Transcription

You have a Google API key: `AIzaSyDhTm-xtWd-9iLjjGyyXfB4MY1-yFwff9w`

## Quick Setup Instructions

### Step 1: Add API Key to Environment Variables

Open your `.env.local` file (it should be in the root of your project) and add:

```bash
GOOGLE_API_KEY=AIzaSyDhTm-xtWd-9iLjjGyyXfB4MY1-yFwff9w
```

**Important**: 
- Make sure there are no spaces around the `=` sign
- Make sure there are no quotes around the key
- The file should be named exactly `.env.local` (starts with a dot)

### Step 2: Restart Your Development Server

After adding the key, you **must** restart your Next.js development server:

1. Stop the current server (Ctrl+C or Cmd+C)
2. Run `npm run dev` (or `pnpm dev`) again

### Step 3: Verify It Works

1. Join a meeting
2. Speak some words
3. Leave the meeting
4. Check the department chat - you should see a transcript file appear

## If You Still Get Errors

### Enable Google Speech-to-Text API

Your Google API key might not have the Speech-to-Text API enabled:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Library"
3. Search for "Cloud Speech-to-Text API"
4. Click "Enable"

### Check API Key Restrictions

1. Go to "APIs & Services" > "Credentials"
2. Find your API key
3. Click to edit it
4. Under "API restrictions", make sure "Don't restrict key" is selected, OR
5. Select "Restrict key" and ensure "Cloud Speech-to-Text API" is enabled

## File Location

Your `.env.local` file should be at:
```
/Users/iustinadraghici/Downloads/code (2)/.env.local
```

## Alternative: Use OpenAI Instead

If you prefer to use OpenAI, add this instead:
```bash
OPENAI_API_KEY=sk-...
```

The system will automatically use Google API if `GOOGLE_API_KEY` is set, otherwise it will use OpenAI.

