import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"
import { DailyMeetingButton } from "@/components/teams/daily-meeting-button"

export default async function DepartmentChatsPage({
  params,
}: {
  params: Promise<{ teamId: string; departmentId: string }>
}) {
  const { teamId, departmentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user's profile to verify company
  const { data: profile } = await supabase.from("profiles").select("company").eq("id", user.id).single()
  
  // Get user's assigned departments (handle gracefully if table doesn't exist yet)
  const { data: userDepts, error: userDeptsError } = await supabase
    .from("user_departments")
    .select(`
      departments (
        name
      )
    `)
    .eq("user_id", user.id)
  
  // If table doesn't exist yet or error, check old profile.department field as fallback
  const userDepartmentNames = userDeptsError 
    ? (profile?.department ? [profile.department] : [])
    : (userDepts?.map((ud: any) => ud.departments?.name).filter(Boolean) || [])

  // Get department details with team info
  const { data: department } = await supabase
    .from("departments")
    .select(`
      *,
      teams:team_id (
        company,
        name
      )
    `)
    .eq("id", departmentId)
    .single()

  // Verify department belongs to user's company
  if (department?.teams && profile?.company && department.teams.company !== profile.company) {
    redirect("/teams")
  }

  // Verify user is assigned to this department (case-insensitive match)
  if (!department?.name || userDepartmentNames.length === 0) {
    redirect("/teams")
  }
  // Case-insensitive department match - check if department name is in user's assigned departments
  const isAssigned = userDepartmentNames.some(
    (deptName: string) => deptName.trim().toLowerCase() === department.name.trim().toLowerCase()
  )
  if (!isAssigned) {
    redirect("/teams")
  }

  // CRITICAL: Get the "general" chat for this department
  // We MUST ensure ALL users get the SAME chat ID
  // First, try to get ALL chats for this department to see if there are duplicates
  const { data: allChats, error: allChatsError } = await supabase
    .from("chats")
    .select("*")
    .eq("department_id", departmentId)
    .eq("type", "department")
    .eq("name", "general")

  console.log("Server-side: All general chats for department:", allChats?.length || 0)
  if (allChats && allChats.length > 1) {
    // Log warning but don't throw error - we'll handle it by using the oldest chat
    console.warn("⚠️ WARNING: Multiple chats found for this department!")
    console.warn("Chat IDs:", allChats.map(c => c.id))
    console.warn("Using the oldest chat to ensure consistency.")
    console.warn("To permanently fix: Run scripts/023_force_merge_and_fix.sql in Supabase")
  }

  // Get the OLDEST chat (first created) to ensure consistency
  let chat = allChats && allChats.length > 0 
    ? { data: allChats.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0], error: null }
    : { data: null, error: null }

  // If no chat exists, create it
  if (!chat.data) {
    console.log("No chat found, creating new one...")
    const { data: newChat, error: insertError } = await supabase
      .from("chats")
      .insert({
        name: "general",
        type: "department",
        department_id: departmentId,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error creating chat:", insertError)
      // If insert fails (unique constraint), try fetching again
      const { data: existingChats } = await supabase
        .from("chats")
        .select("*")
        .eq("department_id", departmentId)
        .eq("type", "department")
        .eq("name", "general")
      
      if (existingChats && existingChats.length > 0) {
        // Get the oldest one
        chat = { 
          data: existingChats.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0], 
          error: null 
        }
      } else {
        chat = { data: null, error: insertError }
      }
    } else {
      chat = { data: newChat, error: null }
    }
  }

  if (!chat.data) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/teams/${teamId}`}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{department?.name}</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <p className="text-gray-500">Unable to load department chat. Please try again.</p>
          </div>
        </main>
        <MobileNav userId={user.id} />
      </div>
    )
  }

  const chatId = chat.data.id

  // Debug: Log chat info - CRITICAL for debugging
  console.log("=== DEPARTMENT CHAT DEBUG ===")
  console.log("Department ID:", departmentId)
  console.log("Department Name:", department?.name)
  console.log("CHAT ID (USER SEES THIS):", chatId)
  console.log("Chat Name:", chat.data.name)
  console.log("User ID:", user.id)
  console.log("User Department:", profile?.department)
  console.log("=============================")
  
  // Display chat ID in the UI temporarily for debugging
  console.log("💬 IMPORTANT: Both users must see the SAME Chat ID:", chatId)

  // Get messages for this chat
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select(`
      *,
      profiles (
        full_name,
        avatar_url
      )
    `)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  // Debug: Log messages info
  if (messagesError) {
    console.error("Error fetching messages:", messagesError)
    console.error("Messages error details:", JSON.stringify(messagesError, null, 2))
  }
  console.log("Server-side: Messages found:", messages?.length || 0, "messages")
  console.log("Server-side: Chat ID:", chatId)
  console.log("Server-side: User ID:", user.id)
  console.log("Server-side: User Department:", profile?.department)
  console.log("Server-side: Department Name:", department?.name)
  
  // Test query without join to see if basic RLS works
  const { data: testMessages, error: testError } = await supabase
    .from("messages")
    .select("id, content, sender_id, created_at")
    .eq("chat_id", chatId)
    .limit(10)
  
  console.log("Server-side: Basic messages query:", testMessages?.length || 0, "messages", "Error:", testError)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/teams/${teamId}`}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold text-gray-900">{department?.name}</h1>
            </div>
            {departmentId && department?.name && (
              <DailyMeetingButton 
                departmentId={departmentId} 
                departmentName={department.name}
                teamId={teamId}
              />
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <ChatMessages messages={messages || []} chatId={chatId} />
        </div>
      </main>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <ChatInput chatId={chatId} userId={user.id} />
        </div>
      </div>

      <MobileNav userId={user.id} />
    </div>
  )
}
