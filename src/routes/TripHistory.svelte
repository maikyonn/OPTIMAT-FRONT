<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fly, fade } from 'svelte/transition';
  import { Map, TileLayer, Marker, Popup, Polyline } from 'sveaflet';
  import { buildProvidersApiUrl } from '../config';

  const DEFAULT_CENTER = [37.989, -121.835];
  const DEFAULT_ZOOM = 11;
  const tripsUrl = buildProvidersApiUrl('/tri-delta-transit/trips');

  let loading = true;
  let error = null;
  let trips = [];
  let selectedTrip = null;
  let mapCenter = DEFAULT_CENTER;
  let mapZoom = DEFAULT_ZOOM;
  let mapKey = 'default-map';

  onMount(loadTrips);

  async function loadTrips() {
    loading = true;
    error = null;

    try {
      const response = await fetch(tripsUrl);
      if (!response.ok) {
        throw new Error(`Failed to load trips (HTTP ${response.status})`);
      }

      const data = await response.json();
      trips = [...data].sort((a, b) => a.trip_id - b.trip_id);

      if (trips.length > 0) {
        const { center, zoom } = computeInitialMapView(trips);
        mapCenter = center;
        mapZoom = zoom;
        mapKey = `all-trips-${Date.now()}`;
        selectTrip(trips[0], { animate: false, focus: false });
      }
    } catch (err) {
      error = err?.message ?? 'Unable to load trip data.';
      trips = [];
      mapCenter = DEFAULT_CENTER;
      mapZoom = DEFAULT_ZOOM;
      mapKey = `default-${Date.now()}`;
    } finally {
      loading = false;
    }
  }

  function selectTrip(trip, { animate = true, focus = true } = {}) {
    if (!trip) return;

    selectedTrip = trip;

    if (focus) {
      const origin = getOriginLatLng(trip);
      const destination = getDestinationLatLng(trip);

      if (origin && destination) {
        mapCenter = [
          (origin[0] + destination[0]) / 2,
          (origin[1] + destination[1]) / 2
        ];
        mapZoom = 12;
      } else if (origin) {
        mapCenter = origin;
        mapZoom = 13;
      } else if (destination) {
        mapCenter = destination;
        mapZoom = 13;
      } else {
        mapCenter = DEFAULT_CENTER;
        mapZoom = DEFAULT_ZOOM;
      }

      mapKey = animate ? `trip-${trip.trip_id}-${Date.now()}` : `trip-${trip.trip_id}`;
    }
  }

  function getOriginLatLng(trip) {
    if (!trip) return null;
    const { origin_latitude, origin_longitude } = trip;
    if (origin_latitude == null || origin_longitude == null) return null;
    return [Number(origin_latitude), Number(origin_longitude)];
  }

  function getDestinationLatLng(trip) {
    if (!trip) return null;
    const { destination_latitude, destination_longitude } = trip;
    if (destination_latitude == null || destination_longitude == null) return null;
    return [Number(destination_latitude), Number(destination_longitude)];
  }

  function formatDuration(hours) {
    if (hours == null || Number.isNaN(Number(hours))) {
      return 'Unknown duration';
    }
    const minutes = Math.max(0, Math.round(Number(hours) * 60));
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  function goHome() {
    push('/');
  }

  $: selectedOrigin = getOriginLatLng(selectedTrip);
  $: selectedDestination = getDestinationLatLng(selectedTrip);
  $: tripSegments = trips
    .map((trip) => {
      const origin = getOriginLatLng(trip);
      const destination = getDestinationLatLng(trip);
      if (!origin || !destination) {
        return null;
      }
      return {
        id: trip.trip_id,
        origin,
        destination,
      };
    })
    .filter(Boolean);

  $: mappedTripCount = tripSegments.length;

  function computeInitialMapView(tripList) {
    const coordinates = tripList
      .flatMap((trip) => [getOriginLatLng(trip), getDestinationLatLng(trip)])
      .filter((point) => Array.isArray(point));

    if (coordinates.length === 0) {
      return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
    }

    const lats = coordinates.map(([lat]) => Number(lat));
    const lngs = coordinates.map(([, lng]) => Number(lng));

    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const lngMin = Math.min(...lngs);
    const lngMax = Math.max(...lngs);

    const center = [
      (latMin + latMax) / 2,
      (lngMin + lngMax) / 2,
    ];

    const latSpan = latMax - latMin;
    const lngSpan = lngMax - lngMin;
    const maxSpan = Math.max(latSpan, lngSpan);

    let zoom;
    if (maxSpan < 0.05) zoom = 13;
    else if (maxSpan < 0.1) zoom = 12;
    else if (maxSpan < 0.2) zoom = 11;
    else if (maxSpan < 0.5) zoom = 10;
    else zoom = 9;

    return { center, zoom };
  }
</script>

<button
  class="back-button"
  on:click={goHome}
  in:fly={{ x: -40, duration: 300 }}
  aria-label="Go back to home page"
>
  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
  </svg>
</button>

<div class="map-container" in:fade={{ duration: 400 }}>
  {#if trips.length > 0}
    <div class="map-overlay">
      <div class="overlay-title">Trip coverage</div>
      <div class="overlay-value">
        {mappedTripCount} of {trips.length} trips displayed
      </div>
    </div>
  {/if}
  {#key mapKey}
    <Map
      options={{
        center: mapCenter,
        zoom: mapZoom
      }}
    >
      <TileLayer
        url={'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'}
        options={{
          attribution:
            "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>"
        }}
      />

      {#each tripSegments as segment (segment.id)}
        <Polyline
          latLngs={[segment.origin, segment.destination]}
          options={{
            color: selectedTrip?.trip_id === segment.id ? '#2563eb' : '#6366f1',
            weight: selectedTrip?.trip_id === segment.id ? 4 : 2,
            opacity: selectedTrip?.trip_id === segment.id ? 0.85 : 0.18,
            lineCap: 'round'
          }}
        />
      {/each}

    </Map>
  {/key}
</div>

<aside
  class="trips-panel"
  in:fly={{ x: 40, duration: 400, delay: 100 }}
>
  <div class="panel-inner">
    <header class="panel-header">
      <div>
        <h2>Tri Delta Transit Trips</h2>
        <p class="panel-subtitle">Historical rides sourced from Aurora</p>
      </div>
      <button class="refresh-button" on:click={loadTrips} disabled={loading}>
        {#if loading}
          <span class="spinner" aria-hidden="true"></span>
        {:else}
          ↻
        {/if}
      </button>
    </header>

    <div class="panel-content">
      {#if loading && trips.length === 0}
        <div class="state">
          <span class="spinner" aria-hidden="true"></span>
          <p>Loading trip history…</p>
        </div>
      {:else if error}
        <div class="state error">
          <p>{error}</p>
          <button class="retry-button" on:click={loadTrips}>Try again</button>
        </div>
      {:else if trips.length === 0}
        <div class="state">
          <p>No trip records are available yet.</p>
        </div>
      {:else}
        <p class="trip-count">Showing {trips.length} trips</p>
        <div class="trip-list">
          {#each trips as trip (trip.trip_id)}
            <button
              class="trip-card {selectedTrip?.trip_id === trip.trip_id ? 'selected' : ''}"
              on:click={() => selectTrip(trip)}
            >
              <div class="trip-id">Trip #{trip.trip_id}</div>
              <div class="trip-route">
                <div class="trip-label">Origin</div>
                <div class="trip-address">{trip.origin_address}, {trip.origin_city}</div>
              </div>
              <div class="trip-route">
                <div class="trip-label">Destination</div>
                <div class="trip-address">{trip.destination_address}, {trip.destination_city}</div>
              </div>
              <div class="trip-meta">
                <span>{formatDuration(trip.duration_hours)}</span>
                {#if trip.origin_latitude != null && trip.origin_longitude != null}
                  <span>({Number(trip.origin_latitude).toFixed(4)}, {Number(trip.origin_longitude).toFixed(4)})</span>
                {/if}
                {#if trip.destination_latitude != null && trip.destination_longitude != null}
                  <span>→ ({Number(trip.destination_latitude).toFixed(4)}, {Number(trip.destination_longitude).toFixed(4)})</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</aside>

<style>
  :global(body) {
    overflow: hidden;
  }

  :global(.leaflet-container) {
    height: 100vh !important;
    width: 100vw !important;
  }

  .map-container {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .map-overlay {
    position: absolute;
    top: 1.25rem;
    left: 1.25rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(6px);
    box-shadow: 0 12px 32px -18px rgba(15, 23, 42, 0.45);
    color: #111827;
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 1000;
    pointer-events: none;
  }

  .overlay-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
  }

  .overlay-value {
    margin-top: 0.2rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1f2937;
  }

  .back-button {
    position: fixed;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 50;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(6px);
    color: #1f2937;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    padding: 0.75rem;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }

  .back-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 35px rgba(15, 23, 42, 0.16);
  }

  .back-button:focus {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }

  .icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .trips-panel {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    width: 24rem;
    height: calc(100vh - 3rem);
    max-height: calc(100vh - 3rem);
    z-index: 40;
    display: flex;
    flex-direction: column;
  }

  .panel-inner {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 1.5rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 25px 45px -12px rgba(15, 23, 42, 0.25);
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    min-height: 0;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem 1.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    gap: 1rem;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: #111827;
  }

  .panel-subtitle {
    margin: 0.25rem 0 0;
    color: #6b7280;
    font-size: 0.9rem;
  }

  .refresh-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 9999px;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #374151;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .refresh-button:hover:not(:disabled) {
    background: #eef2ff;
  }

  .refresh-button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .panel-content {
    flex: 1;
    min-height: 0;
    padding: 1.25rem 1.5rem 1.5rem;
    overflow-y: auto;
  }

  .trip-count {
    font-size: 0.85rem;
    color: #6b7280;
    margin: 0 0 1rem;
  }

  .trip-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 0.5rem;
  }

  .trip-card {
    width: 100%;
    text-align: left;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1rem;
    background: #f9fafb;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }

  .trip-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 20px -8px rgba(30, 64, 175, 0.2);
  }

  .trip-card.selected {
    border-color: #6366f1;
    background: #eef2ff;
    box-shadow: 0 18px 30px -12px rgba(79, 70, 229, 0.3);
  }

  .trip-id {
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #1f2937;
  }

  .trip-route {
    margin-bottom: 0.5rem;
  }

  .trip-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    margin-bottom: 0.2rem;
  }

  .trip-address {
    font-size: 0.95rem;
    color: #111827;
  }

  .trip-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #e5e7eb;
    color: #4b5563;
    font-size: 0.85rem;
  }

  .state {
    text-align: center;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: #4b5563;
  }

  .state.error {
    color: #b91c1c;
  }

  .retry-button {
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    border: 1px solid #ef4444;
    background: #fee2e2;
    color: #b91c1c;
    cursor: pointer;
  }

  .retry-button:hover {
    background: #fecaca;
  }

  .spinner {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    border: 3px solid #d1d5db;
    border-top-color: #6366f1;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .popup-content {
    min-width: 180px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.9rem;
    color: #1f2937;
  }

  .popup-content strong {
    display: block;
    margin-bottom: 0.25rem;
  }
</style>
