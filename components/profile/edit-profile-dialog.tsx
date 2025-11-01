"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2, X, Camera, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getDepartmentIcon } from "@/lib/department-images"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface EditProfileDialogProps {
  profile: {
    id: string
    full_name: string | null
    bio: string | null
    job_title: string | null
    department: string | null
    company: string | null
    avatar_url: string | null
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Department {
  id: string
  name: string
  access_code: string
}

const COMPANIES = [
  { name: "Adobe", code: "AdobeCode" },
  { name: "Google", code: "GoogleCode" },
  { name: "Electronic Arts", code: "EACode" }
]

export function EditProfileDialog({ profile, open, onOpenChange }: EditProfileDialogProps) {
  const [fullName, setFullName] = useState(profile.full_name || "")
  const [bio, setBio] = useState(profile.bio || "")
  const [jobTitle, setJobTitle] = useState(profile.job_title || "")
  const [selectedCompany, setSelectedCompany] = useState<string>(profile.company || "")
  const [companyAccessCode, setCompanyAccessCode] = useState("")
  const [companyError, setCompanyError] = useState("")
  const [companyVerified, setCompanyVerified] = useState(!!profile.company)
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string>("")
  const [departmentAccessCode, setDepartmentAccessCode] = useState("")
  const [departmentError, setDepartmentError] = useState("")
  const [departments, setDepartments] = useState<Department[]>([])
  const [assignedDepartments, setAssignedDepartments] = useState<string[]>([]) // Array of department names
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar_url)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Update avatar preview when profile changes
  useEffect(() => {
    if (profile.avatar_url) {
      setAvatarPreview(profile.avatar_url)
    }
  }, [profile.avatar_url])

  // Fetch all unique departments for verified company (grouped by name, use first access_code)
  useEffect(() => {
    const fetchDepartments = async () => {
      const companyToUse = selectedCompany || profile.company
      if (!companyToUse || !open || !companyVerified) return
      
      setLoadingDepartments(true)
      try {
        // Get teams for the verified company
        const { data: teams } = await supabase
          .from("teams")
          .select("id")
          .eq("company", companyToUse)

        if (!teams || teams.length === 0) {
          setDepartments([])
          return
        }

        const teamIds = teams.map((t) => t.id)

        // Get all departments for those teams
        const { data: depts, error } = await supabase
          .from("departments")
          .select(`
            id,
            name,
            access_code,
            team_id
          `)
          .in("team_id", teamIds)
          .order("name", { ascending: true })

        if (error) throw error

        // Group by name and get unique departments (same name = same access code)
        const uniqueDepartments = new Map<string, Department>()
        for (const dept of depts || []) {
          if (!uniqueDepartments.has(dept.name)) {
            uniqueDepartments.set(dept.name, {
              id: dept.id, // Keep first ID, doesn't matter which one
              name: dept.name,
              access_code: dept.access_code
            })
          }
        }

        setDepartments(Array.from(uniqueDepartments.values()))

        // Load user's currently assigned departments
        const { data: userDepts, error: userDeptsError } = await supabase
          .from("user_departments")
          .select(`
            departments (
              name
            )
          `)
          .eq("user_id", profile.id)

        if (userDeptsError) {
          // Only log meaningful errors (not empty objects or missing table errors)
          if (userDeptsError.message && 
              userDeptsError.message !== '{}' && 
              !userDeptsError.message.includes('relation "public.user_departments" does not exist') &&
              !userDeptsError.message.includes("Could not find the table 'public.user_departments' in the schema cache")) {
            console.error("Error fetching user departments:", userDeptsError.message)
          }
          // If table doesn't exist yet, that's okay - user hasn't run the migration script
          setAssignedDepartments([])
        } else {
          const assignedNames = userDepts?.map((ud: any) => ud.departments?.name).filter(Boolean) || []
          // Remove duplicates - same department name might appear multiple times (different teams)
          const uniqueAssignedNames = Array.from(new Set(assignedNames))
          setAssignedDepartments(uniqueAssignedNames)
        }
      } catch (error) {
        console.error("Error fetching departments:", error)
      } finally {
        setLoadingDepartments(false)
      }
    }

    fetchDepartments()
  }, [selectedCompany, profile.company, open, supabase, profile.id, companyVerified])

  // Update form fields when profile changes
  useEffect(() => {
    setFullName(profile.full_name || "")
    setBio(profile.bio || "")
    setJobTitle(profile.job_title || "")
    setSelectedCompany(profile.company || "")
    setCompanyVerified(!!profile.company)
    setCompanyAccessCode("")
    setCompanyError("")
    setDepartmentAccessCode("")
    setDepartmentError("")
    setSelectedDepartmentName("")
  }, [profile])

  const handleCompanyVerify = () => {
    if (!selectedCompany) {
      setCompanyError("Please select a company")
      return false
    }

    const companyConfig = COMPANIES.find((c) => c.name === selectedCompany)
    if (!companyConfig) {
      setCompanyError("Company not found")
      return false
    }

    if (companyAccessCode !== companyConfig.code) {
      setCompanyError("Incorrect company code. Please try again.")
      return false
    }

    setCompanyError("")
    setCompanyVerified(true)
    return true
  }

  const handleDepartmentVerify = async (): Promise<boolean> => {
    if (!selectedDepartmentName || !departmentAccessCode) {
      setDepartmentError("Please select a department and enter the access code")
      return false
    }

    const companyToUse = selectedCompany || profile.company
    if (!companyToUse) {
      setDepartmentError("Please select a company first")
      return false
    }

    try {
      // Get teams for the company
      const { data: teams } = await supabase
        .from("teams")
        .select("id")
        .eq("company", companyToUse)

      if (!teams || teams.length === 0) {
        setDepartmentError("No teams found for your company")
        return false
      }

      const teamIds = teams.map((t) => t.id)
      
      // Check directly against database for this company
      // Get ALL departments with this name to see what codes exist
      const { data: allDepts, error: deptError } = await supabase
        .from("departments")
        .select(`
          access_code, 
          name, 
          team_id,
          teams (
            company
          )
        `)
        .eq("name", selectedDepartmentName)
        .in("team_id", teamIds)

      if (deptError) {
        console.error("Error verifying department:", deptError)
        setDepartmentError("Error verifying department. Please try again.")
        return false
      }

      // Filter by company after fetching (since we can't filter on joined table directly)
      const filteredDepts = allDepts?.filter((dept: any) => {
        return dept.teams && dept.teams.company === companyToUse
      }) || []

      if (filteredDepts.length === 0) {
        setDepartmentError(`Department "${selectedDepartmentName}" not found for your company (${companyToUse})`)
        return false
      }

      // Get the first department's code (they should all be the same for the same company)
      const deptData = filteredDepts[0]
      
      // Handle potential null access_code
      if (!deptData.access_code) {
        console.error("❌ Department has no access code!", { department: selectedDepartmentName, company: companyToUse })
        setDepartmentError(`Department "${selectedDepartmentName}" has no access code configured. Please contact support.`)
        return false
      }
      
      // Normalize codes for comparison (trim and uppercase)
      const enteredCodeUpper = departmentAccessCode.trim().toUpperCase()
      const dbCode = deptData.access_code.trim().toUpperCase()
      
      // Show all available codes in case there's a mismatch
      const allCodes = [...new Set(filteredDepts.map((d: any) => d.access_code).filter(Boolean))]
      
      console.log("🔍 Verifying code:", { 
        department: selectedDepartmentName,
        company: companyToUse,
        entered: departmentAccessCode,
        enteredNormalized: enteredCodeUpper,
        databaseRaw: deptData.access_code,
        databaseNormalized: dbCode,
        allCodesInDatabase: allCodes,
        match: enteredCodeUpper === dbCode,
        enteredLength: enteredCodeUpper.length,
        dbLength: dbCode.length,
        charCodes: {
          entered: enteredCodeUpper.split('').map(c => `${c}(${c.charCodeAt(0)})`),
          db: dbCode.split('').map(c => `${c}(${c.charCodeAt(0)})`)
        }
      })

      if (enteredCodeUpper !== dbCode) {
        // Show more helpful error with actual database code
        const errorDetails = {
          youEntered: departmentAccessCode,
          youEnteredNormalized: enteredCodeUpper,
          databaseHas: deptData.access_code || "NULL",
          databaseNormalized: dbCode || "NULL",
          allAvailableCodes: allCodes,
          department: selectedDepartmentName,
          company: companyToUse,
          foundDepartments: allDepts.length
        }
        console.error("❌ Code mismatch!", errorDetails)
        setDepartmentError(`Incorrect access code. For "${selectedDepartmentName}" in ${companyToUse}, the code should be: "${deptData.access_code || "NOT CONFIGURED"}"`)
        return false
      }

      console.log("✅ Code verified successfully!", { entered: departmentAccessCode, database: deptData.access_code })

      setDepartmentError("")
      return true
    } catch (error) {
      console.error("Error in department verification:", error)
      setDepartmentError("Error verifying department. Please try again.")
      return false
    }
  }

  const handleAddDepartment = async () => {
    if (!selectedDepartmentName || !departmentAccessCode) {
      return
    }

    // Verify access code
    const isValid = await handleDepartmentVerify()
    if (!isValid) {
      return
    }

    // Check if already assigned
    if (assignedDepartments.includes(selectedDepartmentName)) {
      setDepartmentError("You are already assigned to this department")
      return
    }

    setIsLoading(true)
    try {
      const companyToUse = selectedCompany || profile.company
      if (!companyToUse) {
        setDepartmentError("Please select a company first")
        setIsLoading(false)
        return
      }

      // Get teams for the company
      const { data: teams } = await supabase
        .from("teams")
        .select("id")
        .eq("company", companyToUse)

      if (!teams || teams.length === 0) {
        throw new Error("No teams found for your company")
      }

      const teamIds = teams.map((t) => t.id)

      // Find ALL departments with this name for the user's company (there may be multiple teams)
      // Get all departments with this name first, then filter by access code
      const enteredCode = departmentAccessCode.trim().toUpperCase()
      
      const { data: allDepts, error: deptError } = await supabase
        .from("departments")
        .select("id, access_code, name")
        .eq("name", selectedDepartmentName)
        .in("team_id", teamIds)

      if (deptError) {
        console.error("Error finding departments:", deptError)
        throw new Error("Failed to find department")
      }

      if (!allDepts || allDepts.length === 0) {
        throw new Error("Department not found for your company")
      }

      // Filter by access code (case-insensitive)
      const deptData = allDepts.filter(dept => {
        if (!dept.access_code) return false
        const dbCode = dept.access_code.trim().toUpperCase()
        return dbCode === enteredCode
      })

      console.log("Adding department:", {
        department: selectedDepartmentName,
        enteredCode,
        foundDepts: allDepts.length,
        matchingDepts: deptData.length,
        codes: allDepts.map(d => d.access_code),
        departmentIds: deptData.map(d => d.id),
        userId: profile.id
      })

      if (!deptData || deptData.length === 0) {
        throw new Error("Incorrect access code or department not found for your company")
      }

      // Validate department IDs and user ID before inserting
      const validDeptIds = deptData.filter(dept => dept.id && typeof dept.id === 'string')
      if (validDeptIds.length === 0) {
        throw new Error("No valid department IDs found")
      }

      if (!profile.id) {
        throw new Error("User ID is missing")
      }

      // Insert all departments with this name (one for each team) into user_departments
      const inserts = validDeptIds.map(dept => ({
        user_id: profile.id,
        department_id: dept.id
      }))

      console.log("Attempting to insert:", {
        insertsCount: inserts.length,
        inserts: inserts,
        userId: profile.id,
        departmentIds: validDeptIds.map(d => d.id)
      })

      // First, verify the table exists by trying a simple select
      const { error: testError, data: testData } = await supabase
        .from("user_departments")
        .select("id")
        .limit(0)

      if (testError) {
        // Try to extract error information
        const errorCode = (testError as any)?.code
        const errorMessage = (testError as any)?.message || (testError as any)?.details || (testError as any)?.hint
        const errorDetails = (testError as any)?.details
        const errorKeys = Object.keys(testError || {})
        const isEmptyError = errorKeys.length === 0 || (errorKeys.length === 1 && errorKeys[0] === 'toString')
        
        // Check if error is essentially empty (no useful information)
        const hasNoUsefulInfo = !errorCode && !errorMessage && !errorDetails && isEmptyError
        
        console.error("Table access test failed:", {
          code: errorCode,
          message: errorMessage,
          details: errorDetails,
          errorType: typeof testError,
          errorKeys: errorKeys,
          isEmptyError: isEmptyError,
          hasNoUsefulInfo: hasNoUsefulInfo,
          errorString: String(testError),
          errorJSON: (() => {
            try {
              return JSON.stringify(testError, null, 2)
            } catch {
              return "Could not stringify error"
            }
          })()
        })
        
        // Check if table doesn't exist (any error accessing table likely means it doesn't exist or RLS blocking)
        const errorStr = (errorMessage || "").toLowerCase()
        
        // If error is empty or we can't read useful info from it, assume table doesn't exist
        if (hasNoUsefulInfo || 
            errorStr.includes("does not exist") || 
            errorStr.includes("schema cache") || 
            errorStr.includes("relation") ||
            errorStr.includes("could not find") ||
            errorCode === '42P01' ||
            (!errorCode && !errorMessage && isEmptyError)) {
          setDepartmentError("⚠️ The user_departments table doesn't exist. Please run the migration script: scripts/027_create_user_departments.sql in your Supabase SQL Editor.")
          setIsLoading(false)
          return
        }
        
        // If it's an RLS/permission error, show that
        if (errorCode === '42501' || errorStr.includes("permission") || errorStr.includes("policy") || errorStr.includes("row-level security")) {
          setDepartmentError("⚠️ Permission denied. Please check RLS policies in scripts/027_create_user_departments.sql")
          setIsLoading(false)
          return
        }
        
        // Generic error
        setDepartmentError(`⚠️ Cannot access user_departments table: ${errorMessage || 'Unknown error'}. Please run scripts/027_create_user_departments.sql`)
        setIsLoading(false)
        return
      }
      
      // Table exists and is accessible
      console.log("✅ Table access test passed - user_departments table exists")

      const { error: insertError, data: insertData } = await supabase
        .from("user_departments")
        .insert(inserts)
        .select()

      if (insertError) {
        // Try to extract error information in multiple ways
        let errorCode: string | undefined
        let errorMessage: string | undefined
        let errorDetails: string | undefined
        let errorHint: string | undefined

        try {
          errorCode = (insertError as any)?.code
          errorMessage = (insertError as any)?.message
          errorDetails = (insertError as any)?.details
          errorHint = (insertError as any)?.hint
        } catch (e) {
          // Error accessing properties
        }

        // Log everything we can
        const errorInfo = {
          errorType: typeof insertError,
          errorConstructor: insertError?.constructor?.name,
          errorCode,
          errorMessage,
          errorDetails,
          errorHint,
          errorString: String(insertError),
          errorJSON: (() => {
            try {
              return JSON.stringify(insertError, null, 2)
            } catch {
              return "Could not stringify"
            }
          })(),
          errorKeys: (() => {
            try {
              return Object.keys(insertError || {})
            } catch {
              return []
            }
          })(),
          inserts: inserts,
          userId: profile.id,
          insertCount: inserts.length,
          authCheck: "Will check auth.uid() in next step"
        }
        
        console.error("Error inserting departments:", errorInfo)
        
        // Try to get more info by checking auth
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        console.error("Current authenticated user:", {
          userId: currentUser?.id,
          matchesInsertUserId: currentUser?.id === profile.id,
          insertUserId: profile.id
        })
        
        // Extract error message from various possible locations
        const extractedMessage = errorMessage || errorDetails || errorHint || String(insertError) || "Failed to add department"
        const extractedCode = errorCode || "unknown"
        
        // If duplicate constraint error, that's okay - user might already be in some of them
        if (extractedCode !== '23505') {
          // Check if it's because table doesn't exist
          const errorStr = extractedMessage.toLowerCase()
          if (errorStr.includes("does not exist") || 
              errorStr.includes("schema cache") ||
              errorStr.includes("relation") ||
              extractedCode === '42P01') {
            setDepartmentError("Please run the migration script first: scripts/027_create_user_departments.sql")
          } else if (extractedCode === '42501' || errorStr.includes("permission") || errorStr.includes("policy") || errorStr.includes("row-level security")) {
            setDepartmentError("Permission denied. The user ID must match auth.uid(). Check RLS policies. Run scripts/027_create_user_departments.sql")
          } else {
            // Provide more helpful error message
            setDepartmentError(`Error adding department: ${extractedMessage} (Code: ${extractedCode || 'unknown'})`)
            // Don't throw - just show error to user
          }
        } else {
          // Some were duplicates, but some might have succeeded - refresh the list
          // Update local state optimistically (deduplicate)
          const updated = Array.from(new Set([...assignedDepartments, selectedDepartmentName]))
          setAssignedDepartments(updated)
        }
      } else {
        // Success - update local state (deduplicate to avoid duplicates)
        console.log("✅ Successfully inserted departments:", insertData)
        const updated = Array.from(new Set([...assignedDepartments, selectedDepartmentName]))
        setAssignedDepartments(updated)
      }

      // Refresh assigned departments from database to be sure
      const { data: userDepts, error: refreshError } = await supabase
        .from("user_departments")
        .select(`
          departments (
            name
          )
        `)
        .eq("user_id", profile.id)

      if (refreshError) {
        // Table might not exist - that's okay, the insert might have failed
        console.warn("Could not refresh departments:", refreshError.message)
      } else if (userDepts) {
        const assignedNames = userDepts.map((ud: any) => ud.departments?.name).filter(Boolean) || []
        // Remove duplicates - same department name might appear multiple times (different teams)
        const uniqueNames = Array.from(new Set(assignedNames))
        setAssignedDepartments(uniqueNames)
        console.log("Assigned departments after refresh:", uniqueNames)
      }

      setSelectedDepartmentName("")
      setDepartmentAccessCode("")
      setDepartmentError("")
    } catch (error: any) {
      console.error("Error adding department:", error)
      const errorMessage = error?.message || "Failed to add department. Please try again."
      setDepartmentError(errorMessage)
    } finally {
      setIsLoading(false)
    }
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

  const handleRemoveAvatar = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    if (avatarInputRef.current) {
      avatarInputRef.current.value = ""
    }
  }

  const handleRemoveDepartment = async (departmentName: string) => {
    setIsLoading(true)
    try {
      // Find department IDs with this name
      const { data: deptData, error: deptError } = await supabase
        .from("departments")
        .select("id")
        .eq("name", departmentName)

      if (deptError) {
        throw deptError
      }

      if (!deptData || deptData.length === 0) {
        return
      }

      const departmentIds = deptData.map(d => d.id)

      // Remove from user_departments
      const { error: deleteError } = await supabase
        .from("user_departments")
        .delete()
        .eq("user_id", profile.id)
        .in("department_id", departmentIds)

      if (deleteError) {
        throw deleteError
      }

      // Update local state - remove all instances and deduplicate
      const updated = assignedDepartments.filter(d => d !== departmentName)
      setAssignedDepartments(Array.from(new Set(updated)))
    } catch (error) {
      console.error("Error removing department:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // Verify company code if company is selected and not yet verified
      let isCompanyVerified = companyVerified
      if (selectedCompany && !isCompanyVerified) {
        if (!handleCompanyVerify()) {
          setIsLoading(false)
          return
        }
        isCompanyVerified = true
        setCompanyVerified(true)
      }

      // Upload avatar if provided
      let avatarUrl: string | null = null
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop()
        const fileName = `avatar-${profile.id}-${Date.now()}.${fileExt}`
        const filePath = `avatars/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("chat-files")
          .upload(filePath, avatarFile, {
            cacheControl: "3600",
            upsert: false,
          })

        if (uploadError) {
          console.error("Error uploading avatar:", uploadError)
          alert("Failed to upload profile picture. Continuing with other updates...")
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("chat-files")
            .getPublicUrl(filePath)
          avatarUrl = publicUrl
        }
      } else if (avatarPreview === null && profile.avatar_url) {
        // User removed avatar - set to null
        avatarUrl = null
      } else {
        // Keep existing avatar
        avatarUrl = profile.avatar_url
      }

      const updateData: {
        full_name: string
        bio: string | null
        job_title: string
        company?: string
        avatar_url?: string | null
        updated_at: string
      } = {
        full_name: fullName,
        bio: bio || null,
        job_title: jobTitle,
        updated_at: new Date().toISOString(),
      }

      // Always update company if it's selected and verified
      if (selectedCompany && (isCompanyVerified || companyVerified)) {
        updateData.company = selectedCompany
      }

      // Update avatar_url if we have a new one or it was removed
      if (avatarUrl !== undefined && avatarUrl !== profile.avatar_url) {
        updateData.avatar_url = avatarUrl
      }

      const { error, data } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", profile.id)
        .select()

      if (error) {
        console.error("Profile update error:", error)
        throw error
      }

      console.log("Profile updated successfully:", data)

      onOpenChange(false)
      router.refresh()
    } catch (error) {
      console.error("Error updating profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your profile information</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Picture Section */}
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl">
                    {fullName.split(" ").map((n) => n[0]).join("").toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {avatarPreview ? "Change Picture" : "Upload Picture"}
                </Button>
                {avatarPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">Max size: 5MB. JPG, PNG, or GIF.</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title</Label>
            <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select 
              value={selectedCompany} 
              onValueChange={(value) => {
                setSelectedCompany(value)
                setCompanyAccessCode("")
                setCompanyError("")
                setCompanyVerified(false)
                setAssignedDepartments([])
                setDepartments([])
              }}
            >
              <SelectTrigger id="company">
                <SelectValue placeholder="Select your company" />
              </SelectTrigger>
              <SelectContent>
                {COMPANIES.map((comp) => (
                  <SelectItem key={comp.name} value={comp.name}>
                    {comp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCompany && !companyVerified && (
              <div className="space-y-2 mt-2">
                <Label htmlFor="companyCode">Company Access Code</Label>
                <Input
                  id="companyCode"
                  type="text"
                  placeholder="Enter company access code"
                  value={companyAccessCode}
                  onChange={(e) => {
                    setCompanyAccessCode(e.target.value)
                    setCompanyError("")
                  }}
                  required={!!selectedCompany && !companyVerified}
                />
                {companyError && <p className="text-sm text-red-500">{companyError}</p>}
                <p className="text-xs text-gray-500">
                  Codes: AdobeCode, GoogleCode, or EACode
                </p>
              </div>
            )}
            {companyVerified && (
              <p className="text-xs text-green-600">Company verified ✓</p>
            )}
          </div>
          
          {/* Assigned Departments Display */}
          {assignedDepartments.length > 0 && (
            <div className="space-y-2">
              <Label>Your Departments</Label>
              <div className="flex flex-wrap gap-2">
                {assignedDepartments.map((deptName) => (
                  <Badge key={deptName} variant="secondary" className="flex items-center gap-1.5">
                    <span className="text-sm">{getDepartmentIcon(deptName)}</span>
                    {deptName}
                    <button
                      type="button"
                      onClick={() => handleRemoveDepartment(deptName)}
                      className="ml-1 hover:text-red-500"
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Add Department Section */}
          {companyVerified && (
            <div className="space-y-2">
              <Label htmlFor="department">Add Department</Label>
              <Select 
                value={selectedDepartmentName} 
                onValueChange={(value) => {
                  setSelectedDepartmentName(value)
                  setDepartmentAccessCode("")
                  setDepartmentError("")
                }}
                disabled={loadingDepartments || !companyVerified}
              >
                <SelectTrigger id="department">
                  <SelectValue placeholder={
                    !companyVerified 
                      ? "Verify company first" 
                      : loadingDepartments 
                      ? "Loading departments..." 
                      : "Select a department"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {                  departments.length > 0 ? (
                    departments
                      .filter(d => !assignedDepartments.includes(d.name)) // Hide already assigned
                      .map((dept) => (
                        <SelectItem key={dept.name} value={dept.name}>
                          <span className="flex items-center gap-2">
                            <span>{getDepartmentIcon(dept.name)}</span>
                            {dept.name}
                          </span>
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="none" disabled>
                      {!companyVerified ? "Verify company first" : "No departments available"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedDepartmentName && companyVerified && (
                <div className="space-y-2 mt-2">
                  <Label htmlFor="departmentCode">Department Access Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="departmentCode"
                      type="text"
                      placeholder="Enter department access code"
                      value={departmentAccessCode}
                      onChange={(e) => {
                        setDepartmentAccessCode(e.target.value)
                        setDepartmentError("")
                      }}
                    />
                    <Button
                      type="button"
                      onClick={handleAddDepartment}
                      disabled={isLoading || !departmentAccessCode}
                    >
                      Add
                    </Button>
                  </div>
                  {departmentError && <p className="text-sm text-red-500">{departmentError}</p>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              className="min-h-[100px]"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
