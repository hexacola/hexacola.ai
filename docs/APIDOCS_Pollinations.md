Pollinations.AI API Documentation
Cheatsheet
Image Generation API (Default model: 'flux')
Generate Image: GET https://image.pollinations.ai/prompt/{prompt}

Params: prompt*, model, seed, width, height, nologo, private, enhance, safe
Return: Image file
List Models: GET https://image.pollinations.ai/models

Text Generation API (Default model: 'openai')
Generate (GET): GET https://text.pollinations.ai/{prompt}

Params: prompt*, model, seed, json, system, private
Return: Generated text
Generate (POST): POST https://text.pollinations.ai/

Body: messages*, model, seed, jsonMode
Return: Generated text
OpenAI Compatible: POST https://text.pollinations.ai/openai

Body: Follows OpenAI ChatGPT API format
Return: OpenAI-style response
List Models: GET https://text.pollinations.ai/models

Feed Endpoints
Image Feed: GET https://image.pollinations.ai/feed (SSE stream of user-generated images).

Example: data: { "width":1024, "height":1024, "seed":42, "model":"flux", "imageURL":"https://image.pollinations.ai/prompt/gleaming%20face%20n2xuqsan%2020250205141310", "prompt":"A radiant visage illuminated by soft, ethereal light", ... }

Text Feed: GET https://text.pollinations.ai/feed (SSE stream of user-generated text)

Example: data: { "response": "Cherry Blossom Pink represents the beautiful spring in Tachikawa", "model": "openai", "messages": [openai messages array], ... }

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
private: Set to 'true' to prevent the response from appearing in the public feed. Default: false
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
  "jsonMode": true,  // Optional: Forces the response to be valid JSON
  "private": true    // Optional: Prevents response from appearing in public feed
}
Return: Generated text

Vision Capabilities
The following models support analyzing images through our API:

openai
openai-large
claude-hybridspace
You can pass images either as URLs or base64-encoded data in the messages. See the OpenAI Vision Guide for detailed documentation on the message format.

Note: While we offer other models like Gemini, they currently do not support multimodal (image) inputs.

Example message format with image:

{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What's in this image?"},
        {
          "type": "image_url",
          "image_url": {
            "url": "https://example.com/image.jpg"
          }
        }
      ]
    }
  ],
  "model": "openai"
}
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
Python (Vision)
import base64
import requests

def analyze_image(image_url):
    response = requests.post('https://text.pollinations.ai/openai', json={
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What's in this image?"},
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url}
                    }
                ]
            }
        ],
        "model": "openai"
    })
    return response.json()

# Example usage
result = analyze_image("https://example.com/image.jpg")
print(result['choices'][0]['message']['content'])
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

CHAT MODELS:

[{"name":"openai","type":"chat","censored":true,"description":"OpenAI GPT-4o-mini","baseModel":true,"vision":true},{"name":"openai-large","type":"chat","censored":true,"description":"OpenAI GPT-4o","baseModel":true,"vision":true},{"name":"openai-reasoning","type":"chat","censored":true,"description":"OpenAI o1-mini","baseModel":true,"reasoning":true},{"name":"qwen-coder","type":"chat","censored":true,"description":"Qwen 2.5 Coder 32B","baseModel":true},{"name":"llama","type":"chat","censored":false,"description":"Llama 3.3 70B","baseModel":true},{"name":"mistral","type":"chat","censored":false,"description":"Mistral Nemo","baseModel":true},{"name":"unity","type":"chat","censored":false,"description":"Unity with Mistral Large by Unity AI Lab","baseModel":false},{"name":"midijourney","type":"chat","censored":true,"description":"Midijourney musical transformer","baseModel":false},{"name":"rtist","type":"chat","censored":true,"description":"Rtist image generator by @bqrio","baseModel":false},{"name":"searchgpt","type":"chat","censored":true,"description":"SearchGPT with realtime news and web search","baseModel":false},{"name":"evil","type":"chat","censored":false,"description":"Evil Mode - Experimental","baseModel":false},{"name":"deepseek","type":"chat","censored":true,"description":"DeepSeek-V3","baseModel":true},{"name":"claude-hybridspace","type":"chat","censored":true,"description":"Claude Hybridspace","baseModel":true},{"name":"deepseek-r1","type":"chat","censored":true,"description":"DeepSeek-R1 Distill Qwen 32B","baseModel":true,"reasoning":true,"provider":"cloudflare"},{"name":"deepseek-reasoner","type":"chat","censored":true,"description":"DeepSeek R1 - Full","baseModel":true,"reasoning":true,"provider":"deepseek"},{"name":"llamalight","type":"chat","censored":false,"description":"Llama 3.1 8B Instruct","baseModel":true},{"name":"llamaguard","type":"safety","censored":false,"description":"Llamaguard 7B AWQ","baseModel":false,"provider":"cloudflare"},{"name":"gemini","type":"chat","censored":true,"description":"Gemini 2.0 Flash","baseModel":true,"provider":"google"},{"name":"gemini-thinking","type":"chat","censored":true,"description":"Gemini 2.0 Flash Thinking","baseModel":true,"provider":"google"},{"name":"hormoz","type":"chat","description":"Hormoz 8b by Muhammadreza Haghiri","baseModel":false,"provider":"modal.com","censored":false}]

IMAGE MODELS:

["flux","turbo"]

## Chat Models and Reasoning

The chat interface supports multiple models. Some models have a `reasoning` property; when reasoning mode is enabled, the AI is instructed to provide a detailed chain-of-thought explanation before its final answer. This chain-of-thought is returned as a JSON array in the `reasoning` field and is displayed in a dedicated panel on the chat screen.

## Chat Models

The chat interface supports multiple models. For example:

- `openai`: OpenAI GPT-4o-mini (vision enabled)
- `openai-large`: OpenAI GPT-4o (vision enabled)
- `openai-reasoning`: OpenAI o1-mini (with reasoning)
- `qwen-coder`: Qwen 2.5 Coder 32B
- `llama`: Llama 3.3 70B
- ... and many others.

Models with the `reasoning` property (e.g. `openai-reasoning`, `deepseek-r1`, `deepseek-reasoner`, `gemini-thinking`) will trigger additional reasoning functions within the chat interface.