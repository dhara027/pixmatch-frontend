import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '@/api/apiClient';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signup: (email: string, mobile_no: string, password: string, confirmpassword: string) => Promise<unknown>;
  verifyOtp: (email: string, otp: string) => Promise<unknown>;
  resendOtp: (email: string) => Promise<unknown>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Stores only the user profile (id, email) — NOT tokens.
// Auth tokens live in httpOnly cookies and are never accessible to JavaScript.
const USER_KEY = 'auth_user';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore user profile from localStorage on mount.
    // The actual session validity is verified on the first API call (401 → refresh → redirect).
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        _clearAuth();
      }
    }
    setLoading(false);
  }, []);

  const _setUser = (userObj: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    setUser(userObj);
  };

  const _clearAuth = () => {
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const signup = async (email: string, mobile_no: string, password: string, confirmpassword: string) => {
    const response = await apiClient.post('/api/v1/auth/signup', {
      email,
      mobile_no,
      password,
      confirmpassword,
    });
    return response.data;
  };

  const verifyOtp = async (email: string, otp: string) => {
    const response = await apiClient.post('/api/v1/auth/verify-otp', { email, otp });
    return response.data;
  };

  const resendOtp = async (email: string) => {
    const response = await apiClient.post('/api/v1/auth/resend-otp', { email });
    return response.data;
  };

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/api/v1/auth/login', { email, password });
    // Backend sets access_token and refresh_token as httpOnly cookies automatically.
    // We only store the user profile (non-sensitive) in localStorage for UI state.
    const userObj: User = response.data.data.user;
    _setUser(userObj);
  };

  const logout = async () => {
    try {
      // Backend clears cookies (Set-Cookie with max_age=0) and invalidates the Redis session
      await apiClient.post('/api/v1/auth/logout');
    } catch {
      // Proceed with local logout even if the server call fails
    } finally {
      _clearAuth();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        signup,
        verifyOtp,
        resendOtp,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
