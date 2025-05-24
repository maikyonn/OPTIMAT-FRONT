<script>
  import { push } from 'svelte-spa-router';
  import { fade, fly } from 'svelte/transition';
  import { onMount } from 'svelte';

  let mounted = false;
  
  onMount(() => {
    mounted = true;
  });

  function navigateToMap() {
    push('/map');
  }

  function navigateToChat() {
    push('/chat');
  }

  const apiLinks = [
    {
      title: 'Provider Map',
      description: 'Interactive map of service providers',
      url: 'https://optimat.us/api-providers/providers/map',
      icon: '🗺️'
    },
    {
      title: 'Provider API Docs',
      description: 'Provider matching API documentation',
      url: 'https://optimat.us/api-providers/docs',
      icon: '📚'
    },
    {
      title: 'Chat Interface',
      description: 'AI-powered transportation assistant',
      url: 'https://optimat.us/api-chat/',
      icon: '💬'
    },
    {
      title: 'Chat API Docs',
      description: 'Chat API documentation',
      url: 'https://optimat.us/api-chat/docs',
      icon: '📖'
    },
    {
      title: 'Admin Logs',
      description: 'Chat conversation logs',
      url: 'https://optimat.us/api-chat/admin/logs',
      icon: '📊'
    }
  ];
</script>

<main class="min-h-screen relative flex items-center justify-center">
  <!-- Background Image -->
  <div 
    class="absolute inset-0 bg-cover bg-center bg-no-repeat"
    style="background-image: url('https://its.berkeley.edu/sites/default/files/styles/openberkeley_image_full/public/general/15548045457_dcb7955f22_o.jpg')"
  ></div>
  
  <!-- Gradient Overlay -->
  <div class="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-indigo-100/80"></div>
  
  <!-- Content -->
  <div class="relative z-10 w-full">
  <div class="max-w-6xl mx-auto px-6 py-12">
    {#if mounted}
      <!-- Hero Section -->
      <div class="text-center mb-16" in:fade={{ duration: 800, delay: 200 }}>
        <h1 class="text-6xl font-bold text-gray-900 mb-6" in:fly={{ y: -50, duration: 1000, delay: 400 }}>
          Welcome to <span class="text-indigo-600">OPTIMAT</span>
        </h1>
        <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto" in:fly={{ y: 30, duration: 800, delay: 600 }}>
          Your comprehensive service for finding paratransit providers. Connect with transportation options 
          that meet your accessibility needs through our intelligent matching system.
        </p>
      </div>

      <!-- Main Action Cards -->
      <div class="grid md:grid-cols-2 gap-8 mb-16" in:fly={{ y: 50, duration: 800, delay: 800 }}>
        <!-- Map Option -->
        <div class="group cursor-pointer" role="button" tabindex="0" on:click={navigateToMap} on:keypress={navigateToMap}>
          <div class="bg-white rounded-2xl shadow-xl p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-gray-100">
            <div class="text-center">
              <div class="text-6xl mb-6 transform transition-transform duration-300 group-hover:scale-110">🗺️</div>
              <h3 class="text-2xl font-bold text-gray-900 mb-4">Find with Map</h3>
              <p class="text-gray-600 mb-6">
                Use our interactive map to visually explore transportation providers in your area. 
                Search by addresses and see service zones in real-time.
              </p>
              <div class="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold transform transition-all duration-300 group-hover:bg-indigo-700 inline-block">
                Open Map Interface
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Option -->
        <div class="group cursor-pointer" role="button" tabindex="0" on:click={navigateToChat} on:keypress={navigateToChat}>
          <div class="bg-white rounded-2xl shadow-xl p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-gray-100">
            <div class="text-center">
              <div class="text-6xl mb-6 transform transition-transform duration-300 group-hover:scale-110">💬</div>
              <h3 class="text-2xl font-bold text-gray-900 mb-4">Chat Assistant</h3>
              <p class="text-gray-600 mb-6">
                Get personalized recommendations through our AI-powered chat assistant. 
                Describe your needs and receive tailored transportation solutions.
              </p>
              <div class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transform transition-all duration-300 group-hover:bg-green-700 inline-block">
                Start Conversation
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Documentation Links -->
      <div class="bg-white rounded-2xl shadow-xl p-8 border border-gray-100" in:fly={{ y: 50, duration: 800, delay: 1000 }}>
        <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">API Documentation & Tools</h2>
        <div class="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {#each apiLinks as link, index}
            <a 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              class="group block p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-300"
              in:fly={{ y: 30, duration: 600, delay: 1200 + (index * 100) }}
            >
              <div class="text-center">
                <div class="text-2xl mb-2 transform transition-transform duration-300 group-hover:scale-110">{link.icon}</div>
                <h3 class="font-semibold text-gray-900 text-sm mb-1">{link.title}</h3>
                <p class="text-xs text-gray-600">{link.description}</p>
              </div>
            </a>
          {/each}
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center mt-12" in:fade={{ duration: 600, delay: 1400 }}>
        <p class="text-gray-500">
          Built for accessible transportation • Open source • Community driven
        </p>
      </div>
    {/if}
    </div>
  </div>
</main>

<style>
  :global(body) {
    overflow-x: hidden;
  }
  
  .group:focus {
    outline: none;
  }
  
  .group:focus > div {
    ring: 2px;
    ring-color: #4f46e5;
    ring-offset: 2px;
  }
</style>