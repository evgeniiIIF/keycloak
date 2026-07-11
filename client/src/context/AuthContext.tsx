import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/api';

interface AuthContextType {
  authenticated: boolean;
  profile: any;
  login: () => void;
  logout: () => Promise<void>;
  loading: boolean;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/me');
      const { user } = response.data;

      setProfile(user);
      setAuthenticated(true);
    } catch (error) {
      setAuthenticated(false);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await checkAuth();
    })();
  }, []);

  const login = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/login`;
  };

  const logout = async () => {
    try {
      const response = await api.post('/logout');
      window.location.href = response.data.logoutUrl;
    } catch (error) {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ authenticated, profile, login, logout, loading, checkAuth }}>
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