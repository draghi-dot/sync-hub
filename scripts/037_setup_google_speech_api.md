# Setup Google Speech-to-Text API for Meeting Transcription

This guide explains how to set up Google Speech-to-Text API for meeting transcription.

## Option 1: Using Google API Key (Recommended if you have a Google API key)

### Step 1: Enable Google Speech-to-Text API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Cloud Speech-to-Text API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Cloud Speech-to-Text API"
   - Click "Enable"

### Step 2: Create API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the API key (it will start with `AIza`)

### Step 3: Add Environment Variable

Add your Google API key to your environment variables:

**For local development** (`.env.local`):
```
GOOGLE_API_KEY=AIzaSyDhTm-xtWd-9iLjjGyyXfB4MY1-yFwff9w
```

**For production** (Vercel, Netlify, etc.):
- Add `GOOGLE_API_KEY` as an environment variable in your deployment platform's settings

## Option 2: Using OpenAI Whisper API (Alternative)

If you prefer to use OpenAI instead:

1. Get an API key from [OpenAI Platform](https://platform.openai.com/)
2. Add to environment variables:
```
OPENAI_API_KEY=sk-...
```

## API Priority

The transcription API will:
1. **First** try to use `GOOGLE_API_KEY` (or `NEXT_PUBLIC_GOOGLE_API_KEY`)
2. **Fallback** to `OPENAI_API_KEY` if Google key is not available

## Notes

- Google API key can be exposed in client-side code (if using `NEXT_PUBLIC_GOOGLE_API_KEY`)
- For better security, restrict your Google API key to only allow Speech-to-Text API
- Google Speech-to-Text API has a free tier with limits
- Make sure your API key has Speech-to-Text API enabled in Google Cloud Console

