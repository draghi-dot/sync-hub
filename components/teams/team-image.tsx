"use client"

import { useState } from "react"
import Image from "next/image"
import { getTeamImageUrl, getTeamImageUrls, getTeamIcon } from "@/lib/team-images"

interface TeamImageProps {
  teamName: string
  logoUrl?: string | null
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "w-10 h-10",
  md: "w-16 h-16",
  lg: "w-24 h-24",
}

const textSizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
}

export function TeamImage({ teamName, logoUrl, size = "md" }: TeamImageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const imageUrls = getTeamImageUrls(teamName, logoUrl)
  const icon = getTeamIcon(teamName)

  const currentImageUrl = imageUrls[currentImageIndex] || null

  const handleImageError = () => {
    // Try next image URL if available
    if (currentImageIndex < imageUrls.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1)
      setImageError(false) // Reset error to try next image
    } else {
      // All images failed, show icon
      setImageError(true)
    }
  }

  return (
    <div className={`${sizeClasses[size]} bg-white rounded-lg flex items-center justify-center relative overflow-hidden shadow-md border border-gray-200`}>
      {currentImageUrl && !imageError ? (
        <Image
          key={currentImageUrl} // Force re-render when URL changes
          src={currentImageUrl}
          alt={teamName}
          fill
          className="object-contain p-2"
          onError={handleImageError}
          unoptimized
        />
      ) : (
        <span className={textSizes[size]}>{icon}</span>
      )}
    </div>
  )
}

