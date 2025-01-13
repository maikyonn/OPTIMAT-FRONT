<script>
    import { onMount } from 'svelte';
  
    let messages = [];
    let userInput = '';
    let loading = false;
    let error = null;
    let serverOnline = false;
  
    async function checkServerHealth() {
      try {
        const response = await fetch('http://209.20.159.36:8001/health');
        serverOnline = response.ok;
      } catch (e) {
        serverOnline = false;
      }
    }
  
    // Check server status on mount and every 30 seconds
    onMount(() => {
      checkServerHealth();
      const interval = setInterval(checkServerHealth, 30000);
      return () => clearInterval(interval);
    });
  
    async function handleSubmit() {
      if (!userInput.trim() || !serverOnline) return;
  
      loading = true;
      error = null;
  
      // 1) Add the user’s new message to our local conversation
      messages = [
        ...messages,
        {
          role: 'human',
          content: userInput
        }
      ];
  
      try {
        // 2) Send **all** messages (which now includes the newest user message)
        const response = await fetch('http://209.20.159.36:8001/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // Pass the entire conversation (messages) — content is optional now
          body: JSON.stringify({
            messages: messages
          })
        });
  
        if (!response.ok) throw new Error('Failed to send message');
  
        const data = await response.json();
  
        // 3) The server returns ONLY new AI messages, so we append them directly
        messages = [...messages, ...data.messages];
      } catch (e) {
        error = e.message;
      } finally {
        loading = false;
        userInput = ''; // Clear input after sending
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
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      {#each messages as message}
        <div class="flex flex-col {message.role === 'human' ? 'items-end' : 'items-start'}">
          <div class="max-w-[80%] rounded-lg p-3 {
            message.role === 'human' 
              ? 'bg-indigo-600 text-white' 
              : message.role === 'system/other'
                ? 'bg-gray-200 text-gray-700 font-mono text-sm'
                : 'bg-gray-100 text-gray-900'
          }">
            <p class="whitespace-pre-wrap">{message.content}</p>
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
        <input
          type="text"
          bind:value={userInput}
          placeholder={serverOnline ? "Type your message..." : "Chat is currently unavailable"}
          class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"   
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