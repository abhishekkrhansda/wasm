import axios from 'axios';

// Use environment variable for production, proxy for dev
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token from localStorage if exists
const token = localStorage.getItem('token');
if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// API helper functions
export const casesAPI = {
    list: (params) => api.get('/cases', { params }),
    get: (id) => api.get(`/cases/${id}`),
    create: (data) => api.post('/cases', data),
    update: (id, data) => api.put(`/cases/${id}`, data),
    updateStatus: (id, status) => api.put(`/cases/${id}/status`, { status }),
    assign: (id, assigneeId) => api.put(`/cases/${id}/assign`, { assigneeId }),
    getComments: (id) => api.get(`/cases/${id}/comments`),
    addComment: (id, comment) => api.post(`/cases/${id}/comments`, { comment }),
    getAudit: (id) => api.get(`/cases/${id}/audit`)
};

export const dashboardAPI = {
    getSummary: () => api.get('/dashboard/summary'),
    getSlaBreaches: () => api.get('/dashboard/sla-breaches'),
    getResolutionTimes: () => api.get('/dashboard/resolution-times'),
    getAnalystWorkload: () => api.get('/dashboard/analyst-workload'),
    getRecentActivity: () => api.get('/dashboard/recent-activity'),
    getMyPendingActions: () => api.get('/dashboard/my-pending-actions')
};

export const usersAPI = {
    list: (role) => api.get('/users', { params: { role } }),
    getAnalysts: () => api.get('/users/analysts'),
    get: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`)
};
