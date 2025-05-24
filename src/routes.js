import Home from './routes/Home.svelte';
import MapView from './routes/MapView.svelte';
import ChatView from './routes/ChatView.svelte';
import BetaSignup from './routes/BetaSignup.svelte';

const routes = {
  // Home page
  '/': Home,
  
  // Map interface
  '/map': MapView,
  
  // Chat interface
  '/chat': ChatView,
  
  // Beta signup page
  '/beta-signup': BetaSignup,
  
  // Catch-all route (redirects to home)
  '*': Home
};

export default routes; 