"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Camera, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Image from "next/image"

interface CheckInButtonProps {
  userId: string
}

export function CheckInButton({ userId }: CheckInButtonProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)

  // Check status when component mounts
  useEffect(() => {
    const checkTodayStatus = async () => {
      const clientSupabase = createClient()
      setIsCheckingStatus(true)
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const { data: checkIn } = await clientSupabase
          .from("posts")
          .select("id")
          .eq("author_id", userId)
          .eq("post_type", "checkin")
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString())
          .maybeSingle()

        setHasCheckedInToday(!!checkIn)
      } catch (error) {
        console.error("Error checking check-in status:", error)
      } finally {
        setIsCheckingStatus(false)
      }
    }
    checkTodayStatus()
  }, [userId])

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file")
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("Image must be smaller than 10MB")
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setIsOpen(true)
    }
  }

  const handleCheckIn = async () => {
    if (!selectedImage) return

    setIsUploading(true)

    try {
      const clientSupabase = createClient()

      // Upload image to Supabase Storage
      const fileExt = selectedImage.name.split(".").pop()
      const fileName = `checkin-${userId}-${Date.now()}.${fileExt}`
      const filePath = `check-ins/${fileName}`

      const { data: uploadData, error: uploadError } = await clientSupabase.storage
        .from("chat-files")
        .upload(filePath, selectedImage, {
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
        content: "", // Check-ins don't need text content
        image_url: publicUrl,
        post_type: "checkin",
      })

      if (postError) {
        console.error("Error creating check-in:", postError)
        alert("Failed to create check-in. Please try again.")
        setIsUploading(false)
        return
      }

      // Reset form and close dialog
      setSelectedImage(null)
      setImagePreview(null)
      setIsOpen(false)
      setHasCheckedInToday(true)
      router.refresh()
    } catch (error) {
      console.error("Error during check-in:", error)
      alert("Failed to create check-in. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  if (isCheckingStatus) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  if (hasCheckedInToday) {
    return (
      <Button variant="outline" disabled className="opacity-60">
        <Camera className="mr-2 h-4 w-4" />
        Checked In Today
      </Button>
    )
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleImageSelect}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        className="bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
      >
        <Camera className="mr-2 h-4 w-4" />
        Check In
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Your Check-In</DialogTitle>
            <DialogDescription>
              Share a photo of yourself for today&apos;s check-in
            </DialogDescription>
          </DialogHeader>

          {imagePreview && (
            <div className="relative w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
              <Image
                src={imagePreview}
                alt="Check-in preview"
                fill
                className="object-cover"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false)
                setSelectedImage(null)
                setImagePreview(null)
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button onClick={handleCheckIn} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Post Check-In"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

