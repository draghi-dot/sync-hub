import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Video } from "lucide-react"
import Link from "next/link"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { chatId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get chat details
  const { data: chat } = await supabase.from("chats").select("*").eq("id", chatId).single()

  // Get messages for this chat
  const { data: messages } = await supabase
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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/chats">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <h1 className="text-xl font-bold text-gray-900">
                {chat?.name === "daily-meeting" ? "#daily-meeting" : `#${chat?.name}`}
              </h1>
            </div>
            {chat?.name === "daily-meeting" && (
              <Button size="icon" variant="ghost">
                <Video className="h-5 w-5" />
              </Button>
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
