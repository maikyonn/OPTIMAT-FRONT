// API endpoints
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const rawApiUrl = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:8001' : 'https://api-providers.optimat.us');
export const API_URL = rawApiUrl.replace(/\/+$/, '');
export const CHAT_API_URL = (import.meta.env.VITE_CHAT_API_URL || (isLocal ? 'http://localhost:8002' : 'https://api-chat.optimat.us')).replace(/\/+$/, '');

function normalizePrefix(prefix) {
  const value = (prefix ?? '').trim();
  if (value === '' || value === '/') {
    return '';
  }
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

export const PROVIDERS_API_PREFIX = normalizePrefix(import.meta.env.VITE_API_PREFIX ?? '');

export const BACKEND_URL = API_URL;
export const PROVIDERS_API_BASE = `${API_URL}${PROVIDERS_API_PREFIX}`;

export function buildProvidersApiUrl(path = '/') {
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${PROVIDERS_API_BASE}${normalizedPath}`;
}
