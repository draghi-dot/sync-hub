"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { FeedHeader } from "@/components/feed/feed-header"
import { CreatePost } from "@/components/feed/create-post"
import { PostList } from "@/components/feed/post-list"
import { MobileNav } from "@/components/mobile-nav"
import { CheckInView } from "@/components/feed/check-in-view"

export default function FeedPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<"feed" | "checkin">("feed")
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadPosts = useCallback(async () => {
    if (!userId) return
    
    const { data: postsData } = await supabase
      .from("posts")
      .select(`
        *,
        profiles:author_id (
          id,
          full_name,
          avatar_url,
          job_title,
          department
        ),
        likes (
          id,
          user_id
        ),
        comments (
          id,
          content,
          created_at,
          author_id,
          profiles:author_id (
            id,
            full_name,
            avatar_url,
            job_title
          )
        )
      `)
      .order("created_at", { ascending: false })

    // Filter out check-ins on client side
    const filteredPosts = postsData?.filter(post => 
      !post.post_type || post.post_type === "post"
    ) || []

    setPosts(filteredPosts)
  }, [userId, supabase])

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserId(user.id)

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      setProfile(profileData)

      setIsLoading(false)
    }

    loadData()
  }, [router, supabase])

  useEffect(() => {
    if (userId) {
      loadPosts()
    }
  }, [userId, loadPosts])

  // Listen for post creation events
  useEffect(() => {
    const handlePostCreated = () => {
      loadPosts()
    }

    window.addEventListener("post-created", handlePostCreated)
    return () => window.removeEventListener("post-created", handlePostCreated)
  }, [loadPosts])

  if (isLoading || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
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
            <button
              onClick={() => setActiveTab("feed")}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === "feed"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Feed
            </button>
            <div className="w-px h-6 bg-gray-300"></div>
            <button
              onClick={() => setActiveTab("checkin")}
              className={`flex-1 py-4 text-center font-semibold transition-colors ${
                activeTab === "checkin"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Check-In
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {activeTab === "feed" ? (
          <>
            <CreatePost userId={userId} />
            <PostList posts={posts} currentUserId={userId} />
          </>
        ) : (
          <CheckInView userId={userId} />
        )}
      </main>

      <MobileNav userId={userId} />
    </div>
  )
}
