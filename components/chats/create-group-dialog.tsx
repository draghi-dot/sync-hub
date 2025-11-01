"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Image as ImageIcon, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Profile {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  currentUserId,
}: CreateGroupDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [groupName, setGroupName] = useState("")
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Search for users
  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const clientSupabase = createClient()
    const { data: profiles } = await clientSupabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .neq("id", currentUserId)
      .limit(20)

    if (profiles) {
      // Filter out already selected members
      const filtered = profiles.filter((p) => !selectedMembers.includes(p.id))
      setSearchResults(filtered)
    }
    setIsSearching(false)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    
    if (query.trim().length >= 2) {
      searchUsers(query)
    } else {
      setSearchResults([])
    }
  }

  const handleAddMember = (userId: string) => {
    if (!selectedMembers.includes(userId)) {
      setSelectedMembers([...selectedMembers, userId])
      setSearchQuery("")
      setSearchResults([])
    }
  }

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter((id) => id !== userId))
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be smaller than 5MB")
        return
      }
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file")
        return
      }
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreate = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name")
      return
    }

    if (selectedMembers.length < 2) {
      alert("Please add at least 2 other members to create a group chat")
      return
    }

    setIsCreating(true)

    try {
      let avatarUrl: string | null = null

      const clientSupabase = createClient()

      // Upload avatar if provided
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop()
        const fileName = `group-${Date.now()}.${fileExt}`
        const filePath = `group-avatars/${fileName}`

        const { data: uploadData, error: uploadError } = await clientSupabase.storage
          .from("chat-files")
          .upload(filePath, avatarFile, {
            cacheControl: "3600",
            upsert: false,
          })

        if (uploadError) {
          console.error("Error uploading avatar:", uploadError)
          alert("Failed to upload avatar image. Continuing without it...")
        } else {
          const { data: { publicUrl } } = clientSupabase.storage
            .from("chat-files")
            .getPublicUrl(filePath)
          avatarUrl = publicUrl
        }
      }

      // Create group chat (only include avatar_url if it exists and column exists)
      const chatData: any = {
        name: groupName.trim(),
        type: "group",
        created_by: currentUserId,
      }
      
      // Only add avatar_url if we have one (and column exists)
      if (avatarUrl) {
        chatData.avatar_url = avatarUrl
      }

      const { data: newChat, error: chatError } = await clientSupabase
        .from("chats")
        .insert(chatData)
        .select()
        .single()

      if (chatError) {
        console.error("Error creating chat:", chatError)
        console.error("Chat error details:", JSON.stringify(chatError, null, 2))
        const errorMessage = chatError.message || "Failed to create group chat."
        const errorCode = (chatError as any)?.code
        
        // Provide helpful error message based on error code
        if (errorCode === '42501' || errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
          alert(
            `Failed to create group chat: Permission denied (RLS Policy).\n\n` +
            `Error: ${errorMessage}\n\n` +
            `To fix this:\n` +
            `1. Go to Supabase SQL Editor\n` +
            `2. Run: scripts/051_fix_group_chat_creation.sql\n` +
            `3. Try creating the group again`
          )
        } else {
          alert(`Failed to create group chat: ${errorMessage}`)
        }
        setIsCreating(false)
        return
      }

      // Add creator and selected members
      const allUserIds = [currentUserId, ...selectedMembers]
      
      // Try using the function first (if available)
      let insertedMembers = null
      let memberError = null
      
      try {
        console.log("Attempting to use add_chat_members function...")
        const { data: functionResult, error: functionError } = await clientSupabase
          .rpc('add_chat_members', {
            p_chat_id: newChat.id,
            p_user_ids: allUserIds
          })
        
        console.log("Function call result:", { functionResult, functionError })
        
        if (!functionError && functionResult && functionResult.length > 0) {
          insertedMembers = functionResult
          console.log("✅ Successfully added members via function:", insertedMembers.length)
        } else if (functionError) {
          // Function error - check if it's "function doesn't exist" or other error
          console.log("Function error:", functionError)
          if (functionError.code === '42883' || functionError.message?.includes('does not exist')) {
            console.log("Function doesn't exist yet, will try direct insert")
            memberError = null // Reset to try direct insert
          } else {
            // Other function error - might be permission issue
            memberError = functionError
          }
        } else {
          // Function returned empty - might need to try direct insert
          console.log("Function returned empty result, trying direct insert")
          memberError = null
        }
      } catch (functionErr) {
        console.log("Function call exception:", functionErr)
        // Continue to try direct insert
        memberError = null
      }
      
      // If function didn't work, try direct insert
      if (!insertedMembers) {
        console.log("Attempting direct INSERT...")
        const members = [
          { chat_id: newChat.id, user_id: currentUserId },
          ...selectedMembers.map((id) => ({ chat_id: newChat.id, user_id: id })),
        ]

        const { data: directInsertResult, error: directInsertError } = await clientSupabase
          .from("chat_members")
          .insert(members)
          .select()
        
        console.log("Direct insert result:", { directInsertResult, directInsertError })
        
        if (!directInsertError && directInsertResult) {
          insertedMembers = directInsertResult
          console.log("✅ Successfully added members via direct insert:", insertedMembers.length)
        } else {
          memberError = directInsertError
        }
      }

      if (memberError) {
        console.error("Error adding members:", memberError)
        console.error("Member error details:", JSON.stringify(memberError, null, 2))
        console.error("Trying to add members for chat:", newChat.id, "User IDs:", allUserIds)
        
        // Check if it's a duplicate key error (members already exist)
        if (memberError.code === '23505' || memberError.message?.includes('duplicate')) {
          // Try to verify members were actually added
          const { data: existingMembers } = await clientSupabase
            .from("chat_members")
            .select("user_id")
            .eq("chat_id", newChat.id)
          
          console.log("Existing members after error:", existingMembers)
          
          if (existingMembers && existingMembers.length >= allUserIds.length) {
            // Members were actually added, continue
            console.log("Members were added despite error, continuing...")
          } else {
            alert(`Failed to add some members: ${memberError.message}\n\nPlease try again or manually add members.`)
            setIsCreating(false)
            return
          }
        } else {
          const errorCode = (memberError as any)?.code
          const errorMessage = memberError.message || "Failed to add members"
          
          if (errorCode === '42501' || errorMessage.includes('row-level security') || errorMessage.includes('RLS')) {
          alert(
            `Failed to add members: Permission denied (RLS Policy).\n\n` +
            `Error: ${errorMessage}\n\n` +
            `To fix this:\n` +
            `1. Go to Supabase SQL Editor\n` +
            `2. Run: scripts/057_ultimate_fix_chat_members_insert.sql\n` +
            `3. Refresh this page and try creating the group again\n\n` +
            `This creates a function that bypasses RLS for adding members.`
          )
          } else {
            alert(`Failed to add members: ${errorMessage}\n\nPlease check RLS policies.`)
          }
          setIsCreating(false)
          return
        }
      } else {
        console.log("Successfully added members:", insertedMembers)
      }

      // Reset form and close dialog
      setGroupName("")
      setSelectedMembers([])
      setAvatarFile(null)
      setAvatarPreview(null)
      setSearchQuery("")
      setSearchResults([])
      
      // Dispatch event to refresh chat list BEFORE closing dialog
      window.dispatchEvent(new CustomEvent("chat-created", { detail: { chatId: newChat.id } }))
      
      // Close dialog
      onOpenChange(false)
      
      // Small delay to ensure event is processed, then navigate
      setTimeout(() => {
        router.push(`/chat/${newChat.id}`)
        router.refresh()
      }, 300)
    } catch (error) {
      console.error("Error creating group:", error)
      alert("Failed to create group chat. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const [selectedMemberProfiles, setSelectedMemberProfiles] = useState<Profile[]>([])

  // Fetch selected member profiles when selectedMembers changes
  useEffect(() => {
    const fetchProfiles = async () => {
      if (selectedMembers.length === 0) {
        setSelectedMemberProfiles([])
        return
      }

      const clientSupabase = createClient()
      const { data: profiles } = await clientSupabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", selectedMembers)

      setSelectedMemberProfiles(profiles || [])
    }
    fetchProfiles()
  }, [selectedMembers])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
          <DialogDescription>
            Create a group chat with 3 or more people. Give it a name and optionally add a profile picture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name *</Label>
            <Input
              id="group-name"
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          {/* Avatar Upload */}
          <div className="space-y-2">
            <Label>Group Picture <span className="text-gray-500 font-normal">(Optional)</span></Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback>
                  {groupName.charAt(0).toUpperCase() || "G"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCreating}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {avatarFile ? "Change Picture" : "Add Picture"}
                </Button>
                {avatarFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => {
                      setAvatarFile(null)
                      setAvatarPreview(null)
                    }}
                    disabled={isCreating}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Selected Members */}
          {selectedMemberProfiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Members ({selectedMembers.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedMemberProfiles.map((profile) => (
                  <Badge
                    key={profile.id}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {profile.full_name || profile.email}
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(profile.id)}
                      disabled={isCreating}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Member Search */}
          <div className="space-y-2">
            <Label htmlFor="member-search">Add Members (Minimum 2) *</Label>
            <Input
              id="member-search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={handleSearchChange}
              disabled={isCreating}
            />
            {isSearching && (
              <p className="text-sm text-gray-500">Searching...</p>
            )}
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {searchResults.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleAddMember(profile.id)}
                    disabled={isCreating || selectedMembers.includes(profile.id)}
                    className="w-full p-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-b-0"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>
                        {profile.full_name?.charAt(0).toUpperCase() ||
                          profile.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">
                        {profile.full_name || profile.email}
                      </p>
                      {profile.full_name && (
                        <p className="text-sm text-gray-500">{profile.email}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || selectedMembers.length < 2 || !groupName.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Group"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

