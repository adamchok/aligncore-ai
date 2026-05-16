/** Client-side validation before mentor profile photo upload (backend enforces again). */

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 5 * 1024 * 1024

export function validateProfileImage(file: File): string | null {
  if (!ALLOWED.has(file.type)) return 'Use JPG, PNG, WebP, or GIF.'
  if (file.size > MAX_BYTES) return 'Image must be under 5 MB.'
  return null
}
