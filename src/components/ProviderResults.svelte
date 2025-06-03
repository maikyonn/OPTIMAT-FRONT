<script>
  import { createEventDispatcher } from 'svelte';
  
  export let providerData = null;
  export let show = false;
  export let loadingZones = false;
  
  const dispatch = createEventDispatcher();
  
  function closeWindow() {
    dispatch('close');
  }
  
  function formatServiceHours(hoursString) {
    try {
      const hours = JSON.parse(hoursString);
      if (!hours.hours?.[0]) return 'Hours not available';

      const schedule = hours.hours[0];
      const days = schedule.day.split('').map((day, index) => {
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return day === '1' ? weekdays[index] : null;
      }).filter(Boolean).join(', ');

      const formatTime = (time) => {
        const hour = parseInt(time.substring(0, 2));
        const minute = time.substring(2);
        const period = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${minute} ${period}`;
      };

      const start = formatTime(schedule.start);
      const end = formatTime(schedule.end);

      return `${days}: ${start} - ${end}`;
    } catch {
      return 'Hours not available';
    }
  }

  function getProviderTypeLabel(type) {
    const types = {
      'ADA-para': 'ADA Paratransit',
      'volunteer-driver': 'Volunteer Driver Program'
    };
    return types[type] || type;
  }

  function parseBookingInfo(bookingString) {
    try {
      const booking = JSON.parse(bookingString);
      return booking.call || null;
    } catch {
      return null;
    }
  }

  // Array of colors for service zones
  const zoneColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
  ];
</script>

{#if show && providerData}
  <div class="fixed top-6 left-6 z-40 w-96 max-h-[calc(100vh-3rem)] bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-gray-200 bg-white/90">
      <div>
        <h3 class="text-xl font-bold text-gray-900">Transportation Providers</h3>
        <div class="flex items-center space-x-2">
          <p class="text-sm text-gray-600">
            {providerData.data.length} provider{providerData.data.length !== 1 ? 's' : ''} found
          </p>
          {#if loadingZones}
            <div class="flex items-center space-x-1 text-xs text-blue-600">
              <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span>Loading zones...</span>
            </div>
          {/if}
        </div>
      </div>
      <button
        class="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
        on:click={closeWindow}
        aria-label="Close provider results"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="overflow-y-auto max-h-[calc(100vh-12rem)]">
      {#if providerData.data.length === 0}
        <div class="text-gray-500 text-center py-8 bg-gray-50 m-6 rounded-lg">
          <div class="text-4xl mb-2">🚌</div>
          <p>No transportation providers found for your criteria.</p>
        </div>
      {:else}
        <div class="p-6 space-y-4">
          <!-- Trip Details Summary -->
          {#if providerData.source_address && providerData.destination_address}
            <div class="bg-gray-50 rounded-lg p-4 text-sm">
              <h4 class="font-medium text-gray-900 mb-2">Trip Details</h4>
              <div class="space-y-1 text-gray-600">
                <p><span class="font-medium">From:</span> {providerData.source_address}</p>
                <p><span class="font-medium">To:</span> {providerData.destination_address}</p>
              </div>
            </div>
          {/if}
          
          <!-- Providers List -->
          <div class="space-y-3">
            {#each providerData.data as provider, index}
              <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-start space-x-3">
                  <!-- Color indicator -->
                  <div 
                    class="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                    style="background-color: {zoneColors[index % zoneColors.length]}"
                  ></div>
                  
                  <!-- Provider details -->
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900">{provider.provider_name}</h4>
                    <dl class="mt-2 text-sm text-gray-600 space-y-1">
                      <div class="flex">
                        <dt class="font-medium w-20">Type:</dt>
                        <dd>{getProviderTypeLabel(provider.provider_type)}</dd>
                      </div>
                      {#if provider.routing_type}
                        <div class="flex">
                          <dt class="font-medium w-20">Service:</dt>
                          <dd>{provider.routing_type.replace(/-/g, ' ')}</dd>
                        </div>
                      {/if}
                      {#if provider.service_hours}
                        <div class="flex">
                          <dt class="font-medium w-20">Hours:</dt>
                          <dd class="flex-1">{formatServiceHours(provider.service_hours)}</dd>
                        </div>
                      {/if}
                      <div class="flex">
                        <dt class="font-medium w-20">Booking:</dt>
                        <dd class="flex-1">
                          {#if parseBookingInfo(provider.booking)}
                            <a href="tel:{parseBookingInfo(provider.booking)}" class="text-blue-600 hover:underline">
                              {parseBookingInfo(provider.booking)}
                            </a>
                          {:else}
                            Contact provider
                          {/if}
                        </dd>
                      </div>
                      {#if provider.website}
                        <div class="flex">
                          <dt class="font-medium w-20">Website:</dt>
                          <dd class="flex-1">
                            <a href={provider.website} target="_blank" rel="noopener noreferrer" 
                               class="text-blue-600 hover:underline">
                              Visit website
                            </a>
                          </dd>
                        </div>
                      {/if}
                    </dl>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50/90">
      <p class="text-xs text-gray-600">
        Results from AI assistant
      </p>
      <button
        class="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        on:click={closeWindow}
      >
        Close
      </button>
    </div>
  </div>
{/if}