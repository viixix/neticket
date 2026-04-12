"use client";

import {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
} from "react";

const STORAGE_KEY = "auth_token";

interface AuthContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken);
    try {
      if (newToken) {
        sessionStorage.setItem(STORAGE_KEY, newToken);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("AuthContext's useAuth function Error");
  }
  return context;
}
