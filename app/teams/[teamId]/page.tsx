import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MobileNav } from "@/components/mobile-nav"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { DepartmentAccessModal } from "@/components/teams/department-access-modal"
import { TeamImage } from "@/components/teams/team-image"

export default async function TeamDepartmentsPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
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

  // Get team details - RLS will ensure user can only access teams from their company
  const { data: team, error: teamError } = await supabase.from("teams").select("*").eq("id", teamId).single()

  // If team not found or doesn't belong to user's company, redirect
  if (teamError || !team || (profile?.company && team.company !== profile.company)) {
    redirect("/teams")
  }

  // Get departments for this team - only show departments from user's company teams
  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select(`
      *,
      teams:team_id (
        company
      )
    `)
    .eq("team_id", teamId)
    .order("created_at", { ascending: true })

  // Filter departments to only show those from user's company
  let filteredDepartments = departments?.filter(
    (dept) => dept.teams && dept.teams.company === profile?.company
  ) || []

  // If user has assigned departments, only show those departments (by name)
  if (userDepartmentNames.length > 0) {
    filteredDepartments = filteredDepartments.filter(
      (dept) => userDepartmentNames.includes(dept.name)
    )
  }
  
  // Remove duplicates by name (same department name appears in multiple teams)
  const uniqueDepartments = new Map<string, typeof filteredDepartments[0]>()
  for (const dept of filteredDepartments) {
    if (!uniqueDepartments.has(dept.name)) {
      uniqueDepartments.set(dept.name, dept)
    }
  }
  filteredDepartments = Array.from(uniqueDepartments.values())

  if (departmentsError) {
    console.error("Error fetching departments:", departmentsError)
  }

  // Debug: Log the query result
  console.log("Team ID:", teamId)
  console.log("Departments found:", departments?.length || 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/teams">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              {team && <TeamImage teamName={team.name} logoUrl={team.logo_url} size="sm" />}
              <h1 className="text-2xl font-bold text-gray-900">{team?.name} Departments</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="space-y-3">
          {userDepartmentNames.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 font-medium">You are not assigned to any department.</p>
              <p className="text-sm text-gray-400 mt-2">Please select a department in your profile settings.</p>
            </div>
          ) : filteredDepartments && filteredDepartments.length > 0 ? (
            filteredDepartments.map((department) => {
              // Check if this is one of the user's assigned departments
              const isUserDepartment = userDepartmentNames.includes(department.name)
              return (
                <DepartmentAccessModal 
                  key={department.id} 
                  department={department} 
                  teamId={teamId}
                  userDepartment={isUserDepartment ? department.name : null}
                  isAssigned={isUserDepartment}
                />
              )
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No departments found for this team matching your assigned departments.</p>
            </div>
          )}
        </div>
      </main>

      <MobileNav userId={user.id} />
    </div>
  )
}
