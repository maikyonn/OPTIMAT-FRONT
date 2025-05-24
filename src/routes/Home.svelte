<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import TransportationForm from '../components/TransportationForm.svelte';
  import { Map, TileLayer, Marker, Popup, Polygon, GeoJSON } from 'sveaflet';
  import Chat from '../components/Chat.svelte';
  import { BACKEND_URL } from '../config';

  let loading = false;
  let error = null;
  let responseData = null;
  let originMarker = [51.505, -0.09];
  let destinationMarker = [51.505, -0.09];
  let showChat = false;

  // Calculate the center point between two coordinates
  function calculateCenter(coord1, coord2) {
    const lat = (coord1[0] + coord2[0]) / 2;
    const lng = (coord1[1] + coord2[1]) / 2;
    return [lat, lng];
  }

  // Calculate zoom level to fit both markers
  function calculateZoom(coord1, coord2) {
    // Calculate distance between points in meters
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coord1[0] * Math.PI/180;
    const φ2 = coord2[0] * Math.PI/180;
    const Δφ = (coord2[0]-coord1[0]) * Math.PI/180;
    const Δλ = (coord2[1]-coord1[1]) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Calculate appropriate zoom based on distance
    if (distance > 10000) return 11;      // > 10km
    if (distance > 5000) return 12;       // 5-10km  
    if (distance > 2000) return 13;       // 2-5km
    if (distance > 1000) return 14;       // 1-2km
    return 15;                            // < 1km
  }

  // Reactive statements to update map center and zoom
  $: mapCenter = calculateCenter(originMarker, destinationMarker);
  $: mapZoom = calculateZoom(originMarker, destinationMarker);
  $: mapKey = [...originMarker, ...destinationMarker].join(',');

  async function geocodeAddress(address) {
    try {
      const apiPath = window.location.hostname === 'localhost' ? '/providers/geocode' : '/api-providers/providers/geocode';
      const url = `${BACKEND_URL}${apiPath}?address=${encodeURIComponent(address)}`;
      console.log('Geocoding URL:', url);
      
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
    console.log("Origin address updated:", address);
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      originMarker = coordinates;
      console.log("New origin coordinates:", coordinates);
    }
  }

  async function handleDestinationAddressUpdate(event) {
    const address = event.detail;
    console.log("Destination address updated:", address);
    const coordinates = await geocodeAddress(address);
    if (coordinates) {
      destinationMarker = coordinates;
      console.log("New destination coordinates:", coordinates);
    }
  }

  async function handleFormSubmit(event) {
    const formData = event.detail;
    loading = true;
    error = null;
    responseData = null;
    
    try {
      console.log('Submitting form data:', formData);
      
      const apiPath = window.location.hostname === 'localhost' ? '/providers/filter' : '/api-providers/providers/filter';
      console.log('API URL:', `${BACKEND_URL}${apiPath}`);
      const response = await fetch(`${BACKEND_URL}${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_address: formData.originAddress,
          destination_address: formData.destinationAddress,
          is_operating: true
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (!responseText.trim()) {
        throw new Error('Empty response from server');
      }
      
      const data = JSON.parse(responseText);
      responseData = { data };
    } catch (err) {
      error = err.message;
      console.error('Error:', err);
    } finally {
      loading = false;
    }
  }

  // Array of distinct colors for service zones
  const zoneColors = [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Turquoise
    '#45B7D1', // Sky Blue
    '#96CEB4', // Sage Green
    '#FFEEAD', // Cream Yellow
    '#D4A5A5', // Dusty Rose
    '#9B59B6', // Purple
    '#3498DB', // Blue
    '#E67E22', // Orange
    '#2ECC71'  // Emerald Green
  ];

  function parseServiceZone(zoneString) {
    try {
      return JSON.parse(zoneString);
    } catch (e) {
      console.error('Error parsing service zone:', e);
      return null;
    }
  }

  // Get style for zone based on index
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

  function onEachFeature(feature, layer) {
    if (feature.properties && feature.properties.name) {
      layer.bindPopup(feature.properties.name);
    }
  }

  $: serviceZones = responseData?.data?.map((provider, index) => ({
    geojson: parseServiceZone(provider.service_zone),
    name: provider.provider_name,
    style: getZoneStyle(index)
  })) || [];

  function navigateToBetaSignup() {
    push('/beta-signup');
  }

  onMount(async () => {
    // Set initial markers from default addresses
    const defaultOrigin = "1103 S California Blvd, Walnut Creek, CA 94596";
    const defaultDestination = "1010 Stanley Dollar Dr, Walnut Creek, CA 94595";
    
    const originCoords = await geocodeAddress(defaultOrigin);
    const destCoords = await geocodeAddress(defaultDestination);
    
    if (originCoords) originMarker = originCoords;
    if (destCoords) destinationMarker = destCoords;
  });
</script>

<main class="min-h-screen bg-gray-100 flex relative">
  <!-- Beta signup link -->
  <div class="absolute top-4 right-4 z-10">
    <button
      class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-md"
      on:click={navigateToBetaSignup}
    >
      Join SMS Beta
    </button>
  </div>

  <div class="w-1/2 h-screen relative">
    {#key mapKey}
      <Map
        options={{
          center: mapCenter,
          zoom: mapZoom
        }}
      >
        <TileLayer url={'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} />
        {#each serviceZones as zone}
          {console.log('Service zone:', zone.geojson)}
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
                },
                pointToLayer(feature, latlng) {
                  return {
                    radius: 8,
                    fillColor: zone.style.color,
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                  };
                }
              }}
            />
          {/if}
        {/each}

        <Marker latLng={originMarker} popup="Origin" />
        <Marker latLng={destinationMarker} popup="Destination" />
      </Map>
    {/key}
    
    <button
      class="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-md shadow-md hover:bg-gray-100"
      on:click={() => {
        console.log('Origin coordinates:', originMarker);
        console.log('Destination coordinates:', destinationMarker);
        console.log('Center point:', mapCenter);
      }}
    >
      Debug Coordinates
    </button>
  </div>
  <div class="w-1/2 px-8 py-6 overflow-y-auto">
    <div class="bg-white shadow-lg rounded-3xl p-8">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold text-gray-900">OPTIMAT Transportation</h1>
        <button
          class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          on:click={() => showChat = !showChat}
        >
          {showChat ? 'Show Form' : 'Show Chat'}
        </button>
      </div>

      {#if showChat}
        <div class="h-[600px]">
          <Chat />
        </div>
      {:else}
        <TransportationForm 
          {loading}
          {error}
          {responseData}
          on:submit={handleFormSubmit}
          on:originUpdate={handleOriginAddressUpdate}
          on:destinationUpdate={handleDestinationAddressUpdate}
        />
      {/if}
    </div>
  </div>
</main> 