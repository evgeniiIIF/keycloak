import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true, // Essential for sending SESSION_ID cookie
});

// Interceptor to add CSRF token to mutating requests
api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    // Note: we'll use a simple global variable or a store for the csrfToken
    // since we can't easily use hooks inside a plain JS file.
    const csrfToken = window.localStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// Interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Trigger logout or redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
