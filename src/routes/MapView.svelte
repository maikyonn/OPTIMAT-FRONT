<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fade, fly, scale } from 'svelte/transition';
  import TransportationForm from '../components/TransportationForm.svelte';
  import { Map, TileLayer, Marker, Popup, GeoJSON } from 'sveaflet';
  import { BACKEND_URL } from '../config';

  let loading = false;
  let error = null;
  let responseData = null;
  let originMarker = [37.9020731, -122.0618702]; // Default to Walnut Creek
  let destinationMarker = [37.9020731, -122.0618702];
  let showForm = false;
  let formPosition = 'form'; // 'form' or 'results'

  // Animation state
  let mounted = false;
  
  onMount(() => {
    mounted = true;
    // Show form after a brief delay for animation
    setTimeout(() => {
      showForm = true;
    }, 500);
  });

  // Calculate the center point between two coordinates
  function calculateCenter(coord1, coord2) {
    const lat = (coord1[0] + coord2[0]) / 2;
    const lng = (coord1[1] + coord2[1]) / 2;
    return [lat, lng];
  }

  // Calculate zoom level to fit both markers
  function calculateZoom(coord1, coord2) {
    const R = 6371e3;
    const φ1 = coord1[0] * Math.PI/180;
    const φ2 = coord2[0] * Math.PI/180;
    const Δφ = (coord2[0]-coord1[0]) * Math.PI/180;
    const Δλ = (coord2[1]-coord1[1]) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    if (distance > 10000) return 11;
    if (distance > 5000) return 12;
    if (distance > 2000) return 13;
    if (distance > 1000) return 14;
    return 15;
  }

  $: mapCenter = calculateCenter(originMarker, destinationMarker);
  $: mapZoom = calculateZoom(originMarker, destinationMarker);
  $: mapKey = [...originMarker, ...destinationMarker].join(',');

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

  async function handleOriginAddressUpdate(event) {
    const address = event.detail;
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      originMarker = coordinates;
    }
  }

  async function handleDestinationAddressUpdate(event) {
    const address = event.detail;
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      destinationMarker = coordinates;
    }
  }

  async function handleFormSubmit(event) {
    const formData = event.detail;
    loading = true;
    error = null;
    responseData = null;
    
    try {
      const apiPath = window.location.hostname === 'localhost' ? '/providers/filter' : '/api-providers/providers/filter';
      
      // Build the request body with all filter fields
      const requestBody = {
        source_address: formData.originAddress,
        destination_address: formData.destinationAddress
      };
      
      // Add optional filters only if they have values
      if (formData.providerType) requestBody.provider_type = formData.providerType;
      if (formData.routingType) requestBody.routing_type = formData.routingType;
      if (formData.scheduleType) requestBody.schedule_type = formData.scheduleType;
      if (formData.planningType) requestBody.planning_type = formData.planningType;
      if (formData.eligibilityReq) requestBody.eligibility_req = formData.eligibilityReq;
      if (formData.providerOrg) requestBody.provider_org = formData.providerOrg;
      if (formData.providerNameContains) requestBody.provider_name__contains = formData.providerNameContains;
      if (formData.isOperating !== null) requestBody.is_operating = formData.isOperating;
      if (formData.hasServiceZone !== null) requestBody.has_service_zone = formData.hasServiceZone;
      
      const response = await fetch(`${BACKEND_URL}${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(responseText);
      responseData = { data };
      formPosition = 'results';
    } catch (err) {
      error = err.message;
      console.error('Error:', err);
    } finally {
      loading = false;
    }
  }

  function goHome() {
    push('/');
  }

  function handleReturnToForm() {
    responseData = null;
    error = null;
    formPosition = 'form';
  }

  // Array of colors for service zones
  const zoneColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
  ];

  function parseServiceZone(zoneString) {
    try {
      return JSON.parse(zoneString);
    } catch (e) {
      console.error('Error parsing service zone:', e);
      return null;
    }
  }

  function getZoneStyle(index) {
    return {
      color: zoneColors[index % zoneColors.length],
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.2,
      fillColor: zoneColors[index % zoneColors.length],
      dashArray: index % 2 ? '3' : null
    };
  }

  $: serviceZones = responseData?.data?.map((provider, index) => ({
    geojson: parseServiceZone(provider.service_zone),
    name: provider.provider_name,
    style: getZoneStyle(index)
  })) || [];
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

  <!-- Fullscreen Map -->
  <div class="fixed inset-0 z-0" in:fade={{ duration: 800 }}>
    {#key mapKey}
      <Map
        options={{
          center: mapCenter,
          zoom: mapZoom
        }}
      >
        <TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
        
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
                  if (feature.properties && feature.properties.name) {
                    layer.bindPopup(feature.properties.name);
                  }
                }
              }}
            />
          {/if}
        {/each}

        <Marker latLng={originMarker} popup="Origin" />
        <Marker latLng={destinationMarker} popup="Destination" />
      </Map>
    {/key}
  </div>

  <!-- Floating Form Container -->
  {#if showForm}
    <div 
      class="fixed top-6 right-6 z-40 w-96 max-h-[calc(100vh-3rem)] overflow-y-auto"
      in:fly={{ x: 50, duration: 600, delay: 300 }}
    >
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200">
        {#if formPosition === 'form'}
          <div class="p-6" in:scale={{ duration: 400 }}>
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-gray-900">Find Providers</h2>
              {#if loading}
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              {/if}
            </div>
            
            <TransportationForm 
              {loading}
              {error}
              {responseData}
              on:submit={handleFormSubmit}
              on:originUpdate={handleOriginAddressUpdate}
              on:destinationUpdate={handleDestinationAddressUpdate}
            />
          </div>
        {:else if formPosition === 'results'}
          <div class="p-6" in:scale={{ duration: 400 }}>
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-gray-900">Available Providers</h2>
              <button
                class="text-indigo-600 hover:text-indigo-700 font-medium"
                on:click={handleReturnToForm}
              >
                New Search
              </button>
            </div>
            
            <TransportationForm 
              {loading}
              {error}
              {responseData}
              on:submit={handleFormSubmit}
              on:originUpdate={handleOriginAddressUpdate}
              on:destinationUpdate={handleDestinationAddressUpdate}
            />
          </div>
        {/if}
      </div>
    </div>
  {/if}
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