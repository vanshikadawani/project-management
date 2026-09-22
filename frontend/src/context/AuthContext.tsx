import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.ts';

interface AuthContextType {
  currentUser: User | null;
  directory: User[];
  isLoading: boolean;
  login: (credentials: { email?: string; userId?: string }) => Promise<{ success: boolean; error?: string }>;
  signup: (data: { name: string; email: string; department?: string; role?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  isCEO: boolean;
  isProjectOwner: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [directory, setDirectory] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.currentUser);
        setDirectory(data.directory || []);
      }
    } catch (err) {
      console.error('Failed to load auth session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (credentials: { email?: string; userId?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Authentication failed' };
      }
      setCurrentUser(data.user);
      await fetchSession();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: { name: string; email: string; department?: string; role?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Account creation failed' };
      }
      setCurrentUser(resData.user);
      await fetchSession();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      await fetchSession();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const switchUser = async (userId: string) => {
    await login({ userId });
  };

  const refreshUser = async () => {
    await fetchSession();
  };

  const isCEO = currentUser?.role === 'CEO';
  const isProjectOwner = currentUser?.role === 'ProjectOwner' || isCEO;
  const isEmployee = currentUser?.role === 'Employee';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        directory,
        isLoading,
        login,
        signup,
        logout,
        switchUser,
        refreshUser,
        isCEO,
        isProjectOwner,
        isEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
