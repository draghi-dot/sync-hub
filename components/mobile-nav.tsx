"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, User, Users, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  userId: string
}

export function MobileNav({ userId }: MobileNavProps) {
  const pathname = usePathname()

  const navItems = [
    {
      href: "/feed",
      label: "Home",
      icon: Home,
      active: pathname === "/feed",
    },
    {
      href: "/teams",
      label: "Teams",
      icon: Users,
      active: pathname?.startsWith("/teams"),
    },
    {
      href: "/chats",
      label: "Chats",
      icon: MessageCircle,
      active: pathname?.startsWith("/chats"),
    },
    {
      href: `/profile/${userId}`,
      label: "Profile",
      icon: User,
      active: pathname?.startsWith("/profile"),
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-center justify-around h-16 px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                item.active ? "text-blue-600" : "text-gray-600 hover:text-gray-900",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
