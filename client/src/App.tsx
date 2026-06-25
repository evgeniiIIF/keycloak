import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Service from './pages/Service';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { authenticated, loading } = useAuth();
  if (loading) return null;
  if (!authenticated) {
    window.location.href = 'http://localhost:3000/login';
    return null;
  }
  return children;
};

const Navigation = () => {
  const { authenticated, logout, profile } = useAuth();

  return (
    <div className="nav">
      <Link to="/home" className="btn">Home</Link>
      <Link to="/service" className="btn">Service</Link>

      {!authenticated ? (
        <Link to="/login" className="btn">Login</Link>
      ) : (
        <>
          <span style={{ margin: '0 10px' }}>Hello, {profile?.preferred_username}</span>
          <button onClick={logout} className="btn btn-danger">Logout</button>
        </>
      )}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AuthWrapper>
        <Router>
          <Navigation />
          <Routes>
            <Route path="/" element={<ProtectedRoute><Navigate to="/service" /></ProtectedRoute>} />
            <Route path="/service" element={<ProtectedRoute><Service /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
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
