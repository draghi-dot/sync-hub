import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { FeedHeader } from "@/components/feed/feed-header"
import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfilePosts } from "@/components/profile/profile-posts"
import { MobileNav } from "@/components/mobile-nav"

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login")
  }

  // Fetch current user's profile for header
  const { data: currentUserProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Fetch the profile being viewed
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", id).single()

  if (profileError || !profile) {
    notFound()
  }

  // Fetch user's assigned departments (handle gracefully if table doesn't exist yet)
  const { data: userDepts, error: userDeptsError } = await supabase
    .from("user_departments")
    .select(`
      departments (
        name
      )
    `)
    .eq("user_id", id)
  
  // If table doesn't exist yet or error, default to empty array
  const departmentNamesRaw = userDeptsError 
    ? (profile.department ? [profile.department] : []) // Fallback to old single department if available
    : (userDepts?.map((ud: any) => ud.departments?.name).filter(Boolean) || [])
  
  // Remove duplicates - same department name might appear multiple times (different teams)
  const departmentNames = Array.from(new Set(departmentNamesRaw))

  const { data: posts } = await supabase
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
    .eq("author_id", id)
    .order("created_at", { ascending: false })

  const isOwnProfile = user.id === id

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <FeedHeader profile={currentUserProfile} />

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} postCount={posts?.length || 0} departments={departmentNames} />

        <div className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Posts</h2>
          <ProfilePosts posts={posts || []} currentUserId={user.id} />
        </div>
      </main>

      <MobileNav userId={user.id} />
    </div>
  )
}
