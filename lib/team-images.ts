// Team image mappings - maps team names to image URLs
// Using official product logos from reliable public sources

export const TEAM_IMAGES: Record<string, string> = {
  // Adobe teams - High quality PNG logos
  'Photoshop': 'https://logos-world.net/wp-content/uploads/2020/04/Adobe-Photoshop-Logo.png',
  'Illustrator': 'https://cdn.worldvectorlogo.com/logos/adobe-illustrator-cc-icon.svg',
  'InDesign': 'https://logos-world.net/wp-content/uploads/2020/04/Adobe-InDesign-Logo.png',
  
  // Google teams - Official logos
  'Google Drive': 'https://logos-world.net/wp-content/uploads/2020/11/Google-Drive-Logo.png',
  'Google Slides': 'https://logos-world.net/wp-content/uploads/2020/11/Google-Slides-Logo.png',
  'Google Gemini': 'https://logos-world.net/wp-content/uploads/2023/12/Gemini-Logo.png',
  'YouTube': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_play_button_icon_%282013-2017%29.svg/1024px-YouTube_play_button_icon_%282013-2017%29.svg.png',
  
  // Electronic Arts teams - Game logos
  'EA Sports FC': 'https://logos-world.net/wp-content/uploads/2023/05/EA-Sports-FC-Logo.png',
  'Apex Legends': 'https://logos-world.net/wp-content/uploads/2021/03/Apex-Legends-Logo.png',
  'The Sims': 'https://upload.wikimedia.org/wikipedia/en/4/4b/The_Sims_4_logo.png',
}

// Alternative image URLs if primary fails - using different sources
export const TEAM_IMAGES_ALT: Record<string, string[]> = {
  'Photoshop': [
    'https://logos-world.net/wp-content/uploads/2020/04/Adobe-Photoshop-Logo.png',
    'https://cdn.worldvectorlogo.com/logos/adobe-photoshop-2.svg',
  ],
  'Illustrator': [
    'https://cdn.worldvectorlogo.com/logos/adobe-illustrator-cc-icon.svg',
    'https://logos-world.net/wp-content/uploads/2020/04/Adobe-Illustrator-Logo.png',
    'https://upload.wikimedia.org/wikipedia/commons/f/fb/Adobe_Illustrator_CC_icon.svg',
  ],
  'InDesign': [
    'https://logos-world.net/wp-content/uploads/2020/04/Adobe-InDesign-Logo.png',
    'https://cdn.worldvectorlogo.com/logos/adobe-indesign-cc-icon.svg',
  ],
  'Google Drive': [
    'https://logos-world.net/wp-content/uploads/2020/11/Google-Drive-Logo.png',
    'https://cdn.worldvectorlogo.com/logos/google-drive-2020.svg',
  ],
  'Google Slides': [
    'https://logos-world.net/wp-content/uploads/2020/11/Google-Slides-Logo.png',
    'https://cdn.worldvectorlogo.com/logos/google-slides-2020.svg',
  ],
  'Google Gemini': [
    'https://logos-world.net/wp-content/uploads/2023/12/Gemini-Logo.png',
    'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg',
    'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Gemini.max-1000x1000.png',
  ],
  'YouTube': [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_play_button_icon_%282013-2017%29.svg/1024px-YouTube_play_button_icon_%282013-2017%29.svg.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/YouTube_play_button_icon_%282013-2017%29.svg/512px-YouTube_play_button_icon_%282013-2017%29.svg.png',
    'https://logos-world.net/wp-content/uploads/2020/04/YouTube-Logo.png',
  ],
  'EA Sports FC': [
    'https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/EA_Sports_FC_logo.svg/640px-EA_Sports_FC_logo.svg.png',
    'https://logos-world.net/wp-content/uploads/2023/05/EA-Sports-FC-Logo.png',
  ],
  'Apex Legends': [
    'https://upload.wikimedia.org/wikipedia/en/d/db/Apex_legends_cover.jpg',
    'https://logos-world.net/wp-content/uploads/2021/03/Apex-Legends-Logo.png',
  ],
  'The Sims': [
    'https://upload.wikimedia.org/wikipedia/en/4/4b/The_Sims_4_logo.png',
    'https://logos-world.net/wp-content/uploads/2021/03/The-Sims-Logo.png',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/The_Sims_-_logo_official.svg/512px-The_Sims_-_logo_official.svg.png',
  ],
}

// Alternative: Use simple icon-based approach if images fail
export const TEAM_ICONS: Record<string, string> = {
  'Photoshop': '🎨',
  'Illustrator': '✏️',
  'InDesign': '📄',
  'Google Drive': '☁️',
  'Google Slides': '📊',
  'Google Gemini': '🤖',
  'YouTube': '▶️',
  'EA Sports FC': '⚽',
  'Apex Legends': '🎮',
  'The Sims': '🏠',
}

// Get team image URL - returns from database logo_url, or from mapping, or fallback to icon
export function getTeamImageUrl(teamName: string, logoUrl?: string | null): string | null {
  // First, use database logo_url if available
  if (logoUrl) {
    return logoUrl
  }
  
  // Otherwise, use mapping - prefer logos-world.net for better quality PNGs
  return TEAM_IMAGES[teamName] || null
}

// Get alternative image URLs for fallback
export function getTeamImageUrls(teamName: string, logoUrl?: string | null): string[] {
  const urls: string[] = []
  
  if (logoUrl) {
    urls.push(logoUrl)
  }
  
  // Add primary image
  if (TEAM_IMAGES[teamName]) {
    urls.push(TEAM_IMAGES[teamName])
  }
  
  // Add alternative images
  if (TEAM_IMAGES_ALT[teamName]) {
    urls.push(...TEAM_IMAGES_ALT[teamName])
  }
  
  return urls
}

// Get team icon as fallback
export function getTeamIcon(teamName: string): string {
  return TEAM_ICONS[teamName] || teamName.charAt(0).toUpperCase()
}

