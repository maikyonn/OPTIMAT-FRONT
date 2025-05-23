import Home from './routes/Home.svelte';
import BetaSignup from './routes/BetaSignup.svelte';

const routes = {
  // Home page
  '/': Home,
  
  // Beta signup page
  '/beta-signup': BetaSignup,
  
  // Catch-all route (redirects to home)
  '*': Home
};

export default routes; 