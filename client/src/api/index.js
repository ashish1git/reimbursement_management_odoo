import api from './axios.js';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  checkFirstUser: () => api.get('/auth/check-first-user'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
};

export const userApi = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  changeRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  assignManager: (id, managerId) => api.patch(`/users/${id}/manager`, { managerId }),
  sendCredentials: (id, resetPassword = false) => api.post(`/users/${id}/send-credentials`, { resetPassword }),
  delete: (id) => api.delete(`/users/${id}`),
};

export const expenseApi = {
  submit: (data) => api.post('/expenses', data),
  submitDraft: (id, data) => api.patch(`/expenses/${id}/submit`, data),
  updateDraft: (id, data) => api.patch(`/expenses/${id}/draft`, data),
  getMy: () => api.get('/expenses/my'),
  getPending: () => api.get('/expenses/pending'),
  getApprovalHistory: () => api.get('/expenses/approval-history'),
  getAll: (params) => api.get('/expenses/all', { params }),
  // FLAW #1: Manager-scoped team expenses (direct reports only)
  getTeam: (params) => api.get('/expenses/team', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  approve: (id, comment) => api.patch(`/expenses/${id}/approve`, { comment }),
  reject: (id, comment) => api.patch(`/expenses/${id}/reject`, { comment }),
  override: (id, action, comment) => api.post(`/expenses/${id}/override`, { action, comment }),
  // FLAW #4: Resubmit a rejected expense
  resubmit: (id, data) => api.post(`/expenses/${id}/resubmit`, data || {}),
  exportCsv: (params) =>
    api.get('/expenses/export', {
      params,
      responseType: 'blob',
    }),
};


export const approvalFlowApi = {
  get: () => api.get('/approval-flow'),
  save: (data) => api.post('/approval-flow', data),
};

export const ocrApi = {
  parseReceipt: (formData) =>
    api.post('/ocr/parse-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getRatePreview: (amount, from, to) =>
    api.get('/ocr/rate-preview', { params: { amount, from, to } }),
};

export const analyticsApi = {
  getSummary: () => api.get('/analytics/summary'),
};
