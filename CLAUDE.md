# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OPTIMAT-FRONT is a Svelte-based single-page application that serves as the frontend for the OPTIMAT transportation service platform. It provides interfaces for transportation provider search, chat-based interactions, and map visualization.

## Commands

```bash
# Install dependencies
npm install

# Run development server (default port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture Overview

### Technology Stack
- **Framework**: Svelte 5.15.0 (using new Svelte 5 mount API)
- **Build Tool**: Vite 6.0.5
- **Styling**: TailwindCSS 3.4.17 with PostCSS
- **Routing**: svelte-spa-router 4.0.1 for client-side routing
- **Maps**: Leaflet 1.9.4 with Sveaflet wrapper
- **State Management**: Svelte stores (in lib/stores.js)

### Project Structure
```
src/
├── App.svelte              # Root component with router setup
├── main.js                 # Application entry point
├── app.css                 # Global styles (Tailwind imports)
├── routes.js               # Route definitions
├── components/             # Reusable UI components
│   ├── Chat.svelte         # Chat interface component
│   ├── ProviderResults.svelte  # Provider search results display
│   └── TransportationForm.svelte # Transportation search form
├── routes/                 # Page components
│   ├── Home.svelte         # Landing page
│   ├── MapView.svelte      # Map-based provider view
│   ├── ChatView.svelte     # Chat interface page
│   ├── ChatExamples.svelte # Chat examples/templates
│   └── BetaSignup.svelte   # Beta signup form
└── lib/                    # Shared utilities
    ├── stores.js           # Svelte stores for state
    └── Counter.svelte      # Example counter component
```

### Routing

The application uses hash-based routing via svelte-spa-router:

- `/` - Home page
- `/map` - Map view for provider locations
- `/chat` - Chat interface
- `/chat-examples` - Chat examples/templates
- `/beta-signup` - Beta signup form

### API Integration

The frontend communicates with two backend services:
- **Provider API**: Expected at `/api-providers/` (for transportation provider data)
- **Chat API**: Expected at `/api-chat/` (for chat functionality)

Configure the API endpoints in `src/config.js` if present.

### Development Notes

1. **Svelte 5**: This project uses Svelte 5 with the new mount API. Components use the modern syntax.

2. **Styling**: TailwindCSS is configured with PostCSS. Custom styles can be added to `app.css`.

3. **No Test Framework**: Currently no test framework is configured. Consider adding Vitest for unit testing.

4. **TypeScript**: JavaScript files have TypeScript checking enabled via `jsconfig.json`.

5. **Deployment**: Configured for Vercel deployment (see `vercel.json`).

6. **Build Output**: Production builds are output to the `dist/` directory.