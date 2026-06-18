import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  register: (data: { company_name: string; website_url: string; full_name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const companyAPI = {
  getMe: () => api.get('/company/me'),
  update: (data: Record<string, unknown>) => api.put('/company/me', data),
};

export const crawlerAPI = {
  start: (website_url: string, max_pages = 20) => api.post('/crawler/start', { website_url, max_pages }),
  getPages: () => api.get('/crawler/pages'),
  deletePage: (id: string) => api.delete(`/crawler/pages/${id}`),
};

export const documentsAPI = {
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  list: () => api.get('/documents/'),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

export const leadsAPI = {
  getAll: (params?: Record<string, unknown>) => api.get('/leads/', { params }),
  getStats: () => api.get('/leads/stats'),
  get: (id: string) => api.get(`/leads/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leads/${id}`, data),
};

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getDaily: () => api.get('/analytics/daily'),
  getQuestions: () => api.get('/analytics/questions'),
};

export const agentAPI = {
  getSettings: () => api.get('/agent/settings'),
  updateSettings: (data: Record<string, unknown>) => api.put('/agent/settings', data),
};

export const chatAPI = {
  getSessions: () => api.get('/chat/sessions'),
  getMessages: (sessionId: string) => api.get(`/chat/sessions/${sessionId}/messages`),
};

export default api;
