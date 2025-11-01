"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface DailyMeetingButtonProps {
  departmentId: string
  departmentName: string
  teamId: string
}

export function DailyMeetingButton({ departmentId, departmentName, teamId }: DailyMeetingButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    // Navigate to video call page for this department
    router.push(`/teams/${teamId}/departments/${departmentId}/meeting`)
  }

  return (
    <Button
      onClick={handleClick}
      className="w-14 h-14 rounded-full bg-white hover:bg-gray-100 text-gray-900 font-bold text-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center border-2 border-gray-300"
      size="icon"
      aria-label="Start Daily Meeting"
    >
      D
    </Button>
  )
}

