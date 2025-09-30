<script>
  import { onMount, tick } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { Map, TileLayer, GeoJSON, Marker, Popup } from 'sveaflet';
  import { BACKEND_URL } from '../config';

  let loading = true;
  let error = null;
  let trips = [];
  let tripGeoJson = null;
  let selectedTrip = null;
  let mapRef;
  let highlightLayerId = null;
  const tripLayers = new Map();
  let pendingTripSelection = null;

  const baseMapUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const defaultCenter = [37.998, -121.79];
  const defaultZoom = 11;

  function buildApiUrl(path) {
    const trimmedBase = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    if (trimmedBase.endsWith('/api-providers')) {
      return `${trimmedBase}${path}`;
    }
    return `${trimmedBase}/api-providers${path}`;
  }

  onMount(async () => {
    await loadTrips();
  });

  async function loadTrips() {
    loading = true;
    error = null;
    try {
      tripLayers.clear();
      highlightLayerId = null;
      selectedTrip = null;
      const url = buildApiUrl('/tri-delta-transit/trips');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load trip history: ${response.status}`);
      }
      trips = await response.json();
      tripGeoJson = buildTripGeoJson(trips);
      pendingTripSelection = trips.length > 0 ? trips[0].trip_id : null;
      await tick();
      fitMapToTrips(trips);
    } catch (err) {
      console.error('Trip history load error', err);
      error = err.message || 'Failed to load trip history';
    } finally {
      loading = false;
    }
  }

  function buildTripGeoJson(records) {
    const features = records
      .filter((trip) => isValidTrip(trip))
      .map((trip) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [trip.origin_longitude, trip.origin_latitude],
            [trip.destination_longitude, trip.destination_latitude]
          ]
        },
        properties: {
          trip_id: trip.trip_id,
          origin_address: trip.origin_address,
          destination_address: trip.destination_address,
          origin_city: trip.origin_city,
          destination_city: trip.destination_city,
          duration_hours: trip.duration_hours
        }
      }));
    return {
      type: 'FeatureCollection',
      features
    };
  }

  function isValidTrip(trip) {
    return (
      typeof trip.origin_latitude === 'number' &&
      typeof trip.origin_longitude === 'number' &&
      typeof trip.destination_latitude === 'number' &&
      typeof trip.destination_longitude === 'number'
    );
  }

  function fitMapToTrips(records) {
    if (!mapRef || !mapRef.leafletMap) return;
    const coords = [];
    for (const trip of records) {
      if (isValidTrip(trip)) {
        coords.push([trip.origin_latitude, trip.origin_longitude]);
        coords.push([trip.destination_latitude, trip.destination_longitude]);
      }
    }
    if (coords.length === 0) return;
    const lats = coords.map((c) => c[0]);
    const lngs = coords.map((c) => c[1]);
    const bounds = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ];
    mapRef.leafletMap.fitBounds(bounds, { padding: [40, 40] });
  }

  function handleFeature(feature, layer) {
    const tripId = feature.properties.trip_id;
    tripLayers.set(tripId, layer);
    if (pendingTripSelection === tripId) {
      selectTrip(tripId);
      pendingTripSelection = null;
    }
    layer.on({
      click: () => selectTrip(tripId),
      mouseover: () => layer.setStyle(highlightStyle),
      mouseout: () => {
        if (highlightLayerId !== tripId) {
          layer.setStyle(defaultStyle);
        }
      }
    });
  }

  function selectTrip(tripId) {
    const trip = trips.find((t) => t.trip_id === tripId);
    if (!trip) return;
    selectedTrip = trip;

    if (highlightLayerId && tripLayers.has(highlightLayerId)) {
      tripLayers.get(highlightLayerId).setStyle(defaultStyle);
    }
    if (tripLayers.has(tripId)) {
      tripLayers.get(tripId).setStyle(highlightStyle);
      highlightLayerId = tripId;
    }
  }

  const defaultStyle = {
    color: '#2563eb',
    weight: 1.5,
    opacity: 0.4
  };

  const highlightStyle = {
    color: '#1d4ed8',
    weight: 4,
    opacity: 0.9
  };
</script>

<svelte:head>
  <title>Trip History | OPTIMAT</title>
</svelte:head>

<div class="trip-history-page">
  <div class="header" in:fade={{ duration: 400 }}>
    <h1>Tri Delta Transit Trip History</h1>
    <p>Explore historical paratransit trips completed through Tri Delta Transit.</p>
  </div>

  {#if loading}
    <div class="status-card loading" in:fade>
      <span class="spinner"></span>
      <p>Loading trip records...</p>
    </div>
  {:else if error}
    <div class="status-card error" in:fade>
      <p>{error}</p>
      <button class="retry" on:click={loadTrips}>Retry</button>
    </div>
  {:else}
    <div class="content" in:fade={{ duration: 300 }}>
      <div class="map-container" in:fly={{ y: 40, duration: 400 }}>
        <Map
          bind:this={mapRef}
          options={{
            center: defaultCenter,
            zoom: defaultZoom,
            zoomControl: true
          }}
        >
          <TileLayer url={baseMapUrl} options={{ attribution }} />

          {#if tripGeoJson}
            <GeoJSON
              json={tripGeoJson}
              options={{
                style: () => defaultStyle,
                onEachFeature: handleFeature
              }}
            />
          {/if}

          {#if selectedTrip}
            <Marker
              latLng={[selectedTrip.origin_latitude, selectedTrip.origin_longitude]}
            >
              <Popup>
                <div class="popup-content">
                  <strong>Origin</strong>
                  <div>{selectedTrip.origin_address}</div>
                  <div class="city">{selectedTrip.origin_city}</div>
                </div>
              </Popup>
            </Marker>
            <Marker
              latLng={[selectedTrip.destination_latitude, selectedTrip.destination_longitude]}
            >
              <Popup>
                <div class="popup-content">
                  <strong>Destination</strong>
                  <div>{selectedTrip.destination_address}</div>
                  <div class="city">{selectedTrip.destination_city}</div>
                </div>
              </Popup>
            </Marker>
          {/if}
        </Map>
      </div>

      <aside class="details" in:fly={{ x: 40, duration: 400 }}>
        <div class="summary">
          <h2>Total Trips</h2>
          <p class="count">{trips.length.toLocaleString()}</p>
          <p class="hint">Select a route on the map to view trip details.</p>
        </div>

        {#if selectedTrip}
          <div class="trip-card" in:fade>
            <h3>Trip #{selectedTrip.trip_id}</h3>
            <dl>
              <div>
                <dt>Origin</dt>
                <dd>{selectedTrip.origin_address}, {selectedTrip.origin_city}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{selectedTrip.destination_address}, {selectedTrip.destination_city}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{selectedTrip.duration_hours?.toFixed(2)} hours</dd>
              </div>
            </dl>
          </div>
        {/if}

        <button class="refresh" on:click={loadTrips}>Refresh Data</button>
      </aside>
    </div>
  {/if}
</div>

<style>
  .trip-history-page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
    padding: 1.5rem;
    gap: 1rem;
  }

  .header {
    text-align: left;
    max-width: 720px;
  }

  .header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 0.25rem;
  }

  .header p {
    color: #475569;
  }

  .status-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    background: white;
    border: 1px solid rgba(148, 163, 184, 0.2);
    max-width: 320px;
  }

  .status-card.loading .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #93c5fd;
    border-top-color: transparent;
    border-radius: 999px;
    animation: spin 0.9s linear infinite;
  }

  .status-card.error {
    border-color: rgba(239, 68, 68, 0.3);
    color: #b91c1c;
  }

  .status-card .retry {
    margin-left: auto;
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    border: none;
    background: #2563eb;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .content {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(260px, 1fr);
    gap: 1.5rem;
    flex: 1;
    min-height: 0;
  }

  .map-container {
    position: relative;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 20px 35px -25px rgba(30, 64, 175, 0.45);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }

  .map-container :global(.leaflet-container) {
    height: calc(100vh - 220px);
    min-height: 480px;
    width: 100%;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .summary {
    background: white;
    border-radius: 1rem;
    padding: 1.25rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 15px 30px -20px rgba(59, 130, 246, 0.45);
  }

  .summary h2 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .summary .count {
    font-size: 2rem;
    font-weight: 700;
    color: #2563eb;
    margin: 0.25rem 0 0.5rem;
  }

  .summary .hint {
    font-size: 0.9rem;
    color: #475569;
  }

  .trip-card {
    background: white;
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.2);
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 15px 30px -25px rgba(37, 99, 235, 0.4);
  }

  .trip-card h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1d4ed8;
  }

  .trip-card dl {
    display: grid;
    gap: 0.5rem;
  }

  .trip-card dt {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }

  .trip-card dd {
    margin: 0;
    color: #0f172a;
    font-weight: 500;
  }

  .refresh {
    margin-top: auto;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: white;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 15px 30px -22px rgba(37, 99, 235, 0.6);
  }

  .popup-content {
    font-size: 0.9rem;
    line-height: 1.35;
    color: #1e293b;
  }

  .popup-content .city {
    margin-top: 0.2rem;
    font-size: 0.8rem;
    color: #64748b;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1024px) {
    .content {
      grid-template-columns: 1fr;
    }

    .details {
      flex-direction: row;
      flex-wrap: wrap;
    }

    .summary, .trip-card {
      flex: 1 1 280px;
    }
  }

  @media (max-width: 768px) {
    .trip-history-page {
      padding: 1rem;
    }

    .map-container :global(.leaflet-container) {
      height: 420px;
    }
  }
</style>
