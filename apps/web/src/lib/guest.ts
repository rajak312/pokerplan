const TOKEN_KEY = 'pokerplan:guest-token';
const NAME_KEY = 'pokerplan:display-name';

function generateToken(): string {
  // randomUUID is only available in secure contexts (https / localhost).
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

/**
 * A random secret stored in localStorage that identifies this browser as a guest.
 * Refreshing or reconnecting with the same token keeps the same seat in every room.
 */
export function getGuestToken(): string {
  try {
    const existing = localStorage.getItem(TOKEN_KEY);
    if (existing && existing.length >= 20) return existing;
    const token = generateToken();
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    // Private mode / storage disabled: fall back to a per-tab identity.
    return generateToken();
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
