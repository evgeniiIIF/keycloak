import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
});

// CSRF-токен
api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    const csrfToken = match ? decodeURIComponent(match[1]) : null;
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// 401 → сразу на логин
let isLoggingOut = false;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/login`;
    }
    return Promise.reject(error);
  }
);

export default api;