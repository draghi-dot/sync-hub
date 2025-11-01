# Google Speech-to-Text API Troubleshooting

## Error: "Failed to transcribe audio with Google API"

If you're seeing this error, here are the most common causes and solutions:

### 1. **API Not Enabled**
The Cloud Speech-to-Text API must be enabled in your Google Cloud project.

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Cloud Speech-to-Text API"
5. Click on it and click **Enable**

### 2. **API Key Not Valid or Missing Permissions**
Your API key might be invalid or not have access to the Speech-to-Text API.

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Find your API key or create a new one
4. Click **Edit** and ensure:
   - **API restrictions**: Either "Don't restrict key" or restrict to "Cloud Speech-to-Text API"
   - **Application restrictions**: Set to "None" (or configure for your domain)

### 3. **Billing Account Required**
Google Speech-to-Text API requires a billing account, even for free tier usage.

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Billing**
3. Link a billing account to your project
4. Note: Google provides free tier: 60 minutes per month free

### 4. **Check Your Server Logs**
The server logs will show the exact error from Google's API. Look for:
- **Status 403**: API key issue or API not enabled
- **Status 400**: Audio format issue or invalid request
- **Other statuses**: Check the error message for specific details

**To view logs:**
- Check your terminal/console where Next.js is running
- Look for messages starting with "Google Speech-to-Text error:"

### 5. **Verify API Key Format**
Your API key should start with `AIza...` and be around 39 characters long.

**To verify:**
1. Check `.env.local` file
2. Ensure line reads: `GOOGLE_API_KEY=AIzaSyDhTm-xtWd-9iLjjGyyXfB4MY1-yFwff9w`
3. Restart your Next.js server after adding/updating

### 6. **Test API Key Directly**
You can test if your API key works by making a direct API call:

```bash
curl "https://speech.googleapis.com/v1/speech:recognize?key=YOUR_API_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "encoding": "LINEAR16",
      "sampleRateHertz": 16000,
      "languageCode": "en-US"
    },
    "audio": {
      "content": "BASE64_ENCODED_AUDIO"
    }
  }'
```

### Common Error Messages

- **"API key invalid"** → Regenerate API key or check restrictions
- **"Permission denied"** → Enable Speech-to-Text API in Google Cloud Console
- **"Billing required"** → Link a billing account (free tier available)
- **"Invalid encoding"** → Audio format issue, but this is handled automatically

### Still Having Issues?

1. Check the browser console for detailed error messages
2. Check your server terminal for Google API response logs
3. Verify the API key is correctly set in `.env.local`
4. Ensure you've restarted the Next.js server after adding the API key
5. Try regenerating the API key in Google Cloud Console

