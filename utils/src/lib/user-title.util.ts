/**
 * Sanitizes user title: only English letters (lowercase), numbers, and space.
 * Maximum 10 characters.
 */
export function sanitizeUserTitle(input: string | undefined | null): string {
  if (input == null || typeof input !== 'string') return '';
  const lower = input.toLowerCase();
  const allowed = lower.replace(/[^a-z0-9\s]/g, '');
  return allowed.slice(0, 10).trim();
}

/**
 * Returns true if title is valid: only English letters, numbers, space, max 10 chars.
 */
export function isValidUserTitle(input: string | undefined | null): boolean {
  if (input == null || typeof input !== 'string') return true;
  const trimmed = input.trim();
  if (!trimmed) return true;
  if (trimmed.length > 10) return false;
  return /^[a-zA-Z0-9\s]+$/.test(trimmed);
}
