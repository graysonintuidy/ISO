'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext(null);

// Pages that don't require authentication
const PUBLIC_PATHS = ['/login'];

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Check if the user has a specific permission.
 * Convenience hook.
 */
export function usePermission(permission) {
  const { permissions, user } = useAuth();
  if (!user) return false;
  // Admins always have all permissions
  if (user.role === 'admin') return true;
  return permissions.includes(permission);
}

export default function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPermissions(data.permissions || []);
        return data.user;
      } else {
        setUser(null);
        setPermissions([]);
        return null;
      }
    } catch {
      setUser(null);
      setPermissions([]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // On mount, check auth status
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (isLoading) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
    if (!user && !isPublic) {
      router.push('/login');
    }
  }, [user, isLoading, pathname, router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors — we redirect regardless
    }
    setUser(null);
    setPermissions([]);
    router.push('/login');
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      permissions,
      isLoading,
      isAuthenticated: !!user,
      logout,
      refreshUser: fetchUser,
    }),
    [user, permissions, isLoading, logout, fetchUser]
  );

  // Show nothing while checking auth (prevents flash of content)
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg)',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
      </div>
    );
  }

  // If not authenticated and not on a public page, don't render children
  const isPublic = PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
  if (!user && !isPublic) {
    return null;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
