"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api.loadTokens();
    if (api.getAccessToken()) {
      api
        .fetch<{
          id: string;
          name: string;
          email: string;
          role: { name: string };
          permissions: string[];
        }>("/auth/me")
        .then((data) => {
          setUser({
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role.name,
            permissions: data.permissions,
          });
        })
        .catch(() => {
          api.clearTokens();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const userData = await api.login(email, password);
      setUser(userData);
      router.push("/");
    },
    [router]
  );

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
    router.push("/login");
  }, [router]);

  const hasPermission = useCallback(
    (permission: string) => {
      return user?.permissions.includes(permission) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
