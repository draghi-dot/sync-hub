"use client"

import type React from "react"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Loader2, Trash2 } from "lucide-react"
import Link from "next/link"

interface Comment {
  id: string
  content: string
  created_at: string
  author_id: string
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
    job_title: string | null
  } | null
}

interface CommentSectionProps {
  postId: string
  comments: Comment[]
  currentUserId: string
}

export function CommentSection({ postId, comments, currentUserId }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: currentUserId,
        content: newComment.trim(),
      })

      if (error) throw error

      setNewComment("")
      router.refresh()
    } catch (error) {
      console.error("Error creating comment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return

    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentId)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("Error deleting comment:", error)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      {/* Comments list */}
      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => {
            const author = comment.profiles
            const initials =
              author?.full_name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"
            const isOwnComment = comment.author_id === currentUserId

            return (
              <div key={comment.id} className="flex gap-3">
                <Link href={`/profile/${author?.id}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={author?.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <div className="bg-gray-100 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/profile/${author?.id}`}
                        className="font-semibold text-sm text-gray-900 hover:underline"
                      >
                        {author?.full_name || "Unknown User"}
                      </Link>
                      {isOwnComment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleDelete(comment.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 mt-1">{comment.content}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-3">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Textarea
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[60px] resize-none"
          disabled={isSubmitting}
        />
        <Button type="submit" disabled={isSubmitting || !newComment.trim()} className="self-end">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
        </Button>
      </form>
    </div>
  )
}
