"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, Trash2 } from "lucide-react"
import { CreateGroupDialog } from "@/components/chats/create-group-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
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

interface Chat {
  id: string
  name: string
  type: string
  created_at: string
  avatar_url?: string | null
}

interface ChatMember {
  chat_id: string
  chats: Chat | null
}

interface Profile {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

export default function ChatsPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [chatMembers, setChatMembers] = useState<ChatMember[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingDM, setIsCreatingDM] = useState(false)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)

  const loadChats = useCallback(async () => {
    if (!userId) return
    
    const supabase = createClient()
    
    try {
      // First, get the chat_ids the user is a member of
      const { data: memberRows, error: membersError } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", userId)

      if (membersError) {
        console.error("Error loading chat memberships:", membersError)
        // Try to extract error info
        const errorStr = String(membersError)
        const errorMsg = (membersError as any)?.message || errorStr
        const errorCode = (membersError as any)?.code
        console.error("Error message:", errorMsg)
        console.error("Error code:", errorCode)
        
        // Only show alert for non-RLS errors to avoid spam
        if (!errorMsg.includes("recursion") && !errorMsg.includes("row-level security")) {
          console.warn("⚠️ Chat loading error (not showing alert to avoid spam):", errorMsg)
        } else {
          console.warn("⚠️ RLS recursion error detected. Run scripts/042_fix_group_chat_rls.sql to fix.")
        }
        return
      }

      if (!memberRows || memberRows.length === 0) {
        setChatMembers([])
        return
      }

      // Extract chat_ids
      const chatIds = memberRows.map(m => m.chat_id)

      // Now fetch the chats themselves
      const { data: chats, error: chatsError } = await supabase
        .from("chats")
        .select("id, name, type, created_at, avatar_url")
        .in("id", chatIds)

      if (chatsError) {
        console.error("Error loading chats:", chatsError)
        const errorStr = String(chatsError)
        const errorMsg = (chatsError as any)?.message || errorStr
        const errorCode = (chatsError as any)?.code
        console.error("Error message:", errorMsg)
        console.error("Error code:", errorCode)
        
        // Only show alert for non-RLS errors to avoid spam
        if (!errorMsg.includes("recursion") && !errorMsg.includes("row-level security")) {
          console.warn("⚠️ Chat loading error (not showing alert to avoid spam):", errorMsg)
        } else {
          console.warn("⚠️ RLS recursion error detected. Run scripts/042_fix_group_chat_rls.sql to fix.")
        }
        return
      }

      // Combine the data to match the expected format
      const combined = memberRows.map(member => {
        const chat = chats?.find(c => c.id === member.chat_id)
        return {
          chat_id: member.chat_id,
          chats: chat || null
        }
      }).filter(item => item.chats !== null) // Remove any that don't have chat data

      setChatMembers(combined as ChatMember[])
    } catch (error) {
      console.error("Unexpected error loading chats:", error)
      alert("Failed to load chats. Please refresh the page.")
    }
  }, [userId])

  useEffect(() => {
    async function loadUserAndChats() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserId(user.id)
      setIsLoading(false)
    }

    loadUserAndChats()
  }, [router])

  useEffect(() => {
    if (userId) {
      loadChats()
    }
  }, [userId, loadChats])

  // Listen for chat creation events and also refresh on focus
  useEffect(() => {
    const handleChatCreated = () => {
      console.log("Chat created event received, reloading chats...")
      // Add small delay to ensure database has updated
      setTimeout(() => {
        loadChats()
      }, 500)
    }

    const handleFocus = () => {
      // Refresh chats when window regains focus (user returns to tab)
      loadChats()
    }

    window.addEventListener("chat-created", handleChatCreated)
    window.addEventListener("focus", handleFocus)
    return () => {
      window.removeEventListener("chat-created", handleChatCreated)
      window.removeEventListener("focus", handleFocus)
    }
  }, [loadChats])

  useEffect(() => {
    async function searchUsers() {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Search for users by name or email (excluding current user)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .neq("id", user.id)
        .limit(10)

      if (profiles) {
        setSearchResults(profiles)
      }
      setIsSearching(false)
    }

    const timeoutId = setTimeout(searchUsers, 300) // Debounce search
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const handleCreateDM = async (otherUserId: string, otherUserName: string) => {
    if (!userId || isCreatingDM) return // Prevent multiple simultaneous calls

    setIsCreatingDM(true)
    const supabase = createClient()
    
    try {
      // CRITICAL: Check if DM already exists between these two users
      // We need to check ALL DMs where BOTH users are members, not just ones created by current user
      const { data: userChatMembers } = await supabase
        .from("chat_members")
        .select(`
          chat_id,
          chats!inner (
            id,
            type,
            name
          )
        `)
        .eq("user_id", userId)
        .eq("chats.type", "dm")

      // Now check each DM to see if the other user is also a member
      let existingDM = null
      if (userChatMembers) {
        for (const member of userChatMembers) {
          const chat = member.chats
          if (!chat) continue

          // Get all members of this chat
          const { data: allMembers } = await supabase
            .from("chat_members")
            .select("user_id")
            .eq("chat_id", chat.id)

          if (allMembers && allMembers.length === 2) {
            const userIds = allMembers.map(m => m.user_id)
            // Check if both users are in this DM
            if (userIds.includes(userId) && userIds.includes(otherUserId)) {
              existingDM = chat
              break
            }
          }
        }
      }

      if (existingDM) {
        // Navigate to existing DM - no need to create a new one
        router.push(`/chat/${existingDM.id}`)
        setIsCreatingDM(false)
        return
      }

      // Create new DM chat
      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({
          name: otherUserName,
          type: "dm",
          created_by: userId,
        })
        .select()
        .single()

      if (chatError) {
        console.error("Error creating chat:", chatError)
        alert("Failed to create chat. Please try again.")
        setIsCreatingDM(false)
        return
      }

      // Add both users as members
      const { error: memberError } = await supabase
        .from("chat_members")
        .insert([
          { chat_id: newChat.id, user_id: userId },
          { chat_id: newChat.id, user_id: otherUserId },
        ])

      if (memberError) {
        console.error("Error adding members:", memberError)
        // If members already exist (rare race condition), just navigate to the chat
        if (memberError.code === '23505') { // Unique constraint violation
          // Try to find the chat that was just created (might have been created by other user)
          const { data: foundChat } = await supabase
            .from("chat_members")
            .select(`
              chat_id,
              chats!inner(id)
            `)
            .eq("user_id", userId)
            .eq("chats.type", "dm")
            .eq("chats.id", newChat.id)
            .single()

          if (foundChat) {
            router.push(`/chat/${newChat.id}`)
            setIsCreatingDM(false)
            return
          }
        }
        alert("Failed to add members. Please try again.")
        setIsCreatingDM(false)
        return
      }

      // Navigate to the new chat
      router.push(`/chat/${newChat.id}`)
      router.refresh()
    } catch (error) {
      console.error("Error creating DM:", error)
      alert("Failed to create chat. Please try again.")
    } finally {
      setIsCreatingDM(false)
    }
  }

  const handleDeleteChat = async (chatId: string, chatType: string) => {
    if (!userId || deletingChatId) return

    setDeletingChatId(chatId)
    const supabase = createClient()

    try {
      // Don't allow deleting department chats (they're system-level)
      if (chatType === "department") {
        alert("Department chats cannot be deleted. They are system-managed.")
        setDeletingChatId(null)
        return
      }

      // Get chat details to check if user is the creator
      const { data: chat } = await supabase
        .from("chats")
        .select("created_by, type")
        .eq("id", chatId)
        .single()

      if (!chat) {
        alert("Chat not found")
        setDeletingChatId(null)
        return
      }

      // If user created the chat, delete it entirely
      // Otherwise, just remove the user from chat_members
      if (chat.created_by === userId) {
        // Delete the entire chat (cascade will delete messages and members)
        const { error: deleteError } = await supabase
          .from("chats")
          .delete()
          .eq("id", chatId)

        if (deleteError) {
          console.error("Error deleting chat:", deleteError)
          alert("Failed to delete chat. You may not have permission.")
          setDeletingChatId(null)
          return
        }
      } else {
        // Just remove the user from chat_members (leave the chat)
        const { error: leaveError } = await supabase
          .from("chat_members")
          .delete()
          .eq("chat_id", chatId)
          .eq("user_id", userId)

        if (leaveError) {
          console.error("Error leaving chat:", leaveError)
          alert("Failed to leave chat. Please try again.")
          setDeletingChatId(null)
          return
        }
      }

      // Refresh the chat list
      const { data: members } = await supabase
        .from("chat_members")
        .select(`
          chat_id,
          chats (
            id,
            name,
            type,
            created_at
          )
        `)
        .eq("user_id", userId)

      if (members) {
        setChatMembers(members as ChatMember[])
      }
    } catch (error) {
      console.error("Error deleting/leaving chat:", error)
      alert("Failed to delete chat. Please try again.")
    } finally {
      setDeletingChatId(null)
    }
  }

  if (isLoading || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
            <Button
              size="icon"
              onClick={() => setIsGroupDialogOpen(true)}
              className="rounded-full"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {searchQuery.trim() && searchQuery.length >= 2 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              {isSearching ? "Searching..." : `Search Results (${searchResults.length})`}
            </h2>
            {searchResults.length === 0 && !isSearching ? (
              <div className="text-center py-8 text-gray-500">
                <p>No users found</p>
              </div>
            ) : (
              searchResults.map((profile) => (
                <Card
                  key={profile.id}
                  className={`hover:shadow-md transition-shadow cursor-pointer ${isCreatingDM ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !isCreatingDM && handleCreateDM(profile.id, profile.full_name || profile.email)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {profile.full_name?.charAt(0).toUpperCase() || profile.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {profile.full_name || profile.email}
                        </h3>
                        {profile.full_name && (
                          <p className="text-sm text-gray-600">{profile.email}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Your Chats</h2>
            {chatMembers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No chats yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Start a conversation by searching for a user above
                </p>
              </div>
            ) : (
              chatMembers.map((member) => {
                const chat = member.chats
                if (!chat) return null

                return (
                  <Card key={chat.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/chat/${chat.id}`} className="flex-1 flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={chat.avatar_url || undefined} />
                            <AvatarFallback>{chat.name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{chat.name}</h3>
                            <p className="text-sm text-gray-600">
                              {chat.type === "dm" ? "Direct message" : chat.type === "department" ? "Department chat" : "Group chat"}
                            </p>
                          </div>
                        </Link>
                        <div onClick={(e) => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-gray-400 hover:text-red-600"
                                disabled={deletingChatId === chat.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {chat.type === "department" 
                                  ? "Cannot Delete Department Chat" 
                                  : "Delete Chat?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {chat.type === "department" ? (
                                  "Department chats are system-managed and cannot be deleted."
                                ) : chat.type === "dm" ? (
                                  "Are you sure you want to delete this direct message? This will remove the chat and all messages permanently."
                                ) : (
                                  "Are you sure you want to delete this group chat? This will remove the chat and all messages permanently."
                                )}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              {chat.type !== "department" && (
                                <AlertDialogAction
                                  onClick={() => handleDeleteChat(chat.id, chat.type)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {deletingChatId === chat.id ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              )}
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </main>

      <MobileNav userId={userId} />

      {userId && (
        <CreateGroupDialog
          open={isGroupDialogOpen}
          onOpenChange={setIsGroupDialogOpen}
          currentUserId={userId}
        />
      )}
    </div>
  )
}
