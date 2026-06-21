import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { authenticated, loading } = useAuth();
  if (loading) return null;
  if (!authenticated) {
    window.location.href = 'http://localhost:3000/login';
    return null;
  }
  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <AuthWrapper>
        <Router>
          <Routes>
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthWrapper>
    </AuthProvider>
  );
};

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h2>Loading authentication...</h2>
      </div>
    );
  }
  return <>{children}</>;
};

export default App;