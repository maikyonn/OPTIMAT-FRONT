// API endpoints
export const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8001' : 'https://api.optimat.us/api-providers');
export const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8002' : 'https://api.optimat.us/api-chat');

// Backward compatibility
export const BACKEND_URL = API_URL; 