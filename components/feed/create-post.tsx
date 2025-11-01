"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface CreatePostProps {
  userId: string
}

export function CreatePost({ userId }: CreatePostProps) {
  const [content, setContent] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setIsLoading(true)
    try {
      const postData: any = {
        author_id: userId,
        content: content.trim(),
      }
      
      // Try to add post_type (will fail silently if column doesn't exist)
      // The error will be handled below
      postData.post_type = "post"
      
      const { error, data } = await supabase.from("posts").insert(postData).select()
      
      // If error is about missing column, retry without post_type
      if (error && error.message && error.message.includes("post_type")) {
        delete postData.post_type
        const { error: retryError, data: retryData } = await supabase.from("posts").insert(postData).select()
        if (retryError) {
          console.error("Error creating post:", retryError)
          console.error("Error details:", JSON.stringify(retryError, null, 2))
          alert(`Failed to create post: ${retryError.message || "Unknown error"}`)
          setIsLoading(false)
          return
        }
        // Success on retry - dispatch event
        setContent("")
        window.dispatchEvent(new CustomEvent("post-created"))
        router.refresh()
        setIsLoading(false)
        return
      }

      if (error) {
        console.error("Error creating post:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        alert(`Failed to create post: ${error.message || "Unknown error"}`)
        setIsLoading(false)
        return
      }

      setContent("")
      
      // Dispatch event to refresh posts list
      window.dispatchEvent(new CustomEvent("post-created"))
      
      // Also refresh router
      router.refresh()
    } catch (error: any) {
      console.error("Error creating post:", error)
      alert(`Failed to create post: ${error.message || "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] resize-none"
            disabled={isLoading}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || !content.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
