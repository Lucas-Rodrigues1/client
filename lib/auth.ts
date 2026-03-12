const JWT_KEY = "auth_token";

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
