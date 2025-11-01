import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // If user is already logged in, redirect to feed
  if (data?.user) {
    redirect("/feed");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-3xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Connect with Your Team
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            Your company&apos;s internal social network for collaboration,
            communication, and community building.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/auth/login">Sign In</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg px-8">
            <Link href="/auth/sign-up">Create Account</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2 text-gray-900">
              Share Updates
            </h3>
            <p className="text-sm text-gray-600">
              Post updates, announcements, and ideas with your colleagues
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2 text-gray-900">
              Engage & Collaborate
            </h3>
            <p className="text-sm text-gray-600">
              Comment, like, and discuss with your team members
            </p>
          </div>
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-semibold text-lg mb-2 text-gray-900">
              Build Community
            </h3>
            <p className="text-sm text-gray-600">
              Connect with colleagues across departments and locations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
