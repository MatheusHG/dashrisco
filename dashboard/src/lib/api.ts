const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface ApiOptions extends RequestInit {
  token?: string;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
    }
  }

  loadTokens() {
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("accessToken");
      this.refreshToken = localStorage.getItem("refreshToken");
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }

  getAccessToken() {
    return this.accessToken;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  async fetch<T = unknown>(
    path: string,
    options: ApiOptions = {}
  ): Promise<T> {
    this.loadTokens();

    const headers: Record<string, string> = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    // If 401, try to refresh token
    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${this.accessToken}`;
        res = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
        });
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  async login(email: string, password: string) {
    const data = await this.fetch<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        permissions: string[];
      };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    this.setTokens(data.accessToken, data.refreshToken);
    return data.user;
  }

  logout() {
    this.clearTokens();
  }
}

export const api = new ApiClient();
