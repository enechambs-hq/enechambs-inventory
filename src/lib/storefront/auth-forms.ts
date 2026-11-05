/**
 * Client-side hints for the account forms. These only save a round trip; the
 * API is the authority and repeats every rule (its password rule is
 * CUSTOMER_PASSWORD_PATTERN, at most 72 UTF-8 bytes, at least 8 characters).
 * Relative imports only (node:test loads this).
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normaliseEmail = (v: string): string => v.trim().toLowerCase();

export function emailError(v: string): string | null {
  const e = normaliseEmail(v);
  if (!e) return 'Enter your email address.';
  if (e.length > 254 || !EMAIL_PATTERN.test(e)) return 'Enter a valid email address.';
  return null;
}

/** Same strength rule as the API: upper + lower + (digit or symbol), 8 to 72 bytes. */
export function passwordError(v: string): string | null {
  if (v.length < 8) return 'Use at least 8 characters.';
  if (new TextEncoder().encode(v).length > 72) return 'That password is too long (72 bytes at most).';
  if (!/[A-Z]/.test(v) || !/[a-z]/.test(v) || !(/\d/.test(v) || /\W/.test(v))) {
    return 'Use an uppercase letter, a lowercase letter, and a number or symbol.';
  }
  return null;
}

export const codeError = (v: string): string | null => (/^\d{6}$/.test(v.trim()) ? null : 'Enter the six-digit code from the email.');

export function nameError(v: string): string | null {
  const n = v.trim();
  return n.length < 2 ? 'Enter your name.' : n.length > 120 ? 'That name is too long.' : null;
}

/** A light check; the API normalises 0803…, 234803… and +234803… itself. */
export function phoneError(v: string): string | null {
  const digits = v.replace(/[\s()-]/g, '');
  return /^(\+?234|0)[789][01]\d{8}$/.test(digits) ? null : 'Enter a Nigerian phone number, e.g. 08031234567.';
}
