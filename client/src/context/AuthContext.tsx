import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/api';

interface AuthContextType {
  authenticated: boolean;
  profile: any;
  csrfToken: string | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/me');
      const { user, csrfToken } = response.data;

      setProfile(user);
      setCsrfToken(csrfToken);
      window.localStorage.setItem('csrf_token', csrfToken);
      setAuthenticated(true);
    } catch (error) {
      setAuthenticated(false);
      setProfile(null);
      setCsrfToken(null);
      window.localStorage.removeItem('csrf_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/login`;
  };

  const logout = () => {
    // Redirect to BFF /logout endpoint
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/logout`;
  };

  return (
    <AuthContext.Provider value={{ authenticated, profile, csrfToken, login, logout, loading, checkAuth }}>
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