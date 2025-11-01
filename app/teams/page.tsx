import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
import { TeamImage } from "@/components/teams/team-image"

export default async function TeamsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user's profile to check company and admin status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company, is_admin")
    .eq("id", user.id)
    .maybeSingle() // Use maybeSingle instead of single to avoid errors when profile doesn't exist

  if (profileError) {
    // Only log meaningful errors
    const errorMessage = profileError.message || JSON.stringify(profileError)
    if (errorMessage && errorMessage !== '{}' && profileError.code !== 'PGRST116') {
      console.error("Error fetching profile:", errorMessage)
    }
  }

  // Get teams for user's company - only show teams from user's company
  let teams = null
  let teamsError = null

  if (profile?.company) {
    const result = await supabase
      .from("teams")
      .select("*")
      .eq("company", profile.company)
      .order("name", { ascending: true })
    
    teams = result.data
    teamsError = result.error
  } else {
    // No company set - don't show any teams
    teams = []
  }

  if (teamsError) {
    console.error("Error fetching teams:", teamsError)
  }

  // Debug logging
  console.log("User company:", profile?.company)
  console.log("Teams found:", teams?.length || 0)
  if (teams && teams.length > 0) {
    console.log("Sample team:", teams[0])
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-sm text-gray-600">{profile?.company}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams && teams.length > 0 ? (
            <>
              {teams.map((team) => (
                <Link key={team.id} href={`/teams/${team.id}`}>
                  <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <TeamImage teamName={team.name} logoUrl={team.logo_url} size="md" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">{team.name}</h3>
                          <p className="text-sm text-gray-600">View departments</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}

              {profile?.is_admin && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <Button className="w-full bg-transparent" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Team
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-12">
              {teamsError ? (
                <>
                  <p className="text-red-500 mb-4">Error loading teams. Please check the console for details.</p>
                  <p className="text-sm text-gray-400">Error: {teamsError.message}</p>
                </>
              ) : !profile?.company ? (
                <>
                  <p className="text-gray-500 mb-4">No company set in your profile.</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Please update your profile to set your company and see teams.
                  </p>
                  <Link href={`/profile/${user.id}`}>
                    <Button variant="outline">Update Profile</Button>
                  </Link>
                </>
              ) : (
                <p className="text-gray-500">No teams found for {profile.company}.</p>
              )}
            </div>
          )}
        </div>
      </main>

      <MobileNav userId={user.id} />
    </div>
  )
}
