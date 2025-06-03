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
  
  // Map configuration
  let mapCenter = [37.9020731, -122.0618702];
  let mapZoom = 12;
  let mapKey = 'initial'; // Force map to re-render when this changes
  let serviceZones = [];
  let loadingZones = false;
  
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
    
    // Fetch service zones for the providers
    await fetchServiceZones(providerData.data);
    
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
  

  async function fetchServiceZones(providers) {
    if (!providers || providers.length === 0) return;
    
    loadingZones = true;
    serviceZones = [];
    
    try {
      const apiPath = window.location.hostname === 'localhost' ? '/providers' : '/api-providers/providers';
      
      // Fetch service zone data for each provider
      const zonePromises = providers.map(async (provider, index) => {
        try {
          const response = await fetch(`${BACKEND_URL}${apiPath}/${provider.provider_id}/service-zone`);
          
          if (response.ok) {
            const zoneData = await response.json();
            
            if (zoneData.has_service_zone && zoneData.raw_data) {
              return {
                providerId: provider.provider_id,
                providerName: provider.provider_name,
                geojson: zoneData.raw_data,
                style: getZoneStyle(index),
                index
              };
            }
          }
        } catch (error) {
          console.error(`Error fetching service zone for ${provider.provider_name}:`, error);
        }
        return null;
      });
      
      const zones = await Promise.all(zonePromises);
      serviceZones = zones.filter(zone => zone !== null);
      
      console.log(`Loaded ${serviceZones.length} service zones out of ${providers.length} providers`);
    } catch (error) {
      console.error('Error fetching service zones:', error);
    } finally {
      loadingZones = false;
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
    // Optionally clear service zones when closing
    serviceZones = [];
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
          <Chat 
            on:providersFound={handleProvidersFound}
            on:addressFound={handleAddressFound}
          />
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

  <!-- Provider Results Window -->
  <ProviderResults 
    {providerData}
    {loadingZones}
    show={showProviderResults}
    on:close={handleCloseProviderResults}
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