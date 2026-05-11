/**
 * Short URL Generator
 * 
 * Generates short, URL-safe codes for stream URLs.
 * Format: 6 characters (a-z, 0-9), giving ~2 billion combinations.
 * 
 * Examples:
 *   "ax8k2m"
 *   "9q3pdz"
 *   "kf7t1n"
 */

// URL-safe alphabet (no ambiguous chars: 0/O, 1/l, etc.)
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const SHORT_CODE_LENGTH = 6;

/**
 * Generate a random short code
 */
export function generateShortCode(length: number = SHORT_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * Generate a unique short code (checks DB)
 */
export async function generateUniqueShortCode(
  checkExists: (code: string) => Promise<boolean>
): Promise<string> {
  // Try up to 10 times with 6-char codes
  for (let i = 0; i < 10; i++) {
    const code = generateShortCode(SHORT_CODE_LENGTH);
    if (!(await checkExists(code))) {
      return code;
    }
  }
  
  // Fallback to longer code
  for (let i = 0; i < 5; i++) {
    const code = generateShortCode(SHORT_CODE_LENGTH + 2);
    if (!(await checkExists(code))) {
      return code;
    }
  }
  
  throw new Error('Failed to generate unique short code');
}

/**
 * Validate a short code
 */
export function isValidShortCode(code: string): boolean {
  if (!code || code.length < 4 || code.length > 16) return false;
  return /^[a-z0-9]+$/.test(code);
}

// =====================================================
// Slug helpers (for when displaying playlist names in URLs)
// =====================================================

/**
 * Slugify a string (for display purposes only — not for URLs)
 */
export function slugify(text: string): string {
  if (!text) return '';
  
  let slug = text.trim().toLowerCase();
  slug = slug.replace(/[\s_]+/g, '-');
  slug = slug.replace(/[^\u0600-\u06FFa-z0-9-]/g, '');
  slug = slug.replace(/-+/g, '-');
  slug = slug.replace(/^-+|-+$/g, '');
  
  if (!slug) {
    slug = 'playlist';
  }
  
  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-+$/g, '');
  }
  
  return slug;
}
