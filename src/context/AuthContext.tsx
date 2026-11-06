import React, { createContext, useContext, useState, useEffect } from 'react';
import { SaaSUser, AuthState } from '../types';
import { safeFetchJson } from '../utils/apiClient';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; user?: SaaSUser; error?: string }>;
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<{ success: boolean; user?: SaaSUser; error?: string }>;
  requestRegisterOtp: (name: string, email: string, password: string, password_confirmation: string) => Promise<{ success: boolean; email?: string; devOtp?: string; message?: string; error?: string }>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<{ success: boolean; user?: SaaSUser; error?: string }>;
  resendRegisterOtp: (email: string) => Promise<{ success: boolean; devOtp?: string; message?: string; error?: string }>;
  requestForgotPasswordOtp: (email: string) => Promise<{ success: boolean; email?: string; devOtp?: string; message?: string; error?: string }>;
  verifyForgotPasswordOtp: (email: string, otp: string, newPassword: string, confirmPassword: string) => Promise<{ success: boolean; user?: SaaSUser; error?: string }>;
  logout: () => void;
  quickDemoLogin: (role: 'superadmin' | 'creator') => Promise<SaaSUser | null>;
  refreshProfile: () => Promise<void>;
  isLoadingSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'scriby_sanctum_token';
const LEGACY_TOKEN_KEY = 'banglascribe_sanctum_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SaaSUser | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY)
  );
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  const saveToken = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  };

  const clearToken = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  };

  const fetchProfile = async (currentToken: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; user: SaaSUser }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (result.ok && result.data?.user) {
        setUser(result.data.user);
      } else {
        // Token invalid or expired, clear session
        clearToken();
      }
    } catch {
      // Network failure, don't clear token preemptively
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setIsLoadingSession(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; user: SaaSUser; token: string; error?: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!result.ok || !result.data?.success) {
        return { success: false, error: result.error || result.data?.error || 'Login failed. Please verify credentials.' };
      }

      saveToken(result.data.token);
      setUser(result.data.user);
      return { success: true, user: result.data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  };

  const register = async (name: string, email: string, password: string, password_confirmation: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; user: SaaSUser; token: string; error?: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, password_confirmation }),
        }
      );

      if (!result.ok || !result.data?.success) {
        return { success: false, error: result.error || result.data?.error || 'Registration failed.' };
      }

      saveToken(result.data.token);
      setUser(result.data.user);
      return { success: true, user: result.data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  };

  const requestRegisterOtp = async (name: string, email: string, password: string, password_confirmation: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; email?: string; devOtp?: string; message?: string; error?: string }>(
        '/api/auth/register/request-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, password_confirmation }),
        }
      );

      if (!result.ok || !result.data?.success) {
        return { success: false, error: result.error || result.data?.error || 'Failed to send verification code.' };
      }

      return {
        success: true,
        email: result.data.email,
        devOtp: result.data.devOtp,
        message: result.data.message,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  };

  const verifyRegisterOtp = async (email: string, otp: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; user: SaaSUser; token: string; error?: string }>(
        '/api/auth/register/verify-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp }),
        }
      );

      if (!result.ok || !result.data?.success) {
        return { success: false, error: result.error || result.data?.error || 'Verification failed.' };
      }

      saveToken(result.data.token);
      setUser(result.data.user);
      return { success: true, user: result.data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification failed.' };
    }
  };

  const resendRegisterOtp = async (email: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; devOtp?: string; message?: string; error?: string }>(
        '/api/auth/register/resend-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      if (!result.ok || !result.data?.success) {
        return { success: false, error: result.error || result.data?.error || 'Failed to resend code.' };
      }

      return {
        success: true,
        devOtp: result.data.devOtp,
        message: result.data.message,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  };

  const requestForgotPasswordOtp = async (email: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; email?: string; devOtp?: string; message?: string; error?: string }>(
        '/api/auth/forgot-password/request-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      if (!result.ok || !result.data?.success) {
        return { success: false, error: result.error || result.data?.error || 'Failed to send reset code.' };
      }

      return {
        success: true,
        email: result.data.email,
        devOtp: result.data.devOtp,
        message: result.data.message,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  };

  const verifyForgotPasswordOtp = async (email: string, otp: string, newPassword: string, confirmPassword: string) => {
    try {
      const result = await safeFetchJson<{ success: boolean; user: SaaSUser; token: string; error?: string }>(
        '/api/auth/forgot-password/verify-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, newPassword, confirmPassword }),
        }
      );

      if (!result.ok || !result.data?.success) {
        return { success: false, error: result.error || result.data?.error || 'Password reset failed.' };
      }

      saveToken(result.data.token);
      setUser(result.data.user);
      return { success: true, user: result.data.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'Server connection error.' };
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    }
    clearToken();
  };

  const quickDemoLogin = async (role: 'superadmin' | 'creator'): Promise<SaaSUser | null> => {
    const creds =
      role === 'superadmin'
        ? { email: 'admin@scriby.com', password: 'admin1234' }
        : { email: 'creator@scriby.com', password: 'creator1234' };

    const res = await login(creds.email, creds.password);
    return res.user || null;
  };

  const refreshProfile = async () => {
    if (token) await fetchProfile(token);
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'superadmin',
    isLoadingSession,
    login,
    register,
    requestRegisterOtp,
    verifyRegisterOtp,
    resendRegisterOtp,
    requestForgotPasswordOtp,
    verifyForgotPasswordOtp,
    logout,
    quickDemoLogin,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
