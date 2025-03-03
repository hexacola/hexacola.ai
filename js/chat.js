/*******************************************************
 * chat.js - Hexacola.ai Chat Application
 * 
 * Fixes:
 * 1) "forEach of undefined" by returning arrays safely.
 * 2) "Cannot read properties of undefined (reading 'ok')"
 *    by adding checks in fetchWithRetry & fetchAIResponse.
 * 3) 404 for "hexacola-chat.png" is just a missing file
 *    (place the file or remove the reference in HTML).
 *
 * This file handles the core logic for the chat application. 
 * It manages user input, interacts with the AI, stores chat 
 * history, and handles various UI updates.
 *******************************************************/

/*******************************************************
 * Chat History and Response Caching
 *******************************************************/
// `chatHistory` stores all user and AI messages in an array.
let chatHistory = [];
// `responseCache` stores AI responses to avoid generating the same response multiple times. (Not currently used)
const responseCache = {};

/*******************************************************
 * API Configuration
 *******************************************************/
// This section defines all the settings needed for making calls to the AI API.
const API_CONFIG = {
  // `baseUrl` is the URL where the AI service is hosted. Make sure this is correct!
  baseUrl: 'https://text.pollinations.ai/', // Ensure this is correct or point to your chosen AI endpoint
  // `headers` include the format of the data being sent, JSON
  headers: {
    'Content-Type': 'application/json',
  },
  //`timeout` sets a limit on how long the system will wait for a response.
  timeout: 30000, // 30 second timeout
  // `retryDelay` is the starting delay in milliseconds for when a request fails and needs to be retried.
  retryDelay: 1000, // Base delay between retries
  // `maxRetries` sets the maximum number of attempts to make on a failed request.
  maxRetries: 3,
    // `errorMessages` provides user-friendly messages for various API errors.
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
// This function creates the base instruction set (prompt) for the AI
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

// `getBasePrompt` is a getter function. It calls `generateBasePrompt` to get the prompt
// every time it's needed. This ensures the prompt is always up-to-date
const getBasePrompt = () => generateBasePrompt();

/*******************************************************
 * composePrompt(userMessage):
 * Merges the basePrompt + chatHistory + the new user
 * message into one final messages array.
 *******************************************************/
// This function takes the user's input and creates the final message for the AI
async function composePrompt(userMessage) {
  // Analyze the user's message to determine the intent
  const analysis = analyzeMessage(userMessage);
  // Get the recent conversation context
  const context = chatHistoryManager.getRecentContext();
  // Get the previous user-assistant exchange
  const previousExchange = chatHistoryManager.getPreviousExchange();
  
  // Get the base prompt from the generator
  let systemPrompt = getBasePrompt(); // Use the getter instead of constant
  
  // Add context awareness
  // If the user wants to improve the previous response, add instructions for that
  if (analysis.context === 'improve_previous' && previousExchange) {
    systemPrompt += `\nThe user wants to improve this previous text: "${previousExchange.assistantResponse}"\nPlease provide an enhanced version with better grammar, clarity, and style.`;
  }

  // Add grammar check instruction
  // If user specifically asked for a grammar check, add instructions for that
  if (analysis.isGrammarCheck) {
    systemPrompt += '\nPlease check grammar and suggest improvements. Point out specific issues and provide corrections.';
  }

  // Add specific instruction based on message complexity
  // If the message is complex, we need to remind the AI to give structured responses
  if (analysis.complexity === 'complex') {
    systemPrompt += '\nThis is a detailed request. Please break down your response into clear sections.';
  }
  // Combine the system prompt (instructions), the conversation history, and user message into one array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.messages.slice(-CONTEXT_WINDOW_SIZE), // Include recent messages
    { role: 'user', content: userMessage }
  ];

  // Return the final array
  return messages;
}

/*******************************************************
 * Chat Logic & Reasoning Data
 *******************************************************/
// This section stores all dynamic data related to chat logic and response reasoning.
const reasoningData = {
  currentStep: null, // Current AI thinking step
  results: {}, //  Stores results from previous steps
  errors: [], // Stores any errors that occur during the process
  isIncomplete: false, // Track if the AI response has been truncated
  lastMessageId: null, // The ID of the last incomplete message
  currentMessage: '', // Store the text of a current message
  messageContext: null, // Stores time based context for current message
  currentReason: null, // Stores the reason for the current prompt
  lastImprovement: null,  // Stores the result of the last improvement request
  improvementCount: 0,  // Track how many improvements have been requested
  grammarIssues: [], // Stores a list of grammatical issues
  contextualHints: [], // Stores contextual hints relevant to the conversation
  thinkingSteps: [] // Stores the sequence of steps the AI follows while thinking
};

/*******************************************************
 * fetchWithRetry
 * 
 * Ensures we handle server or network failures gracefully.
 *******************************************************/
// This function sends a request to the AI and retries if the request fails.
async function fetchWithRetry(url, options, maxRetries = API_CONFIG.maxRetries, delayMs = API_CONFIG.retryDelay) {
  // `lastError` will store the last error, if any.
  let lastError;
    
  // Add timeout to fetch using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    
    // Start a loop to retry the request if it fails.
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Send the request to the AI endpoint.
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      // Clear timeout if fetch completes
      clearTimeout(timeoutId);

      // Check if the request was successful (status 200)
      if (!response.ok) {
        // Use the friendly error message or a default
        const errorMessage = API_CONFIG.errorMessages[response.status] || API_CONFIG.errorMessages.default;
        lastError = new Error(errorMessage);
        
         // Don't retry client errors except 429
        if (response.status !== 429 && response.status < 500) {
          break;
        }
        
        // Exponential backoff for retries: wait longer on each attempt.
        await new Promise(res => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
        continue;
      }

      // If the request was successful, return the response
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
      // If max retries are reached, stop retrying.
      if (attempt === maxRetries) break;
            
      // Exponential backoff for retries
      await new Promise(res => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
    }
  }

  // If all retries failed, throw the last error.
  throw lastError;
}

/*******************************************************
 * fetchAIResponse(messages)
 * 
 * Takes the final messages array (basePrompt + history
 * + user message) and calls our AI endpoint.
 *******************************************************/
// This function takes the generated messages and sends them to the AI for a response.
async function fetchAIResponse(messages) {
  // Check to make sure that the messages are a valid array
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Invalid messages format');
  }

  try {
      // Fetch selected model
    const modelSelect = document.getElementById('modelSelect');
    let selectedModel = modelSelect ? chatModels.find(model => model.name === modelSelect.value) : null;

    // If reasoning mode is enabled but the selected model is not reasoning capable,
    // override with a default reasoning model (if available)
    if (reasoningMode) {
      if (!selectedModel || !selectedModel.reasoning) {
        const defaultReasoning = chatModels.find(m => m.reasoning);
        if (defaultReasoning) {
          selectedModel = defaultReasoning;
          if(modelSelect) {
            modelSelect.value = defaultReasoning.name;
          }
          console.log("Overriding model to reasoning:", defaultReasoning.description);
        }
      }
    }

    // Fallback to a safe default if still not set.
    const modelName = selectedModel ? selectedModel.name : 'openai';

    // Call the `fetchWithRetry` function
    const response = await fetchWithRetry(API_CONFIG.baseUrl, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({
        messages: messages,
        model: modelName
      })
    });

    // Parse response text
    let textData;
    try {
      textData = await response.text();
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    // Check if the response is empty
    if (!textData) {
      throw new Error('Empty response from AI service');
    }
      // Return the text response from the AI
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
// This is the main function that is called when the user sends a message.
async function sendMessage() {
  // Get the chat input element
  const chatInput = document.getElementById('chatInput');
  // Get the user's message
  const message = chatInput.value.trim();
  // If the message is empty, don't do anything.
  if (!message) return;
    
    // Clear the chat input area
  try {
    // Check working status of selected model.
    const modelSelect = document.getElementById('modelSelect');
    let selectedModel = modelSelect ? chatModels.find(model => model.name === modelSelect.value) : null;
    if (selectedModel && selectedModel.working === false) {
      // Model is flagged as unavailable so show alert and return.
      showModelErrorAlert("Sorry, this model is down. Please try again later.");
      return;
    }
    chatInput.value = '';
      // Analyze the user's message to determine its intent
    const analysis = analyzeMessage(message);
      // Get the conversation context for a new message
    const context = chatHistoryManager.getRecentContext();
    
    // Show appropriate thinking animation based on analysis
    if (analysis.context === 'improve_previous') {
      showThinkingSteps('Improving previous response...');
    } else if (analysis.isGrammarCheck) {
      showThinkingSteps('Checking grammar and style...');
    } else {
      showThinkingSteps(context.summary?.lastUserQuery ? 'Continuing conversation...' : 'Starting new conversation...');
    }
      // Update local history with user message
    updateChatHistory('user', message);
    // Show the user's message on the chat interface
    appendMessage('user', message);

    // Generate the complete AI prompt.
    const finalPrompt = await composePrompt(message);
      // Fetch response from the AI.
    let response = await fetchAIResponse(finalPrompt);

    // Enhance response with personal context
    response = aiMemoryManager.enhanceResponse(response);

    // Track improvements
      if (analysis.isImprovement) {
      reasoningData.lastImprovement = response;
      reasoningData.improvementCount++;
    }

    // Removes thinking animation
    removeThinkingProcess();
      // Update local chat history with AI response
    updateChatHistory('assistant', response);
    // Display the AI response in the chat area.
    appendMessage('assistant', response);

    // Save memory and context to local storage
    aiMemoryManager.saveMemory(message, response);
      // Store chat history in local storage
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
 // This function shows a visual "thinking" animation while the AI is processing a request
async function showThinkingSteps(contextMessage = 'Processing request...') {
  // Create main thinking container
  const thinkingContainer = document.createElement('div');
  thinkingContainer.className = 'thinking-container';
    
  // Create icon container
  const thinkingIcon = document.createElement('div');
  thinkingIcon.className = 'thinking-icon';
    
  // Add thinking dots
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'thinking-dot';
    thinkingIcon.appendChild(dot);
  }
  // Create text container
  const thinkingText = document.createElement('div');
  thinkingText.className = 'thinking-text';
    
  const thinkingStatus = document.createElement('span');
  thinkingStatus.textContent = 'Hexacola is thinking';
    
  const messageText = document.createElement('span');
  messageText.textContent = contextMessage;
    
    // Add elements to the text container
  thinkingText.appendChild(thinkingStatus);
  thinkingText.appendChild(messageText);
  
    // Add the icon and text to the main container
  thinkingContainer.appendChild(thinkingIcon);
  thinkingContainer.appendChild(thinkingText);
  
  // Get the chat container
  const chat = document.getElementById('chat');
    // Append thinking container
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
    
    // Keep scrollbar to bottom
  chat.scrollTop = chat.scrollHeight;
  return thinkingContainer;
}

/*******************************************************
 * removeThinkingProcess
 *******************************************************/
// Removes the thinking animation once the AI has responded.
function removeThinkingProcess() {
  // Gets the thinking container
  const thinkingContainer = document.querySelector('.thinking-container');
  // If a container is found
  if (thinkingContainer) {
      // Clear the interval
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
// This function adds a message to the chat area.
function appendMessage(role, content) {
    // Gets the main chat container
  const chat = document.getElementById('chat');
  // Creates a new div for the message
  const messageDiv = document.createElement('div');
  // Adds CSS classes to the message for styling
  messageDiv.classList.add('chat-message', role);

    // Generate a unique ID for each message
  const messageId = Date.now().toString();
  messageDiv.setAttribute('data-message-id', messageId);

  // Store the message in the reasoning data if from assistant
  if (role === 'assistant') {
    reasoningData.currentMessage = content;
      reasoningData.messageContext = { messageId, timestamp: Date.now() };
  }
  // Format content to add styling if needed
  const formattedContent = formatMessage(content);
    // Set the inner HTML of the div to show message
  messageDiv.innerHTML = formattedContent;
  // Adds message to the chat
  chat.appendChild(messageDiv);
  // Ensure the new message is visible by scrolling the chat
  chat.scrollTop = chat.scrollHeight;

  // Check if the message is likely to be incomplete
  if (role === 'assistant' && (content.endsWith('...') || content.length >= 500)) {
    reasoningData.isIncomplete = true;
    reasoningData.lastMessageId = messageId;
    // If message is incomplete, append continue button
    appendContinueButton(messageDiv);
  }

  // Highlight code syntax if prism.js is loaded
  if (typeof Prism !== 'undefined') {
    Prism.highlightAllUnder(messageDiv);
  }
}

/*******************************************************
 * formatMessage - Basic Markdown + Sanitization
 *******************************************************/
// This function takes message text and formats it using HTML and sanitizes it.
function formatMessage(content) {
  // Check if the message is valid.
  if (!content) return '';
    
    // If DOMPurify is available, sanitize the content
    if (typeof DOMPurify !== 'undefined') {
      content = DOMPurify.sanitize(content);
    }

  // Convert markdown-like syntax to HTML
    // e.g., **bold** becomes <strong>bold</strong>, *italic* becomes <em>italic</em>
  content = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const languageClass = lang ? `language-${lang}` : '';
      return `<pre><code class="${languageClass}">${escapeHtml(code)}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Return formatted message
  return content;
}

/*******************************************************
 * escapeHtml
 *******************************************************/
// This function takes a piece of text and makes sure that all of the HTML tags are correctly rendered and dont cause security concerns.
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
// This function adds a "Continue" button to messages from the AI that are longer than usual, as they might be incomplete.
function appendContinueButton(messageDiv) {
  const continueButton = document.createElement('button');
  continueButton.classList.add('continue-button');
  continueButton.innerHTML = 'Continue Response';
  continueButton.onclick = continueResponse;
  messageDiv.appendChild(continueButton);
}

// This function handles continuing the AI message
async function continueResponse() {
  // Gets last message
  const lastMessage = document.querySelector(`[data-message-id="${reasoningData.lastMessageId}"]`);
    // Returns if no last message
  if (!lastMessage) return;
    // Get the continue button
  const continueButton = lastMessage.querySelector('.continue-button');
    // Removes the button
  if (continueButton) continueButton.remove();

  try {
      // Create a context for response
    const continuationContext = {
      previousContent: reasoningData.currentMessage,
      lastContext: reasoningData.messageContext
    };

    // Show "thinking" animation
    showThinkingSteps();

    // We'll just do a naive approach: "Continue from previous" system message
    const finalPrompt = await composePrompt('continue from previous response');
      // Get response from the AI
    const data = await fetchAIResponse(finalPrompt);
      // Removes thinking animation
    removeThinkingProcess();

      // Combines the previous response with the new one
    reasoningData.currentMessage += data;
    // Displays complete text
    lastMessage.innerHTML = formatMessage(reasoningData.currentMessage);
      
      // Check if response is still too long
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
// This object manages the chat history including storing, retreiving and manipulating messages and metadata.
const chatHistoryManager = {
  // Stores all chat messages
  history: [],
    // stores conversation metadata
  metadata: {
    firstInteraction: null,
    lastInteraction: null,
    commonTopics: new Set(),
    userPreferences: new Map()
  },
    // Stores user's last text that was improved
  lastImprovedText: null,
  // Counts how many time a user requests an improvement of text
  improvementCount: 0,

  // Add a new message to the chat history.
    addMessage(role, content) {
        // Store the current timestamp for the message
      const timestamp = Date.now();
        // extract topics for context
      const topics = this.extractTopics(content);

        // Creates a message object
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

        // Add topics to the metadata
    topics.forEach(topic => this.metadata.commonTopics.add(topic));
        // Add message to the history
      this.history.push(message);
        // save history
      this.save();
    return message;
  },

  // Extracts topics from message content
  extractTopics(content) {
    // Always returns an array
    if (!content || typeof content !== 'string') return [];
    const words = content.toLowerCase().match(/\b\w{4,}\b/g) || [];
    return [...new Set(words)];
  },

    // Returns context data
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

    // Returns first message in the conversation
  getFirstMessage() {
    return this.metadata.firstInteraction || null;
  },
    // Retreive conversation summary
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

  // Loads chat history from local storage.
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

  // Saves chat history to local storage.
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

    // Clears all chat history from local storage.
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

  // Get previous exchange between user and assistant
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
  
  // Detect whether a message is asking for improvement
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
// Helper function to update chat history
function updateChatHistory(role, content) {
  return chatHistoryManager.addMessage(role, content);
}

// Helper function to load the chat history
function loadChatHistory() {
    chatHistoryManager.load();
  if (chatHistoryManager.history.length > 0) {
    chatHistoryManager.history.forEach(msg => appendMessage(msg.role, msg.content));
  } else {
    appendMessage('assistant', 'Hello! I’m Hexacola.ai, your friendly Artist GPT. How can I help you today?');
  }
}

// UPDATED: Clear only the chat UI without clearing AI memory storage
function clearChat() {
  // Instead of calling chatHistoryManager.clear(), we simply reset the UI history.
  chatHistoryManager.history = []; // reset conversation history without affecting AIMemoryManager.memories
  const chat = document.getElementById('chat');
  if (chat) chat.innerHTML = '';
  const welcomeMessage = 'Chat history cleared. Memories preserved in AI Memory Storage.';
  updateChatHistory('assistant', welcomeMessage);
  appendMessage('assistant', welcomeMessage);
}

/*******************************************************
 * Dark Mode Toggling
 *******************************************************/
// Toggles dark mode
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

// Load Darkmode preference
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
// Function to handle send message button click
function handleSendMessageClick() {
  sendMessage();
}

// Function to handle open code modal button click
function handleOpenCodeModalClick() {
  const codeSample = "console.log('Hello, World!');";
  openCodeModal(codeSample, "javascript");
}

// Function to handle close code modal button click
function handleCloseCodeModalClick() {
  closeCodeModal();
}

// Function to handle all button clicks
function handleButtonClick(event) {
    // Find the closest button
  const button = event.target.closest('button');
  // If not button, return
  if (!button) return;
  // Get the onclick action
  const action = button.getAttribute('onclick');
  if (action) {
      // Prevent default action
    event.preventDefault();
      // Clean up function name
    const functionName = action.replace('()', '');
      // Call the function if it is a valid function
    if (typeof window[functionName] === 'function') {
      window[functionName]();
    }
  }
}

/*******************************************************
 * chatApp - Main controller
 *******************************************************/
// This object controls the state of the chat application
const chatApp = {
    // Tracks the state of the chat app.
  state: { thinking: false, lastMessageId: null },
    // Initialize all chat functionality
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
        
        // add listener for click
    document.addEventListener('click', handleButtonClick);
        
        // Get the input and send buttons
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
        // Add listener for clearing history
    const clearButton = document.getElementById('clearChat');
    if (clearButton) {
      clearButton.addEventListener('click', clearChat);
    }

    // If you have a code modal, ensure it closes correctly
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
// Run chat app initialization when the page loads
document.addEventListener('DOMContentLoaded', () => {
  chatApp.init();
});

/* ...existing code... */

// Add these constants near the top of the file
// Number of messages to keep for context
const CONTEXT_WINDOW_SIZE = 10;
// Key for chat history storage in localStorage
const MESSAGE_HISTORY_KEY = 'chatMessageHistory';
// Array of words used to trigger an improvement to the previous AI message
const IMPROVEMENT_TRIGGERS = ['improve', 'enhance', 'better', 'fix', 'correct', 'grammar'];

/* ...rest of existing code... */

// Add new constants for reasoning
// Different steps for AI response logic
const REASONING_STEPS = {
  ANALYZE: 'analyzing',
  CONTEXT: 'context',
  GRAMMAR: 'grammar',
  IMPROVE: 'improve',
  RESPOND: 'respond'
};

// Contextual messages while thinking
const THINKING_MESSAGES = {
  [REASONING_STEPS.ANALYZE]: 'Analyzing your message...',
  [REASONING_STEPS.CONTEXT]: 'Understanding context...',
  [REASONING_STEPS.GRAMMAR]: 'Checking grammar and style...',
  [REASONING_STEPS.IMPROVE]: 'Considering improvements...',
  [REASONING_STEPS.RESPOND]: 'Preparing response...'
};

// Enhanced message analysis
// This functions analyzes the user message
function analyzeMessage(message) {
  // Set default message state
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
// Key for storing the main memory of the ai
const MEMORY_STORAGE_KEY = 'hexacola_memory';
// Maximum number of memories to store
const MAX_MEMORIES = 50;
// Particle count for animations
const PARTICLE_COUNT = 30;

// Add these constants at the top
// Key for storing personal information
const PERSONAL_INFO_KEY = 'hexacola_personal_info';
// Key for storing personality traits
const PERSONALITY_TRAITS_KEY = 'hexacola_personality';
// Key for storing interests
const INTERESTS_KEY = 'hexacola_interests';
// Key for storing conversation patterns
const CONVERSATION_PATTERNS_KEY = 'hexacola_patterns';

// This class manages the AI memory, personal information, conversation analysis, and all modal and particle animations.
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

    // Adds all needed event listeners for the AI memory system
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
    // Loads memories from local storage
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
    // Loads personal information from local storage
    loadPersonalInfo() {
        return JSON.parse(localStorage.getItem(PERSONAL_INFO_KEY)) || {
            name: null,
            occupation: null,
            location: null
        };
    }
    // Loads the personality traits from local storage
    loadPersonalityTraits() {
        return JSON.parse(localStorage.getItem(PERSONALITY_TRAITS_KEY)) || {
            traits: [],
            communicationStyle: null,
            emotionalResponses: [],
            preferences: {}
        };
    }
    // Loads interests from local storage
    loadInterests() {
        return JSON.parse(localStorage.getItem(INTERESTS_KEY)) || {
            hobbies: [],
            topics: [],
            dislikes: [],
            favorites: {}
        };
    }
    // Loads conversation patterns from local storage
    loadConversationPatterns() {
        return JSON.parse(localStorage.getItem(CONVERSATION_PATTERNS_KEY)) || {
            frequentTopics: {},
            responsePreferences: {},
            timePatterns: {}
        };
    }
    // Saves personal information to local storage
    savePersonalInfo(key, value) {
        this.personalInfo[key] = value;
        this.personalInfo.lastInteraction = Date.now();
        localStorage.setItem(PERSONAL_INFO_KEY, JSON.stringify(this.personalInfo));
    }
    // Updates the personality traits in local storage
    updatePersonality(trait) {
        if (!this.personality.traits.includes(trait)) {
            this.personality.traits.push(trait);
            localStorage.setItem(PERSONALITY_TRAITS_KEY, JSON.stringify(this.personality));
        }
    }
    // Adds a new interest category and item to the local storage
    addInterest(category, item) {
        if (!this.interests[category].includes(item)) {
            this.interests[category].push(item);
            localStorage.setItem(INTERESTS_KEY, JSON.stringify(this.interests));
        }
    }
    // Analyses the user's messages and extracts important information
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
    // Enhances the AI response with personalized context
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
    // Saves messages to the memory log
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
    // Updates the conversation patterns in the localStorage
    updateConversationPatterns(message) {
        const topics = this.extractTopics(message);
        topics.forEach(topic => {
            this.patterns.frequentTopics[topic] = (this.patterns.frequentTopics[topic] || 0) + 1;
        });
        
        const hour = new Date().getHours();
        this.patterns.timePatterns[hour] = (this.patterns.timePatterns[hour] || 0) + 1;
        
        localStorage.setItem(CONVERSATION_PATTERNS_KEY, JSON.stringify(this.patterns));
    }
    // updates the memory display to show all stored content
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
    // creates the particle animations in the background of the brain visualization
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

    // Animates the particles in the brain visualization
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
    // Sets up the event listener for esc key
    setupKeyboardListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isModalOpen) {
                this.closeModal();
            }
        });
    }
    // Opens the brain memory modal
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
    // Closes the brain memory modal
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
    // Updates the memory display
    updateMemoryDisplay() {
        const memoryList = document.querySelector('.memory-list');
        if (!memoryList) return;

        // Group memories by date
        const groupedMemories = this.groupMemoriesByDate();
        
        const html = Object.entries(groupedMemories).map(([date, memories]) => `
            <div class="memory-group">
                <h4 class="memory-date">${date}</h4>
                ${memories.map(memory => {
                    return `<div class="memory-item" data-timestamp="${memory.timestamp}">
                        <div class="memory-time">${new Date(memory.timestamp).toLocaleTimeString()}</div>
                        <div class="memory-content">
                            <p class="memory-message">${this.escapeHtml(memory.message)}</p>
                            <div class="memory-context">${this.formatContext(memory.context)}</div>
                        </div>
                    </div>`;
                }).join('')}
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
    // Groups all stored memories by date
    groupMemoriesByDate() {
        const groups = {};
        this.memories.forEach(memory => {
            const date = new Date(memory.timestamp).toLocaleDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(memory);
        });
        return groups;
    }
    // Formats context as HTML
    formatContext(context) {
        if (!context) return '';
        return `<div class="context-tags">
            ${context.topics?.map(topic => `<span class="context-tag">${topic}</span>`).join('') || ''}
        </div>`;
    }
    // Highlights memories that are connected
    highlightConnectedMemories(timestamp) {
        const items = document.querySelectorAll('.memory-item');
        items.forEach(item => {
            if (this.areMemoriesConnected(timestamp, item.dataset.timestamp)) {
                item.classList.add('connected');
            }
        });
    }
    // Clears all highlighted memories
    clearHighlights() {
        document.querySelectorAll('.memory-item').forEach(item => {
            item.classList.remove('connected');
        });
    }
    // Checks if two memories are connected
    areMemoriesConnected(timestamp1, timestamp2) {
        // Implement your connection logic here
        // For example, memories within 5 minutes might be connected
        return Math.abs(timestamp1 - timestamp2) < 300000;
    }

    // Escape html tags in text
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    // extracts the context from a message
    extractContext(message) {
        // Extract context from the message
        return {
            topics: this.extractTopics(message),
            timestamp: Date.now(),
            sentiment: this.analyzeSentiment(message),
            keywords: this.extractKeywords(message)
        };
    }
    // Extracts topics from the text
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
    // Analyzes sentiment of a message
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
    // Extracts keywords from message
    extractKeywords(message) {
        // Extract potential keywords (capitalized words, technical terms, etc.)
        const keywords = message.match(/\b[A-Z][a-z]+\b|\b[A-Z]+\b/g) || [];
        return [...new Set(keywords)];
    }

    /* ...rest of existing AIMemoryManager code... */
    // Initializes memory storage if it doesn't exist
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
    // Loads memory state
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
    // Saves memory state
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
    // Clears all stored memories
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

    // sets up the button for clearing all memories
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

/* ...existing code... */

// Chat models data
const chatModels = [
  {"name":"openai","type":"chat","censored":true,"description":"OpenAI GPT-4o-mini","baseModel":true,"vision":true},
  {"name":"openai-large","type":"chat","censored":true,"description":"OpenAI GPT-4o","baseModel":true,"vision":true},
  {"name":"openai-reasoning","type":"chat","censored":true,"description":"OpenAI o1-mini","baseModel":true,"reasoning":true},
  {"name":"qwen-coder","type":"chat","censored":true,"description":"Qwen 2.5 Coder 32B","baseModel":true},
  {"name":"llama","type":"chat","censored":false,"description":"Llama 3.3 70B","baseModel":true},
  {"name":"mistral","type":"chat","censored":false,"description":"Mistral Nemo","baseModel":true},
  {"name":"unity","type":"chat","censored":false,"description":"Unity with Mistral Large by Unity AI Lab","baseModel":false},
  {"name":"midijourney","type":"chat","censored":true,"description":"Midijourney musical transformer","baseModel":false},
  {"name":"rtist","type":"chat","censored":true,"description":"Rtist image generator by @bqrio","baseModel":false},
  {"name":"searchgpt","type":"chat","censored":true,"description":"SearchGPT with realtime news and web search","baseModel":false},
  {"name":"evil","type":"chat","censored":false,"description":"Evil Mode - Experimental","baseModel":false},
  {"name":"deepseek","type":"chat","censored":true,"description":"DeepSeek-V3","baseModel":true},
  {"name":"claude-hybridspace","type":"chat","censored":true,"description":"Claude Hybridspace","baseModel":true},
  {"name":"deepseek-r1","type":"chat","censored":true,"description":"DeepSeek-R1 Distill Qwen 32B","baseModel":true,"reasoning":true,"provider":"cloudflare"},
  {"name":"deepseek-reasoner","type":"chat","censored":true,"description":"DeepSeek R1 - Full","baseModel":true,"reasoning":true,"provider":"deepseek"},
  {"name":"llamalight","type":"chat","censored":false,"description":"Llama 3.1 8B Instruct","baseModel":true},
  {"name":"llamaguard","type":"safety","censored":false,"description":"Llamaguard 7B AWQ","baseModel":false,"provider":"cloudflare"},
  {"name":"gemini","type":"chat","censored":true,"description":"Gemini 2.0 Flash","baseModel":true,"provider":"google"},
  {"name":"gemini-thinking","type":"chat","censored":true,"description":"Gemini 2.0 Flash Thinking","baseModel":true,"provider":"google"},
  {"name":"hormoz","type":"chat","description":"Hormoz 8b by Muhammadreza Haghiri","baseModel":false,"provider":"modal.com","censored":false}
];

function populateModelSelect() {
  const modelSelect = document.getElementById('modelSelect');
  if (!modelSelect) return;
  // Clear any existing options
  modelSelect.innerHTML = '';
  chatModels.forEach(model => {
    // Only include chat models (type "chat") in the dropdown
    if(model.type === "chat") {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = model.description;
      // Optionally mark reasoning enabled models (if reasoning property true)
      if(model.reasoning) {
        option.textContent += " (Reasoning)";
      }
      modelSelect.appendChild(option);
    }
  });
}

// Sample function to handle extra behavior for reasoning models
function handleModelChange() {
  const selectedName = document.getElementById('modelSelect').value;
  const selectedModel = chatModels.find(model => model.name === selectedName);
  if(selectedModel && selectedModel.reasoning) {
    // Enable reasoning specific behavior if needed
    console.log("Reasoning features enabled for:", selectedModel.description);
    // ...insert any additional reasoning functions...
  } else {
    console.log("Standard chat mode for:", selectedModel ? selectedModel.description : "unknown");
  }
}

// Global variable to track reasoning mode
let reasoningMode = false;

// Toggle reasoning mode and update button text
function toggleReasoningMode() {
  reasoningMode = !reasoningMode;
  const btn = document.getElementById('toggleReasoningBtn');
  if (btn) {
    btn.textContent = 'Reasoning Mode: ' + (reasoningMode ? 'On' : 'Off');
  }
  console.log('Reasoning mode is now', reasoningMode ? 'enabled' : 'disabled');
}

// Initialize model select on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  populateModelSelect();
  const modelSelect = document.getElementById('modelSelect');
  if(modelSelect) {
    modelSelect.addEventListener('change', handleModelChange);
  }
  // Attach reasoning mode toggle on DOM ready along with model select listener.
  const reasoningBtn = document.getElementById('toggleReasoningBtn');
  if (reasoningBtn) {
    reasoningBtn.addEventListener('click', toggleReasoningMode);
  }
  // ...existing initialization code...
});

/* ...existing code... */

// Update composePrompt to add chain-of-thought instructions if reasoning mode is on
async function composePrompt(userMessage) {
  const analysis = analyzeMessage(userMessage);
  const context = chatHistoryManager.getRecentContext();
  const previousExchange = chatHistoryManager.getPreviousExchange();
  let systemPrompt = getBasePrompt();
  
  if (analysis.context === 'improve_previous' && previousExchange) {
    systemPrompt += `\nThe user wants to improve this previous text: "${previousExchange.assistantResponse}"\nPlease enhance the response with better grammar, clarity, and style.`;
  }
  if (analysis.isGrammarCheck) {
    systemPrompt += '\nPlease check grammar and suggest improvements with corrections.';
  }
  if (analysis.complexity === 'complex') {
    systemPrompt += '\nThis is a detailed request. Break down your answer in clear, numbered steps.';
  }
  // NEW: When reasoning mode is enabled, instruct the AI to include a chain-of-thought as a JSON array in a "reasoning" field.
  if (reasoningMode) {
    systemPrompt += "\nAdditionally, provide a 'reasoning' chain-of-thought as a JSON array with step-by-step explanations before your final answer.";
  }
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.messages.slice(-CONTEXT_WINDOW_SIZE),
    { role: 'user', content: userMessage }
  ];
  return messages;
}

/* ...existing code... */

// NEW: Display reasoning steps in the dedicated panel
function displayReasoning(reasoningSteps) {
  const panel = document.getElementById('reasoningPanel');
  const list = document.getElementById('reasoningStepsList');
  if (!panel || !list) return;
  
  // Clear previous steps
  list.innerHTML = '';
  
  // Assume reasoningSteps is an array
  reasoningSteps.forEach((step, index) => {
    const li = document.createElement('li');
    li.textContent = `Step ${index + 1}: ${step}`;
    list.appendChild(li);
  });
  
  // Show the panel
  panel.style.display = 'block';
}

// NEW: In sendMessage, after receiving the AI response, extract reasoning if available.
// Assume the AI returns a JSON object with optional "reasoning" field.
async function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (!message) return;
  try {
    // Check working status of selected model.
    const modelSelect = document.getElementById('modelSelect');
    let selectedModel = modelSelect ? chatModels.find(model => model.name === modelSelect.value) : null;
    if (selectedModel && selectedModel.working === false) {
      // Model is flagged as unavailable so show alert and return.
      showModelErrorAlert("Sorry, this model is down. Please try again later.");
      return;
    }
    chatInput.value = '';
    const analysis = analyzeMessage(message);
    const context = chatHistoryManager.getRecentContext();
    
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
    
    // NEW: Try to parse response as JSON for reasoning
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      parsed = null;
    }
    
    if (parsed && parsed.reasoning && Array.isArray(parsed.reasoning)) {
      displayReasoning(parsed.reasoning);
      // Use the final answer from the JSON (assume in finalAnswer field)
      response = parsed.finalAnswer || response;
    } else {
      // Hide the reasoning panel if not present
      const panel = document.getElementById('reasoningPanel');
      if (panel) panel.style.display = 'none';
    }
    
    response = aiMemoryManager.enhanceResponse(response);
    if (analysis.isImprovement) {
      reasoningData.lastImprovement = response;
      reasoningData.improvementCount++;
    }
    removeThinkingProcess();
    updateChatHistory('assistant', response);
    appendMessage('assistant', response);
    aiMemoryManager.saveMemory(message, response);
    localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(chatHistoryManager.getRecentContext()));
  } catch (error) {
    console.error('Error:', error);
    removeThinkingProcess();
    appendMessage('assistant', `Error: ${error.message}`);
  }
}

/* ...existing code... */

// Attach reasoning mode toggle on DOM ready along with model select listener.
document.addEventListener("DOMContentLoaded", () => {
  populateModelSelect();
  const modelSelect = document.getElementById('modelSelect');
  if(modelSelect) {
    modelSelect.addEventListener('change', handleModelChange);
  }
  const reasoningBtn = document.getElementById('toggleReasoningBtn');
  if (reasoningBtn) {
    reasoningBtn.addEventListener('click', toggleReasoningMode);
  }
  // ...existing initialization code...
});

/* ...existing code... */

// NEW: Function to create and display an error alert
function showModelErrorAlert(message) {
  // Check if an alert is already present and remove it if so.
  let existingAlert = document.querySelector('.model-error-alert');
  if (existingAlert) {
    existingAlert.remove();
  }
  // Create the alert element
  const alertEl = document.createElement('div');
  alertEl.className = 'model-error-alert shake';
  alertEl.innerHTML = `<p>${message}</p>`;
  // Append the alert element to the document body (or a container of your choice)
  document.body.appendChild(alertEl);
  // Remove alert after 3 seconds
  setTimeout(() => {
    alertEl.classList.add('fade-out');
    setTimeout(() => alertEl.remove(), 500);
  }, 3000);
}

/* ...existing code... */

/* ...existing code... */

function appendReasoningStep(text) {
  const reasoningList = document.getElementById('reasoningStepsList');
  if (reasoningList) {
    const li = document.createElement('li');
    li.textContent = text;
    li.classList.add('reasoning-step');
    reasoningList.appendChild(li);
  }
}

/* Example: call appendReasoningStep when reasoning data is received */
// function onChatResponse(response) {
//   /* ...existing code... */
//   if (response.reasoning && Array.isArray(response.reasoning)) {
//     response.reasoning.forEach(step => appendReasoningStep(step));
//   }
//   /* ...existing code... */
// }

/* ...existing code... */