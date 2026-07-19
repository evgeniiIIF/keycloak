import React, { useEffect, useState } from 'react';
import api from '../api/api';

const Service = () => {
  const [serviceData, setServiceData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/service')
      .then(res => setServiceData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to fetch data from the protected service'))
      .finally(() => setLoading(false));
  }, []);

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
          <p><strong>Username:</strong> {serviceData?.user?.preferred_username}</p>
          <p><strong>Email:</strong> {serviceData?.user?.email}</p>
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
