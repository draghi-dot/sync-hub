"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Pencil, Mail, Briefcase, Building2, Building } from "lucide-react"
import { useState } from "react"
import { EditProfileDialog } from "./edit-profile-dialog"

interface ProfileHeaderProps {
  profile: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    bio: string | null
    job_title: string | null
    department: string | null
    company: string | null
  }
  isOwnProfile: boolean
  postCount: number
  departments?: string[]
}

export function ProfileHeader({ profile, isOwnProfile, postCount, departments = [] }: ProfileHeaderProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  // Deduplicate departments to avoid duplicate keys
  const uniqueDepartments = Array.from(new Set(departments))

  const initials =
    profile.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{profile.full_name || "Unknown User"}</h1>
                  <div className="mt-2 space-y-2">
                    {profile.job_title && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Briefcase className="h-4 w-4" />
                        <span>{profile.job_title}</span>
                      </div>
                    )}
                    {uniqueDepartments.length > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 flex-wrap">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="flex flex-wrap gap-1">
                          {uniqueDepartments.map((dept, idx) => (
                            <span key={`${dept}-${idx}`}>
                              {dept}
                              {idx < uniqueDepartments.length - 1 && <span className="mx-1">,</span>}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                    {profile.company && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building className="h-4 w-4" />
                        <span>{profile.company}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{profile.email}</span>
                    </div>
                  </div>
                </div>

                {isOwnProfile && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>

              {profile.bio && <p className="mt-4 text-gray-700 leading-relaxed">{profile.bio}</p>}

              <div className="mt-4 pt-4 border-t">
                <div className="flex gap-6">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">{postCount}</span>
                    <span className="ml-2 text-gray-600">{postCount === 1 ? "Post" : "Posts"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isOwnProfile && (
        <EditProfileDialog profile={profile} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
      )}
    </>
  )
}
