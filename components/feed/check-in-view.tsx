"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Camera, Loader2 } from "lucide-react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface CheckInPost {
  id: string
  image_url: string
  created_at: string
  author_id: string
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
    job_title: string | null
  } | null
}

interface CheckInViewProps {
  userId: string
}

export function CheckInView({ userId }: CheckInViewProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [checkIns, setCheckIns] = useState<CheckInPost[]>([])
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showCamera, setShowCamera] = useState(false)

  // Effect to ensure video plays when camera is shown and stream is available
  useEffect(() => {
    if (showCamera && streamRef.current && videoRef.current) {
      const video = videoRef.current
      const stream = streamRef.current
      
      // Ensure srcObject is set
      if (video.srcObject !== stream) {
        video.srcObject = stream
      }
      
      // Ensure video properties are set
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      
      // Try to play
      const playVideo = async () => {
        try {
          await video.play()
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error("Error playing video in effect:", err)
          }
        }
      }
      
      playVideo()
    }
  }, [showCamera])

  useEffect(() => {
    async function loadData() {
      const clientSupabase = createClient()

      // Check if user has checked in today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Check for today's check-in (check by image_url - works with or without post_type column)
      const { data: todayCheckIn, error: checkInError } = await clientSupabase
        .from("posts")
        .select("id")
        .eq("author_id", userId)
        .not("image_url", "is", null)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .maybeSingle()

      // If query failed due to missing column, try without filtering
      let hasCheckedIn = !!todayCheckIn
      if (checkInError && checkInError.message && checkInError.message.includes("post_type")) {
        // Retry without post_type filtering
        const { data: retryCheckIn } = await clientSupabase
          .from("posts")
          .select("id")
          .eq("author_id", userId)
          .not("image_url", "is", null)
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString())
          .maybeSingle()
        hasCheckedIn = !!retryCheckIn
      }

      setHasCheckedInToday(!!hasCheckedIn)

      // Load all check-ins (posts with images, optionally filtered by post_type)
      let { data: checkInsData } = await clientSupabase
        .from("posts")
        .select(`
          id,
          image_url,
          created_at,
          author_id,
          profiles:author_id (
            id,
            full_name,
            avatar_url,
            job_title
          )
        `)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)

      // If post_type column exists, filter by it; otherwise show all posts with images
      if (checkInsData) {
        // Try to filter by post_type, but if it fails, show all image posts
        try {
          const filtered = checkInsData.filter(p => !p.post_type || p.post_type === "checkin")
          checkInsData = filtered
        } catch {
          // Column doesn't exist or can't filter, use all image posts
        }
      }

      if (checkInsData) {
        setCheckIns(checkInsData as CheckInPost[])
      }

      setIsLoading(false)
    }

    loadData()
  }, [userId])

  const startCamera = async () => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera is not supported in this browser. Please use a modern browser with camera support.")
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })
      
      streamRef.current = stream
      
      // Use setTimeout to ensure the video element is rendered before setting srcObject
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Set video properties
          videoRef.current.muted = true // Required for autoplay in some browsers
          videoRef.current.playsInline = true
          videoRef.current.autoplay = true
          
          // Ensure video plays when metadata loads
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(err => {
              // Ignore AbortError - it's common and harmless in WebRTC
              if (err.name !== 'AbortError') {
                console.error("Error playing video:", err)
              }
            })
          }
          
          // Also try to play immediately
          videoRef.current.play().catch(err => {
            if (err.name !== 'AbortError') {
              console.error("Error playing video immediately:", err)
            }
          })
        }
      }, 100)
      
      setShowCamera(true)
    } catch (error: any) {
      console.error("Error accessing camera:", error)
      
      let errorMessage = "Could not access camera. "
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage += "Please allow camera permissions in your browser settings."
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMessage += "No camera found on this device."
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorMessage += "Camera is already in use by another application."
      } else {
        errorMessage += error.message || "Unknown error occurred."
      }
      
      alert(errorMessage)
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL("image/jpeg")
      setCapturedImage(dataUrl)
      
      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      setShowCamera(false)
    }
  }

  const handleCheckIn = async () => {
    if (!capturedImage || !userId) return

    setIsUploading(true)

    try {
      const clientSupabase = createClient()

      // Convert data URL to blob
      const response = await fetch(capturedImage)
      const blob = await response.blob()
      const file = new File([blob], `checkin-${userId}-${Date.now()}.jpg`, { type: "image/jpeg" })

      // Upload image
      const filePath = `check-ins/${file.name}`
      const { error: uploadError } = await clientSupabase.storage
        .from("chat-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (uploadError) {
        console.error("Error uploading image:", uploadError)
        console.error("Upload error details:", JSON.stringify(uploadError, null, 2))
        alert(`Failed to upload image: ${uploadError.message || "Unknown error"}`)
        setIsUploading(false)
        return
      }

      // Get public URL
      const { data: { publicUrl } } = clientSupabase.storage
        .from("chat-files")
        .getPublicUrl(filePath)

      // Create check-in post
      const checkInData: any = {
        author_id: userId,
        content: "",
        image_url: publicUrl,
      }
      
      // Try to add post_type (will retry without it if column doesn't exist)
      checkInData.post_type = "checkin"
      
      let { error: postError, data: postData } = await clientSupabase
        .from("posts")
        .insert(checkInData)
        .select()

      // If error is about missing column, retry without post_type
      if (postError && postError.message && postError.message.includes("post_type")) {
        delete checkInData.post_type
        const retryResult = await clientSupabase
          .from("posts")
          .insert(checkInData)
          .select()
        postError = retryResult.error
        postData = retryResult.data
      }

      if (postError) {
        console.error("Error creating check-in:", postError)
        console.error("Post error details:", JSON.stringify(postError, null, 2))
        alert(`Failed to create check-in: ${postError.message || "Unknown error"}`)
        setIsUploading(false)
        return
      }

      // Reset and refresh
      setCapturedImage(null)
      setHasCheckedInToday(true)
      router.refresh()
      
      // Reload check-ins
      let { data: checkInsData } = await clientSupabase
        .from("posts")
        .select(`
          id,
          image_url,
          created_at,
          author_id,
          profiles:author_id (
            id,
            full_name,
            avatar_url,
            job_title
          )
        `)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)

      // Filter by post_type if column exists
      if (checkInsData) {
        try {
          const filtered = checkInsData.filter(p => !p.post_type || p.post_type === "checkin")
          checkInsData = filtered
        } catch {
          // Use all image posts if filtering fails
        }
        setCheckIns(checkInsData as CheckInPost[])
      }
    } catch (error) {
      console.error("Error during check-in:", error)
      alert("Failed to create check-in. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const cancelCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
    setCapturedImage(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Check-In Button */}
      {!hasCheckedInToday ? (
        <Card>
          <CardContent className="pt-6">
            {!capturedImage ? (
              <div className="text-center space-y-4">
                {!showCamera ? (
                  <>
                    <Camera className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="text-gray-600">Capture a photo for today&apos;s check-in</p>
                    <Button 
                      onClick={startCamera} 
                      className="bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take Photo
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="relative aspect-square max-w-md mx-auto rounded-lg overflow-hidden border-2 border-gray-200 bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }} // Mirror the video like a selfie camera
                      />
                      {!streamRef.current && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                          <p>Starting camera...</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={capturePhoto} className="bg-green-600 hover:bg-green-700">
                        <Camera className="mr-2 h-4 w-4" />
                        Capture
                      </Button>
                      <Button onClick={cancelCapture} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-square max-w-md mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                  <Image
                    src={capturedImage}
                    alt="Captured check-in"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleCheckIn} disabled={isUploading} className="bg-white text-gray-900 hover:bg-gray-100 border border-gray-300">
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      "Post Check-In"
                    )}
                  </Button>
                  <Button onClick={() => setCapturedImage(null)} variant="outline" disabled={isUploading}>
                    Retake
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6 text-center">
            <p className="text-green-700 font-medium">You&apos;ve already checked in today!</p>
          </CardContent>
        </Card>
      )}

      {/* Check-In Feed */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Recent Check-Ins</h2>
        {checkIns.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              <p>No check-ins yet. Be the first to check in!</p>
            </CardContent>
          </Card>
        ) : (
          checkIns.map((checkIn) => {
            const author = checkIn.profiles
            const initials =
              author?.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"

            return (
              <Card key={checkIn.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Link href={`/profile/${author?.id}`}>
                      <Avatar>
                        <AvatarImage src={author?.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <Link href={`/profile/${author?.id}`} className="font-semibold text-gray-900 hover:underline">
                        {author?.full_name || "Unknown User"}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(checkIn.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden border-2 border-gray-200">
                    <Image
                      src={checkIn.image_url}
                      alt="Check-in"
                      fill
                      className="object-cover"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

