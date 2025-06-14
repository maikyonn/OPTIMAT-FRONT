<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { zoneColors } from '../lib/stores';
  const dispatch = createEventDispatcher();

  // Helper function to format datetime-local string
  function formatDateTimeLocal(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }

  // Set default times
  const now = new Date();
  const fourHoursLater = new Date(now.getTime() + (4 * 60 * 60 * 1000));

  export let loading = false;
  export let error = null;
  export let responseData = null;

  // Add predefined origin addresses
  const predefinedOrigins = [
    {
      label: "Safeway (Walnut Creek)",
      address: "600 S Broadway, Walnut Creek, CA"
    },
    {
      label: "BART (Walnut Creek)",
      address: "200 Ygnacio Valley Road, Walnut Creek, CA 94596"
    },
    {
      label: "Rossmoor Golf Clubs",
      address: "1010 Stanley Dollar Dr, Walnut Creek, CA 94595"
    },
    {
      label: "Kaiser Permanente",
      address: "1425 S Main St, Walnut Creek, CA 94596"
    }
  ];

  // Add predefined destinations
  const predefinedDestinations = [
    {
      label: "Broadway Plaza",
      address: "1275 Broadway Plaza, Walnut Creek, CA 94596"
    },
    {
      label: "UC Berkeley",
      address: "Barrow Ln, Berkeley, CA 94704"
    },
    {
      label: "Rossmoor Shopping Center",
      address: "1980 Tice Valley Blvd, Walnut Creek, CA 94595"
    },
    {
      label: "Police Station",
      address: "1666 N Main St, Walnut Creek, CA 94596"
    },
    {
      label: "Stoneridge Shopping Center",
      address: "1 Stoneridge Mall Rd, Pleasanton, CA 94588"
    }
  ];

  // Update formData to use first predefined origin and destination as default
  let formData = {
    departureTime: formatDateTimeLocal(now),
    returnTime: formatDateTimeLocal(fourHoursLater),
    originAddress: predefinedOrigins[0].address,
    destinationAddress: predefinedDestinations[0].address,
    providerType: '',
    routingType: '',
    scheduleType: '',
    planningType: '',
    eligibilityReq: '',
    providerOrg: '',
    providerNameContains: '',
    isOperating: null,
    hasServiceZone: null
  };

  function handleSubmit() {
    dispatch('submit', formData);
  }

  // // Watch for changes to addresses using $: reactive statements
  // $: if (formData.originAddress) {
  //   dispatch('originUpdate', formData.originAddress);
  // }

  // $: if (formData.destinationAddress) {
  //   dispatch('destinationUpdate', formData.destinationAddress);
  // }

  // Dispatch initial addresses on mount
  onMount(() => {
    dispatch('originUpdate', formData.originAddress);
    dispatch('destinationUpdate', formData.destinationAddress);
  });

  function handleReturnToForm() {
    responseData = null;
    error = null;
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

      // Format time from "HHMM" to "HH:MM AM/PM"
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

  async function handleOriginBlur() {
    if (formData.originAddress) {
      dispatch('originUpdate', formData.originAddress);
    }
  }

  async function handleDestinationBlur() {
    if (formData.destinationAddress) {
      dispatch('destinationUpdate', formData.destinationAddress);
    }
  }

  // Handle origin selection
  function handleOriginSelect(event) {
    formData.originAddress = event.target.value;
    handleOriginBlur();
  }

  // Handle destination selection
  function handleDestinationSelect(event) {
    formData.destinationAddress = event.target.value;
    handleDestinationBlur();
  }
</script>

{#if responseData}
  <div class="space-y-4">
    {#if responseData.data.length === 0}
      <div class="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">
        <div class="text-4xl mb-2">🚌</div>
        <p>No transportation providers found for your route and criteria.</p>
        <p class="text-sm mt-1">Try adjusting your search parameters.</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each responseData.data as provider, index}
          <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start space-x-3">
              <!-- Color indicator -->
              <div 
                class="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                style="background-color: {$zoneColors[index % $zoneColors.length]}"
              ></div>
              
              <!-- Service details -->
              <div class="flex-1">
                <h4 class="font-medium text-gray-900">{provider.provider_name}</h4>
                <dl class="mt-2 text-sm text-gray-600 space-y-1">
                  <div class="flex">
                    <dt class="font-medium w-24">Type:</dt>
                    <dd>{getProviderTypeLabel(provider.provider_type)}</dd>
                  </div>
                  <div class="flex">
                    <dt class="font-medium w-24">Service:</dt>
                    <dd>{provider.routing_type.replace(/-/g, ' ')}</dd>
                  </div>
                  <div class="flex">
                    <dt class="font-medium w-24">Hours:</dt>
                    <dd>{formatServiceHours(provider.service_hours)}</dd>
                  </div>
                  <div class="flex">
                    <dt class="font-medium w-24">Booking:</dt>
                    <dd>
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
                      <dt class="font-medium w-24">Website:</dt>
                      <dd>
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
    {/if}

    <!-- Trip Details Summary -->
    <div class="bg-gray-50 rounded-lg p-4 text-sm">
      <h3 class="font-medium text-gray-900 mb-2">Your Trip Details</h3>
      <div class="space-y-1 text-gray-600">
        <p><span class="font-medium">From:</span> {formData.originAddress}</p>
        <p><span class="font-medium">To:</span> {formData.destinationAddress}</p>
        <p><span class="font-medium">Departure:</span> {new Date(formData.departureTime).toLocaleString()}</p>
        <p><span class="font-medium">Return:</span> {new Date(formData.returnTime).toLocaleString()}</p>
      </div>
    </div>

    <div class="flex justify-end">
      <button
        type="button"
        class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        on:click={handleReturnToForm}
      >
        Submit Another Request
      </button>
    </div>
  </div>

{:else if error}
  <div class="rounded-md bg-red-50 p-4">
    <div class="flex">
      <div class="flex-shrink-0">
        <!-- You can add an error icon here -->
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-red-800">Error Submitting Request</h3>
        <div class="mt-2 text-sm text-red-700">
          <p>Error: {error.error || error}</p>
          {#if error.details}
            <ul class="list-disc list-inside mt-2">
              {#each Object.entries(error.details) as [field, message]}
                <li>{message}</li>
              {/each}
            </ul>
          {/if}
        </div>
        <div class="mt-4">
          <button
            type="button"
            class="bg-red-50 text-red-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-100"
            on:click={handleReturnToForm}
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  </div>

{:else}
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <div class="space-y-2">
      <label for="departureTime" class="block text-sm font-medium text-gray-700">Departure Time</label>
      <input 
        id="departureTime"
        type="datetime-local" 
        bind:value={formData.departureTime}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      />
    </div>

    <div class="space-y-2">
      <label for="returnTime" class="block text-sm font-medium text-gray-700">Return Time</label>
      <input 
        id="returnTime"
        type="datetime-local" 
        bind:value={formData.returnTime}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      />
    </div>

    <div class="space-y-2">
      <label for="originAddress" class="block text-sm font-medium text-gray-700">Origin Address</label>
      <select
        id="originAddress"
        bind:value={formData.originAddress}
        on:change={handleOriginSelect}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      >
        {#each predefinedOrigins as origin}
          <option value={origin.address}>
            {origin.label}
          </option>
        {/each}
      </select>
    </div>

    <div class="space-y-2">
      <label for="destinationAddress" class="block text-sm font-medium text-gray-700">Destination Address</label>
      <select
        id="destinationAddress"
        bind:value={formData.destinationAddress}
        on:change={handleDestinationSelect}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        required
      >
        {#each predefinedDestinations as destination}
          <option value={destination.address}>
            {destination.label}
          </option>
        {/each}
      </select>
    </div>

    <!-- Provider Type Filter -->
    <div class="space-y-2">
      <label for="providerType" class="block text-sm font-medium text-gray-700">Provider Type (Optional)</label>
      <select 
        id="providerType"
        bind:value={formData.providerType}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      >
        <option value="">All Types</option>
        <option value="Bus">Bus</option>
        <option value="Train">Train</option>
        <option value="Shuttle">Shuttle</option>
        <option value="Paratransit">Paratransit</option>
        <option value="On-demand">On-demand</option>
        <option value="ADA-para">ADA Paratransit</option>
        <option value="volunteer-driver">Volunteer Driver</option>
      </select>
    </div>

    <!-- Routing Type Filter -->
    <div class="space-y-2">
      <label for="routingType" class="block text-sm font-medium text-gray-700">Routing Type (Optional)</label>
      <select 
        id="routingType"
        bind:value={formData.routingType}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      >
        <option value="">All Routing Types</option>
        <option value="Fixed">Fixed Route</option>
        <option value="Flexible">Flexible Route</option>
        <option value="On-demand">On-demand</option>
        <option value="door-to-door">Door-to-door</option>
        <option value="curb-to-curb">Curb-to-curb</option>
      </select>
    </div>

    <!-- Schedule Type Filter -->
    <div class="space-y-2">
      <label for="scheduleType" class="block text-sm font-medium text-gray-700">Schedule Type (Optional)</label>
      <select 
        id="scheduleType"
        bind:value={formData.scheduleType}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      >
        <option value="">All Schedule Types</option>
        <option value="Static">Static</option>
        <option value="Dynamic">Dynamic</option>
        <option value="Real-time">Real-time</option>
      </select>
    </div>

    <!-- Planning Type Filter -->
    <div class="space-y-2">
      <label for="planningType" class="block text-sm font-medium text-gray-700">Planning Type (Optional)</label>
      <select 
        id="planningType"
        bind:value={formData.planningType}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      >
        <option value="">All Planning Types</option>
        <option value="Manual">Manual</option>
        <option value="Algorithmic">Algorithmic</option>
        <option value="Hybrid">Hybrid</option>
      </select>
    </div>

    <!-- Eligibility Requirements Filter -->
    <div class="space-y-2">
      <label for="eligibilityReq" class="block text-sm font-medium text-gray-700">Eligibility Requirements (Optional)</label>
      <input 
        id="eligibilityReq"
        type="text" 
        bind:value={formData.eligibilityReq}
        placeholder="e.g., General Public, Senior"
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </div>

    <!-- Provider Organization Filter -->
    <div class="space-y-2">
      <label for="providerOrg" class="block text-sm font-medium text-gray-700">Provider Organization (Optional)</label>
      <input 
        id="providerOrg"
        type="text" 
        bind:value={formData.providerOrg}
        placeholder="e.g., Metro Transit"
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </div>

    <!-- Provider Name Search -->
    <div class="space-y-2">
      <label for="providerNameContains" class="block text-sm font-medium text-gray-700">Provider Name Contains (Optional)</label>
      <input 
        id="providerNameContains"
        type="text" 
        bind:value={formData.providerNameContains}
        placeholder="e.g., transit"
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
      />
    </div>

    <!-- Currently Operating Filter -->
    <div class="space-y-2">
      <label for="isOperating" class="block text-sm font-medium text-gray-700">Operating Status (Optional)</label>
      <select 
        id="isOperating"
        bind:value={formData.isOperating}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        on:change={(e) => {
          const val = e.target.value;
          formData.isOperating = val === 'null' ? null : val === 'true';
        }}
      >
        <option value="null">Any</option>
        <option value="true">Currently Operating Only</option>
        <option value="false">Not Currently Operating</option>
      </select>
    </div>

    <!-- Has Service Zone Filter -->
    <div class="space-y-2">
      <label for="hasServiceZone" class="block text-sm font-medium text-gray-700">Service Zone (Optional)</label>
      <select 
        id="hasServiceZone"
        bind:value={formData.hasServiceZone}
        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        on:change={(e) => {
          const val = e.target.value;
          formData.hasServiceZone = val === 'null' ? null : val === 'true';
        }}
      >
        <option value="null">Any</option>
        <option value="true">Has Service Zone Only</option>
        <option value="false">No Service Zone</option>
      </select>
    </div>

    <div class="space-y-2">
      <button 
        type="submit" 
        class="mt-4 w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        disabled={loading}
      >
        {#if loading}
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Searching...
        {:else}
          Submit
        {/if}
      </button>
    </div>
  </form>
{/if} 