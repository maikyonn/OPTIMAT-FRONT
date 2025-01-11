<script>
  import { onMount } from 'svelte';
  import TransportationForm from './components/TransportationForm.svelte';
	import { Map, TileLayer, Marker, Popup, Polygon, GeoJSON } from 'sveaflet';

  
  let loading = false;
  let error = null;
  let responseData = null;
  let originMarker = [51.505, -0.09];
  let destinationMarker = [51.505, -0.09];

  // Calculate the center point between two coordinates
  function calculateCenter(coord1, coord2) {
    const lat = (coord1[0] + coord2[0]) / 2;
    const lng = (coord1[1] + coord2[1]) / 2;
    return [lat, lng];
  }

  // Calculate zoom level to fit both markers
  function calculateZoom(coord1, coord2) {
    const latDiff = Math.abs(coord1[0] - coord2[0]);
    const lngDiff = Math.abs(coord1[1] - coord2[1]);
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Increased zoom levels (smaller numbers = zoomed out, larger numbers = zoomed in)
    if (maxDiff > 0.1) return 13;     // was 11
    if (maxDiff > 0.05) return 14;    // was 12
    if (maxDiff > 0.01) return 15;    // was 13
    return 16;                        // was 14
  }

  // Reactive statements to update map center and zoom
  $: mapCenter = calculateCenter(originMarker, destinationMarker);
  $: mapZoom = calculateZoom(originMarker, destinationMarker);
  $: mapKey = [...originMarker, ...destinationMarker].join(',');

  async function geocodeAddress(address) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      
      if (data && data[0]) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
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
    
    let local = "http://0.0.0.0:8000/api/v1/providers/match"
    let online = "https://optimat-db.onrender.com/api/match"
    try {
      const response = await fetch(online, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      responseData = data;
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
      weight: 3,
      opacity: 0.8,
      fillOpacity: 0.4
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

  onMount(async () => {
    // Set initial markers from default addresses
    const defaultOrigin = "1103 S California Blvd, Walnut Creek, CA 94596";
    const defaultDestination = "1275 Broadway Plaza, Walnut Creek, CA 94596";
    
    const originCoords = await geocodeAddress(defaultOrigin);
    const destCoords = await geocodeAddress(defaultDestination);
    
    if (originCoords) originMarker = originCoords;
    if (destCoords) destinationMarker = destCoords;
  });
</script>
<main class="min-h-screen bg-gray-100 flex">
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
          {#if zone.geojson}
            <GeoJSON
              json={zone.geojson}
              options={{
                style: () => zone.style,
                onEachFeature,
                pointToLayer(feature, latlng) {
                  return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: zone.style.color,
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                  });
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
      <h1 class="text-2xl font-bold text-gray-900 mb-4">OPTIMAT Transportation</h1>

      <TransportationForm 
        {loading}
        {error}
        {responseData}
        on:submit={handleFormSubmit}
        on:originUpdate={handleOriginAddressUpdate}
        on:destinationUpdate={handleDestinationAddressUpdate}
      />
    </div>
  </div>
</main>