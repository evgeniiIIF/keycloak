import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const Admin = () => {
  const { authenticated, login } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authenticated) {
      api.get('/admin')
        .then(res => setData(res.data))
        .catch(err => setError(err.response?.data?.message || 'Forbidden: Admin role required'));
    }
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div>
        <h1>Admin Page</h1>
        <p>You must be logged in to access the admin area.</p>
        <button onClick={login} className="btn">Login Now</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Admin Area</h1>
      <div className="card">
        {error ? (
          <p style={{ color: 'red' }}>{error}</p>
        ) : (
          <div>
            <p className="status">Admin Access Granted!</p>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
