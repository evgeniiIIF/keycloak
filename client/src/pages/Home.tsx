import React from 'react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { profile, logout } = useAuth();

  return (
    <div>
      <h1>User Profile</h1>
      <div className="card">
        <p className="status">Authenticated</p>
        <p><strong>Username:</strong> {profile?.preferred_username || 'N/A'}</p>
        <p><strong>Email:</strong> {profile?.email || 'N/A'}</p>
        <p><strong>Name:</strong> {profile?.name || 'N/A'}</p>
      </div>
      <button onClick={logout} className="btn btn-danger" style={{ marginTop: '1rem' }}>
        Logout
      </button>
    </div>
  );
};

export default Home;