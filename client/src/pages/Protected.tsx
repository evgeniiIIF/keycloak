import React, { useEffect, useState } from 'react';
import api from '../api/api';

const Protected = () => {
  const [getData, setGetData] = useState<any>(null);
  const [postData, setPostData] = useState<any>(null);
  const [getError, setGetError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/hello')
      .then(res => setGetData(res.data))
      .catch(err => setGetError(err.response?.data?.message || 'GET failed'));
  }, []);

  const testPost = async () => {
    setPostError(null);
    try {
      const res = await api.post('/api/hello', { test: 'data', timestamp: new Date().toISOString() });
      setPostData(res.data);
    } catch (err: any) {
      setPostError(err.response?.data?.message || 'POST failed');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Protected Page</h1>

      <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>GET Test (Session Guard)</h3>
        {getError ? (
          <p style={{ color: 'red' }}>{getError}</p>
        ) : (
          <pre style={{ background: '#f4f4f4', padding: '10px' }}>{JSON.stringify(getData, null, 2)}</pre>
        )}
      </div>

      <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>POST Test (Session + CSRF Guard)</h3>
        <button
          onClick={testPost}
          style={{ padding: '10px 20px', cursor: 'pointer', marginBottom: '10px' }}
        >
          Send Protected POST Request
        </button>
        {postError ? (
          <p style={{ color: 'red' }}>{postError}</p>
        ) : (
          <pre style={{ background: '#f4f4f4', padding: '10px' }}>{JSON.stringify(postData, null, 2)}</pre>
        )}
      </div>
    </div>
  );
};

export default Protected;
