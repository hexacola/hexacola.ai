Pollinations.AI API Documentation
Cheatsheet
Image Generation API (Default model: 'flux')
Generate Image: GET https://image.pollinations.ai/prompt/{prompt}

Params: prompt*, model, seed, width, height, nologo, private, enhance, safe
Return: Image file
List Models: GET https://image.pollinations.ai/models

Text Generation API (Default model: 'openai')
Generate (GET): GET https://text.pollinations.ai/{prompt}

Params: prompt*, model, seed, json, system
Return: Generated text
Generate (POST): POST https://text.pollinations.ai/

Body: messages*, model, seed, jsonMode
Return: Generated text
OpenAI Compatible: POST https://text.pollinations.ai/openai

Body: Follows OpenAI ChatGPT API format
Return: OpenAI-style response
List Models: GET https://text.pollinations.ai/models

Feed Endpoints
Image Feed: GET https://image.pollinations.ai/feed - SSE stream of user-generated images.
Text Feed: GET https://text.pollinations.ai/feed - SSE stream of user-generated text.
* required parameter

React Hooks (npm install @pollinations/react)
usePollinationsText(prompt, options)

Options: seed, model, systemPrompt
Return: string | null
usePollinationsImage(prompt, options)

Options: width, height, model, seed, nologo, enhance
Return: string | null
usePollinationsChat(initialMessages, options)

Options: seed, jsonMode, model
Return: { sendUserMessage: (message) => void, messages: Array<{role, content}> }
Docs: https://pollinations.ai/react-hooks

Detailed API Documentation
Image Generation API
Generate Image
GET https://image.pollinations.ai/prompt/{prompt}

Parameters:

prompt* (required): Text description of the image you want to generate. Should be URL-encoded.
model: Model to use for generation. See https://image.pollinations.ai/models for available models.
seed: Seed for reproducible results.
width: Width of the generated image. Default: 1024
height: Height of the generated image. Default: 1024
nologo: Set to 'true' to turn off the rendering of the logo. Default: false
private: Set to 'true' to prevent the image from appearing in the public feed. Default: false
enhance: Set to 'true' to turn on prompt enhancing (passes prompts through an LLM to add detail). Default: false
safe: Set to 'true' to enable strict NSFW content filtering, throwing an error if NSFW content is detected. Default: false
Return: Image file (typically JPEG or PNG)

Example Usage
https://image.pollinations.ai/prompt/A%20beautiful%20sunset%20over%20the%20ocean?width=1280&height=720&seed=42
Text Generation API
Generate (GET)
GET https://text.pollinations.ai/{prompt}

Parameters:

prompt* (required): Text prompt for the AI to respond to. Should be URL-encoded.
model: Model to use for text generation. Options: 'openai', 'mistral'. See https://text.pollinations.ai/models for available models.
seed: Seed for reproducible results.
json: Set to 'true' to receive response in JSON format.
system: System prompt to set the behavior of the AI. Should be URL-encoded.
Return: Generated text

Generate (POST)
POST https://text.pollinations.ai/

Request Body:

{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is artificial intelligence?"}
  ],
  "model": "openai",
  "seed": 42,
  "jsonMode": true  // Optional: Forces the response to be valid JSON
}
Return: Generated text

Example Usage (GET)
https://text.pollinations.ai/What%20is%20artificial%20intelligence?seed=42&json=true&model=mistral&system=You%20are%20a%20helpful%20AI%20assistant
Code Examples
Python (Image Generation)
import requests

def download_image(prompt, width=768, height=768, model='flux', seed=None):
    url = f"https://image.pollinations.ai/prompt/{prompt}?width={width}&height={height}&model={model}&seed={seed}"
    response = requests.get(url)
    with open('generated_image.jpg', 'wb') as file:
        file.write(response.content)
    print('Image downloaded!')

download_image("A beautiful sunset over the ocean", width=1280, height=720, model='flux', seed=42)
JavaScript (Text Generation)
const fetch = require('node-fetch');

async function generateText() {
  const response = await fetch('https://text.pollinations.ai/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is artificial intelligence?' }
      ],
      seed: 42,
      model: 'mistral'
    }),
  });

  const data = await response.json();
  console.log(data);
}

generateText();
HTML (Image Embedding)
<img src="https://image.pollinations.ai/prompt/Modern%20minimalist%20logo" alt="AI-generated logo">
Integration Examples
Web Design: Use AI-generated images for dynamic content
E-learning: Generate custom illustrations for concepts
Chatbots: Enhance responses with relevant images
Social Media: Create engaging visual content on-the-fly
For more examples and community projects, visit our GitHub repository.

[
  {
    "name": "openai",
    "type": "chat",
    "censored": true,
    "description": "OpenAI GPT-4o",
    "baseModel": true
  },
  {
    "name": "qwen",
    "type": "chat",
    "censored": true,
    "description": "Qwen 2.5 72B",
    "baseModel": true
  },
  {
    "name": "qwen-coder",
    "type": "chat",
    "censored": true,
    "description": "Qwen 2.5 Coder 32B",
    "baseModel": true
  },
  {
    "name": "llama",
    "type": "chat",
    "censored": false,
    "description": "Llama 3.3 70B",
    "baseModel": true
  },
  {
    "name": "mistral",
    "type": "chat",
    "censored": false,
    "description": "Mistral Nemo",
    "baseModel": true
  },
  {
    "name": "unity",
    "type": "chat",
    "censored": false,
    "description": "Unity with Mistral Large by Unity AI Lab",
    "baseModel": false
  },
  {
    "name": "midijourney",
    "type": "chat",
    "censored": true,
    "description": "Midijourney musical transformer",
    "baseModel": false
  },
  {
    "name": "rtist",
    "type": "chat",
    "censored": true,
    "description": "Rtist image generator by @bqrio",
    "baseModel": false
  },
  {
    "name": "searchgpt",
    "type": "chat",
    "censored": true,
    "description": "SearchGPT with realtime news and web search",
    "baseModel": false
  },
  {
    "name": "evil",
    "type": "chat",
    "censored": false,
    "description": "Evil Mode - Experimental",
    "baseModel": false
  },
  {
    "name": "p1",
    "type": "chat",
    "censored": false,
    "description": "Pollinations 1 (OptiLLM)",
    "baseModel": false
  },
  {
    "name": "deepseek",
    "type": "chat",
    "censored": true,
    "description": "DeepSeek-V3",
    "baseModel": true
  }
]

IMAGE MODELS:

[
  "flux",
  "flux-realism",
  "flux-cablyai",
  "flux-anime",
  "flux-3d",
  "any-dark",
  "flux-pro",
  "turbo"
]
