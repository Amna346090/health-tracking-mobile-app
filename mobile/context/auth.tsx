import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setAccessToken, setRefreshCallback } from '../api/client';
import {
  AuthUser,
  LoginResult,
  loginApi,
  logoutApi,
  refreshApi,
  getMeApi,
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
  refreshUser: () => Promise<void>;
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

  // Re-fetches this user's own record from the server — the only way profile edits made
  // elsewhere (e.g. an admin updating them in the CRM) ever reach an already-open session,
  // since `user` is otherwise just the snapshot captured once at login.
  const refreshUser = useCallback(async () => {
    if (!refreshTokenRef.current) return;
    try {
      const fresh = await getMeApi();
      await Store.setItemAsync(KEY.USER, JSON.stringify(fresh));
      setUser(fresh);
    } catch {
      // non-fatal — keep whatever we already had rather than disrupt the session
    }
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

  // Refresh tokens are single-use (the server rotates them). If two requests both hit a
  // 401 around the same moment and each independently call refreshApi(), the first one
  // consumes the token and the second one — now using an already-used token — gets rejected
  // and would wrongly trigger a full logout. Sharing one in-flight promise means every
  // concurrent caller gets the same outcome instead of racing each other.
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const doRefresh = useCallback((): Promise<boolean> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const rt = refreshTokenRef.current;
    if (!rt) return Promise.resolve(false);

    const attempt = (async () => {
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
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = attempt;
    return attempt;
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
          // Cached profile may be stale (e.g. edited via the CRM since last launch) —
          // fetch the real thing in the background without blocking startup.
          refreshUser();
        }
      } catch {
        // Secure store unavailable — treat as logged out
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshUser]);

  // Also catch edits made while the app was merely backgrounded, not closed —
  // e.g. an admin updates the patient in the CRM while their app sits in the background.
  useEffect(() => {
    function handleAppStateChange(state: AppStateStatus) {
      if (state === 'active') refreshUser();
    }
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [refreshUser]);

  // ── public auth actions ───────────────────────────────────────────────────

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await loginApi(identifier, password);
    await persist(result);
  }, [persist]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
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
