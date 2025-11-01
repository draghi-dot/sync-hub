import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Convert file to format for API
    const audioBuffer = await audioFile.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')
    
    // Log which API we're using (without exposing keys)
    console.log("Transcription request - API:", 
      process.env.GOOGLE_API_KEY ? "Google" : 
      process.env.OPENAI_API_KEY ? "OpenAI" : 
      "None configured"
    )

    // Check for Google API key (starts with AIza)
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    
    // Check for OpenAI API key as fallback
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY

    // Prefer Google API if available, otherwise use OpenAI
    if (GOOGLE_API_KEY) {
      console.log("Using Google Speech-to-Text API")
      console.log("Audio file size:", audioFile.size, "bytes")
      console.log("Audio file type:", audioFile.type)
      
      // Use Google Speech-to-Text API
      // Try LINEAR16 encoding (PCM) as it's more widely supported
      // First, we'll try to detect the actual sample rate from the audio
      let response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            config: {
              encoding: "WEBM_OPUS",
              sampleRateHertz: 48000,
              languageCode: "en-US",
              enableAutomaticPunctuation: true,
              audioChannelCount: 1,
            },
            audio: {
              content: audioBase64,
            },
          }),
        }
      )

      // Log the response status and error details
      console.log("Google API response status:", response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error("Google API error response:", errorText)
        
        // Try alternative: remove audioChannelCount
        console.log("Trying alternative configuration without audioChannelCount...")
        response = await fetch(
          `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              config: {
                encoding: "WEBM_OPUS",
                sampleRateHertz: 48000,
                languageCode: "en-US",
                enableAutomaticPunctuation: true,
              },
              audio: {
                content: audioBase64,
              },
            }),
          }
        )
        console.log("Alternative request status:", response.status, response.statusText)
      }

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }
        console.error("Google Speech-to-Text error:", JSON.stringify(errorData, null, 2))
        console.error("Error text:", errorText)
        
        // Check if audio is too long for sync API or other errors that should trigger OpenAI fallback
        const isAudioTooLong = errorText.includes("Sync input too long") || 
                               errorText.includes("LongRunningRecognize") ||
                               (errorData.error?.message && errorData.error.message.includes("too long"))
        
        // If Google API fails due to permissions/blocking (403) or audio too long (400) and OpenAI is available, try fallback
        if (OPENAI_API_KEY && (response.status === 403 || (response.status === 400 && isAudioTooLong))) {
          const reason = isAudioTooLong ? "audio too long (Google limit is 1 minute)" : "API blocked"
          console.log(`Google API failed (${reason}), falling back to OpenAI Whisper API...`)
          
          // Fallback to OpenAI
          const file = new File([audioBuffer], audioFile.name, { type: audioFile.type || "audio/webm" })
          const formDataToOpenAI = new FormData()
          formDataToOpenAI.append("file", file)
          formDataToOpenAI.append("model", "whisper-1")

          try {
            const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
              },
              body: formDataToOpenAI,
            })

            if (transcriptionResponse.ok) {
              const transcriptionData = await transcriptionResponse.json()
              const transcript = transcriptionData.text
              console.log("Successfully transcribed using OpenAI fallback")
              return NextResponse.json({ transcript })
            } else {
              const errorTextOpenAI = await transcriptionResponse.text()
              console.error("OpenAI fallback also failed:", errorTextOpenAI)
              // Continue to show Google error since both failed
            }
          } catch (fallbackError) {
            console.error("Error during OpenAI fallback:", fallbackError)
            // Continue to show Google error
          }
        }
        
        // Provide more helpful error messages based on common issues
        let userFriendlyMessage = errorData.message || errorText || "Unknown error"
        
        if (response.status === 403) {
          // Check for specific error types
          if (errorText.includes("API_KEY_SERVICE_BLOCKED") || errorText.includes("are blocked")) {
            if (OPENAI_API_KEY) {
              userFriendlyMessage = "Google API key service blocked. Attempted OpenAI fallback but it also failed. Please fix Google API key restrictions or check OpenAI API key."
            } else {
              userFriendlyMessage = "API key service blocked. Your API key restrictions are blocking access. Go to Google Cloud Console > APIs & Services > Credentials, edit your API key, and either set 'Don't restrict key' or add 'Cloud Speech-to-Text API' to allowed APIs. Alternatively, add OPENAI_API_KEY for automatic fallback."
            }
          } else if (errorText.includes("API key")) {
            userFriendlyMessage = "API key invalid or missing permissions. Please check that your Google API key has Speech-to-Text API enabled."
          } else {
            userFriendlyMessage = `API access denied (403). Check API key restrictions in Google Cloud Console. Error: ${errorData.message || errorText}`
          }
        } else if (response.status === 400) {
          if (errorText.includes("encoding")) {
            userFriendlyMessage = "Audio format not supported. Please ensure the audio recording is working correctly."
          } else if (isAudioTooLong) {
            if (OPENAI_API_KEY) {
              userFriendlyMessage = "Audio is longer than 1 minute (Google's limit). Attempted OpenAI fallback but it also failed. Please check OpenAI API key."
            } else {
              userFriendlyMessage = "Audio is longer than 1 minute. Google Speech-to-Text has a 1-minute limit for sync requests. Please add OPENAI_API_KEY to your environment variables for automatic fallback, or keep meetings under 1 minute."
            }
          } else {
            userFriendlyMessage = `Invalid request: ${errorData.message || errorText}`
          }
        }
        
        return NextResponse.json(
          { 
            error: "Failed to transcribe audio with Google API", 
            details: userFriendlyMessage,
            status: response.status,
            rawError: errorData
          },
          { status: response.status }
        )
      }

      const data = await response.json()
      
      // Extract transcript from Google response
      if (data.results && data.results.length > 0) {
        const transcript = data.results
          .map((result: any) => result.alternatives?.[0]?.transcript || "")
          .join(" ")
          .trim()

        if (!transcript) {
          return NextResponse.json(
            { error: "No speech detected in audio" },
            { status: 400 }
          )
        }

        return NextResponse.json({ transcript })
      } else {
        return NextResponse.json(
          { error: "No transcription results returned. The audio may be too short or contain no speech." },
          { status: 400 }
        )
      }
    } else if (OPENAI_API_KEY) {
      // Fallback to OpenAI Whisper API
      const file = new File([audioBuffer], audioFile.name, { type: audioFile.type || "audio/webm" })

      const formDataToOpenAI = new FormData()
      formDataToOpenAI.append("file", file)
      formDataToOpenAI.append("model", "whisper-1")

      const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formDataToOpenAI,
      })

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text()
        console.error("OpenAI transcription error:", errorText)
        return NextResponse.json(
          { error: "Failed to transcribe audio", details: errorText },
          { status: transcriptionResponse.status }
        )
      }

      const transcriptionData = await transcriptionResponse.json()
      const transcript = transcriptionData.text

      return NextResponse.json({ transcript })
    } else {
      return NextResponse.json(
        { 
          error: "No API key configured",
          message: "Please add either GOOGLE_API_KEY or OPENAI_API_KEY to your environment variables"
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Transcription error:", error)
    return NextResponse.json(
      { error: "Failed to transcribe audio", details: error.message },
      { status: 500 }
    )
  }
}
