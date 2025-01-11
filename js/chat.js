/*******************************************************
 * chat.js - Hexacola.ai Chat Application
 * 
 * Fixes:
 * 1) "forEach of undefined" by returning arrays safely.
 * 2) "Cannot read properties of undefined (reading 'ok')"
 *    by adding checks in fetchWithRetry & fetchAIResponse.
 * 3) 404 for "hexacola-chat.png" is just a missing file
 *    (place the file or remove the reference in HTML).
 *******************************************************/

/*******************************************************
 * Chat History and Response Caching
 *******************************************************/
let chatHistory = [];
const responseCache = {};

/*******************************************************
 * API Configuration
 *******************************************************/
const API_CONFIG = {
  baseUrl: 'https://text.pollinations.ai/', // Ensure this is correct or point to your chosen AI endpoint
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
  retryDelay: 1000, // Base delay between retries
  maxRetries: 3,
  errorMessages: {
    400: 'Invalid request. Please check your input.',
    401: 'Authentication failed. Please check your credentials.',
    403: 'Access forbidden. Please check your permissions.',
    404: 'API endpoint not found. Please check the URL.',
    429: 'Too many requests. Please wait a moment.',
    500: 'Server error. Please try again later.',
    503: 'Service unavailable. Please try again later.',
    TIMEOUT: 'Request timed out. Please check your connection.',
    NETWORK: 'Network error. Please check your internet connection.',
    default: 'Something went wrong. Please try again.'
  }
};

/*******************************************************
 * Base Prompt Generator
 *******************************************************/
function generateBasePrompt() {
    return `
YOU ARE HEXACOLA.AI — AN ADVANCED, ARTISTIC, AND KNOWLEDGEABLE AI WITH PERFECT MEMORY RECALL.
YOUR CORE TRAITS:
- Artistic and creative
- Highly knowledgeable across many fields
- Memory-focused with perfect recall of conversations
- Friendly but professional teaching style
- Detail-oriented and thorough

MEMORY AND CONTEXT RULES:
1. Always maintain context from our conversation history
2. Remember and use personal details shared by the user:
   - Their name: ${window.aiMemoryManager?.personalInfo?.name || 'not yet shared'}
   - Their occupation: ${window.aiMemoryManager?.personalInfo?.occupation || 'not yet shared'}
   - Their interests: ${window.aiMemoryManager?.interests?.topics?.join(', ') || 'still learning'}
   - Their communication style: ${window.aiMemoryManager?.personality?.traits?.join(', ') || 'observing'}

FOLLOW THESE RULES IN EVERY RESPONSE:

1. **SIMPLE LANGUAGE:**
   - Always use simple terms and explanations as if the person you’re talking to is a student who is eager to learn.
   - Avoid overly technical jargon unless explicitly requested, and explain it clearly if used.

2. **EXPLANATORY APPROACH:**
   - Always break down complex topics into smaller, easy-to-understand pieces.
   - Use examples, analogies, and step-by-step explanations to make concepts clear.

3. **FRIENDLY AND ENCOURAGING TONE:**
   - Respond in a friendly, approachable way that encourages learning and curiosity.
   - Avoid being overly formal; aim to sound like a knowledgeable and helpful teacher.

4. **STUDENT-CENTERED FOCUS:**
   - Tailor your responses to the student’s level of understanding.
   - Check for potential gaps in their knowledge and fill them with explanations and context.

5. **CLEAR STRUCTURE:**
   - Use bullet points, numbered lists, or sections where necessary to organize information.
   - Ensure instructions are precise, with clear steps to follow.

6. **HONEST AND ACCURATE INFORMATION:**
   - Only provide accurate and factual information. If unsure, clarify and offer to research further.

7. **PRACTICAL EXAMPLES:**
   - Provide real-world applications or coding examples when explaining concepts.
   - Ensure examples are concise, well-commented, and easy to understand.

8. **PERSONALIZED INTERACTIONS:**
   - Adapt responses to the user’s specific needs, interests, and preferred learning style.

9. **LEARNING ENCOURAGEMENT:**
   - End responses with suggestions for further exploration, study, or related topics to inspire continued learning.

10. **CODE-FRIENDLY:**
    - When discussing coding, clearly explain what each line or section of code does.
    - Use comments in code examples to clarify functionality step-by-step.

11. **DOUBLE-CHECK AND ENHANCE:**
    - Always double-check responses for accuracy, clarity, and completeness before presenting them.
    - Automatically enhance responses to ensure they are the best possible version, both in content and delivery.

12. **CREATIVE AND BASIC KNOWLEDGE:**
    - Demonstrate expertise in creative fields like movies, art, music, and storytelling, while also being capable of explaining basic, foundational concepts clearly.
    - Balance artistic and practical knowledge to provide well-rounded responses.

13. **YOU HAVE A BRAIN MEMORIES OF A USER INTEGRATED IN A CODE BASED ON THAT:**
    - Leverage advanced reasoning and problem-solving capabilities to analyze, understand, and respond intelligently.
    - Think critically and adaptively, ensuring thoughtful and well-informed answers.

EXAMPLES OF YOUR RESPONSES:
- If explaining HTML: "Think of HTML as the skeleton of a webpage. It gives structure to the content. For example: <h1>...</h1> means a big headline on the page."
- If discussing loops in JavaScript: "A loop is like a robot doing the same task again and again until you tell it to stop. For example: \n\nfor (let i = 0; i < 5; i++) {\n   console.log(i); // This prints 0, 1, 2, 3, 4\n}"

Your goal is to help the user understand and learn while keeping things simple and engaging.`;
}

// Replace the basePrompt constant with a getter
const getBasePrompt = () => generateBasePrompt();

/*******************************************************
 * composePrompt(userMessage):
 * Merges the basePrompt + chatHistory + the new user
 * message into one final messages array.
 *******************************************************/
async function composePrompt(userMessage) {
  const analysis = analyzeMessage(userMessage);
  const context = chatHistoryManager.getRecentContext();
  const previousExchange = chatHistoryManager.getPreviousExchange();
  
  let systemPrompt = getBasePrompt(); // Use the getter instead of constant
  
  // Add context awareness
  if (analysis.context === 'improve_previous' && previousExchange) {
    systemPrompt += `\nThe user wants to improve this previous text: "${previousExchange.assistantResponse}"\nPlease provide an enhanced version with better grammar, clarity, and style.`;
  }

  // Add grammar check instruction
  if (analysis.isGrammarCheck) {
    systemPrompt += '\nPlease check grammar and suggest improvements. Point out specific issues and provide corrections.';
  }

  // Add specific instruction based on message complexity
  if (analysis.complexity === 'complex') {
    systemPrompt += '\nThis is a detailed request. Please break down your response into clear sections.';
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.messages.slice(-CONTEXT_WINDOW_SIZE), // Include recent messages
    { role: 'user', content: userMessage }
  ];

  return messages;
}

/*******************************************************
 * Chat Logic & Reasoning Data
 *******************************************************/
const reasoningData = {
  currentStep: null,
  results: {},
  errors: [],
  isIncomplete: false,
  lastMessageId: null,
  currentMessage: '',
  messageContext: null,
  currentReason: null,
  lastImprovement: null,
  improvementCount: 0,
  grammarIssues: [],
  contextualHints: [],
  thinkingSteps: []
};

/*******************************************************
 * fetchWithRetry
 * 
 * Ensures we handle server or network failures gracefully.
 *******************************************************/
async function fetchWithRetry(url, options, maxRetries = API_CONFIG.maxRetries, delayMs = API_CONFIG.retryDelay) {
  let lastError;
  
  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      // Clear timeout if fetch completes
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorMessage = API_CONFIG.errorMessages[response.status] || API_CONFIG.errorMessages.default;
        lastError = new Error(errorMessage);
        
        // Don't retry client errors except 429
        if (response.status !== 429 && response.status < 500) {
          break;
        }
        
        // Exponential backoff for retries
        await new Promise(res => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
        continue;
      }

      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle specific error types
      if (error.name === 'AbortError') {
        throw new Error(API_CONFIG.errorMessages.TIMEOUT);
      }
      
      lastError = new Error(
        error.message === 'Failed to fetch' 
          ? API_CONFIG.errorMessages.NETWORK 
          : error.message
      );

      if (attempt === maxRetries) break;
      
      // Exponential backoff for retries
      await new Promise(res => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
    }
  }

  // If we exhausted all attempts, throw lastError
  throw lastError;
}

/*******************************************************
 * fetchAIResponse(messages)
 * 
 * Takes the final messages array (basePrompt + history
 * + user message) and calls our AI endpoint.
 *******************************************************/
async function fetchAIResponse(messages) {
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Invalid messages format');
  }

  try {
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect ? modelSelect.value : 'default';

    const response = await fetchWithRetry(API_CONFIG.baseUrl, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({
        messages: messages,
        model: selectedModel
      })
    });

    // Parse response
    let textData;
    try {
      textData = await response.text();
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    if (!textData) {
      throw new Error('Empty response from AI service');
    }

    return textData;

  } catch (error) {
    console.error('Error in fetchAIResponse:', error);
    
    // Convert error to user-friendly message
    const errorMessage = error.message.includes('Failed to fetch')
      ? 'Unable to reach AI service. Please check your connection.'
      : error.message;
    
    throw new Error(errorMessage);
  }
}

/*******************************************************
 * sendMessage - Main function for user input
 *******************************************************/
async function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (!message) return;

  try {
    chatInput.value = '';
    const analysis = analyzeMessage(message);
    const context = chatHistoryManager.getRecentContext();
    
    // Show appropriate thinking animation
    if (analysis.context === 'improve_previous') {
      showThinkingSteps('Improving previous response...');
    } else if (analysis.isGrammarCheck) {
      showThinkingSteps('Checking grammar and style...');
    } else {
      showThinkingSteps(context.summary?.lastUserQuery ? 'Continuing conversation...' : 'Starting new conversation...');
    }

    updateChatHistory('user', message);
    appendMessage('user', message);

    const finalPrompt = await composePrompt(message);
    let response = await fetchAIResponse(finalPrompt);

    // Enhance response with personal context
    response = aiMemoryManager.enhanceResponse(response);

    // Track improvements
    if (analysis.isImprovement) {
      reasoningData.lastImprovement = response;
      reasoningData.improvementCount++;
    }

    removeThinkingProcess();
    updateChatHistory('assistant', response);
    appendMessage('assistant', response);

    // Save memory and context
    aiMemoryManager.saveMemory(message, response);
    localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(chatHistoryManager.getRecentContext()));

  } catch (error) {
    console.error('Error:', error);
    removeThinkingProcess();
    appendMessage('assistant', `Error: ${error.message}`);
  }
}

/*******************************************************
 * Helper: Show "thinking" steps
 *******************************************************/
async function showThinkingSteps(contextMessage = 'Processing request...') {
  const thinkingContainer = document.createElement('div');
  thinkingContainer.className = 'thinking-container';
  
  const thinkingIcon = document.createElement('div');
  thinkingIcon.className = 'thinking-icon';
  
  // Add thinking dots
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'thinking-dot';
    thinkingIcon.appendChild(dot);
  }
  
  const thinkingText = document.createElement('div');
  thinkingText.className = 'thinking-text';
  
  const thinkingStatus = document.createElement('span');
  thinkingStatus.textContent = 'Hexacola is thinking';
  
  const messageText = document.createElement('span');
  messageText.textContent = contextMessage;
  
  thinkingText.appendChild(thinkingStatus);
  thinkingText.appendChild(messageText);
  
  thinkingContainer.appendChild(thinkingIcon);
  thinkingContainer.appendChild(thinkingText);
  
  const chat = document.getElementById('chat');
  chat.appendChild(thinkingContainer);
  
  // Update thinking status periodically
  const thinkingStates = [
    'Analyzing input',
    'Processing context',
    'Checking references',
    'Formulating response',
    'Reviewing answer'
  ];
  
  let stateIndex = 0;
  const statusInterval = setInterval(() => {
    thinkingStatus.textContent = thinkingStates[stateIndex % thinkingStates.length];
    stateIndex++;
  }, 2000);
  
  // Store the interval ID for cleanup
  thinkingContainer.dataset.intervalId = statusInterval;
  
  chat.scrollTop = chat.scrollHeight;
  return thinkingContainer;
}

/*******************************************************
 * removeThinkingProcess
 *******************************************************/
function removeThinkingProcess() {
  const thinkingContainer = document.querySelector('.thinking-container');
  if (thinkingContainer) {
    // Clear the status update interval
    clearInterval(thinkingContainer.dataset.intervalId);
    
    // Add removing animation
    thinkingContainer.style.opacity = '0';
    thinkingContainer.style.transform = 'translateY(-10px)';
    
    // Remove after animation
    setTimeout(() => thinkingContainer.remove(), 300);
  }
}

/*******************************************************
 * appendMessage - Display a message in the chat area
 *******************************************************/
function appendMessage(role, content) {
  const chat = document.getElementById('chat');
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chat-message', role);

  // Generate a unique ID
  const messageId = Date.now().toString();
  messageDiv.setAttribute('data-message-id', messageId);

  if (role === 'assistant') {
    reasoningData.currentMessage = content;
    reasoningData.messageContext = { messageId, timestamp: Date.now() };
  }

  const formattedContent = formatMessage(content);
  messageDiv.innerHTML = formattedContent;
  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight;

  // Check if response might be incomplete
  if (role === 'assistant' && (content.endsWith('...') || content.length >= 500)) {
    reasoningData.isIncomplete = true;
    reasoningData.lastMessageId = messageId;
    appendContinueButton(messageDiv);
  }

  // Syntax highlighting
  if (typeof Prism !== 'undefined') {
    Prism.highlightAllUnder(messageDiv);
  }
}

/*******************************************************
 * formatMessage - Basic Markdown + Sanitization
 *******************************************************/
function formatMessage(content) {
  // We'll do a minimal version here
  if (!content) return '';

  // If DOMPurify is available
  if (typeof DOMPurify !== 'undefined') {
    content = DOMPurify.sanitize(content);
  }

  // Convert markdown-like syntax to HTML
  // e.g. **bold** => <strong>bold</strong>, etc.
  content = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const languageClass = lang ? `language-${lang}` : '';
      return `<pre><code class="${languageClass}">${escapeHtml(code)}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  return content;
}

/*******************************************************
 * escapeHtml
 *******************************************************/
function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/*******************************************************
 * Continue Button (in case of truncated assistant messages)
 *******************************************************/
function appendContinueButton(messageDiv) {
  const continueButton = document.createElement('button');
  continueButton.classList.add('continue-button');
  continueButton.innerHTML = 'Continue Response';
  continueButton.onclick = continueResponse;
  messageDiv.appendChild(continueButton);
}

async function continueResponse() {
  const lastMessage = document.querySelector(`[data-message-id="${reasoningData.lastMessageId}"]`);
  if (!lastMessage) return;
  const continueButton = lastMessage.querySelector('.continue-button');
  if (continueButton) continueButton.remove();

  try {
    const continuationContext = {
      previousContent: reasoningData.currentMessage,
      lastContext: reasoningData.messageContext
    };

    showThinkingSteps();

    // We'll just do a naive approach: "Continue from previous" system message
    const finalPrompt = await composePrompt('continue from previous response');
    const data = await fetchAIResponse(finalPrompt);

    removeThinkingProcess();

    reasoningData.currentMessage += data;
    lastMessage.innerHTML = formatMessage(reasoningData.currentMessage);

    if (data.endsWith('...') || data.length >= 500) {
      appendContinueButton(lastMessage);
    } else {
      reasoningData.isIncomplete = false;
      reasoningData.lastMessageId = null;
      reasoningData.currentMessage = '';
      reasoningData.messageContext = null;
    }
  } catch (error) {
    console.error('Error continuing response:', error);
    removeThinkingProcess();
    appendMessage('assistant', `Error continuing response: ${error.message}`);
  }
}

/*******************************************************
 * Chat History Manager
 *******************************************************/
const chatHistoryManager = {
  history: [],
  metadata: {
    firstInteraction: null,
    lastInteraction: null,
    commonTopics: new Set(),
    userPreferences: new Map()
  },

  lastImprovedText: null,
  improvementCount: 0,

  addMessage(role, content) {
    const timestamp = Date.now();
    const topics = this.extractTopics(content);  // ensures array

    const message = {
      role,
      content,
      timestamp,
      topics
    };

    // Track first/last interactions
    if (!this.metadata.firstInteraction) {
      this.metadata.firstInteraction = message;
    }
    this.metadata.lastInteraction = message;

    // Safely loop over topics (which is an array now)
    topics.forEach(topic => this.metadata.commonTopics.add(topic));

    this.history.push(message);
    this.save();
    return message;
  },

  extractTopics(content) {
    // Always returns an array
    if (!content || typeof content !== 'string') return [];
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    return [...new Set(words)];
  },

  getConversationContext() {
    return {
      firstMessage: this.metadata.firstInteraction,
      lastMessage: this.metadata.lastInteraction,
      commonTopics: Array.from(this.metadata.commonTopics),
      messageCount: this.history.length,
      recentMessages: this.history.slice(-3),
      preferences: Object.fromEntries(this.metadata.userPreferences)
    };
  },

  getFirstMessage() {
    return this.metadata.firstInteraction || null;
  },

  getConversationSummary() {
    return {
      firstMessage: this.getFirstMessage(),
      totalMessages: this.history.length,
      commonTopics: Array.from(this.metadata.commonTopics).slice(0, 5),
      duration: this.metadata.lastInteraction 
                ? (Date.now() - this.metadata.firstInteraction.timestamp)
                : 0
    };
  },

  load() {
    try {
      const savedHistory = localStorage.getItem('chatHistory');
      const savedMetadata = localStorage.getItem('chatMetadata');
      if (savedHistory) {
        this.history = JSON.parse(savedHistory).map(msg => ({
          ...msg,
          timestamp: msg.timestamp || Date.now()
        }));
      }
      if (savedMetadata) {
        const meta = JSON.parse(savedMetadata);
        this.metadata = {
          firstInteraction: meta.firstInteraction,
          lastInteraction: meta.lastInteraction,
          commonTopics: new Set(meta.commonTopics),
          userPreferences: new Map(Object.entries(meta.userPreferences || {}))
        };
      }
      if (this.history.length > 0 && !this.metadata.firstInteraction) {
        this.metadata.firstInteraction = this.history[0];
        this.metadata.lastInteraction = this.history[this.history.length - 1];
        this.save();
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      this.clear();
    }
  },

  save() {
    try {
      localStorage.setItem('chatHistory', JSON.stringify(this.history));
      localStorage.setItem('chatMetadata', JSON.stringify({
        firstInteraction: this.metadata.firstInteraction,
        lastInteraction: this.metadata.lastInteraction,
        commonTopics: Array.from(this.metadata.commonTopics),
        userPreferences: Object.fromEntries(this.metadata.userPreferences)
      }));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  },

  clear() {
    this.history = [];
    this.metadata = {
      firstInteraction: null,
      lastInteraction: null,
      commonTopics: new Set(),
      userPreferences: new Map()
    };
    localStorage.removeItem('chatHistory');
    localStorage.removeItem('chatMetadata');
  },

  // Add new methods for context management
  getRecentContext() {
    const recentMessages = this.history.slice(-CONTEXT_WINDOW_SIZE);
    return {
      messages: recentMessages,
      summary: this.summarizeContext(recentMessages),
      totalMessages: this.history.length
    };
  },

  summarizeContext(messages) {
    if (!messages.length) return null;
    
    const lastUserMessage = messages
      .filter(msg => msg.role === 'user')
      .pop();
      
    const lastAssistantMessage = messages
      .filter(msg => msg.role === 'assistant')
      .pop();

    return {
      lastUserQuery: lastUserMessage?.content || null,
      lastResponse: lastAssistantMessage?.content || null,
      messageCount: messages.length,
      timestamp: Date.now()
    };
  },

  getPreviousExchange() {
    const history = this.history;
    if (history.length < 2) return null;

    // Get the last user-assistant exchange
    const lastMessages = history.slice(-2);
    if (lastMessages[0].role === 'user' && lastMessages[1].role === 'assistant') {
      return {
        userMessage: lastMessages[0].content,
        assistantResponse: lastMessages[1].content
      };
    }
    return null;
  },

  checkForImprovement(message) {
    const isImproveRequest = IMPROVEMENT_TRIGGERS.some(trigger => 
      message.toLowerCase().includes(trigger)
    );
    
    if (isImproveRequest && message.split(' ').length > 3) {
      this.lastImprovedText = message;
      this.improvementCount++;
      return true;
    }
    return false;
  }
};

/*******************************************************
 * chatHistory Access Helpers
 *******************************************************/
function updateChatHistory(role, content) {
  return chatHistoryManager.addMessage(role, content);
}

function loadChatHistory() {
  chatHistoryManager.load();
  if (chatHistoryManager.history.length > 0) {
    chatHistoryManager.history.forEach(msg => appendMessage(msg.role, msg.content));
  } else {
    appendMessage('assistant', 'Hello! I’m Hexacola.ai, your friendly Artist GPT. How can I help you today?');
  }
}

function clearChat() {
  chatHistoryManager.clear();
  const chat = document.getElementById('chat');
  if (chat) chat.innerHTML = '';
  const welcomeMessage = 'Chat history cleared. Let’s start fresh!';
  updateChatHistory('assistant', welcomeMessage);
  appendMessage('assistant', welcomeMessage);
}

/*******************************************************
 * Dark Mode Toggling
 *******************************************************/
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const darkBtn = document.querySelector('.dark-mode-toggle');
  if (document.body.classList.contains('dark-mode')) {
    darkBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
    darkBtn.setAttribute('aria-label', 'Light Mode');
  } else {
    darkBtn.innerHTML = '<i class="fas fa-moon"></i> 🌙';
    darkBtn.setAttribute('aria-label', 'Dark Mode');
  }
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function loadDarkMode() {
  // Check localStorage first
  const darkMode = localStorage.getItem('darkMode') === 'true';
  // Check system preference as fallback
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (darkMode || prefersDark) {
    document.body.classList.add('dark-mode');
    const darkBtn = document.querySelector('.dark-mode-toggle');
    if (darkBtn) {
      darkBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
      darkBtn.setAttribute('aria-label', 'Light Mode');
    }
  }
}

/*******************************************************
 * Button Click Handlers
 *******************************************************/
function handleSendMessageClick() {
  sendMessage();
}

function handleOpenCodeModalClick() {
  const codeSample = "console.log('Hello, World!');";
  openCodeModal(codeSample, "javascript");
}

function handleCloseCodeModalClick() {
  closeCodeModal();
}

function handleButtonClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.getAttribute('onclick');
  if (action) {
    event.preventDefault();
    const functionName = action.replace('()', '');
    if (typeof window[functionName] === 'function') {
      window[functionName]();
    }
  }
}

/*******************************************************
 * chatApp - Main controller
 *******************************************************/
const chatApp = {
  state: { thinking: false, lastMessageId: null },
  init() {
    // Initialize AI Memory Manager first
    window.aiMemoryManager = new AIMemoryManager();
    
    // Load dark mode before other components
    loadDarkMode();
    
    // Add dark mode toggle listener
    const darkModeBtn = document.querySelector('.dark-mode-toggle');
    if (darkModeBtn) {
      darkModeBtn.addEventListener('click', toggleDarkMode);
    }
    
    // Then load other components
    loadChatHistory();

    document.addEventListener('click', handleButtonClick);

    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendMessageBtn');
    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
    }

    const clearButton = document.getElementById('clearChat');
    if (clearButton) {
      clearButton.addEventListener('click', clearChat);
    }

    // If you have a code modal
    window.onclick = function(event) {
      const modal = document.getElementById('codeModal');
      if (event.target === modal) {
        closeCodeModal();
      }
    };

    // Ensure DOMPurify is loaded if you want sanitization
    if (typeof DOMPurify === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/2.3.3/purify.min.js';
      document.head.appendChild(script);
    }

    // Load saved context
    const savedContext = localStorage.getItem(MESSAGE_HISTORY_KEY);
    if (savedContext) {
      try {
        const context = JSON.parse(savedContext);
        if (context.messages) {
          context.messages.forEach(msg => {
            appendMessage(msg.role, msg.content);
            chatHistoryManager.addMessage(msg.role, msg.content);
          });
        }
      } catch (error) {
        console.error('Error loading chat context:', error);
      }
    }
  }
};

/*******************************************************
 * On DOMContentLoaded
 *******************************************************/
document.addEventListener('DOMContentLoaded', () => {
  chatApp.init();
});

/* ...existing code... */

// Add these constants near the top of the file
const CONTEXT_WINDOW_SIZE = 10; // Number of previous messages to keep for context
const MESSAGE_HISTORY_KEY = 'chatMessageHistory';
const IMPROVEMENT_TRIGGERS = ['improve', 'enhance', 'better', 'fix', 'correct', 'grammar'];

/* ...rest of existing code... */

// Add new constants for reasoning
const REASONING_STEPS = {
  ANALYZE: 'analyzing',
  CONTEXT: 'context',
  GRAMMAR: 'grammar',
  IMPROVE: 'improve',
  RESPOND: 'respond'
};

const THINKING_MESSAGES = {
  [REASONING_STEPS.ANALYZE]: 'Analyzing your message...',
  [REASONING_STEPS.CONTEXT]: 'Understanding context...',
  [REASONING_STEPS.GRAMMAR]: 'Checking grammar and style...',
  [REASONING_STEPS.IMPROVE]: 'Considering improvements...',
  [REASONING_STEPS.RESPOND]: 'Preparing response...'
};

// Enhanced message analysis
function analyzeMessage(message) {
  const analysis = {
    isImprovement: message.toLowerCase().includes('improve') || message.toLowerCase().includes('better'),
    isGrammarCheck: message.toLowerCase().includes('grammar') || message.toLowerCase().includes('correct'),
    hasQuestion: message.includes('?'),
    wordCount: message.split(' ').length,
    complexity: message.length > 100 ? 'complex' : 'simple',
    context: null
  };

  // Check if it's an improvement request for previous message
  if (analysis.isImprovement && message.split(' ').length <= 3) {
    analysis.context = 'improve_previous';
  }

  return analysis;
}

/* ...existing code... */

// Add these constants at the top with other constants
const MEMORY_STORAGE_KEY = 'hexacola_memory';
const MAX_MEMORIES = 50;
const PARTICLE_COUNT = 30;

// Add these constants at the top
const PERSONAL_INFO_KEY = 'hexacola_personal_info';
const PERSONALITY_TRAITS_KEY = 'hexacola_personality';
const INTERESTS_KEY = 'hexacola_interests';
const CONVERSATION_PATTERNS_KEY = 'hexacola_patterns';

class AIMemoryManager {
    constructor() {
        // Initialize basic properties
        this.memories = [];
        this.personalInfo = {};
        this.personality = {};
        this.interests = {};
        this.patterns = {};
        this.particles = [];
        this.modal = document.getElementById('brainMemoryModal');
        this.isModalOpen = false;
        this.animationFrameId = null;

        // Load data from storage
        this.loadMemories();
        this.personalInfo = this.loadPersonalInfo();
        this.personality = this.loadPersonalityTraits();
        this.interests = this.loadInterests();
        this.patterns = this.loadConversationPatterns();

        // Setup UI and interactions
        this.initializeParticles();
        this.setupEventListeners();
        this.setupKeyboardListener();
        this.initializeMemoryStorage();
        this.setupClearMemoriesButton();
    }

    setupEventListeners() {
        // Setup brain button click handler
        const brainBtn = document.getElementById('brainMemoryBtn');
        if (brainBtn) {
            brainBtn.addEventListener('click', () => {
                this.openModal();
                this.updateMemoryDisplay(); // Add this line to ensure display updates
            });
        }

        // Setup modal close button
        const closeBtn = document.querySelector('.close-brain-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Close modal when clicking outside
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }
    }

    loadMemories() {
        try {
            const savedMemories = localStorage.getItem(MEMORY_STORAGE_KEY);
            if (savedMemories) {
                this.memories = JSON.parse(savedMemories);
            }
        } catch (error) {
            console.error('Error loading memories:', error);
            this.memories = [];
        }
        return this.memories;
    }

    loadPersonalInfo() {
        return JSON.parse(localStorage.getItem(PERSONAL_INFO_KEY)) || {
            name: null,
            occupation: null,
            location: null
        };
    }

    loadPersonalityTraits() {
        return JSON.parse(localStorage.getItem(PERSONALITY_TRAITS_KEY)) || {
            traits: [],
            communicationStyle: null,
            emotionalResponses: [],
            preferences: {}
        };
    }

    loadInterests() {
        return JSON.parse(localStorage.getItem(INTERESTS_KEY)) || {
            hobbies: [],
            topics: [],
            dislikes: [],
            favorites: {}
        };
    }

    loadConversationPatterns() {
        return JSON.parse(localStorage.getItem(CONVERSATION_PATTERNS_KEY)) || {
            frequentTopics: {},
            responsePreferences: {},
            timePatterns: {}
        };
    }

    savePersonalInfo(key, value) {
        this.personalInfo[key] = value;
        this.personalInfo.lastInteraction = Date.now();
        localStorage.setItem(PERSONAL_INFO_KEY, JSON.stringify(this.personalInfo));
    }

    updatePersonality(trait) {
        if (!this.personality.traits.includes(trait)) {
            this.personality.traits.push(trait);
            localStorage.setItem(PERSONALITY_TRAITS_KEY, JSON.stringify(this.personality));
        }
    }

    addInterest(category, item) {
        if (!this.interests[category].includes(item)) {
            this.interests[category].push(item);
            localStorage.setItem(INTERESTS_KEY, JSON.stringify(this.interests));
        }
    }

    analyzeMessage(message) {
        // Name detection
        const nameMatch = message.match(/(?:my name is|I am|I'm) ([A-Z][a-z]+)/i);
        if (nameMatch) {
            this.savePersonalInfo('name', nameMatch[1]);
        }

        // Occupation detection
        const occupationMatch = message.match(/(?:I work as|I am a|I'm a) ([^.,!?]+)/i);
        if (occupationMatch) {
            this.savePersonalInfo('occupation', occupationMatch[1].trim());
        }

        // Interest detection
        const interestMatch = message.match(/(?:I (?:like|love|enjoy) ([^.,!?]+))/i);
        if (interestMatch) {
            this.addInterest('topics', interestMatch[1].trim());
        }

        // Hobby detection
        const hobbyMatch = message.match(/(?:My hobby is|I do) ([^.,!?]+)/i);
        if (hobbyMatch) {
            this.addInterest('hobbies', hobbyMatch[1].trim());
        }

        // Personality trait detection
        const traits = ['friendly', 'quiet', 'outgoing', 'creative', 'analytical'];
        traits.forEach(trait => {
            if (message.toLowerCase().includes(`i am ${trait}`) || 
                message.toLowerCase().includes(`i'm ${trait}`)) {
                this.updatePersonality(trait);
            }
        });
    }

    enhanceResponse(response) {
        let enhanced = response;
        
        // Add personal greeting if name is known
        if (this.personalInfo.name && response.includes('Hello!')) {
            enhanced = response.replace('Hello!', `Hello ${this.personalInfo.name}!`);
        }

        // Add context based on known information
        if (this.personalInfo.occupation) {
            enhanced = enhanced.replace(
                /\b(work|job|career)\b/i,
                `${this.personalInfo.occupation}`
            );
        }

        // Include known interests in relevant responses
        if (this.interests.hobbies.length > 0 && response.includes('hobby')) {  // Fixed syntax error here
            enhanced += ` I remember you enjoy ${this.interests.hobbies.join(', ')}.`;
        }

        // Personalize based on personality traits
        if (this.personality.traits.length > 0) {
            const trait = this.personality.traits[0];
            if (response.includes('approach') || response.includes('perspective')) {
                enhanced += ` Given your ${trait} nature, you might particularly appreciate this.`;
            }
        }

        return enhanced;
    }

    saveMemory(message, response) {
        // Analyze the message for personal information
        this.analyzeMessage(message);

        const memory = {
            timestamp: Date.now(),
            message,
            response,
            context: this.extractContext(message),
            personalInfo: {...this.personalInfo},
            interests: [...this.interests.topics]
        };

        this.memories.unshift(memory);
        if (this.memories.length > MAX_MEMORIES) {
            this.memories.pop();
        }

        localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(this.memories));
        
        // Update conversation patterns
        this.updateConversationPatterns(message);
        
        if (this.isModalOpen) {
            this.updateMemoryDisplay();
        }

        // After saving the memory, update storage
        this.saveMemoryState();
    }

    updateConversationPatterns(message) {
        const topics = this.extractTopics(message);
        topics.forEach(topic => {
            this.patterns.frequentTopics[topic] = (this.patterns.frequentTopics[topic] || 0) + 1;
        });
        
        const hour = new Date().getHours();
        this.patterns.timePatterns[hour] = (this.patterns.timePatterns[hour] || 0) + 1;
        
        localStorage.setItem(CONVERSATION_PATTERNS_KEY, JSON.stringify(this.patterns));
    }

    /* ...existing AIMemoryManager methods... */

    updateMemoryDisplay() {
        const memoryList = document.querySelector('.memory-list');
        if (!memoryList) return;

        const personalInfoHtml = `
            <div class="memory-section personal-info">
                <h4>Personal Information</h4>
                <p>Name: ${this.personalInfo.name || 'Unknown'}</p>
                <p>Occupation: ${this.personalInfo.occupation || 'Unknown'}</p>
                <h4>Interests</h4>
                <p>Hobbies: ${this.interests.hobbies.join(', ') || 'None recorded'}</p>
                <p>Topics: ${this.interests.topics.join(', ') || 'None recorded'}</p>
                <h4>Personality Traits</h4>
                <p>${this.personality.traits.join(', ') || 'Still learning about you'}</p>
            </div>
            <div class="memory-divider"></div>
        `;

        const memoriesHtml = this.memories
            .map(memory => `
                <div class="memory-item">
                    <strong>${new Date(memory.timestamp).toLocaleString()}</strong>
                    <p>${memory.message}</p>
                </div>
            `)
            .join('');

        // Add clear memories button
        const clearButton = `
            <div class="memory-controls">
                <button class="clear-memories-btn" onclick="aiMemoryManager.clearMemories()">
                    <i class="fas fa-trash"></i> Clear All Memories
                </button>
            </div>
        `;

        const html = clearButton + personalInfoHtml + memoriesHtml;
        memoryList.innerHTML = html;

        /* ...rest of existing updateMemoryDisplay code... */
    }

    initializeParticles() {
        const container = document.querySelector('.particles-container');
        if (!container) return;

        // Clear existing particles
        container.innerHTML = '';

        // Add neural connections
        for (let i = 0; i < 5; i++) {
            const connection = document.createElement('div');
            connection.className = 'neural-connection';
            connection.style.top = `${Math.random() * 100}%`;
            connection.style.animationDelay = `${Math.random() * 2}s`;
            container.appendChild(connection);
        }

        // Initialize particles with more variety
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            this.particles.push({
                x: Math.random() * container.offsetWidth,
                y: Math.random() * container.offsetHeight,
                size: Math.random() * 4 + 1,
                speedX: (Math.random() - 0.5) * 3,
                speedY: (Math.random() - 0.5) * 3,
                opacity: Math.random() * 0.5 + 0.3,
                hue: Math.random() * 60 + 60 // Green to yellow hues
            });
        }
    }

    animateParticles() {
        const container = document.querySelector('.particles-container');
        if (!container || !this.isModalOpen) return;

        // Keep neural connections, only clear particles
        const connections = container.querySelectorAll('.neural-connection');
        container.innerHTML = '';
        connections.forEach(conn => container.appendChild(conn));

        this.particles.forEach(particle => {
            // Update position with boundary checking
            particle.x += particle.speedX;
            particle.y += particle.speedY;

            // Bounce off walls with slight randomization
            if (particle.x < 0 || particle.x > container.offsetWidth) {
                particle.speedX *= -1.1;
                particle.speedX += (Math.random() - 0.5) * 0.5;
            }
            if (particle.y < 0 || particle.y > container.offsetHeight) {
                particle.speedY *= -1.1;
                particle.speedY += (Math.random() - 0.5) * 0.5;
            }

            // Keep speeds in check
            particle.speedX = Math.max(Math.min(particle.speedX, 3), -3);
            particle.speedY = Math.max(Math.min(particle.speedY, 3), -3);

            // Create particle element with dynamic color
            const dot = document.createElement('div');
            dot.className = 'particle';
            dot.style.left = `${particle.x}px`;
            dot.style.top = `${particle.y}px`;
            dot.style.width = `${particle.size}px`;
            dot.style.height = `${particle.size}px`;
            dot.style.opacity = particle.opacity;
            dot.style.backgroundColor = `hsla(${particle.hue}, 70%, 50%, ${particle.opacity})`;
            container.appendChild(dot);
        });

        this.animationFrameId = requestAnimationFrame(() => this.animateParticles());
    }

    setupKeyboardListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalOpen) {
                this.closeModal();
            }
        });
    }

    openModal() {
        if (!this.modal) return;
        
        this.isModalOpen = true;
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        this.updateMemoryDisplay(); // Refresh display when opening
        this.animateParticles();
        
        // Pulse animation for brain button
        const brainBtn = document.querySelector('.brain-button');
        if (brainBtn) {
            brainBtn.classList.add('pulse');
        }
    }

    closeModal() {
        if (!this.modal) return;
        
        this.isModalOpen = false;
        this.modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
        
        // Cleanup animations
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        const brainBtn = document.querySelector('.brain-button');
        if (brainBtn) {
            brainBtn.classList.remove('pulse');
        }
    }

    updateMemoryDisplay() {
        const memoryList = document.querySelector('.memory-list');
        if (!memoryList) return;

        // Group memories by date
        const groupedMemories = this.groupMemoriesByDate();
        
        const html = Object.entries(groupedMemories).map(([date, memories]) => `
            <div class="memory-group">
                <h4 class="memory-date">${date}</h4>
                ${memories.map(memory => `
                    <div class="memory-item" data-timestamp="${memory.timestamp}">
                        <div class="memory-time">${new Date(memory.timestamp).toLocaleTimeString()}</div>
                        <div class="memory-content">
                            <p class="memory-message">${this.escapeHtml(memory.message)}</p>
                            <div class="memory-context">${this.formatContext(memory.context)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');

        memoryList.innerHTML = html;

        // Add hover interaction
        const memoryItems = memoryList.querySelectorAll('.memory-item');
        memoryItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                this.highlightConnectedMemories(item.dataset.timestamp);
            });
            item.addEventListener('mouseleave', () => {
                this.clearHighlights();
            });
        });
    }

    groupMemoriesByDate() {
        const groups = {};
        this.memories.forEach(memory => {
            const date = new Date(memory.timestamp).toLocaleDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(memory);
        });
        return groups;
    }

    formatContext(context) {
        if (!context) return '';
        return `<div class="context-tags">
            ${context.topics?.map(topic => `<span class="context-tag">${topic}</span>`).join('') || ''}
        </div>`;
    }

    highlightConnectedMemories(timestamp) {
        const items = document.querySelectorAll('.memory-item');
        items.forEach(item => {
            if (this.areMemoriesConnected(timestamp, item.dataset.timestamp)) {
                item.classList.add('connected');
            }
        });
    }

    clearHighlights() {
        document.querySelectorAll('.memory-item').forEach(item => {
            item.classList.remove('connected');
        });
    }

    areMemoriesConnected(timestamp1, timestamp2) {
        // Implement your connection logic here
        // For example, memories within 5 minutes might be connected
        return Math.abs(timestamp1 - timestamp2) < 300000;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")     // Remove extra space between /< and /g
            .replace(/</g, "&lt;")      // Fix: was /</  /g with extra spaces
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    extractContext(message) {
        // Extract context from the message
        return {
            topics: this.extractTopics(message),
            timestamp: Date.now(),
            sentiment: this.analyzeSentiment(message),
            keywords: this.extractKeywords(message)
        };
    }

    extractTopics(message) {
        if (!message || typeof message !== 'string') return [];
        
        // Extract meaningful words (4+ characters)
        const words = message.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length >= 4);
        
        // Remove duplicates
        return [...new Set(words)];
    }

    analyzeSentiment(message) {
        // Basic sentiment analysis (can be expanded)
        const positiveWords = ['good', 'great', 'awesome', 'excellent', 'happy', 'love', 'enjoy'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'poor', 'wrong'];
        
        const words = message.toLowerCase().split(/\s+/);
        let sentiment = 0;
        
        words.forEach(word => {
            if (positiveWords.includes(word)) sentiment++;
            if (negativeWords.includes(word)) sentiment--;
        });
        
        return sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral';
    }

    extractKeywords(message) {
        // Extract potential keywords (capitalized words, technical terms, etc.)
        const keywords = message.match(/\b[A-Z][a-z]+\b|\b[A-Z]+\b/g) || [];
        return [...new Set(keywords)];
    }

    // ...rest of existing AIMemoryManager code...

    initializeMemoryStorage() {
        // Initialize memory storage if it doesn't exist
        if (!localStorage.getItem(MEMORY_STORAGE_KEY)) {
            localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify({
                memories: [],
                personalInfo: this.personalInfo,
                personality: this.personality,
                interests: this.interests,
                patterns: this.patterns,
                lastCleared: null
            }));
        }
        this.loadMemoryState();
    }

    loadMemoryState() {
        try {
            const state = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY));
            this.memories = state.memories || [];
            this.personalInfo = state.personalInfo || this.personalInfo;
            this.personality = state.personality || this.personality;
            this.interests = state.interests || this.interests;
            this.patterns = state.patterns || this.patterns;
        } catch (error) {
            console.error('Error loading memory state:', error);
        }
    }

    saveMemoryState() {
        try {
            localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify({
                memories: this.memories,
                personalInfo: this.personalInfo,
                personality: this.personality,
                interests: this.interests,
                patterns: this.patterns,
                lastSaved: Date.now()
            }));
        } catch (error) {
            console.error('Error saving memory state:', error);
        }
    }

    clearMemories() {
        this.memories = [];
        this.personalInfo = {
            name: null,
            occupation: null,
            location: null
        };
        this.personality.traits = [];
        this.interests.hobbies = [];
        this.interests.topics = [];
        this.patterns.frequentTopics = {};
        
        this.saveMemoryState();
        this.updateMemoryDisplay();
    }

    setupClearMemoriesButton() {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'clear-memories-btn';
        clearBtn.innerHTML = '<i class="fas fa-trash"></i> Clear All Memories';
        clearBtn.onclick = () => this.clearMemories();

        // Add button to memory modal content
        const memoryControls = document.createElement('div');
        memoryControls.className = 'memory-controls';
        memoryControls.appendChild(clearBtn);

        const modalContent = document.querySelector('.brain-modal-content');
        if (modalContent) {
            modalContent.insertBefore(memoryControls, modalContent.firstChild);
        }
    }
}

