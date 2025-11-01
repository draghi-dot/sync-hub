"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { FeedHeader } from "@/components/feed/feed-header"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, X } from "lucide-react"
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

export default function CheckInPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [checkIns, setCheckIns] = useState<CheckInPost[]>([])
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showCamera, setShowCamera] = useState(false)

  useEffect(() => {
    async function loadData() {
      const clientSupabase = createClient()
      const { data: { user } } = await clientSupabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserId(user.id)

      // Load profile
      const { data: profileData } = await clientSupabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      setProfile(profileData)

      // Check if user has checked in today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { data: todayCheckIn } = await clientSupabase
        .from("posts")
        .select("id")
        .eq("author_id", user.id)
        .eq("post_type", "checkin")
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString())
        .maybeSingle()

      setHasCheckedInToday(!!todayCheckIn)

      // Load all check-ins
      const { data: checkInsData } = await clientSupabase
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
        .eq("post_type", "checkin")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)

      if (checkInsData) {
        setCheckIns(checkInsData as CheckInPost[])
      }

      setIsLoading(false)
    }

    loadData()
  }, [router])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setShowCamera(true)
    } catch (error) {
      console.error("Error accessing camera:", error)
      alert("Could not access camera. Please allow camera permissions.")
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
      setIsCapturing(false)
      
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
        alert("Failed to upload image. Please try again.")
        setIsUploading(false)
        return
      }

      // Get public URL
      const { data: { publicUrl } } = clientSupabase.storage
        .from("chat-files")
        .getPublicUrl(filePath)

      // Create check-in post
      const { error: postError } = await clientSupabase.from("posts").insert({
        author_id: userId,
        content: "",
        image_url: publicUrl,
        post_type: "checkin",
      })

      if (postError) {
        console.error("Error creating check-in:", postError)
        alert("Failed to create check-in. Please try again.")
        setIsUploading(false)
        return
      }

      // Reset and refresh
      setCapturedImage(null)
      setHasCheckedInToday(true)
      router.refresh()
      
      // Reload check-ins
      const { data: checkInsData } = await clientSupabase
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
        .eq("post_type", "checkin")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50)

      if (checkInsData) {
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
    setIsCapturing(false)
  }

  if (isLoading || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <FeedHeader profile={profile} />

      {/* Tab Navigation */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-3 sm:px-4">
          <div className="flex items-center">
            <Link
              href="/feed"
              className="flex-1 py-4 text-center font-semibold text-gray-600 hover:text-gray-900"
            >
              Feed
            </Link>
            <div className="w-px h-6 bg-gray-300"></div>
            <Link
              href="/feed/check-in"
              className="flex-1 py-4 text-center font-semibold text-gray-900 border-b-2 border-gray-900"
            >
              Check-In
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Check-In Button */}
        {!hasCheckedInToday ? (
          <Card className="mb-6">
            <CardContent className="pt-6">
              {!capturedImage ? (
                <div className="text-center space-y-4">
                  {!showCamera ? (
                    <>
                      <Camera className="h-12 w-12 mx-auto text-gray-400" />
                      <p className="text-gray-600">Capture a photo for today&apos;s check-in</p>
                      <Button onClick={startCamera} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative aspect-square max-w-md mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
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
                    <Button onClick={handleCheckIn} disabled={isUploading} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
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
          <Card className="mb-6 bg-green-50 border-green-200">
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
      </main>

      <MobileNav userId={userId} />
    </div>
  )
}

