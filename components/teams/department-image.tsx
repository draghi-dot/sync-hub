"use client"

import { useState } from "react"
import Image from "next/image"
import { getDepartmentImage, getDepartmentImageUrls, getDepartmentIcon } from "@/lib/department-images"

interface DepartmentImageProps {
  departmentName: string
  size?: "sm" | "md" | "lg"
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
}

const textSizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
}

export function DepartmentImage({ departmentName, size = "md" }: DepartmentImageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const imageUrls = getDepartmentImageUrls(departmentName)
  const icon = getDepartmentIcon(departmentName)

  const currentImageUrl = imageUrls[currentImageIndex] || null

  const handleImageError = () => {
    // Try next image URL if available
    if (currentImageIndex < imageUrls.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1)
      setImageError(false) // Reset error to try next image
    } else {
      // All images failed, show icon fallback
      setImageError(true)
    }
  }

  return (
    <div className={`${sizeClasses[size]} bg-white rounded-lg flex items-center justify-center shadow-md border border-gray-200 relative overflow-hidden`}>
      {currentImageUrl && !imageError ? (
        <Image
          key={currentImageUrl} // Force re-render when URL changes
          src={currentImageUrl}
          alt={departmentName}
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

