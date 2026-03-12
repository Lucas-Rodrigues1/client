const JWT_KEY = "auth_token";
const USER_KEY = "chat_user";

interface StoredUser {
  id: string;
  username: string;
  name: string;
}

export function saveUser(user: StoredUser): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getUser(): StoredUser | null {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Normalize legacy Mongoose _id → id (old sessions before auth fix)
        if (!parsed.id && parsed._id) {
          parsed.id = String(parsed._id);
        }
        return parsed as StoredUser;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function saveToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(JWT_KEY, token);
    document.cookie = `${JWT_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(JWT_KEY);
  }
  return null;
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(USER_KEY);
    document.cookie = `${JWT_KEY}=; path=/; max-age=0`;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Get authorization header with JWT token
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
