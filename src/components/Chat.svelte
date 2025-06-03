<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { BACKEND_URL } from '../config';
    import { fade, fly, slide } from 'svelte/transition';
    
    const dispatch = createEventDispatcher();
    
    // Typewriter effect component
    function typewriterAction(node, { text, maxDuration = 2000, messageId, onComplete = null }) {
        let i = 0;
        let currentText = '';
        let timeoutId;
        let isDestroyed = false;
        
        // Calculate simple speed to fit within maxDuration
        const availableTime = maxDuration - 100; // subtract initial delay
        const speed = Math.max(5, availableTime / text.length); // minimum 5ms per character
        
        // Add typing indicator to the set
        typingMessages.add(messageId);
        typingMessages = typingMessages; // Trigger reactivity
        
        function type() {
            if (isDestroyed || i >= text.length) {
                // Remove typing indicator
                typingMessages.delete(messageId);
                typingMessages = typingMessages; // Trigger reactivity
                if (onComplete) onComplete();
                return;
            }
            
            currentText += text.charAt(i);
            node.textContent = currentText;
            i++;
            
            timeoutId = setTimeout(type, speed);
        }
        
        // Start typing with a small delay to allow the message to appear first
        timeoutId = setTimeout(type, 100);
        
        return {
            destroy() {
                isDestroyed = true;
                if (timeoutId) clearTimeout(timeoutId);
                typingMessages.delete(messageId);
                typingMessages = typingMessages; // Trigger reactivity
            }
        };
    }
  
    let messages = [
      {
        role: 'ai',
        content: "Hello! I'm here to help you find paratransit providers. How can I assist you today?",
        id: 'initial-greeting'
      }
    ];
    
    let userInput = "I'm at Hanover Walnut Creek apartments, and trying to go to the Target in Walnut Creek? Can you help me find providers?";
    let loading = false; // For message sending
    let initializing = true; // For initial conversation setup
    let error = null;
    let serverOnline = false;
    let conversationId = null;
    
    // Save as example functionality
    let savingAsExample = false;
    let showExampleForm = false;
    let exampleForm = {
      title: '',
      description: '',
      tags: ''
    };
    
    // Example viewing functionality
    let isViewingExample = false;
    let currentExample = null;
    let isLoadingExample = false;
    let examplePlaybackPaused = false;
    let currentExampleIndex = 0; // Track current message index in example
    let totalExampleStates = 0; // Total number of states in current example
    
    // Typewriter effect state
    let typingMessages = new Set(); // Track which messages are currently typing

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
          return true;
        } else {
          throw new Error("Failed to retrieve conversation ID from server.");
        }
      } catch (e) {
        error = `Error initializing conversation: ${e.message}`;
        console.error(error);
        return false;
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
        content: userInput,
        id: `human-${Date.now()}`
      };
  
      messages = [...messages, newMessage];
      userInput = ''; // Clear input immediately
      scrollToBottom();
  
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
            (m.role === 'ai' || m.role === 'human') && 
            typeof m.content === 'string' && 
            m.content.trim() !== ''
          ).map((m, i) => ({
            ...m,
            id: m.id || `response-${Date.now()}-${i}`
          }));
          
          // Check for provider data in tool calls
          checkForProviderData(responseMessages);
          
          messages = [...messages, ...validMessages];
          scrollToBottom();
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
      console.log('Checking for provider data, isViewingExample:', isViewingExample);
      
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
    
    // Export function to check server status
    export function getServerStatus() {
      return serverOnline;
    }
    
    // Export functions to control example playback
    export function pauseExamplePlayback() {
      if (isViewingExample && isLoadingExample) {
        examplePlaybackPaused = true;
        console.log('Example playback paused');
      }
    }
    
    export function resumeExamplePlayback() {
      if (isViewingExample && examplePlaybackPaused) {
        examplePlaybackPaused = false;
        console.log('Example playback resumed');
        // If we were in the middle of loading, continue from where we left off
        if (currentExampleIndex < totalExampleStates) {
          continueExamplePlayback();
        }
      }
    }
    
    async function continueExamplePlayback() {
      // Load next message from current index, processing system messages but not displaying them
      const conversationStates = currentExample?._conversationStates;
      if (!conversationStates || currentExampleIndex >= conversationStates.length) {
        isLoadingExample = false;
        return;
      }
      
      // Check if paused or not viewing example
      if (examplePlaybackPaused || !isViewingExample) {
        return;
      }
      
      // Process system messages and empty AI messages automatically without displaying them
      while (currentExampleIndex < conversationStates.length) {
        const stateSnapshot = conversationStates[currentExampleIndex];
        const message = stateSnapshot.message;
        
        // Skip system messages and empty AI messages
        if (message.role === 'system' || 
            (message.role === 'ai' && (!message.content || message.content.trim() === ''))) {
          // Process message state but don't display the message
          await applyConversationState(stateSnapshot.state);
          currentExampleIndex++;
          continue; // Continue to next message automatically
        } else {
          // This is a user message or AI message with content - display it and stop
          const messageWithId = {
            ...message,
            id: message.id || `example-${currentExampleIndex}-${Date.now()}`
          };
          messages = [...messages, messageWithId];
          
          // Apply the conversation state
          await applyConversationState(stateSnapshot.state);
          
          scrollToBottom();
          currentExampleIndex++;
          break; // Stop after displaying one user/AI message
        }
      }
      
      // Check if this was the last message
      if (currentExampleIndex >= conversationStates.length) {
        isLoadingExample = false;
        console.log('Finished loading example conversation with states:', currentExample);
      }
    }
    
    // Example viewing functionality with state reconstruction
    export async function loadExampleWithStates(conversationStates, example) {
      try {
        isViewingExample = true;
        isLoadingExample = true;
        examplePlaybackPaused = false;
        currentExample = { ...example, _conversationStates: conversationStates };
        currentExampleIndex = 0;
        totalExampleStates = conversationStates.length;
        
        // Reset conversation state and clear all messages
        conversationId = null;
        error = null;
        messages = []; // Clear all messages first
        
        // Load the first message
        await continueExamplePlayback();
        
        // Set loading to false after first message loads
        isLoadingExample = false;
        
      } catch (error) {
        console.error('Error loading example conversation with states:', error);
        isLoadingExample = false;
        throw error;
      }
    }
    
    async function applyConversationState(state) {
      try {
        console.log('Applying conversation state:', state);
        
        // Handle providers state
        if (state.providers) {
          console.log('Applying provider state:', state.providers);
          console.log('Dispatching providersFound event...');
          dispatch('providersFound', state.providers);
          console.log('Provider event dispatched successfully');
          
          // For examples, we want providers to show immediately
          if (isViewingExample) {
            console.log('Example mode: Ensuring provider popup shows');
          }
        } else {
          console.log('No providers in state');
        }
        
        // Skip map updates during example playback to prevent map resetting
        if (!isViewingExample) {
          // Handle map geocoding if needed
          if (state.mapState?.pendingGeocode) {
            console.log('Applying map state:', state.mapState.pendingGeocode);
            // Trigger address geocoding for map updates
            dispatch('addressFound', { 
              address: state.mapState.pendingGeocode.origin, 
              messageRole: 'system' 
            });
            
            // Small delay before destination
            setTimeout(() => {
              dispatch('addressFound', { 
                address: state.mapState.pendingGeocode.destination, 
                messageRole: 'system' 
              });
            }, 500);
          }
          
          // Handle individual addresses
          if (state.addresses && state.addresses.length > 0) {
            console.log('Found addresses in state:', state.addresses);
            // Could emit address events for additional map updates if needed
          }
        }
        
      } catch (error) {
        console.error('Error applying conversation state:', error);
      }
    }
    
    export function startNewConversation() {
      isViewingExample = false;
      isLoadingExample = false;
      examplePlaybackPaused = false;
      currentExample = null;
      currentExampleIndex = 0;
      totalExampleStates = 0;
      conversationId = null;
      messages = [{
        role: 'ai',
        content: "Hello! I'm here to help you find paratransit providers. How can I assist you today?",
        id: 'new-conversation-greeting'
      }];
      
      // Initialize a new conversation
      if (serverOnline) {
        initializeNewConversation();
      }
    }
    
    function scrollToBottom(smooth = true) {
      // Scroll chat window to bottom
      setTimeout(() => {
        const chatWindow = document.querySelector('.chat-messages');
        if (chatWindow) {
          if (smooth) {
            chatWindow.scrollTo({
              top: chatWindow.scrollHeight,
              behavior: 'smooth'
            });
          } else {
            chatWindow.scrollTop = chatWindow.scrollHeight;
          }
        }
      }, 100);
    }

    function openExampleForm() {
      if (!conversationId) {
        error = "No conversation to save. Please start chatting first.";
        return;
      }
      showExampleForm = true;
      exampleForm = {
        title: '',
        description: '',
        tags: ''
      };
    }

    function closeExampleForm() {
      showExampleForm = false;
      exampleForm = {
        title: '',
        description: '',
        tags: ''
      };
    }

    async function saveAsExample() {
      if (!conversationId || savingAsExample) {
        return;
      }

      savingAsExample = true;
      error = null;

      try {
        const tags = exampleForm.tags 
          ? exampleForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          : [];

        const response = await fetch(`${BACKEND_URL}/api-chat/conversations/${conversationId}/add-to-examples`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            title: exampleForm.title || null,
            description: exampleForm.description || null,
            tags: tags,
            is_active: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Failed to save example." }));
          throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const exampleData = await response.json();
        console.log('Chat example saved:', exampleData);
        
        // Show success message
        const successMessage = {
          role: 'system',
          content: `✅ This conversation has been saved as an example${exampleForm.title ? ': "' + exampleForm.title + '"' : ''}!`,
          id: `success-${Date.now()}`
        };
        messages = [...messages, successMessage];
        scrollToBottom();
        
        closeExampleForm();
        
      } catch (e) {
        error = `Error saving example: ${e.message}`;
        console.error('Error saving chat example:', e);
      } finally {
        savingAsExample = false;
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

    <!-- Example viewing banner or Save as Example Button -->
    {#if isViewingExample}
      <div class="px-4 pt-2 pb-0 flex justify-between items-center bg-blue-50 mx-4 rounded-lg p-2">
        <div class="flex items-center space-x-2">
          <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
          <span class="text-sm text-blue-700 font-medium">Viewing Example</span>
        </div>
        <button
          on:click={startNewConversation}
          class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Start New Chat
        </button>
      </div>
    {:else if conversationId && messages.length > 1 && serverOnline}
      <div class="px-4 pt-2 pb-0 flex justify-end">
        <button
          on:click={openExampleForm}
          disabled={savingAsExample}
          class="text-sm px-3 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-all duration-200 flex items-center space-x-1"
          title="Save this conversation as an example for others"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
          </svg>
          <span>Save as Example</span>
        </button>
      </div>
    {/if}
  
    <!-- Chat messages -->
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-0 space-y-4 chat-messages scroll-smooth">
      {#each messages.filter(m => (m.role === 'ai' || m.role === 'human') && typeof m.content === 'string' && m.content.trim() !== '') as message, index (message.id || `${message.role}-${index}-${message.content.substring(0, 20)}`)}
        <div 
          class="flex flex-col {message.role === 'human' ? 'items-end' : 'items-start'}"
          in:fly={{ 
            x: message.role === 'human' ? 30 : -30, 
            y: 10,
            duration: 500,
            delay: 0
          }}
        >
          <div class="max-w-[80%] rounded-lg p-3 {
            message.role === 'human'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-900'
          }">
            {#if message.role === 'human' && !isViewingExample}
              <!-- User messages in live chat: no typing animation -->
              <p class="whitespace-pre-wrap">{message.content}</p>
            {:else}
              <!-- AI messages and all messages in examples: typing animation -->
              <p 
                class="whitespace-pre-wrap inline"
                use:typewriterAction={{ 
                  text: message.content, 
                  maxDuration: 2000, 
                  messageId: message.id 
                }}
              ></p>
              {#if typingMessages.has(message.id)}
                <span class="typing-cursor">|</span>
              {/if}
            {/if}
          </div>
          <span class="text-xs text-gray-500 mt-1 opacity-60">
            {message.role}
          </span>
        </div>
      {/each}
  
      {#if loading}
        <div class="flex justify-center" in:fade={{ duration: 300 }}>
          <div class="animate-pulse text-gray-500 flex items-center space-x-2">
            <div class="flex space-x-1">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
            </div>
            <span>Thinking</span>
          </div>
        </div>
      {:else if isLoadingExample}
        <div class="flex justify-center" in:fade={{ duration: 300 }}>
          <div class="animate-pulse text-gray-500 flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
            <span>Loading example conversation...</span>
          </div>
        </div>
      {/if}
  
      {#if error}
        <div class="bg-red-100 text-red-700 p-3 rounded-lg">
          {error}
        </div>
      {/if}
    </div>
    <!-- Input form (hidden during example viewing) -->
    {#if !isViewingExample}
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
    {:else}
      <!-- Continue button for example viewing -->
      <div class="border-t p-4 bg-white flex-shrink-0">
        <div class="flex justify-end">
          {#if currentExampleIndex < totalExampleStates}
            <button
              on:click={continueExamplePlayback}
              class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 flex items-center space-x-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              <span>Continue</span>
            </button>
          {:else}
            <div class="text-sm text-gray-500 italic">
              Example completed
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Save as Example Modal -->
    {#if showExampleForm}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
        on:click={closeExampleForm}
        on:keydown={(e) => {
          if (e.key === 'Escape') {
            closeExampleForm();
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div 
          class="bg-white rounded-lg p-6 w-full max-w-md mx-4" 
          on:click|stopPropagation
          on:keydown|stopPropagation
          role="document"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 id="modal-title" class="text-lg font-semibold text-gray-900">Save as Example</h3>
            <button 
              on:click={closeExampleForm} 
              class="text-gray-400 hover:text-gray-600"
              aria-label="Close modal"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <form on:submit|preventDefault={saveAsExample} class="space-y-4">
            <div>
              <label for="example-title" class="block text-sm font-medium text-gray-700 mb-1">
                Title (optional)
              </label>
              <input
                id="example-title"
                type="text"
                bind:value={exampleForm.title}
                placeholder="e.g., Booking a ride to Target"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label for="example-description" class="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                id="example-description"
                bind:value={exampleForm.description}
                placeholder="What does this conversation demonstrate?"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              ></textarea>
            </div>
            
            <div>
              <label for="example-tags" class="block text-sm font-medium text-gray-700 mb-1">
                Tags (optional)
              </label>
              <input
                id="example-tags"
                type="text"
                bind:value={exampleForm.tags}
                placeholder="e.g., booking, ride, accessibility (comma-separated)"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p class="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                on:click={closeExampleForm}
                class="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingAsExample}
                class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {#if savingAsExample}
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                {:else}
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                  <span>Save Example</span>
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  </div>

  <style>
    .chat-messages {
      scroll-behavior: smooth;
    }
    
    @keyframes bounce {
      0%, 80%, 100% {
        transform: translateY(0);
      }
      40% {
        transform: translateY(-10px);
      }
    }
    
    .typing-cursor {
      display: inline-block;
      animation: blink 1s infinite;
      font-weight: bold;
      margin-left: 1px;
    }
    
    @keyframes blink {
      0%, 50% {
        opacity: 1;
      }
      51%, 100% {
        opacity: 0;
      }
    }
  </style>