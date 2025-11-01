// Department image mappings - actual images for each department
// Using high-quality PNG icons from reliable sources

export const DEPARTMENT_IMAGES: Record<string, string> = {
  'Software Development': 'https://cdn-icons-png.flaticon.com/512/2933/2933245.png',
  'Marketing': 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  'CyberSecurity': 'https://cdn-icons-png.flaticon.com/512/1828/1828443.png',
  'Finance': 'https://cdn-icons-png.flaticon.com/512/3135/3135807.png',
  'Design': 'https://cdn-icons-png.flaticon.com/512/3135/3135713.png',
}

// Alternative image URLs if primary fails
export const DEPARTMENT_IMAGES_ALT: Record<string, string[]> = {
  'Software Development': [
    'https://cdn-icons-png.flaticon.com/512/2933/2933245.png',
    'https://cdn-icons-png.flaticon.com/512/888/888859.png',
    'https://cdn-icons-png.flaticon.com/512/2111/2111425.png',
  ],
  'Marketing': [
    'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    'https://cdn-icons-png.flaticon.com/512/3135/3135789.png',
    'https://cdn-icons-png.flaticon.com/512/3135/3135823.png',
  ],
  'CyberSecurity': [
    'https://cdn-icons-png.flaticon.com/512/1828/1828443.png',
    'https://cdn-icons-png.flaticon.com/512/1828/1828519.png',
    'https://cdn-icons-png.flaticon.com/512/1828/1828479.png',
  ],
  'Finance': [
    'https://cdn-icons-png.flaticon.com/512/3135/3135807.png',
    'https://cdn-icons-png.flaticon.com/512/3135/3135793.png',
    'https://cdn-icons-png.flaticon.com/512/3135/3135810.png',
  ],
  'Design': [
    'https://cdn-icons-png.flaticon.com/512/3135/3135713.png',
    'https://cdn-icons-png.flaticon.com/512/3135/3135788.png',
    'https://cdn-icons-png.flaticon.com/512/3135/3135764.png',
  ],
}

// Fallback emoji icons (only used if all images fail)
export const DEPARTMENT_ICONS: Record<string, string> = {
  'Software Development': '💻',
  'Marketing': '📢',
  'CyberSecurity': '🔒',
  'Finance': '💰',
  'Design': '🎨',
}

// Get department image URL - returns primary image URL
export function getDepartmentImage(departmentName: string): string | null {
  return DEPARTMENT_IMAGES[departmentName] || null
}

// Get all possible image URLs for a department (for fallback)
export function getDepartmentImageUrls(departmentName: string): string[] {
  const urls: string[] = []
  
  // Add primary image
  if (DEPARTMENT_IMAGES[departmentName]) {
    urls.push(DEPARTMENT_IMAGES[departmentName])
  }
  
  // Add alternative images
  if (DEPARTMENT_IMAGES_ALT[departmentName]) {
    urls.push(...DEPARTMENT_IMAGES_ALT[departmentName])
  }
  
  return urls
}

// Get department icon as fallback
export function getDepartmentIcon(departmentName: string): string {
  return DEPARTMENT_ICONS[departmentName] || '🏢'
}

