<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fade, fly, scale } from 'svelte/transition';
  import Chat from '../components/Chat.svelte';
  import ProviderResults from '../components/ProviderResults.svelte';
  import { Map, TileLayer, Marker, GeoJSON } from 'sveaflet';
  import { BACKEND_URL } from '../config';

  let mounted = false;
  let showChat = false;
  let showProviderResults = false;
  let providerData = null;
  let originMarker = [37.9020731, -122.0618702]; // Default to Walnut Creek
  let destinationMarker = [37.9020731, -122.0618702];
  let foundAddresses = [];
  
  // Chat examples functionality
  let showExamplesPanel = false;
  let chatExamples = [];
  let loadingExamples = false;
  let examplesError = null;
  let serverOnline = false;
  let chatComponent = null; // Reference to the chat component
  
  // Map configuration
  let mapCenter = [37.9020731, -122.0618702];
  let mapZoom = 12;
  let mapKey = 'initial'; // Force map to re-render when this changes
  let serviceZones = [];
  let loadingZones = false;
  let visibleZones = new Set(); // Track which provider zones are visible
  
  onMount(async () => {
    mounted = true;
    await checkServerHealth();
    if (serverOnline) {
      await loadChatExamples();
    }
    // Show chat after a brief delay for animation
    setTimeout(() => {
      showChat = true;
    }, 500);
  });
  
  async function checkServerHealth() {
    try {
      const response = await fetch(`${BACKEND_URL}/api-chat/health`);
      serverOnline = response.ok;
      if (!serverOnline) {
        examplesError = "Chat server is currently offline.";
      }
    } catch (e) {
      serverOnline = false;
      examplesError = "Failed to connect to the chat server.";
    }
  }

  async function loadChatExamples() {
    loadingExamples = true;
    examplesError = null;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api-chat/chat-examples?is_active=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to load examples: ${response.status}`);
      }
      
      chatExamples = await response.json();
      console.log('Loaded chat examples:', chatExamples);
    } catch (error) {
      console.error('Error loading chat examples:', error);
      examplesError = error.message;
      chatExamples = [];
    } finally {
      loadingExamples = false;
    }
  }

  function goHome() {
    push('/');
  }

  async function geocodeAddress(address) {
    try {
      const apiPath = window.location.hostname === 'localhost' ? '/providers/geocode' : '/api-providers/providers/geocode';
      const url = `${BACKEND_URL}${apiPath}?address=${encodeURIComponent(address)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.coordinates) {
        const { longitude, latitude } = data.coordinates;
        return [latitude, longitude];
      }

      console.error('Geocoding failed:', data.message);
      return null;

    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  }

  async function handleAddressFound(event) {
    const { address, messageRole } = event.detail;
    console.log('Address found:', address, 'from', messageRole);
    
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      foundAddresses.push({ address, coordinates, role: messageRole });
      
      // Update markers based on context or order
      if (foundAddresses.length === 1) {
        originMarker = coordinates;
        mapCenter = coordinates;
        mapZoom = 14;
        mapKey = Date.now().toString();
      } else if (foundAddresses.length === 2) {
        destinationMarker = coordinates;
        // Center map between both points
        const lat = (originMarker[0] + destinationMarker[0]) / 2;
        const lng = (originMarker[1] + destinationMarker[1]) / 2;
        mapCenter = [lat, lng];
        mapZoom = 12;
        mapKey = Date.now().toString();
      } else {
        // For subsequent addresses, update the most recent marker
        destinationMarker = coordinates;
        mapKey = Date.now().toString();
      }
    }
  }

  async function handleProvidersFound(event) {
    providerData = event.detail;
    showProviderResults = true;
    console.log('Providers found, showing results window');
    
    // Reset visible zones when new providers are found
    visibleZones = new Set();
    serviceZones = [];
    
    // If we have trip details but haven't set markers properly, use the trip addresses
    if (providerData.source_address && providerData.destination_address) {
      await updateMarkersFromTripDetails();
    }
  }
  
  async function updateMarkersFromTripDetails() {
    if (!providerData || !providerData.source_address || !providerData.destination_address) {
      return;
    }
    
    console.log('Updating markers from trip details:', providerData.source_address, '->', providerData.destination_address);
    
    // Geocode both addresses
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(providerData.source_address),
      geocodeAddress(providerData.destination_address)
    ]);
    
    if (originCoords && destCoords) {
      originMarker = originCoords;
      destinationMarker = destCoords;
      
      // Calculate center point between the two addresses
      const centerLat = (originCoords[0] + destCoords[0]) / 2;
      const centerLng = (originCoords[1] + destCoords[1]) / 2;
      mapCenter = [centerLat, centerLng];
      
      // Calculate zoom level based on distance (more zoomed in)
      const distance = calculateDistance(originCoords, destCoords);
      if (distance > 20) mapZoom = 12;
      else if (distance > 10) mapZoom = 13;
      else if (distance > 5) mapZoom = 14;
      else if (distance > 2) mapZoom = 15;
      else mapZoom = 16;
      
      console.log('Updated map center:', mapCenter, 'zoom:', mapZoom);
    } else if (originCoords) {
      // If only origin geocoded, use that
      originMarker = originCoords;
      mapCenter = originCoords;
      mapZoom = 15;
    } else if (destCoords) {
      // If only destination geocoded, use that
      destinationMarker = destCoords;
      mapCenter = destCoords;
      mapZoom = 15;
    }
    
    // Update map key to force re-render
    mapKey = Date.now().toString();
  }
  
  // Calculate distance between two coordinates in kilometers
  function calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const dLon = (coord2[1] - coord1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[0] * Math.PI / 180) * Math.cos(coord2[0] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  

  async function toggleServiceZone(providerId, providerName, index) {
    if (visibleZones.has(providerId)) {
      // Hide the zone
      visibleZones.delete(providerId);
      serviceZones = serviceZones.filter(zone => zone.providerId !== providerId);
      visibleZones = new Set(visibleZones); // Trigger reactivity
    } else {
      // Show the zone
      loadingZones = true;
      
      try {
        const apiPath = window.location.hostname === 'localhost' ? '/providers' : '/api-providers/providers';
        const response = await fetch(`${BACKEND_URL}${apiPath}/${providerId}/service-zone`);
        
        if (response.ok) {
          const zoneData = await response.json();
          
          if (zoneData.has_service_zone && zoneData.raw_data) {
            const newZone = {
              providerId: providerId,
              providerName: providerName,
              geojson: zoneData.raw_data,
              style: getZoneStyle(index),
              index
            };
            
            serviceZones = [...serviceZones, newZone];
            visibleZones.add(providerId);
            visibleZones = new Set(visibleZones); // Trigger reactivity
            
            console.log(`Loaded service zone for ${providerName}`);
          }
        }
      } catch (error) {
        console.error(`Error fetching service zone for ${providerName}:`, error);
      } finally {
        loadingZones = false;
      }
    }
  }
  
  function getZoneStyle(index) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
      '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
    ];
    
    const color = colors[index % colors.length];
    
    return {
      color: color,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.2,
      fillColor: color,
      dashArray: index % 2 ? '5,5' : null // Alternating solid and dashed lines
    };
  }

  function handleCloseProviderResults() {
    showProviderResults = false;
    // Clear service zones and visible zones when closing
    serviceZones = [];
    visibleZones = new Set();
  }
  
  function toggleExamplesPanel() {
    showExamplesPanel = !showExamplesPanel;
    // Reload examples when opening panel
    if (showExamplesPanel && serverOnline) {
      loadChatExamples();
    }
  }
  
  async function viewChatExample(example) {
    try {
      // Fetch the conversation messages and tool calls
      const [messagesResponse, toolCallsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api-chat/conversations/${example.conversation_id}/messages`),
        fetch(`${BACKEND_URL}/api-chat/conversations/${example.conversation_id}/tool-calls`)
      ]);
      
      if (!messagesResponse.ok) {
        throw new Error(`Failed to load conversation: ${messagesResponse.status}`);
      }
      
      if (!toolCallsResponse.ok) {
        throw new Error(`Failed to load tool calls: ${toolCallsResponse.status}`);
      }
      
      const messagesData = await messagesResponse.json();
      const toolCallsData = await toolCallsResponse.json();
      
      console.log('Raw messages data:', messagesData);
      console.log('Raw tool calls data:', toolCallsData);
      
      // Build conversation states using state reconstruction
      const conversationStates = buildConversationStates(messagesData.messages, toolCallsData.tool_calls);
      
      console.log('Built conversation states:', conversationStates);
      
      if (chatComponent) {
        // Load the example conversation with state reconstruction
        await chatComponent.loadExampleWithStates(conversationStates, example);
      }
      
      // Close the examples panel
      showExamplesPanel = false;
    } catch (error) {
      console.error('Error loading example conversation:', error);
      examplesError = `Failed to load example: ${error.message}`;
    }
  }

  function buildConversationStates(messages, toolCalls) {
    // Build conversation state at each message point
    const states = [];
    let currentProviders = null;
    
    console.log('Raw messages from backend:', messages);
    console.log('Available tool calls:', toolCalls);
    
    // Filter and sort messages chronologically
    const sortedMessages = messages
      .filter(msg => msg.role !== 'system' && msg.created_at)
      .sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateA.getTime() - dateB.getTime();
      });
    
    console.log('Sorted messages:', sortedMessages.length);
    
    // Find the find_providers tool call if it exists
    if (toolCalls.find_providers && toolCalls.find_providers.length > 0) {
      const providerCall = toolCalls.find_providers[0];
      console.log('Found provider tool call:', providerCall);
      
      if (providerCall.provider_data) {
        currentProviders = {
          data: providerCall.provider_data,
          source_address: providerCall.source_address,
          destination_address: providerCall.destination_address
        };
        console.log('Provider data extracted:', currentProviders);
      }
    }
    
    // Build states for each message
    for (let i = 0; i < sortedMessages.length; i++) {
      const message = sortedMessages[i];
      
      // Check if this is the AI message that should show providers
      // Look for key phrases that indicate provider results
      const shouldShowProviders = message.role === 'ai' && 
        currentProviders && 
        (message.content.includes('found') || 
         message.content.includes('provider') || 
         message.content.includes('LINK') ||
         message.content.includes('County Connection'));
      
      console.log(`Message ${i} (${message.role}): show providers = ${shouldShowProviders}`);
      
      states.push({
        message: message,
        state: {
          providers: shouldShowProviders ? currentProviders : null,
          hasProviders: shouldShowProviders
        }
      });
    }
    
    return states;
  }
</script>

{#if mounted}
  <!-- Back Button -->
  <button
    class="fixed top-6 left-6 z-50 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200"
    on:click={goHome}
    in:fly={{ x: -50, duration: 600, delay: 200 }}
    aria-label="Go back to home page"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
    </svg>
  </button>

  <!-- Fullscreen Map Background -->
  <div class="fixed inset-0 z-0" in:fade={{ duration: 800 }}>
    {#key mapKey}
      <Map
        options={{
          center: mapCenter,
          zoom: mapZoom
        }}
      >
          <TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
          
          <!-- Service Zones -->
          {#each serviceZones as zone}
            {#if zone.geojson}
              <GeoJSON
                json={zone.geojson}
                options={{
                  style: () => zone.style,
                  onEachFeature: (feature, layer) => {
                    layer.on({
                      mouseover: (e) => {
                        const layer = e.target;
                        layer.setStyle({
                          weight: 3,
                          opacity: 1,
                          fillOpacity: 0.4
                        });
                        layer.bringToFront();
                      },
                      mouseout: (e) => {
                        const layer = e.target;
                        layer.setStyle(zone.style);
                      }
                    });
                    
                    // Bind popup with provider name
                    layer.bindPopup(`
                      <div class="text-sm">
                        <strong>${zone.providerName}</strong><br/>
                        Service Zone
                      </div>
                    `);
                  }
                }}
              />
            {/if}
          {/each}
          
          <!-- Origin Marker -->
          {#if originMarker}
            <Marker latLng={originMarker} popup="Origin" />
          {/if}
          
          <!-- Destination Marker -->
          {#if destinationMarker && (originMarker[0] !== destinationMarker[0] || originMarker[1] !== destinationMarker[1])}
            <Marker latLng={destinationMarker} popup="Destination" />
          {/if}
      </Map>
    {/key}
  </div>

  <!-- Examples Panel -->
  {#if showExamplesPanel && showChat}
    <div 
      class="fixed top-6 left-20 z-40 w-80 h-[calc(100vh-3rem)]"
      in:fly={{ x: -50, duration: 600, delay: 200 }}
    >
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 h-full flex flex-col">
        <div class="p-4 border-b border-gray-200 flex-shrink-0">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-900">Chat Examples</h3>
            <button
              on:click={toggleExamplesPanel}
              class="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close examples panel"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <p class="text-gray-600 mt-1 text-xs">
            View saved conversation examples
          </p>
          
          {#if !serverOnline}
            <div class="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
              <p class="text-xs text-yellow-700">
                Chat server is offline. Examples are unavailable.
              </p>
            </div>
          {/if}
        </div>
        
        <!-- Examples List -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          {#if loadingExamples}
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span class="ml-2 text-sm text-gray-600">Loading examples...</span>
            </div>
          {:else if chatExamples.length === 0}
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10m-10 4h10m-10 4h10" />
              </svg>
              <p class="text-sm text-gray-500 mt-2">No examples available yet</p>
              <p class="text-xs text-gray-400 mt-1">Save conversations as examples to see them here</p>
            </div>
          {:else}
            {#each chatExamples as example}
              <button
                class="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200"
                on:click={() => viewChatExample(example)}
                disabled={!serverOnline}
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900 text-sm">
                      {example.title || 'Untitled Example'}
                    </h4>
                    {#if example.description}
                      <p class="text-xs text-gray-600 mt-1">{example.description}</p>
                    {/if}
                    {#if example.tags && example.tags.length > 0}
                      <div class="flex flex-wrap gap-1 mt-2">
                        {#each example.tags.slice(0, 3) as tag}
                          <span class="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        {/each}
                        {#if example.tags.length > 3}
                          <span class="text-xs text-gray-500">+{example.tags.length - 3} more</span>
                        {/if}
                      </div>
                    {/if}
                    <p class="text-xs text-gray-400 mt-1">
                      Created {new Date(example.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div class="flex items-center ml-2">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
              </button>
            {/each}
          {/if}
        </div>
        
        {#if examplesError}
          <div class="p-3 border-t border-gray-200 bg-red-50">
            <p class="text-xs text-red-700">
              <strong>Error:</strong> {examplesError}
            </p>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Floating Chat Container -->
  {#if showChat}
    <div 
      class="fixed top-6 right-6 z-40 w-[36rem] h-[calc(100vh-3rem)]"
      in:fly={{ x: 50, duration: 600, delay: 300 }}
    >
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 h-full flex flex-col">
        <div class="p-6 border-b border-gray-200 flex-shrink-0" in:scale={{ duration: 400 }}>
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-900">AI Assistant</h2>
            <div class="flex items-center space-x-3">
              <button
                on:click={toggleExamplesPanel}
                class="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded {showExamplesPanel ? 'bg-indigo-100 text-indigo-600' : ''}"
                title="View Chat Examples"
                aria-label="Toggle chat examples panel"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
              </button>
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span class="text-sm text-gray-600">Online</span>
              </div>
            </div>
          </div>
          <p class="text-gray-600 mt-2 text-sm">
            Ask me about transportation options and I'll help you find the best providers for your needs.
          </p>
        </div>
        
        <div class="flex-1 min-h-0" in:scale={{ duration: 400, delay: 200 }}>
          <Chat 
            bind:this={chatComponent}
            on:providersFound={handleProvidersFound}
            on:addressFound={handleAddressFound}
          />
        </div>
      </div>
    </div>
  {/if}

  <!-- Floating Help Card -->
  {#if !showExamplesPanel}
    <div 
      class="fixed bottom-6 left-6 z-40 max-w-sm"
      in:fly={{ y: 50, duration: 600, delay: 600 }}
    >
      <div class="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-gray-900">💡 Chat Tips</h3>
          <button
            on:click={toggleExamplesPanel}
            class="text-xs text-indigo-600 hover:text-indigo-800 underline"
          >
            View Examples
          </button>
        </div>
        <ul class="text-sm text-gray-600 space-y-1">
          <li>• Describe your transportation needs</li>
          <li>• Mention your location and destination</li>
          <li>• Ask about accessibility requirements</li>
          <li>• Get personalized recommendations</li>
        </ul>
      </div>
    </div>
  {/if}

  <!-- Provider Results Window -->
  <ProviderResults 
    {providerData}
    {loadingZones}
    {visibleZones}
    show={showProviderResults}
    on:close={handleCloseProviderResults}
    on:toggleZone={(event) => toggleServiceZone(event.detail.providerId, event.detail.providerName, event.detail.index)}
  />
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