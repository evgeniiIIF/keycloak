import React, { useEffect, useState } from 'react';
import api from '../api/api';

const Home = () => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    api.get('/api/me')
      .then(res => setProfile(res.data.user))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1>User Profile</h1>
      <div className="card">
        <p className="status">Authenticated</p>
        <p><strong>Username:</strong> {profile?.preferred_username || 'N/A'}</p>
        <p><strong>Email:</strong> {profile?.email || 'N/A'}</p>
        <p><strong>Name:</strong> {profile?.name || 'N/A'}</p>
      </div>
    </div>
  );
};

export default Home;
