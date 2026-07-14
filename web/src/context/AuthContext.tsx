import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { setAccessToken, setRefreshCallback } from '../api/client';
import type { AuthUser, LoginResult } from '../api/auth';
import { loginApi, logoutApi, refreshApi } from '../api/auth';

const KEY = {
  ACCESS: 'ht_web_access_token',
  REFRESH: 'ht_web_refresh_token',
  USER: 'ht_web_user',
} as const;

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);

  const persist = useCallback((result: LoginResult) => {
    const { accessToken, refreshToken, user: userData } = result;
    localStorage.setItem(KEY.ACCESS, accessToken);
    localStorage.setItem(KEY.REFRESH, refreshToken);
    localStorage.setItem(KEY.USER, JSON.stringify(userData));
    refreshTokenRef.current = refreshToken;
    setAccessToken(accessToken);
    setUser(userData);
  }, []);

  const clearStorage = useCallback(() => {
    localStorage.removeItem(KEY.ACCESS);
    localStorage.removeItem(KEY.REFRESH);
    localStorage.removeItem(KEY.USER);
  }, []);

  const logout = useCallback(async () => {
    const rt = refreshTokenRef.current;
    if (rt) {
      try { await logoutApi(rt); } catch { /* ignore — clearing local state regardless */ }
    }
    refreshTokenRef.current = null;
    setAccessToken(null);
    setUser(null);
    clearStorage();
  }, [clearStorage]);

  const doRefresh = useCallback(async (): Promise<boolean> => {
    const rt = refreshTokenRef.current;
    if (!rt) return false;
    try {
      const tokens = await refreshApi(rt);
      localStorage.setItem(KEY.ACCESS, tokens.accessToken);
      localStorage.setItem(KEY.REFRESH, tokens.refreshToken);
      refreshTokenRef.current = tokens.refreshToken;
      setAccessToken(tokens.accessToken);
      return true;
    } catch {
      await logout();
      return false;
    }
  }, [logout]);

  useEffect(() => {
    setRefreshCallback(doRefresh);
    return () => setRefreshCallback(null);
  }, [doRefresh]);

  useEffect(() => {
    const storedAccess = localStorage.getItem(KEY.ACCESS);
    const storedRefresh = localStorage.getItem(KEY.REFRESH);
    const storedUser = localStorage.getItem(KEY.USER);

    if (storedAccess && storedRefresh && storedUser) {
      refreshTokenRef.current = storedRefresh;
      setAccessToken(storedAccess);
      setUser(JSON.parse(storedUser) as AuthUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginApi(email, password);
    if (result.user.role === 'PATIENT') {
      throw new Error('This dashboard is for staff and admin accounts only.');
    }
    persist(result);
  }, [persist]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
