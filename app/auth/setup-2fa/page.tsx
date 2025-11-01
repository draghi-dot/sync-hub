"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import QRCode from "qrcode"

function Setup2FAContent() {
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [secret, setSecret] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get("userId")
  const company = searchParams.get("company")

  useEffect(() => {
    // Generate TOTP secret and QR code
    const generateSecret = async () => {
      // Generate a random base32 secret
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      let secret = ""
      for (let i = 0; i < 32; i++) {
        secret += chars[Math.floor(Math.random() * chars.length)]
      }
      setSecret(secret)

      // Create otpauth URL
      const otpauthUrl = `otpauth://totp/CompanySocial:${userId}?secret=${secret}&issuer=CompanySocial`

      // Generate QR code
      const qrUrl = await QRCode.toDataURL(otpauthUrl)
      setQrCodeUrl(qrUrl)
    }

    // Ensure company is saved in profile - try multiple times with delays
    // Note: Company is now set in profile settings, not during sign-up
    const ensureCompanySaved = async (attempt = 1, maxAttempts = 5) => {
      // Company is no longer set during sign-up, skip this
      return
      
      if (!userId || !company) {
        console.log("ensureCompanySaved: Missing userId or company", { userId, company })
        return
      }
      
      const supabase = createClient()
      console.log(`ensureCompanySaved: Attempt ${attempt}/${maxAttempts}`)
      
      try {
        // Try to get user (might fail on first attempts)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user || user.id !== userId) {
          console.log(`ensureCompanySaved: User not authenticated yet (attempt ${attempt})`)
          // Retry if we haven't hit max attempts
          if (attempt < maxAttempts) {
            setTimeout(() => ensureCompanySaved(attempt + 1, maxAttempts), 500)
          }
          return
        }
        
        // Get company from metadata or query param (prioritize query param)
        const companyFromMetadata = company || user?.user_metadata?.company
        
        console.log("ensureCompanySaved: Company from metadata:", user?.user_metadata?.company)
        console.log("ensureCompanySaved: Company from query param:", company)
        console.log("ensureCompanySaved: Final company to save:", companyFromMetadata)
        
        if (!companyFromMetadata) {
          console.warn("ensureCompanySaved: No company found to save")
          return
        }
        
        // Check if profile exists and get current company
        const { data: existingProfile, error: profileCheckError } = await supabase
          .from("profiles")
          .select("company, email")
          .eq("id", userId)
          .single()
        
        if (profileCheckError) {
          console.error("ensureCompanySaved: Error checking profile:", profileCheckError)
          // Profile might not exist yet, try to create it
          if (attempt < maxAttempts) {
            setTimeout(() => ensureCompanySaved(attempt + 1, maxAttempts), 500)
          }
          return
        }
        
        console.log("ensureCompanySaved: Current profile company:", existingProfile?.company)
        
        // Update if company is missing, empty, or if query param is provided (force update)
        if ((!existingProfile?.company || existingProfile.company === '' || company) && companyFromMetadata) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
              {
                id: userId,
                email: user.email || existingProfile?.email || '',
                company: companyFromMetadata,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'id' }
            )
          
          if (profileError) {
            console.error("ensureCompanySaved: Error saving company:", profileError)
            // Retry if we haven't hit max attempts
            if (attempt < maxAttempts) {
              setTimeout(() => ensureCompanySaved(attempt + 1, maxAttempts), 500)
            }
          } else {
            console.log("ensureCompanySaved: Company saved successfully:", companyFromMetadata)
          }
        } else {
          console.log("ensureCompanySaved: Profile already has company, no update needed")
        }
      } catch (err) {
        console.error(`ensureCompanySaved: Error on attempt ${attempt}:`, err)
        if (attempt < maxAttempts) {
          setTimeout(() => ensureCompanySaved(attempt + 1, maxAttempts), 500)
        }
      }
    }

    generateSecret()
    // Start trying to save company with retries
    setTimeout(() => ensureCompanySaved(), 500)
  }, [userId, company])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      if (!userId) {
        throw new Error("User ID is missing. Please try signing up again.")
      }

      console.log("Setup-2FA: userId:", userId, "company param:", company)

      // Get user - but don't require strict authentication check
      // After sign-up, user might not be fully authenticated in browser yet
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.warn("Could not get user:", userError)
      }
      
      console.log("User metadata:", user?.user_metadata)
      console.log("Company from metadata:", user?.user_metadata?.company)
      
      // Prepare update data - always update totp_secret
      const updateData: { totp_secret: string; company?: string } = { totp_secret: secret }
      
      // Company is now set in profile settings with code verification
      // No need to set it here during 2FA setup
      
      console.log("Final update data:", { totp_secret: "***", company: updateData.company })
      
      // Update profile with TOTP secret (and company if needed)
      const { error: updateError, data: updateResult } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
        .select()

      if (updateError) {
        console.error("Profile update error:", updateError)
        console.error("Update error details:", JSON.stringify(updateError, null, 2))
        throw new Error(`Failed to save 2FA secret: ${updateError.message}`)
      }
      
      console.log("Profile updated successfully:", updateResult)

      // For now, we'll skip actual TOTP verification and just redirect
      // In production, you'd verify the code against the secret
      router.push("/auth/email-confirmation")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Set Up Two-Factor Authentication</CardTitle>
            <CardDescription>Please scan this QR code with your Google Authenticator app</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify}>
              <div className="flex flex-col gap-6">
                {qrCodeUrl && (
                  <div className="flex justify-center">
                    <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code" className="w-64 h-64" />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="code">6-Digit Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    required
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify & Complete Sign Up"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function Setup2FAPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Setup2FAContent />
    </Suspense>
  )
}
