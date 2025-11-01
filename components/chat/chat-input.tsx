"use client"

import type React from "react"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Paperclip, Send, X } from "lucide-react"

interface ChatInputProps {
  chatId: string
  userId: string
}

export function ChatInput({ chatId, userId }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB")
        return
      }
      setSelectedFile(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() && !selectedFile) return

    const supabase = createClient()
    const messageContent = message.trim()
    setIsLoading(true)

    try {
      let fileUrl: string | null = null
      let fileName: string | null = null

      // Upload file if one is selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileNameWithId = `${userId}-${Date.now()}.${fileExt}`
        const filePath = `${chatId}/${fileNameWithId}`

        // Upload to Supabase Storage (using 'chat-files' bucket)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(filePath, selectedFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error("Error uploading file:", uploadError)
          
          // Provide detailed error message based on error type
          if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
            alert(
              "Storage bucket 'chat-files' not found.\n\n" +
              "To fix this:\n" +
              "1. Go to Supabase Dashboard → Storage\n" +
              "2. Click 'New bucket'\n" +
              "3. Name it 'chat-files'\n" +
              "4. Make it Public (or set RLS policies)\n" +
              "5. Allow authenticated users to upload/read files"
            )
          } else if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('RLS') || uploadError.message?.includes('policy')) {
            alert(
              "Storage RLS policy error.\n\n" +
              "To fix this:\n" +
              "1. Go to Supabase Dashboard → SQL Editor\n" +
              "2. Run the script: scripts/024_setup_storage_policies.sql\n" +
              "3. This will create the necessary RLS policies for file uploads"
            )
          } else {
            alert(`Failed to upload file: ${uploadError.message}\n\nPlease check your Supabase Storage bucket permissions and RLS policies.`)
          }
          setIsLoading(false)
          return
        }

        // Get public URL for the file
        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(filePath)

        fileUrl = publicUrl
        fileName = selectedFile.name
      }

      // Insert the message
      const { data: insertedMessage, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: userId,
          content: messageContent || null,
          file_url: fileUrl,
          file_name: fileName,
        })
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error("Error inserting message:", error)
        console.error("Error code:", error.code)
        console.error("Error message:", error.message)
        console.error("Error details:", JSON.stringify(error, null, 2))
        console.error("Error hint:", error.hint)
        console.error("Chat ID:", chatId)
        console.error("User ID:", userId)
        
        // Try to get more error info
        const errorMessage = error.message || "Unknown error"
        const errorCode = error.code || "unknown"
        const errorHint = error.hint || ""
        
        // Provide more helpful error message
        if (errorMessage.includes("row-level security") || errorMessage.includes("RLS") || errorMessage.includes("policy") || errorCode === "42501") {
          alert(
            `Failed to send message: Permission denied (RLS Policy).\n\n` +
            `Error Code: ${errorCode}\n` +
            `Error: ${errorMessage}\n` +
            `Hint: ${errorHint || "None"}\n\n` +
            `You may not be a member of this group chat.\n\n` +
            `Please check:\n` +
            `1. Run scripts/042_fix_group_chat_rls.sql in Supabase SQL Editor\n` +
            `2. Run scripts/043_verify_group_chat_members.sql to verify membership\n` +
            `3. Verify you're in the chat_members table for chat ID: ${chatId}`
          )
        } else if (errorCode === "23503") {
          alert(
            `Failed to send message: Foreign key constraint violation.\n\n` +
            `The chat or user referenced may not exist.\n\n` +
            `Error: ${errorMessage}`
          )
        } else {
          alert(
            `Failed to send message.\n\n` +
            `Error Code: ${errorCode}\n` +
            `Error: ${errorMessage}\n` +
            `Hint: ${errorHint || "None"}\n\n` +
            `Please check the browser console for more details.`
          )
        }
        throw error
      }

      console.log("Message inserted successfully:", insertedMessage)

      // Clear the input and file
      setMessage("")
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      
      // Optimistically add the message to the UI immediately
      // This makes it appear instantly without waiting for realtime/polling
      window.dispatchEvent(new CustomEvent('message-sent', { 
        detail: { 
          chatId, 
          messageId: insertedMessage.id,
          message: insertedMessage // Include the full message object
        } 
      }))
    } catch (error) {
      console.error("[v0] Error sending message:", error)
      alert("Failed to send message. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {selectedFile && (
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
          <Paperclip className="h-4 w-4" />
          <span className="flex-1 truncate">{selectedFile.name}</span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || (!message.trim() && !selectedFile)}>
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  )
}
