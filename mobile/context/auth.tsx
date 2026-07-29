import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setAccessToken, setRefreshCallback } from '../api/client';
import {
  AuthUser,
  LoginResult,
  loginApi,
  logoutApi,
  refreshApi,
} from '../api/auth';

// expo-secure-store has no web implementation in this SDK version — fall back to localStorage on web.
const Store = Platform.OS === 'web'
  ? {
      setItemAsync: async (key: string, value: string) => { localStorage.setItem(key, value); },
      getItemAsync: async (key: string) => localStorage.getItem(key),
      deleteItemAsync: async (key: string) => { localStorage.removeItem(key); },
    }
  : SecureStore;

// ─── Keys ─────────────────────────────────────────────────────────────────────

const KEY = {
  ACCESS:  'ht_access_token',
  REFRESH: 'ht_refresh_token',
  USER:    'ht_user',
} as const;

// ─── Context types ────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);

  // ── helpers ──────────────────────────────────────────────────────────────

  const persist = useCallback(async (result: LoginResult) => {
    const { accessToken, refreshToken, user: userData } = result;
    await Store.setItemAsync(KEY.ACCESS, accessToken);
    await Store.setItemAsync(KEY.REFRESH, refreshToken);
    await Store.setItemAsync(KEY.USER, JSON.stringify(userData));
    refreshTokenRef.current = refreshToken;
    setAccessToken(accessToken);
    setUser(userData);
  }, []);

  const clearStorage = useCallback(async () => {
    await Promise.all([
      Store.deleteItemAsync(KEY.ACCESS),
      Store.deleteItemAsync(KEY.REFRESH),
      Store.deleteItemAsync(KEY.USER),
    ]);
  }, []);

  // ── logout ───────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const rt = refreshTokenRef.current;
    if (rt) {
      try { await logoutApi(rt); } catch { /* ignore — clearing local state regardless */ }
    }
    refreshTokenRef.current = null;
    setAccessToken(null);
    setUser(null);
    await clearStorage();
  }, [clearStorage]);

  // ── token refresh (called by API client on 401) ───────────────────────────

  const doRefresh = useCallback(async (): Promise<boolean> => {
    const rt = refreshTokenRef.current;
    if (!rt) return false;
    try {
      const tokens = await refreshApi(rt);
      await Store.setItemAsync(KEY.ACCESS, tokens.accessToken);
      await Store.setItemAsync(KEY.REFRESH, tokens.refreshToken);
      refreshTokenRef.current = tokens.refreshToken;
      setAccessToken(tokens.accessToken);
      return true;
    } catch {
      await logout();
      return false;
    }
  }, [logout]);

  // Register the refresh callback with the API client whenever it changes
  useEffect(() => {
    setRefreshCallback(doRefresh);
    return () => setRefreshCallback(null);
  }, [doRefresh]);

  // ── initialize from SecureStore ───────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [storedAccess, storedRefresh, storedUser] = await Promise.all([
          Store.getItemAsync(KEY.ACCESS),
          Store.getItemAsync(KEY.REFRESH),
          Store.getItemAsync(KEY.USER),
        ]);

        if (storedAccess && storedRefresh && storedUser) {
          refreshTokenRef.current = storedRefresh;
          setAccessToken(storedAccess);
          setUser(JSON.parse(storedUser) as AuthUser);
        }
      } catch {
        // Secure store unavailable — treat as logged out
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── public auth actions ───────────────────────────────────────────────────

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await loginApi(identifier, password);
    await persist(result);
  }, [persist]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
