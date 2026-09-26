import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, fetchSession, loginWithPassword } from "../api/adminApi";
import { clearToken, loadToken, saveToken } from "./secureStorage";

type AuthState = {
  token: string | null;
  email: string | null;
  tenantId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(async (nextToken: string | null) => {
    if (!nextToken) {
      setToken(null);
      setEmail(null);
      setTenantId(null);
      return;
    }
    const session = await fetchSession(nextToken);
    if (!session?.ok) {
      await clearToken();
      setToken(null);
      setEmail(null);
      setTenantId(null);
      return;
    }
    setToken(nextToken);
    setEmail(session.email || null);
    setTenantId(session.tenantId || null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadToken();
        if (!cancelled) await applySession(stored);
      } catch {
        if (!cancelled) {
          await clearToken();
          setToken(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(async (password: string) => {
    const result = await loginWithPassword(password);
    if (!result?.token) {
      throw new ApiError("לא התקבל אסימון התחברות", 500);
    }
    await saveToken(result.token);
    await applySession(result.token);
  }, [applySession]);

  const logout = useCallback(async () => {
    await clearToken();
    setToken(null);
    setEmail(null);
    setTenantId(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    try {
      await applySession(token);
    } catch {
      await logout();
    }
  }, [applySession, logout, token]);

  const value = useMemo(
    () => ({
      token,
      email,
      tenantId,
      isLoading,
      isAuthenticated: Boolean(token),
      login,
      logout,
      refreshSession,
    }),
    [token, email, tenantId, isLoading, login, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
