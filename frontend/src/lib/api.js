const API_KEY = 'fitplan.api';
const TOKEN_KEY = 'fitplan.token';
export const ORDER_KEY = 'fitplan.order';

export function getApiBase() {
  return (localStorage.getItem(API_KEY) ?? '').trim().replace(/\/+$/, '') || '/api';
}

export function setApiBase(value) {
  const text = String(value ?? '').trim().replace(/\/+$/, '');
  if (text) localStorage.setItem(API_KEY, text);
  else localStorage.removeItem(API_KEY);
}

export function apiUrl(path) {
  const base = getApiBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function captureTokenFromHash() {
  const match = /#token=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!match) return false;
  setToken(match[1]);
  const rest = window.location.hash.replace(/#token=[A-Za-z0-9_-]+/, '');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${rest || '#/settings/account'}`);
  return true;
}

export function loginUrl() {
  return apiUrl('/auth/alipay/start');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers ?? {}) };
  if (options.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || `接口返回 ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }
  return payload;
}

export async function authLogin(username, password) {
  const result = await request('/v1/auth/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  return result.data;
}

export async function authRegister({ username, password, nickname, acceptedTerms }) {
  const result = await request('/v1/auth/register', {
    method: 'POST',
    body: { username, password, nickname, acceptedTerms },
    auth: false,
  });
  return result.data;
}

export async function changePassword(payload) {
  const result = await request('/v1/auth/change-password', {
    method: 'POST',
    body: payload,
  });
  return result.data;
}

function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  return search.toString();
}

export async function adminUsers({ keyword = '', pageNum = 1, pageSize = 20 } = {}) {
  const result = await request(`/v1/admin/users?${queryString({ keyword, pageNum, pageSize })}`);
  return result.data;
}

export async function adminUser(id) {
  const result = await request(`/v1/admin/users/${id}`);
  return result.data;
}

export async function adminSetStatus(id, status) {
  const result = await request(`/v1/admin/users/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
  return result.data;
}

export async function adminGrantVip(id, days) {
  const result = await request(`/v1/admin/users/${id}/vip`, {
    method: 'POST',
    body: { days },
  });
  return result.data;
}

export async function adminOperationLogs({ keyword = '', action = '', pageNum = 1, pageSize = 20 } = {}) {
  const result = await request(`/v1/admin/operation-logs?${queryString({ keyword, action, pageNum, pageSize })}`);
  return result.data;
}

export async function adminOrders({ keyword = '', status = '', pageNum = 1, pageSize = 20 } = {}) {
  const result = await request(`/v1/admin/orders?${queryString({ keyword, status, pageNum, pageSize })}`);
  return result.data;
}

export async function adminCloseOrder(outTradeNo) {
  const result = await request(`/v1/admin/orders/${outTradeNo}/close`, { method: 'POST' });
  return result.data;
}

export async function adminRefundOrder(outTradeNo) {
  const result = await request(`/v1/admin/orders/${outTradeNo}/refund`, { method: 'POST' });
  return result.data;
}

export async function myOperationLogs(limit = 20) {
  const result = await request(`/v1/auth/operation-logs?limit=${limit}`);
  return result.data;
}

export function getSession() {
  return request('/session');
}

export function logout() {
  return request('/session', { method: 'DELETE' });
}

export function closeAccount() {
  return request('/account', { method: 'DELETE' });
}

export function getPlan() {
  return request('/plan');
}

export function createOrder() {
  return request('/pay/order', { method: 'POST' });
}

export function getOrder(outTradeNo) {
  return request(`/pay/order?out_trade_no=${encodeURIComponent(outTradeNo)}`);
}

export function syncPayload(state) {
  return {
    profile: state.profile,
    onboarded: state.onboardingDone,
    favorites: state.favorites,
    framework: state.framework,
    sheets: state.sheets,
    setLogs: state.setLogs,
    activityLogs: state.activityLogs,
    mealLogs: state.mealLogs,
    measureLogs: state.measureLogs,
  };
}

export function syncData(state) {
  return request('/data/sync', { method: 'POST', body: syncPayload(state) });
}

export function readCloudData() {
  return request('/data');
}

export function clearCloudData() {
  return request('/data', { method: 'DELETE' });
}

export function stateFromCloud(current, cloud) {
  return {
    ...current,
    profile: { ...current.profile, ...(cloud.profile ?? {}) },
    framework: cloud.framework ?? null,
    sheets: Array.isArray(cloud.sheets) ? cloud.sheets : [],
    setLogs: Array.isArray(cloud.setLogs) ? cloud.setLogs : [],
    activityLogs: Array.isArray(cloud.activityLogs) ? cloud.activityLogs : [],
    mealLogs: Array.isArray(cloud.mealLogs) ? cloud.mealLogs : [],
    measureLogs: Array.isArray(cloud.measureLogs) ? cloud.measureLogs : [],
    favorites: Array.isArray(cloud.favorites) ? cloud.favorites : [],
    onboardingDone: cloud.onboarded === true || Boolean(cloud.profile),
  };
}
