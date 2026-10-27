const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://localhost:4000' : '');

async function request(path, options) {
  if (!API_URL) {
    throw new Error('The city services API URL is not configured for this website.');
  }

  let response;
  try {
    const citizenToken = sessionStorage.getItem('newgencity.citizenToken');
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(citizenToken ? { Authorization: `Bearer ${citizenToken}` } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new Error('Could not reach the city services API. Is the backend running?');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'The request could not be completed.');
  }
  return data;
}

export const getComplaints = () => request('/complaints');
export const getDepartments = () => request('/departments');
export const getOverview = () => request('/overview');
export const getCityConditions = (forceRefresh = false) =>
  request(`/city/conditions${forceRefresh ? '?refresh=true' : ''}`);
export const getComplaint = (id) =>
  request(`/complaints/${encodeURIComponent(id.trim())}`);

export const verifyOpsToken = (token) =>
  request('/auth/verify', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const registerCitizen = (details) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(details),
  });

export const loginCitizen = (credentials) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

export const getCitizenAccount = () => request('/auth/me');
export const getMyComplaints = () => request('/complaints/mine');
export const logoutCitizen = () =>
  request('/auth/logout', { method: 'POST' });

export const createComplaint = (complaint) =>
  request('/complaints', {
    method: 'POST',
    body: JSON.stringify(complaint),
  });

export const updateComplaint = (id, updates) =>
  request(`/complaints/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem('newgencity.opsToken') || ''}`,
    },
    body: JSON.stringify(updates),
  });
