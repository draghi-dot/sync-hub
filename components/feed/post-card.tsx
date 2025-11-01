"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { MessageCircle, Heart, Trash2, Camera } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CommentSection } from "./comment-section"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"

interface PostCardProps {
  post: {
    id: string
    content: string
    created_at: string
    author_id: string
    image_url?: string | null
    post_type?: string | null
    profiles: {
      id: string
      full_name: string | null
      avatar_url: string | null
      job_title: string | null
      department: string | null
    } | null
    likes?: Array<{
      id: string
      user_id: string
    }>
    comments?: Array<{
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
    }>
  }
  currentUserId: string
}

export function PostCard({ post, currentUserId }: PostCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const author = post.profiles
  const initials =
    author?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  const isOwnPost = post.author_id === currentUserId

  const likes = post.likes || []
  const likeCount = likes.length
  const isLiked = likes.some((like) => like.user_id === currentUserId)

  const comments = post.comments || []
  const commentCount = comments.length

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const { error } = await supabase.from("posts").delete().eq("id", post.id)

      if (error) throw error

      router.refresh()
    } catch (error) {
      console.error("Error deleting post:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLike = async () => {
    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", currentUserId)

        if (error) throw error
      } else {
        // Like
        const { error } = await supabase.from("likes").insert({
          post_id: post.id,
          user_id: currentUserId,
        })

        if (error) throw error
      }

      router.refresh()
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
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
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{author?.job_title}</span>
                {author?.department && (
                  <>
                    <span>•</span>
                    <span>{author.department}</span>
                  </>
                )}
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(post.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
          {isOwnPost && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this post? This action cannot be undone and will permanently remove the post and all its comments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {post.post_type === "checkin" && (
          <Badge variant="secondary" className="mb-3">
            <Camera className="h-3 w-3 mr-1" />
            Check-In
          </Badge>
        )}
        {post.image_url && (
          <div className="relative w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200 mb-4">
            <Image
              src={post.image_url}
              alt={post.post_type === "checkin" ? "Check-in photo" : "Post image"}
              fill
              className="object-cover"
            />
          </div>
        )}
        {post.content && (
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
        )}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleLike}>
            <Heart className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
            <span className="text-sm">
              {likeCount > 0 ? `${likeCount} ${likeCount === 1 ? "Like" : "Likes"}` : "Like"}
            </span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowComments(!showComments)}>
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">
              {commentCount > 0 ? `${commentCount} ${commentCount === 1 ? "Comment" : "Comments"}` : "Comment"}
            </span>
          </Button>
        </div>

        {showComments && <CommentSection postId={post.id} comments={comments} currentUserId={currentUserId} />}
      </CardContent>
    </Card>
  )
}
