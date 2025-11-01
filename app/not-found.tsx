import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700">Page Not Found</h2>
        <p className="text-gray-600 max-w-md">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Button asChild>
          <Link href="/feed">
            <Home className="mr-2 h-4 w-4" />
            Back to Feed
          </Link>
        </Button>
      </div>
    </div>
  )
}
