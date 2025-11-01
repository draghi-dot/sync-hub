"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { DepartmentImage } from "./department-image"

interface Department {
  id: string
  name: string
  access_code: string
}

interface DepartmentAccessModalProps {
  department: Department
  teamId: string
  userDepartment?: string | null
  isAssigned?: boolean
}

export function DepartmentAccessModal({ department, teamId, userDepartment, isAssigned }: DepartmentAccessModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  // Check if user is assigned to this department - no password needed
  const userIsAssigned = isAssigned || (userDepartment === department.name)

  const handleClick = () => {
    if (userIsAssigned) {
      // User is assigned - directly navigate without password
      router.push(`/teams/${teamId}/departments/${department.id}`)
    } else {
      // User is not assigned - show password dialog
      setIsOpen(true)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Verify code against any department with the same name (access code is same for same department name)
    const { data: deptData, error } = await createClient()
      .from("departments")
      .select("access_code")
      .eq("name", department.name)
      .limit(1)
      .single()

    if (error || !deptData) {
      setError("Department not found. Please try again.")
      return
    }

    if (code === deptData.access_code) {
      // Redirect to department chats
      router.push(`/teams/${teamId}/departments/${department.id}`)
    } else {
      setError("Incorrect code. Please try again.")
    }
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleClick}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <DepartmentImage departmentName={department.name} size="md" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900">{department.name}</h3>
              <p className="text-sm text-gray-600">
                Click to enter
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!userIsAssigned && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter Code for {department.name}</DialogTitle>
              <DialogDescription>Please enter the department access code to continue</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Department Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="XX-XXX-0000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value)
                    setError("")
                  }}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full">
                Submit
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
