
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const Service = () => {
  const { authenticated, profile } = useAuth();
  const [serviceData, setServiceData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!authenticated) return;

      try {
        setLoading(true);
        const response = await api.get('/api/service');
        setServiceData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch data from the protected service');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h1>Access Restricted</h1>
        <p>You must be logged in to access this service.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h1 style={{ color: '#646cff' }}>Loading Protected Service...</h1>
        <p>Verifying session and fetching data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1 style={{ color: '#646cff' }}>{serviceData?.service || 'Protected Service'}</h1>

      <div className="card" style={{ maxWidth: '600px', margin: '20px auto', textAlign: 'left' }}>
        <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          User Information (Verified by Service)
        </h3>
        <div style={{ marginTop: '15px', fontSize: '14px', lineHeight: '1.6' }}>
          <p><strong>Username:</strong> {serviceData?.user?.preferred_username || profile?.preferred_username}</p>
          <p><strong>Email:</strong> {serviceData?.user?.email || profile?.email}</p>
          <p><strong>Subject (ID):</strong> {serviceData?.user?.sub}</p>
          <p><strong>Service Message:</strong> <span style={{ color: '#4caf50' }}>{serviceData?.message}</span></p>
        </div>
      </div>

      {error && (
        <div style={{ color: 'red', marginTop: '20px' }}>
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      <div style={{ marginTop: '30px' }}>
        <p style={{ opacity: 0.7 }}>This data is fetched via BFF Proxy and verified by the downstream service using JWT.</p>
      </div>
    </div>
  );
};

export default Service;
