<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fade, fly, scale } from 'svelte/transition';
  import Chat from '../components/Chat.svelte';
  import { Map, TileLayer } from 'sveaflet';

  let mounted = false;
  let showChat = false;
  
  // Default map center (Walnut Creek area)
  const mapCenter = [37.9020731, -122.0618702];
  const mapZoom = 12;
  
  onMount(() => {
    mounted = true;
    // Show chat after a brief delay for animation
    setTimeout(() => {
      showChat = true;
    }, 500);
  });

  function goHome() {
    push('/');
  }
</script>

{#if mounted}
  <!-- Back Button -->
  <button
    class="fixed top-6 left-6 z-50 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200"
    on:click={goHome}
    in:fly={{ x: -50, duration: 600, delay: 200 }}
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
    </svg>
  </button>

  <!-- Fullscreen Map Background -->
  <div class="fixed inset-0 z-0" in:fade={{ duration: 800 }}>
    <Map
      options={{
        center: mapCenter,
        zoom: mapZoom
      }}
    >
      <TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
    </Map>
  </div>

  <!-- Floating Chat Container -->
  {#if showChat}
    <div 
      class="fixed top-6 right-6 z-40 w-96 h-[calc(100vh-3rem)]"
      in:fly={{ x: 50, duration: 600, delay: 300 }}
    >
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 h-full flex flex-col">
        <div class="p-6 border-b border-gray-200 flex-shrink-0" in:scale={{ duration: 400 }}>
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-900">AI Assistant</h2>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span class="text-sm text-gray-600">Online</span>
            </div>
          </div>
          <p class="text-gray-600 mt-2 text-sm">
            Ask me about transportation options and I'll help you find the best providers for your needs.
          </p>
        </div>
        
        <div class="flex-1 min-h-0" in:scale={{ duration: 400, delay: 200 }}>
          <Chat />
        </div>
      </div>
    </div>
  {/if}

  <!-- Floating Help Card -->
  <div 
    class="fixed bottom-6 left-6 z-40 max-w-sm"
    in:fly={{ y: 50, duration: 600, delay: 600 }}
  >
    <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4">
      <h3 class="font-semibold text-gray-900 mb-2">💡 Chat Tips</h3>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>• Describe your transportation needs</li>
        <li>• Mention your location and destination</li>
        <li>• Ask about accessibility requirements</li>
        <li>• Get personalized recommendations</li>
      </ul>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    overflow: hidden;
  }
  
  :global(.leaflet-container) {
    height: 100vh !important;
    width: 100vw !important;
  }
</style>