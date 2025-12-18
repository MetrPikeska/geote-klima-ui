// === mcp-chat.js ===
// Chat interface for communicating with MCP PostgreSQL server

window.MCPChat = window.MCPChat || {};

MCPChat.init = function() {
  const chatContainer = document.getElementById('mcp-chat-container');
  if (!chatContainer) return;

  const messagesDiv = chatContainer.querySelector('.mcp-messages');
  const inputField = chatContainer.querySelector('.mcp-input');
  const sendBtn = chatContainer.querySelector('.mcp-send-btn');

  // Load chat history from localStorage
  loadChatHistory();

  sendBtn.addEventListener('click', () => {
    const message = inputField.value.trim();
    if (message) {
      sendMCPQuery(message);
      inputField.value = '';
      inputField.focus();
    }
  });

  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });

  async function sendMCPQuery(userMessage) {
    const messagesDiv = document.querySelector('.mcp-messages');
    
    // Add user message
    addMessage(userMessage, 'user');

    try {
      // Send to backend
      const response = await fetch('/api/mcp/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        addMessage(JSON.stringify(data.result, null, 2), 'assistant');
      } else {
        addMessage(`❌ Error: ${data.error}`, 'error');
      }
    } catch (error) {
      addMessage(`❌ Error: ${error.message}`, 'error');
    }
  }

  function addMessage(text, role) {
    const messagesDiv = document.querySelector('.mcp-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `mcp-message mcp-${role}`;
    
    // Highlight code blocks
    if (role === 'assistant' && text.startsWith('{')) {
      messageEl.innerHTML = `<pre><code>${escapeHtml(text)}</code></pre>`;
    } else {
      messageEl.textContent = text;
    }
    
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Save to localStorage
    saveChatHistory();
  }

  function loadChatHistory() {
    const history = localStorage.getItem('mcp-chat-history');
    if (history) {
      try {
        const messages = JSON.parse(history);
        messages.forEach(msg => {
          addMessage(msg.text, msg.role);
        });
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }

  function saveChatHistory() {
    const messages = [];
    document.querySelectorAll('.mcp-message').forEach(el => {
      const role = el.classList.contains('mcp-user') ? 'user' : 
                   el.classList.contains('mcp-assistant') ? 'assistant' : 'error';
      messages.push({
        role,
        text: el.textContent || el.innerText,
      });
    });
    localStorage.setItem('mcp-chat-history', JSON.stringify(messages));
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', MCPChat.init);
