<script>
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { fade, fly } from 'svelte/transition';
  import { BACKEND_URL } from '../config';
  import chatExamplesData from '../data/chatExamples.json';

  let selectedScenario = null;
  let chatMessages = [];
  let isPlaying = false;
  let currentMessageIndex = 0;
  let providerResults = null;
  let conversationId = null;
  let mounted = false;
  let serverOnline = false;
  let pauseBetweenMessages = chatExamplesData.config.defaultMessageDelay;
  let currentStep = null;
  let demoError = null;

  // Load scenarios from JSON
  const scenarios = chatExamplesData.scenarios;

  onMount(async () => {
    mounted = true;
    await checkServerHealth();
  });

  async function checkServerHealth() {
    try {
      const response = await fetch(`${BACKEND_URL}/api-chat/health`);
      serverOnline = response.ok;
      if (!serverOnline) {
        demoError = "Chat server is currently offline.";
      }
    } catch (e) {
      serverOnline = false;
      demoError = "Failed to connect to the chat server.";
    }
  }

  async function initializeConversation() {
    try {
      const response = await fetch(`${BACKEND_URL}/api-chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: "Chat Examples Demo" })
      });

      if (response.ok) {
        const newConversation = await response.json();
        conversationId = newConversation.id;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing conversation:', error);
      demoError = "Failed to initialize conversation";
      return false;
    }
  }

  async function playScenario(scenario) {
    if (isPlaying || !serverOnline) return;
    
    selectedScenario = scenario;
    chatMessages = [];
    providerResults = null;
    isPlaying = true;
    currentMessageIndex = 0;
    demoError = null;
    currentStep = null;

    // Initialize conversation for this demo
    const initialized = await initializeConversation();
    if (!initialized) {
      isPlaying = false;
      return;
    }

    // Add initial AI greeting
    chatMessages = [...chatMessages, {
      role: 'ai',
      content: "Hi! I'm here to help you find transportation services. How can I assist you today?"
    }];
    scrollToBottom();

    // Wait a bit before starting the conversation
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Process each conversation step
    for (let i = 0; i < scenario.conversation.length; i++) {
      const step = scenario.conversation[i];
      currentStep = `Step ${i + 1} of ${scenario.conversation.length}`;
      
      try {
        if (step.type === 'message') {
          // Handle message step
          await handleMessageStep(step);
        } else if (step.type === 'wait') {
          // Handle wait step
          await handleWaitStep(step);
        }
      } catch (error) {
        console.error('Error in demo step:', error);
        demoError = error.message;
        break;
      }
    }
    
    isPlaying = false;
    currentStep = null;
  }

  async function handleMessageStep(step) {
    // Wait if specified
    if (step.delay) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }

    // Add the message to the chat
    const message = {
      role: step.role,
      content: step.content
    };
    chatMessages = [...chatMessages, message];
    scrollToBottom();

    // If it's a human message, send it to the backend
    if (step.role === 'human') {
      // Wait for previous response if specified
      if (step.waitForPreviousResponse) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await sendMessageToBackend(message);
    }
  }

  async function handleWaitStep(step) {
    if (step.showThinking) {
      // Show thinking indicator is handled in the UI
    }
    await new Promise(resolve => setTimeout(resolve, step.duration));
  }

  async function sendMessageToBackend(message) {
    try {
      const response = await fetch(`${BACKEND_URL}/api-chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          new_message: message
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Process the response messages
      if (data.messages && data.messages.length > 0) {
        for (const msg of data.messages) {
          if (msg.role && msg.content && msg.content.trim()) {
            // Add a small delay between AI messages for readability
            await new Promise(resolve => setTimeout(resolve, 500));
            chatMessages = [...chatMessages, {
              role: msg.role,
              content: msg.content
            }];
            scrollToBottom();
          }
        }

        // Check for provider data in the response
        checkForProviderData(data.messages);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to communicate with the chat server');
    }
  }

  function checkForProviderData(messages) {
    // Look for messages that contain provider data from tool calls
    for (const message of messages) {
      try {
        if (message.content && typeof message.content === 'string') {
          // Look for JSON that contains "data" field (our tool call format)
          const jsonMatch = message.content.match(/\{[\s\S]*"data"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const toolResult = JSON.parse(jsonMatch[0]);
              
              if (toolResult.data && Array.isArray(toolResult.data)) {
                providerResults = {
                  data: toolResult.data,
                  source_address: toolResult.source_address,
                  destination_address: toolResult.destination_address
                };
                console.log('Found provider data in response:', providerResults);
                break;
              }
            } catch (e) {
              console.log('Failed to parse JSON from message content:', e);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing provider data from message:', e);
      }
    }
  }

  function scrollToBottom() {
    // Scroll chat window to bottom
    const chatWindow = document.querySelector('.chat-messages');
    if (chatWindow) {
      setTimeout(() => {
        chatWindow.scrollTop = chatWindow.scrollHeight;
      }, 100);
    }
  }

  function resetDemo() {
    selectedScenario = null;
    chatMessages = [];
    providerResults = null;
    isPlaying = false;
    currentMessageIndex = 0;
    conversationId = null;
    currentStep = null;
    demoError = null;
  }

  function goHome() {
    push('/');
  }

  function getProviderTypeLabel(type) {
    const types = {
      'ADA-para': 'ADA Paratransit',
      'volunteer-driver': 'Volunteer Driver Program'
    };
    return types[type] || type;
  }

  const zoneColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
  ];
</script>

{#if mounted}
  <!-- Header -->
  <div class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Chat Examples</h1>
          <p class="mt-1 text-sm text-gray-500">
            Watch automated demonstrations of different transportation scenarios
          </p>
        </div>
        <button
          class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
          on:click={goHome}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Scenario Selection -->
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Choose a Scenario</h2>
          
          {#if !serverOnline}
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div class="flex">
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    {demoError || 'Chat server is offline. Demos are unavailable.'}
                  </p>
                </div>
              </div>
            </div>
          {/if}
          
          <div class="space-y-3">
            {#each scenarios.slice(0, chatExamplesData.config.maxScenariosToShow) as scenario}
              <button
                class="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 {selectedScenario?.id === scenario.id ? 'border-indigo-500 bg-indigo-50' : ''}"
                on:click={() => playScenario(scenario)}
                disabled={isPlaying || !serverOnline}
                in:fly={{ y: 20, duration: 300, delay: scenario.id * 50 }}
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-medium text-gray-900">{scenario.title}</h3>
                    <p class="text-sm text-gray-600 mt-1">{scenario.description}</p>
                  </div>
                  {#if isPlaying && selectedScenario?.id === scenario.id}
                    <div class="flex items-center space-x-2 ml-4">
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      <span class="text-sm text-indigo-600">Playing...</span>
                    </div>
                  {:else if selectedScenario?.id === scenario.id && !isPlaying}
                    <span class="text-sm text-green-600 ml-4">Completed</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>

        {#if selectedScenario && !isPlaying}
          <button
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg transition-colors"
            on:click={resetDemo}
          >
            Reset Demo
          </button>
        {/if}
        
        <!-- Demo Controls -->
        {#if selectedScenario}
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-900 mb-2">Demo Controls</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Message Delay</span>
                <div class="flex items-center space-x-2">
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="500"
                    bind:value={pauseBetweenMessages}
                    class="w-24"
                    disabled={isPlaying}
                  />
                  <span class="text-sm text-gray-700 w-12">{pauseBetweenMessages / 1000}s</span>
                </div>
              </div>
              {#if currentStep}
                <div class="text-sm text-gray-600">
                  <span class="font-medium">Progress:</span> {currentStep}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Chat Display -->
      <div class="bg-white border border-gray-200 rounded-lg shadow-sm h-[600px] flex flex-col">
        <div class="p-4 border-b border-gray-200 bg-gray-50">
          <h3 class="font-medium text-gray-900">
            {selectedScenario ? selectedScenario.title : 'Select a scenario to begin'}
          </h3>
          {#if selectedScenario}
            <p class="text-sm text-gray-600 mt-1">{selectedScenario.description}</p>
          {/if}
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4 chat-messages">
          {#each chatMessages as message, index}
            <div 
              class="flex flex-col {message.role === 'human' ? 'items-end' : 'items-start'}"
              in:fly={{ y: 20, duration: 400, delay: 200 }}
            >
              <div class="max-w-[80%] rounded-lg p-3 {
                message.role === 'human'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }">
                <p class="whitespace-pre-wrap">{message.content}</p>
              </div>
              <span class="text-xs text-gray-500 mt-1">{message.role}</span>
            </div>
          {/each}

          {#if isPlaying && currentStep && currentStep.includes('wait')}
            <div class="flex justify-center" in:fade>
              <div class="animate-pulse text-gray-500">AI is thinking...</div>
            </div>
          {/if}
          
          {#if demoError && selectedScenario}
            <div class="bg-red-100 text-red-700 p-3 rounded-lg" in:fly={{ y: 20, duration: 400 }}>
              <p class="text-sm font-medium">Demo Error</p>
              <p class="text-sm">{demoError}</p>
            </div>
          {/if}
        </div>

        <!-- Provider Results -->
        {#if providerResults}
          <div class="border-t border-gray-200 bg-gray-50 p-4 max-h-64 overflow-y-auto" in:fly={{ y: 20, duration: 400 }}>
            <h4 class="font-medium text-gray-900 mb-3">
              Found Providers ({providerResults.data.length})
            </h4>
            
            {#if providerResults.data.length === 0}
              <div class="text-center py-4 text-gray-500">
                <div class="text-2xl mb-2">🚌</div>
                <p class="text-sm">No providers found for this route</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each providerResults.data.slice(0, 3) as provider, providerIndex}
                  <div class="bg-white rounded p-3 border border-gray-200">
                    <div class="flex items-start space-x-2">
                      <div 
                        class="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                        style="background-color: {zoneColors[providerIndex % zoneColors.length]}"
                      ></div>
                      <div class="flex-1 min-w-0">
                        <h5 class="font-medium text-sm text-gray-900 truncate">{provider.provider_name}</h5>
                        <p class="text-xs text-gray-600">{getProviderTypeLabel(provider.provider_type)}</p>
                        {#if provider.routing_type}
                          <p class="text-xs text-gray-500">{provider.routing_type.replace(/-/g, ' ')}</p>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
                
                {#if providerResults.data.length > 3}
                  <p class="text-xs text-gray-500 text-center">
                    + {providerResults.data.length - 3} more providers
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}