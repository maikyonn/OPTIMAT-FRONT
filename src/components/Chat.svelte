<script>
    import { onMount } from 'svelte';
    import { BACKEND_URL } from '../config';
  
    let messages = [];
    
    let userInput = "I'm disabled and trying to go from 1871 N Main St, Walnut Creek, CA 94596 to 1601 Ygnacio Valley Rd, Walnut Creek, CA 94598? CAn you help me find providers?";
    let loading = false;
    let error = null;
    let serverOnline = false;
    let conversationId = null;
  
    function generateConversationId() {
      return 'conv_' + Math.random().toString(36).substring(2, 15);
    }
  
    async function checkServerHealth() {
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/chat/health`);
        serverOnline = response.ok;
      } catch (e) {
        serverOnline = false;
      }
    }
  
    // Initialize conversation ID on mount
    onMount(() => {
      conversationId = generateConversationId();
      checkServerHealth();
      const interval = setInterval(checkServerHealth, 30000);
      return () => clearInterval(interval);
    });
  
    async function handleSubmit() {
      if (!userInput.trim() || !serverOnline) return;
  
      loading = true;
      error = null;
  
      const newMessage = {
        role: 'human',
        content: userInput
      };
  
      messages = [...messages, newMessage];
  
      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newMessage: newMessage,
            conversationId: conversationId
          })
        });
  
        if (!response.ok) throw new Error('Failed to send message');
  
        const { messages: responseMessages } = await response.json();
        
        // Add all messages from the response
        if (responseMessages) {
          messages = [...messages, ...responseMessages];
        }
      } catch (e) {
        error = e.message;
      } finally {
        loading = false;
        userInput = '';
      }
    }
  </script>
  
  <div class="flex flex-col h-[600px]">
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
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      {#each messages.filter(m => (m.role === 'ai' || m.role === 'human' || m.role === 'system') && typeof m.content === 'string') as message}
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
                <p class="whitespace-pre-wrap">Searched Providers</p>
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
      class="border-t p-4 bg-white"
    >
      <div class="flex space-x-4">
        <textarea
          bind:value={userInput}
          placeholder={serverOnline ? "Type your message..." : "Chat is currently unavailable"}
          class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 min-h-[100px] resize-y p-2"   
          disabled={loading || !serverOnline}
        />
        <button
          type="submit"
          disabled={loading || !serverOnline}
          class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  </div>