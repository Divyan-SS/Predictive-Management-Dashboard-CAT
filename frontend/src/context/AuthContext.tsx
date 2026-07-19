"use client";

import { API_URL } from "@/config/env";
import React, { createContext, useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";

// Interface definitions
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  name: string | null;
  assigned_site: string | null;
  role: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

interface AuthContextType {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load and validate token on startup
  useEffect(() => {
    const restoreSession = async () => {
      const storedAccess = localStorage.getItem("access_token");
      const storedRefresh = localStorage.getItem("refresh_token");
      const storedUser = localStorage.getItem("user_profile");

      if (storedAccess && storedRefresh && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as UserProfile;
          
          // Verify if token is valid or needs refresh
          // For simplicity and resilience, we check with a refresh attempt if it's there
          const response = await fetch(`${API_URL}/api/auth/refresh/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: storedRefresh })
          });

          if (response.ok) {
            const data = await response.json();
            const newAccess = data.access;
            localStorage.setItem("access_token", newAccess);
            setAccessToken(newAccess);
            setRefreshToken(storedRefresh);
            setUser(parsedUser);
          } else {
            // Refresh failed, clear session
            clearAuthData();
          }
        } catch (err) {
          console.warn("Backend offline or connection failed during session restore.");
          clearAuthData();
        }
      }
      setLoading(false);
    };

    restoreSession();
  }, []);

  const clearAuthData = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_profile");
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Authentication failed.");
      }

      const data = await response.json();
      const userProfile = data.user as UserProfile;

      // Save to localStorage
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("user_profile", JSON.stringify(userProfile));

      // Update state
      setAccessToken(data.access);
      setRefreshToken(data.refresh);
      setUser(userProfile);

      // Redirect based on role
      const roleName = userProfile.role?.name;
      if (roleName === "Super Admin") {
        router.push("/");
      } else if (roleName === "Maintenance Team") {
        router.push("/");
      } else if (roleName === "Service Team") {
        router.push("/");
      } else {
        router.push("/");
      }
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      // Call backend logout
      const token = localStorage.getItem("refresh_token");
      const access = localStorage.getItem("access_token");
      if (token && access) {
        await fetch(`${API_URL}/api/auth/logout/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${access}`
          },
          body: JSON.stringify({ refresh: token })
        });
      }
    } catch (err) {
      console.error("Backend logout error:", err);
    } finally {
      clearAuthData();
      router.push("/login");
    }
  };
  const updateUser = (updatedUser: UserProfile) => {
    localStorage.setItem("user_profile", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, refreshToken, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
