"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { FileText, Download, Image as ImageIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

interface Message {
  id: string
  content: string | null
  sender_id: string
  created_at: string
  is_ai_transcript: boolean
  file_url: string | null
  file_name: string | null
  profiles: {
    full_name: string
    avatar_url: string | null
  } | null
}

interface ChatMessagesProps {
  messages: Message[]
  chatId: string
}

export function ChatMessages({ messages: initialMessages, chatId }: ChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check if file is an image
  const isImageFile = (fileName: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return imageExtensions.includes(ext)
  }

  // Download file helper function
  const downloadFile = async (url: string, fileName: string) => {
    try {
      // Try to fetch and download the file
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch file')
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Error downloading file:', error)
      // Fallback: open in new tab
      window.open(url, '_blank')
    }
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const fetchAllMessages = useCallback(async () => {
    const clientSupabase = createClient()
    const { data: testData, error: testError } = await clientSupabase
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
    
    if (testData) {
      // Only update if we have new messages or the count changed (to avoid unnecessary re-renders)
      setMessages((prev) => {
        const prevCount = prev.length
        const newCount = testData.length
        
        // Update if count changed or if any message IDs are different
        if (prevCount !== newCount || testData.some(newMsg => !prev.find(p => p.id === newMsg.id))) {
          return testData as Message[]
        }
        return prev
      })
      setTimeout(scrollToBottom, 100)
    } else if (testError) {
      console.error("Failed to fetch messages:", testError)
    }
  }, [chatId, scrollToBottom])

  // Update messages when initialMessages prop changes
  useEffect(() => {
    console.log("ChatMessages: Initial messages changed:", initialMessages?.length || 0)
    if (initialMessages) {
      setMessages(initialMessages)
      scrollToBottom()
    }
  }, [initialMessages, scrollToBottom])

  useEffect(() => {
    // Create supabase client inside effect to avoid dependency
    const clientSupabase = createClient()
    
    // Fetch messages immediately to ensure we have the latest
    fetchAllMessages()

    // Set up polling as a reliable fallback (every 3 seconds)
    const pollInterval = setInterval(() => {
      console.log("Polling for new messages...")
      fetchAllMessages()
    }, 3000) // Poll every 3 seconds

    // Subscribe to new messages via Realtime (instant updates if enabled)
    let channel: ReturnType<typeof clientSupabase.channel> | null = null
    
    try {
      channel = clientSupabase
        .channel(`chat:${chatId}`, {
          config: {
            broadcast: { self: true },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chatId}`,
          },
          async (payload) => {
            console.log("✅ New message received via realtime:", payload)
            
            try {
              // Fetch the full message with profile data
              const { data: newMessage, error: fetchError } = await clientSupabase
                .from("messages")
                .select(`
                  *,
                  profiles (
                    full_name,
                    avatar_url
                  )
                `)
                .eq("id", payload.new.id)
                .single()

              console.log("Fetched new message:", newMessage, "Error:", fetchError)

              if (newMessage) {
                setMessages((prev) => {
                  // Check if message already exists to avoid duplicates
                  if (prev.some(m => m.id === newMessage.id)) {
                    return prev
                  }
                  const updated = [...prev, newMessage as Message]
                  // Scroll to bottom after state update
                  setTimeout(scrollToBottom, 100)
                  return updated
                })
              } else if (fetchError) {
                console.error("Error fetching new message:", fetchError)
                // If we can't fetch the message, try fetching all messages again
                fetchAllMessages()
              }
            } catch (error) {
              console.error("Error processing realtime message:", error)
              fetchAllMessages()
            }
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status:", status)
          if (status === "SUBSCRIBED") {
            console.log("✅ Successfully subscribed to real-time updates for chat:", chatId)
          } else if (status === "CHANNEL_ERROR") {
            console.warn("⚠️ Realtime subscription error - using polling fallback")
            console.warn("This usually means:")
            console.warn("1. Realtime is not enabled for the messages table in Supabase")
            console.warn("2. Run scripts/048_enable_realtime_sync.sql in Supabase SQL Editor")
          } else if (status === "TIMED_OUT") {
            console.warn("⚠️ Realtime subscription timed out - using polling fallback")
          } else if (status === "CLOSED") {
            console.warn("⚠️ Realtime subscription closed")
          }
        })
    } catch (error) {
      console.error("Error setting up realtime subscription:", error)
    }

    // Listen for message-sent event and add message optimistically
    const handleMessageSent = (event: CustomEvent) => {
      if (event.detail.chatId === chatId) {
        console.log("Message sent event received")
        
        // If the full message object is included, add it immediately (optimistic update)
        if (event.detail.message) {
          setMessages((prev) => {
            // Check if already exists
            if (prev.some(m => m.id === event.detail.message.id)) {
              return prev
            }
            const updated = [...prev, event.detail.message as Message]
            setTimeout(scrollToBottom, 100)
            return updated
          })
        }
        
        // Also refresh after a short delay to ensure we have the latest
        setTimeout(() => fetchAllMessages(), 300)
      }
    }

    window.addEventListener('message-sent', handleMessageSent as EventListener)

    return () => {
      clearInterval(pollInterval)
      if (channel) {
        clientSupabase.removeChannel(channel)
      }
      window.removeEventListener('message-sent', handleMessageSent as EventListener)
    }
  }, [chatId, fetchAllMessages, scrollToBottom])

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        messages.map((message) => (
          <div key={message.id} className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {message.is_ai_transcript ? "AI" : message.profiles?.full_name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-gray-900">
                  {message.is_ai_transcript ? "AI Assistant" : message.profiles?.full_name || "Unknown"}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              </div>
              {message.content && <p className="text-gray-700 mt-1">{message.content}</p>}
              {message.file_url && message.file_name && (
                <div className="mt-2">
                  {isImageFile(message.file_name) ? (
                    <div className="space-y-2">
                      <a
                        href={message.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:border-gray-300 transition-colors">
                          <img
                            src={message.file_url}
                            alt={message.file_name}
                            className="max-w-full h-auto max-h-96 object-contain"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity flex items-center justify-center">
                            <Download className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </a>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{message.file_name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.preventDefault()
                            downloadFile(message.file_url, message.file_name)
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <a
                      href={message.file_url}
                      download={message.file_name}
                      className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors cursor-pointer group"
                      onClick={(e) => {
                        // If download fails (CORS issue), open in new tab
                        if (!e.defaultPrevented) {
                          e.preventDefault()
                          downloadFile(message.file_url, message.file_name)
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700">{message.file_name}</span>
                      <Download className="h-3 w-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
