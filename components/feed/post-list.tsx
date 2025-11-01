"use client"

import { PostCard } from "./post-card"

interface Post {
  id: string
  content: string
  created_at: string
  author_id: string
  profiles: {
    id: string
    full_name: string | null
    avatar_url: string | null
    job_title: string | null
    department: string | null
  } | null
}

interface PostListProps {
  posts: Post[]
  currentUserId: string
}

export function PostList({ posts, currentUserId }: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No posts yet. Be the first to share something!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}
    </div>
  )
}
