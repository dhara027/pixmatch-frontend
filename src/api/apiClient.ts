import axios, { AxiosError } from 'axios';

const apiClient = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
  // Required for httpOnly cookie auth: the browser sends cookies automatically
  // on all requests to the same origin (and via Vite proxy in development).
  withCredentials: true,
});

// ── Request interceptor: fix multipart uploads ───────────────────────────────
// Tokens are in httpOnly cookies — no manual Authorization header needed.
// Only special handling needed is removing Content-Type for FormData uploads.
apiClient.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      // Browser sets multipart/form-data boundary automatically — don't override it
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: silent token refresh on 401 ────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until the ongoing refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // No body needed — refresh_token cookie is sent automatically (path=/api/v1/auth)
        await axios.post('/api/v1/auth/refresh-token', {}, { withCredentials: true });
        // Backend set a new access_token cookie via Set-Cookie header.
        // Retry all queued requests — they'll send the new cookie automatically.
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        _clearLocalUser();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.code === 'ECONNABORTED' || !error.response) {
      return Promise.reject(
        new Error('Unable to connect to server. Please check your connection.')
      );
    }

    return Promise.reject(error);
  }
);

function _clearLocalUser() {
  localStorage.removeItem('auth_user');
}

export default apiClient;
