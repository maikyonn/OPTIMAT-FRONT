<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { BACKEND_URL } from '../config';
    
    const dispatch = createEventDispatcher();
  
    let messages = [
      {
        role: 'ai',
        content: "Hello! I'm here to help you find paratransit providers. How can I assist you today?"
      }
    ];
    
    let userInput = "I'm at Hanover Walnut Creek apartments, and trying to go to the Target in Walnut Creek? Can you help me find providers?";
    let loading = false; // For message sending
    let initializing = true; // For initial conversation setup
    let error = null;
    let serverOnline = false;
    let conversationId = null;

    async function checkServerHealth() {
      try {
        const response = await fetch(`${BACKEND_URL}/api-chat/health`);
        serverOnline = response.ok;
        if (!serverOnline) {
          error = "Chat server is currently offline.";
        }
      } catch (e) {
        serverOnline = false;
        error = "Failed to connect to the chat server.";
      }
    }

    async function initializeNewConversation() {
      initializing = true;
      error = null;
      try {
        const response = await fetch(`${BACKEND_URL}/api-chat/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: "New Chat via Frontend" }) // Backend expects a title
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Failed to initialize conversation." }));
          throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const newConversation = await response.json();
        if (newConversation && newConversation.id) {
          conversationId = newConversation.id;
          console.log("Conversation initialized with ID:", conversationId);
        } else {
          throw new Error("Failed to retrieve conversation ID from server.");
        }
      } catch (e) {
        error = `Error initializing conversation: ${e.message}`;
        console.error(error);
      } finally {
        initializing = false;
      }
    }
  
    onMount(() => {
      checkServerHealth().then(() => {
        if (serverOnline) {
          initializeNewConversation();
        }
      });
      const interval = setInterval(checkServerHealth, 30000);
      return () => clearInterval(interval);
    });
  
    async function handleSubmit() {
      if (!userInput.trim() || !serverOnline || initializing || !conversationId) {
        if (!conversationId && !initializing) {
            error = "Conversation not initialized. Please wait or refresh.";
        }
        return;
      }
  
      loading = true;
      error = null;
  
      const newMessage = {
        role: 'human',
        content: userInput
      };
  
      messages = [...messages, newMessage];
      userInput = ''; // Clear input immediately
  
      try {
        const response = await fetch(`${BACKEND_URL}/api-chat/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_message: newMessage,
            conversation_id: conversationId 
          })
        });
  
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: "Failed to send message." }));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }
  
        const { messages: responseMessages } = await response.json();
        
        if (responseMessages) {
          const validMessages = responseMessages.filter(m => 
            (m.role === 'ai' || m.role === 'human' || m.role === 'system') && 
            typeof m.content === 'string' && 
            m.content.trim() !== ''
          );
          
          // Check for provider data in tool calls
          checkForProviderData(responseMessages);
          
          messages = [...messages, ...validMessages];
        }
      } catch (e) {
        error = e.message;
        // Optionally, add the user's message back to input if sending failed
        // userInput = newMessage.content; 
      } finally {
        loading = false;
      }
    }

    function checkForProviderData(responseMessages) {
      // Look for messages that contain provider data from tool calls
      for (const message of responseMessages) {
        try {
          // Check if message content contains JSON with provider data
          if (message.content && typeof message.content === 'string') {
            // Look for JSON that contains "data" field (our tool call format)
            const jsonMatch = message.content.match(/\{[\s\S]*"data"[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const toolResult = JSON.parse(jsonMatch[0]);
                console.log('Parsed tool result:', toolResult);
                
                // Check if it has the expected format from find_providers tool
                if (toolResult.data && Array.isArray(toolResult.data)) {
                  const providerData = {
                    data: toolResult.data,
                    source_address: toolResult.source_address,
                    destination_address: toolResult.destination_address
                  };
                  // Emit event instead of showing popup
                  dispatch('providersFound', providerData);
                  console.log('Emitted providers found event:', providerData);
                  break; // Found provider data, no need to check other messages
                }
              } catch (e) {
                console.log('Failed to parse JSON from message content:', e);
              }
            }
            
            // Also check for legacy format (just in case)
            const legacyJsonMatch = message.content.match(/\{[\s\S]*"providers"[\s\S]*\}/);
            if (legacyJsonMatch) {
              try {
                const legacyData = JSON.parse(legacyJsonMatch[0]);
                if (legacyData.providers && Array.isArray(legacyData.providers)) {
                  const providerData = {
                    data: legacyData.providers,
                    source_address: legacyData.source_address,
                    destination_address: legacyData.destination_address
                  };
                  dispatch('providersFound', providerData);
                  console.log('Emitted providers found event from legacy format:', providerData);
                  break;
                }
              } catch (e) {
                console.log('Failed to parse legacy JSON format:', e);
              }
            }
          }
        } catch (e) {
          console.error('Error parsing provider data from message:', e);
        }
      }
      
      // Also check for addresses in the messages to update map
      checkForAddresses(responseMessages);
    }
    
    function checkForAddresses(responseMessages) {
      // Look for addresses in AI responses and user messages
      const allMessages = [...messages, ...responseMessages];
      
      for (const message of allMessages.slice(-5)) { // Check last 5 messages
        if (message.content && typeof message.content === 'string') {
          // Look for common address patterns
          const addressPatterns = [
            /(?:from|origin|start|pickup|at|located at|live at|staying at)\s*:?\s*([^,.!?;]+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|lane|ln|place|pl|court|ct|circle|cir|parkway|pkwy|highway|hwy|freeway|fwy)[^,.!?;]*)/i,
            /(?:to|destination|going to|headed to|drop off|end)\s*:?\s*([^,.!?;]+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|lane|ln|place|pl|court|ct|circle|cir|parkway|pkwy|highway|hwy|freeway|fwy)[^,.!?;]*)/i,
            /([^,.!?;]*(?:target|walmart|safeway|kaiser|bart|plaza|shopping center|mall|hospital|medical|clinic|library|school|university|college|airport|station)[^,.!?;]*)/i
          ];
          
          for (const pattern of addressPatterns) {
            const match = message.content.match(pattern);
            if (match && match[1]) {
              const address = match[1].trim();
              if (address.length > 5) { // Minimum viable address length
                console.log('Found potential address:', address);
                dispatch('addressFound', { address, messageRole: message.role });
              }
            }
          }
        }
      }
    }

</script> 
  <div class="flex flex-col h-full">
    {#if !serverOnline}
      <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <!-- You can add a warning icon here if desired -->
          </div>
          <div class="ml-3">
            <p class="text-sm text-yellow-700">
              Chat is currently unavailable. The server appears to be offline.
            </p>
          </div>
        </div>
      </div>
    {/if}
  
    <!-- Chat messages -->
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-0 space-y-4">
      {#each messages.filter(m => (m.role === 'ai' || m.role === 'human' || m.role === 'system') && typeof m.content === 'string' && m.content.trim() !== '') as message, index}
        <div class="flex flex-col {message.role === 'human' ? 'items-end' : 'items-start'}">
          <div class="max-w-[80%] rounded-lg p-3 {
            message.role === 'human'
              ? 'bg-indigo-600 text-white'
              : message.role === 'system'
                ? 'bg-yellow-100 text-gray-700'
                : 'bg-gray-100 text-gray-900'
          }">
            {#if message.role === 'system'}
              <div class="flex items-center space-x-2">
                <svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <p class="whitespace-pre-wrap">
                  Searched Providers
                  {#if messages.filter(m => m.role === 'system').length > 0}
                    x{messages.filter((m, i) => i <= index && m.role === 'system').length}
                  {/if}
                </p>
              </div>
            {:else}
              <p class="whitespace-pre-wrap">{message.content}</p>
            {/if}
          </div>
          <span class="text-xs text-gray-500 mt-1">
            {message.role}
          </span>
        </div>
      {/each}
  
      {#if loading}
        <div class="flex justify-center">
          <div class="animate-pulse text-gray-500">Thinking...</div>
        </div>
      {/if}
  
      {#if error}
        <div class="bg-red-100 text-red-700 p-3 rounded-lg">
          {error}
        </div>
      {/if}
    </div>
    <!-- Input form -->
    <form 
      on:submit|preventDefault={handleSubmit}
      class="border-t p-4 bg-white flex-shrink-0"
    >
      <div class="space-y-3">
        <textarea
          bind:value={userInput}
          placeholder={serverOnline ? "Type your message here... (Press Ctrl+Enter to send)" : "Chat is currently unavailable"}
          class="w-full h-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 resize-none"   
          disabled={loading || !serverOnline}
          on:keydown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
        ></textarea>
        <div class="flex justify-end">
          <button
            type="submit"
            disabled={loading || !serverOnline || !userInput.trim()}
            class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {#if loading}
              <div class="flex items-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sending...</span>
              </div>
            {:else}
              Send Message
            {/if}
          </button>
        </div>
      </div>
    </form>
  </div>