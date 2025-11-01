# Setup Meeting Transcription Feature

This document explains how to set up the meeting transcription feature that records meetings and generates transcripts using AI.

## Prerequisites

1. **OpenAI API Key**: The transcription feature uses OpenAI's Whisper API for speech-to-text conversion.

## Setup Steps

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key

### 2. Add Environment Variable

Add the OpenAI API key to your environment variables:

```bash
OPENAI_API_KEY=your_api_key_here
```

For local development, add it to your `.env.local` file:

```
OPENAI_API_KEY=sk-...
```

For production (Vercel, Netlify, etc.), add it as an environment variable in your deployment platform's settings.

### 3. Storage Bucket

The transcript files are stored in the `chat-files` Supabase Storage bucket. Make sure this bucket exists and has the proper RLS policies (see `scripts/024_setup_storage_bucket.md`).

### 4. Database Schema

The `messages` table already includes the `is_ai_transcript` column to mark AI-generated transcripts. No additional database changes are needed.

## How It Works

1. **Recording**: When a user joins a meeting, audio recording starts automatically
2. **Audio Collection**: Audio is collected in chunks using the MediaRecorder API
3. **Transcription**: When the meeting ends, the audio is sent to OpenAI Whisper API for transcription
4. **File Generation**: The transcript is saved as a text file with the format `dd.mm.yyyy.txt` (e.g., `15.03.2024.txt`)
5. **Upload**: The transcript file is uploaded to Supabase Storage
6. **Chat Message**: The transcript file is automatically sent to the department's general chat

## Features

- Automatic recording when meeting starts
- Recording indicator in the UI (red pulsing dot)
- Automatic transcript generation after meeting ends
- Transcript file sent to department chat
- Date-formatted filename (dd.mm.yyyy)

## Notes

- Only the local user's audio is recorded (for now)
- In a production environment with multiple participants, you would need to mix all audio streams
- Transcription happens asynchronously - users may need to wait a few seconds after leaving the meeting
- The transcript includes all speech captured during the meeting

## Troubleshooting

### Transcription fails

- Check that `OPENAI_API_KEY` is set correctly
- Verify you have credits in your OpenAI account
- Check browser console for errors
- Ensure the audio file is not empty (meeting duration > 0)

### File upload fails

- Verify the `chat-files` bucket exists in Supabase Storage
- Check RLS policies for the storage bucket
- Ensure the user has permission to upload files

### Transcript not appearing in chat

- Check that the `chat_id` was correctly retrieved
- Verify the message was inserted successfully (check database)
- Check browser console for errors during transcript generation

