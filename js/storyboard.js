/**********************************************************
 * BASIC CONFIGURATIONS & GLOBAL STATE
 **********************************************************/
const state = {
  currentFrameCount: 0,
  storyOutline: {},
  reorderModeEnabled: false,
  MAX_FRAMES: 10,
  CONCURRENT_REQUESTS: 3, // Adjust based on API rate limits
  liveStory: [],
  usedCameraAngles: new Set(),
  cameraAngles: [
    "low angle shot", "high angle shot", "bird's eye view",
    "worm's eye view", "eye level shot", "dutch angle",
    "over-the-shoulder shot", "medium shot", "close-up shot",
    "extreme close-up", "wide shot", "extreme wide shot",
    "tracking shot", "POV shot", "two shot"
  ],
  storyContext: {
    currentPhase: 'introduction',
    usedAngles: new Set(),
    lastUsedAngle: null,
    suggestedAngles: []
  },
  cameraAngleContexts: {
    introduction: ["wide shot", "establishing shot", "medium shot"],
    action: ["tracking shot", "dutch angle", "POV shot", "over-the-shoulder shot"],
    drama: ["close-up shot", "extreme close-up", "low angle shot"],
    conclusion: ["high angle shot", "bird's eye view", "extreme wide shot"]
  },
  characterMemory: {
    mainCharacter: null,
    supportingCharacters: [],
    location: null,
    baseScenario: null,
    parsedDetails: null
  },
  storyProgression: {
    phases: ['setup', 'confrontation', 'resolution'],
    currentPhase: 'setup',
    keyEvents: [],
    completedEvents: new Set(),
    tensionCurve: 0,
    phaseTransitions: {
      setup: 0.25,         // First 25% of frames
      confrontation: 0.75, // Next 50% of frames
      resolution: 1.0      // Final 25% of frames
    }
  },
  storyMemory: {
    baseCharacters: null,
    baseLocation: null,
    currentLocation: null,
    previousActions: new Set(),
    storyArc: {
      setup: [],
      confrontation: [],
      resolution: []
    },
    locationChanges: []
  },
  characterEngagement: {
    reminder: "Characters should be naturally engaged in their actions match the scene's activity."
  },
  retryConfig: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 1.5
  },
  generation: {
    isGenerating: false,
    shouldStop: false,
    timeoutMs: 60000, // 1 minute timeout per frame
    currentFrame: null,
    errors: []
  },
  storyDiversity: {
    usedSceneTypes: new Set(),
    usedElements: new Set(),
    requiredElements: [],
    themeKeywords: [],
    toneSettings: {
      genre: null,
      mood: null,
      intensity: 0.5
    },
    sceneSeeds: [],
    noveltyScore: 0
  },
  sceneTypes: {
    action: ["chase", "confrontation", "escape", "battle", "rescue"],
    drama: ["revelation", "decision", "conversation", "reflection", "loss"],
    transition: ["journey", "discovery", "transformation", "aftermath", "preparation"],
    atmosphere: ["mystery", "tension", "joy", "sorrow", "wonder"]
  }
};

/**********************************************************
 * DEFAULT NEGATIVE PROMPT
 **********************************************************/
const defaultNegativePrompt =
  "ensure that there is no low quality, blurry, bad anatomy, out of frame, direct eye contact, facing viewer, looking at viewer, static portrait poses, posing, photography studio, staged photos, awareness of camera, posed shots, deliberate posing, symmetrical stance, centered composition, centered pose, centered framing";

/**********************************************************
 * STYLE TEMPLATES
 **********************************************************/
const styleTemplates = {
  None: {
    description: "no specific style, plain and unstyled",
    negativePrompt: "avoid any complex details or artistic elements"
  },
  "Pixel Art": {
    description:
      "classic pixel art style, 16-bit aesthetic, carefully crafted pixel details, vibrant retro charm",
    negativePrompt: "avoid realistic textures, high resolution, or smooth shading"
  },
  Cinematic: {
    description:
      "cinematic masterpiece, dramatic lighting, filmic color grading, strong atmosphere",
    negativePrompt: "avoid flat lighting or dull composition"
  },
  Anime: {
    description:
      "vivid color schemes, expressive characters, stylized lines, cinematic anime atmosphere",
    negativePrompt: "avoid overly realistic anatomy or muted colors"
  },
  Realistic: {
    description:
      "photorealistic style, meticulous textures, lifelike proportions, natural lighting",
    negativePrompt: "avoid cartoonish elements or simplified details"
  },
  Mix: {
    description:
      "a fusion of multiple art styles (e.g., Cinematic plus Pixel Art)",
    negativePrompt: "avoid uniform or single-style elements"
  },
  Storyboard: {
    description:
      "simple storyboard style, hand-drawn sketches, quick shading, comic lines",
    negativePrompt: "avoid detailed rendering or complex painting"
  },
  "Film Noir": {
    description:
      "high-contrast black & white, deep shadows, moody vintage atmosphere",
    negativePrompt: "avoid bright colors or modern aesthetics"
  },
  Vintage: {
    description:
      "faded colors, nostalgic film grain, old photographic look, warm tones",
    negativePrompt: "avoid modern saturated color or clarity"
  },
  "Graphic Design": {
    description:
      "clean layouts, bold typography, strong shapes, minimalist composition",
    negativePrompt: "avoid cluttered or chaotic visual elements"
  },
  Cartoon: {
    description:
      "bold outlines, exaggerated features, vibrant colors, playful comedic style",
    negativePrompt: "avoid realistic textures or muted tones"
  },
  Watercolor: {
    description:
      "delicate watercolor painting style, soft brush strokes, pastel tones, organic textures",
    negativePrompt: "avoid hard edges or digital precision"
  },
  Surrealism: {
    description:
      "dreamlike imagery, abstract forms, unusual compositions, fusion of reality & imagination",
    negativePrompt: "avoid strictly realistic or logical structures"
  },
  "Comics Style": {
    description:
      "bold outlines, dynamic panels, halftone patterns, reminiscent of classic Marvel/DC comics",
    negativePrompt: "avoid photorealistic shading or subtle transitions"
  },
  "Concept Art": {
    description:
      "detailed environment, imaginative design, rough painterly strokes typical of concept art",
    negativePrompt: "avoid overly simple or mundane designs"
  },
  "Paper Cut-Out": {
    description:
      "layered colored paper effect, stylized shapes, slight shadow layering",
    negativePrompt:
      "avoid realistic textures, or finely detailed painting"
  },
  "AI Comics": {
    description:
      "AI-generated comic style, semi-realistic lines, comedic composition, digital shading",
    negativePrompt:
      "avoid purely hand-drawn or extremely rough sketches, or super-detailed realism"
  }
};

/**********************************************************
 * API ENDPOINTS
 **********************************************************/
const apiEndpoints = {
  // For images:
  imageGeneration: "https://image.pollinations.ai/prompt/"
  // For text, we'll define dynamic endpoints inside textModels below
};

/**********************************************************
 * CAMERA ANGLE & PROMPT HELPERS
 **********************************************************/
 /**
  * Returns an unused camera angle for the current phase, if available
  */
function getUniqueCameraAngle(phase) {
  // Prioritize angles that create natural scene composition
  const priorityAngles = [
    "wide shot",
    "tracking shot",
    "dutch angle",
    "bird's eye view",
    "establishing shot"
  ];

  // Check priority angles first if they match the phase
  for (let angle of priorityAngles) {
    if (!state.storyContext.usedAngles.has(angle) && 
        (!state.cameraAngleContexts[phase] || state.cameraAngleContexts[phase].includes(angle))) {
      state.storyContext.usedAngles.add(angle);
      state.storyContext.lastUsedAngle = angle;
      return angle;
    }
  }

  // Then proceed with phase-specific angles
  const phaseAngles = state.cameraAngleContexts[phase] || [];
  for (let angle of phaseAngles) {
    if (!state.storyContext.usedAngles.has(angle)) {
      state.storyContext.usedAngles.add(angle);
      state.storyContext.lastUsedAngle = angle;
      return angle;
    }
  }

  // Then any remaining angle
  for (let angle of state.cameraAngles) {
    if (!state.storyContext.usedAngles.has(angle)) {
      state.storyContext.usedAngles.add(angle);
      state.storyContext.lastUsedAngle = angle;
      return angle;
    }
  }

  return "wide shot"; // Changed default to a more natural scene composition
}

/**
 * Basic fallback prompt builder if JSON parse fails
 */
function buildBasicPrompt(basePrompt, characters, location, styleKey, negativePrompt) {
  const sections = [
    `Setting: ${location}.`,
    `Focus: ${characters}.`,
    `Action sequence: ${basePrompt}.`,
    styleTemplates[styleKey]?.description ? 
      `Artistic style: ${styleKey} - ${styleTemplates[styleKey].description}` : "",
    `Technical requirements: high detail, clear focus, proper anatomy and positioning`,
    negativePrompt ? `Avoid: ${negativePrompt}` : ""
  ];

  return sections
    .filter(section => section && section.trim() !== "")
    .join(" ");
}

/**
 * Build final image prompt from the JSON stored in #prompt-{frameNumber}
 */
function buildPromptForImage(basePrompt, styleKey, negativePrompt = "") {
  try {
    const promptData = JSON.parse(basePrompt);
    const styleInfo = styleTemplates[styleKey];
    const cameraAngle = promptData.camera || "";
    const sceneCharacters = promptData.characters || "";
    const locationDetails = promptData.location || "";
    const action = promptData.action || "";
    const emotion = promptData.emotion || "";
    const background = promptData.background || "";
    const title = promptData.title || "";

    // Build a more structured prompt with clear sections
    const sections = [
      // Title
      title ? `**Title:** ${title}.` : "",

      // Scene Context
      `**Location/Setting:** ${locationDetails}.`, // Location first

      // Background
      background ? `**Background:** ${background}.` : "",

      // Character Description
      `**Characters:** ${sceneCharacters}.`, // Detailed character descriptions

      // Action with Characters
      `**Action:** ${action}.`, // Specific actions involving characters

      // Emotion
      emotion ? `**Emotion:** ${emotion}.` : "",

      // Camera Plan
      cameraAngle ? `**Camera Angle:** ${cameraAngle}.` : "",

      // Character Placement and Interactions
      `**Character Placement and Interactions:** ${promptData.characterPlacement || "Characters are positioned naturally within the scene, interacting appropriately based on the action."}.`,

      // Specific Positioning and Movement in Actions
      `**Positioning and Movement:** ${promptData.positioningMovement || "Characters are depicted with clear positioning and dynamic movement to convey the action effectively."}.`,

      // Artistic Style
      styleInfo?.description ? `**Artistic Style:** ${styleKey} - ${styleInfo.description}` : "",

      // Technical Requirements
      `**Technical Requirements:** high detail, clear focus on the action, proper anatomy and positioning, balanced lighting, high resolution, and sharpness.`,

      // Avoid Problematic Elements
      negativePrompt ? `**Avoid:** ${negativePrompt}` : ""
    ];

    // Combine all sections, filtering out empty ones
    const finalPrompt = sections
      .filter(section => section && section.trim() !== "")
      .join("\n\n"); // Use double newline for clear separation

    return finalPrompt;
  } catch (err) {
    console.error("buildPromptForImage error:", err);
    return basePrompt; // fallback
  }
}

/**********************************************************
 * TEXT GENERATION MODELS
 **********************************************************/
const textModels = {
  openai: {
    name: "openai",
    type: "chat",
    censored: true,
    description: "OpenAI GPT-4o-mini",
    baseModel: true,
    vision: true,
    endpoint: "https://text.pollinations.ai/openai"
  },
  "openai-large": {
    name: "openai-large",
    type: "chat",
    censored: true,
    description: "OpenAI GPT-4o",
    baseModel: true,
    vision: true,
    endpoint: "https://text.pollinations.ai/openai-large"
  },
  "openai-reasoning": {
    name: "openai-reasoning",
    type: "chat",
    censored: true,
    description: "OpenAI o1-mini",
    baseModel: true,
    reasoning: true,
    endpoint: "https://text.pollinations.ai/openai-reasoning"
  },
  "qwen-coder": {
    name: "qwen-coder",
    type: "chat",
    censored: true,
    description: "Qwen 2.5 Coder 32B",
    baseModel: true,
    endpoint: "https://text.pollinations.ai/qwen-coder"
  },
  llama: {
    name: "llama",
    type: "chat",
    censored: false,
    description: "Llama 3.3 70B",
    baseModel: true,
    endpoint: "https://text.pollinations.ai/llama"
  },
  mistral: {
    name: "mistral",
    type: "chat",
    censored: false,
    description: "Mistral Nemo",
    baseModel: true,
    endpoint: "https://text.pollinations.ai/mistral"
  },
  unity: {
    name: "unity",
    type: "chat",
    censored: false,
    description: "Unity with Mistral Large by Unity AI Lab",
    baseModel: false,
    endpoint: "https://text.pollinations.ai/unity"
  },
  midijourney: {
    name: "midijourney",
    type: "chat",
    censored: true,
    description: "Midijourney musical transformer",
    baseModel: false,
    endpoint: "https://text.pollinations.ai/midijourney"
  },
  rtist: {
    name: "rtist",
    type: "chat",
    censored: true,
    description: "Rtist image generator by @bqrio",
    baseModel: false,
    endpoint: "https://text.pollinations.ai/rtist"
  },
  searchgpt: {
    name: "searchgpt",
    type: "chat",
    censored: true,
    description: "SearchGPT with realtime news and web search",
    baseModel: false,
    endpoint: "https://text.pollinations.ai/searchgpt"
  },
  evil: {
    name: "evil",
    type: "chat",
    censored: false,
    description: "Evil Mode - Experimental",
    baseModel: false,
    endpoint: "https://text.pollinations.ai/evil"
  },
  deepseek: {
    name: "deepseek",
    type: "chat",
    censored: true,
    description: "DeepSeek-V3",
    baseModel: true,
    endpoint: "https://text.pollinations.ai/deepseek"
  },
  "claude-hybridspace": {
    name: "claude-hybridspace",
    type: "chat",
    censored: true,
    description: "Claude Hybridspace",
    baseModel: true,
    endpoint: "https://text.pollinations.ai/claude-hybridspace"
  },
  "deepseek-r1": {
    name: "deepseek-r1",
    type: "chat",
    censored: true,
    description: "DeepSeek-R1 Distill Qwen 32B",
    baseModel: true,
    reasoning: true,
    provider: "cloudflare",
    endpoint: "https://text.pollinations.ai/deepseek-r1"
  },
  "deepseek-reasoner": {
    name: "deepseek-reasoner",
    type: "chat",
    censored: true,
    description: "DeepSeek R1 - Full",
    baseModel: true,
    reasoning: true,
    provider: "deepseek",
    endpoint: "https://text.pollinations.ai/deepseek-reasoner"
  },
  llamalight: {
    name: "llamalight",
    type: "chat",
    censored: false,
    description: "Llama 3.1 8B Instruct",
    baseModel: true,
    endpoint: "https://text.pollinations.ai/llamalight"
  },
  gemini: {
    name: "gemini",
    type: "chat",
    censored: true,
    description: "Gemini 2.0 Flash",
    baseModel: true,
    provider: "google",
    endpoint: "https://text.pollinations.ai/gemini"
  },
  "gemini-thinking": {
    name: "gemini-thinking",
    type: "chat",
    censored: true,
    description: "Gemini 2.0 Flash Thinking",
    baseModel: true,
    provider: "google",
    endpoint: "https://text.pollinations.ai/gemini-thinking"
  },
  hormoz: {
    name: "hormoz",
    type: "chat",
    censored: false,
    description: "Hormoz 8b by Muhammadreza Haghiri",
    baseModel: false,
    provider: "modal.com",
    endpoint: "https://text.pollinations.ai/hormoz"
  }
};

/**********************************************************
 * TEXT GENERATION (CALLING POLLINATIONS AI)
 **********************************************************/
async function callOpenAIAPI(userMessage) {
  try {
    const chosenModel = document.getElementById("textModelSelection").value;
    const modelConfig = textModels[chosenModel];
    
    if (!modelConfig) {
      throw new Error('Invalid model selected');
    }

    // Try primary endpoint first
    let response = await attemptAPICall(modelConfig.endpoint, userMessage, modelConfig);

    // If primary fails, try fallback models in sequence
    if (!response) {
      console.log('Primary model failed, trying fallbacks...');
      for (const [modelKey, fallbackModel] of Object.entries(textModels)) {
        if (modelKey !== chosenModel) {
          response = await attemptAPICall(fallbackModel.endpoint, userMessage, fallbackModel);
          if (response) {
            console.log(`Successfully used fallback model: ${modelKey}`);
            break;
          }
        }
      }
    }

    // If all models fail, use local fallback
    if (!response) {
      console.warn('All API attempts failed, using local fallback');
      return generateLocalFallbackResponse(userMessage);
    }

    return response;

  } catch (error) {
    console.error("Text generation error:", error);
    return generateLocalFallbackResponse(userMessage);
  }
}

/**
 * Attempt API call with error handling
 */
async function attemptAPICall(endpoint, userMessage, modelConfig) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You must produce valid JSON with string values. Include as many of these keys as possible: title, action, background, characters, location, camera, emotion, narration, storyProgress, characterPlacement, positioningMovement."
          },
          { role: "user", content: userMessage }
        ],
        model: "openai",
        seed: Math.floor(Math.random() * 100000),
        jsonMode: true,
        censored: true
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response format');
    }

    let content = data.choices[0].message.content.trim();
    content = content.replace(/```json|```/g, "").trim();
    
    try {
      const parsed = JSON.parse(content);
      return addMissingFields(parsed);
    } catch (parseError) {
      console.warn('JSON parse error:', parseError);
      return createFallbackResponse(userMessage);
    }

  } catch (error) {
    console.warn(`API attempt failed:`, error);
    return null;
  }
}

/**
 * Add missing fields with default values
 */
function addMissingFields(response) {
  const defaults = {
    title: "Untitled Scene",
    action: "Scene continues",
    background: "Simple background",
    characters: "Characters in scene",
    location: "Current location",
    camera: "Default camera angle",
    emotion: "Neutral",
    narration: "The story continues",
    storyProgress: "Story in progress",
    characterPlacement: "Characters positioned naturally",
    positioningMovement: "Natural movement and positioning"
  };

  // Add any missing fields from defaults
  Object.keys(defaults).forEach(key => {
    if (!response[key]) {
      response[key] = defaults[key];
    }
  });

  return response;
}

/**
 * Create fallback response with basic structure
 */
function createFallbackResponse(userMessage) {
  return {
    title: "Scene",
    action: "The story continues",
    background: "A suitable background",
    characters: extractCharacters(userMessage),
    location: extractLocation(userMessage),
    camera: "Medium shot",
    emotion: "Neutral",
    narration: "The scene progresses",
    storyProgress: "Story continues naturally",
    characterPlacement: "Characters are positioned appropriately",
    positioningMovement: "Characters move naturally in the scene"
  };
}

/**
 * Extract potential character information from user message
 */
function extractCharacters(message) {
  const characterMatch = message.match(/characters?:([^.!?\n]+)/i);
  return characterMatch ? characterMatch[1].trim() : "Characters in scene";
}

/**
 * Extract potential location information from user message
 */
function extractLocation(message) {
  const locationMatch = message.match(/location:([^.!?\n]+)/i);
  return locationMatch ? locationMatch[1].trim() : "Current location";
}

/**********************************************************
 * DETERMINE STORY PHASE FOR CAMERA ANGLES
 **********************************************************/
function determineStoryPhase(frameNumber, totalFrames) {
  const progress = frameNumber / totalFrames;
  if (progress <= 0.25) return 'introduction';
  if (progress <= 0.75) return progress <= 0.5 ? 'action' : 'drama';
  return 'conclusion';
}

/**********************************************************
 * GENERATE JSON FOR EACH FRAME
 **********************************************************/
async function generateFrameText(frameNumber) {
  const scenario = document.getElementById("scenarioInput").value.trim();
  const progress = frameNumber / state.currentFrameCount;

  let currentPhase = 'setup';
  for (const [phase, threshold] of Object.entries(state.storyProgression.phaseTransitions)) {
    if (progress <= threshold) {
      currentPhase = phase;
      break;
    }
  }
  // Force final frame to resolution
  if (frameNumber === state.currentFrameCount) {
    currentPhase = 'resolution';
  }
  state.storyProgression.currentPhase = currentPhase;

  // Phase prompts
  const phasePrompts = {
    setup: `Introduce the detailed story world including any necessary elements and introduce detailed characters with comprehensive descriptions (appearance, personality, abilities, colors, etc.), including side-characters if needed. Ensure locations are described consistently and chronologically. If this is frame 1, define main characters in detail & setting.`,
    confrontation: `Raise conflict and develop the storyline. Possibly change location if logical. Maintain consistency with prior frames and develop characters' interactions.`,
    resolution: `Conclude or wrap up the story. Include any logical plot twists. Ensure consistency with prior frames and resolve conflicts introduced during the confrontation phase.`
  };

  // Tension curve
  state.storyProgression.tensionCurve =
    progress < 0.5 
      ? progress * 2
      : progress < 0.75 
        ? 2 - (progress * 2)
        : (1 - progress) * 2;

  // Unique camera angle for this frame
  const storyPhase = determineStoryPhase(frameNumber, state.currentFrameCount);
  const chosenCameraAngle = getUniqueCameraAngle(storyPhase);

  // Enhance the prompt with scene diversity
  const enhancedPrompt = await enhanceSceneDiversity(frameNumber, scenario);
  const userPrompt = `
You are creating a single story frame in a chronological sequence.
${enhancedPrompt}

Frame #${frameNumber} of ${state.currentFrameCount}
Phase: ${currentPhase}
Progress: ${Math.round(progress * 100)}%

Continuity rules:
- Base characters: ${state.storyMemory.baseCharacters || "None yet"}
- Original location: ${state.storyMemory.baseLocation || "None yet"}
- Previous actions used: ${Array.from(state.storyMemory.previousActions).join(', ') || "None yet"}
- Current location: ${state.storyMemory.currentLocation || "Unknown"}

Your objective:
${phasePrompts[currentPhase]}

Camera angle must be: "${chosenCameraAngle}"

Output strictly valid JSON with the following keys (string values only):
{
  "title": "Title of the frame",
  "action": "Detailed action/story",
  "background": "Detailed background description",
  "characters": "Use same descriptions from frame 1 (only if known) + new if introduced",
  "location": "Keep or change logically",
  "camera": "Must be ${chosenCameraAngle}",
  "emotion": "Emotional vibe or tone",
  "narration": "How this moment fits the overall story",
  "storyProgress": "Key event or detail",
  "characterPlacement": "Describe the placement of each character within the scene",
  "positioningMovement": "Describe the specific positioning and movement of characters during the action"
}
`;

  const response = await callOpenAIAPI(userPrompt);
  if (response) {
    state.storyMemory.previousActions.add(response.action);
    return maintainStoryConsistency(frameNumber, response);
  }
  return null;
}

/**********************************************************
 * IMAGE GENERATION
 **********************************************************/
async function callImageGenerationAPI(prompt, options = {}) {
  try {
    const {
      model = "flux",
      seed = Math.floor(Math.random() * 100000),
      width = 1024,
      height = 1024,
      nologo = true,
      privateImage = false,
      enhance = false,
      safe = false
    } = options;

    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${apiEndpoints.imageGeneration}${encodedPrompt}?model=${model}&seed=${seed}&width=${width}&height=${height}&nologo=${nologo}&private=${privateImage}&enhance=${enhance}&safe=${safe}`;
    
    console.log('Calling image API with URL:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      console.error('Image API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Image API Error: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Received empty image data');
    }
    
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Image generation error:', error);
    // Show error in UI
    const container = document.createElement('div');
    container.className = 'styled-alert error';
    container.innerHTML = `
      <div class="alert-content">
        <i class="fas fa-exclamation-circle"></i>
        <p>Image generation failed: ${error.message}</p>
        <p>Please try again or check your connection.</p>
      </div>
    `;
    document.body.appendChild(container);
    setTimeout(() => {
      container.classList.add('fade-out');
      setTimeout(() => container.remove(), 500);
    }, 5000);
    
    return null;
  }
}

/**********************************************************
 * MAIN STORYBOARD GENERATION
 **********************************************************/
async function generateStoryboard() {
  // Early return if already generating
  if (state.generation.isGenerating) {
    alert("Generation already in progress");
    return;
  }

  try {
    state.generation.isGenerating = true;
    state.generation.shouldStop = false;
    state.generation.errors = [];
    
    // Add stop button to overlay
    const overlay = document.getElementById("overlay");
    const stopBtn = document.createElement("button");
    stopBtn.className = "stop-generation-btn";
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Generation';
    stopBtn.onclick = forceStopGeneration;
    overlay.appendChild(stopBtn);

    const scenario = document.getElementById("scenarioInput").value.trim();
    if (!scenario) {
      const container = document.createElement('div');
      container.className = 'styled-alert';
      container.innerHTML = `
        <div class="alert-content">
          <i class="fas fa-info-circle"></i>
          <p>Please enter a story scenario before generating.</p>
        </div>
      `;
      document.body.appendChild(container);
      setTimeout(() => {
        container.classList.add('fade-out');
        setTimeout(() => container.remove(), 500);
      }, 3000);
      return;
    }

    // Check if any frames exist
    const existingFrames = document.querySelectorAll('.image-container[id^="frame-"]');
    if (existingFrames.length === 0) {
      const container = document.createElement('div');
      container.className = 'styled-alert';
      container.innerHTML = `
        <div class="alert-content">
          <i class="fas fa-film"></i>
          <p>Add at least one frame to begin your storyboard.</p>
        </div>
      `;
      document.body.appendChild(container);
      setTimeout(() => {
        container.classList.add('fade-out');
        setTimeout(() => container.remove(), 500);
      }, 3000);
      return;
    }

    // Check if story has changed
    if (hasStoryChanged()) {
      const shouldRegenerate = confirm("Would you like to generate all frames with the new story?");
      if (shouldRegenerate) {
        clearGeneratedContent();
        // Reset story-related state
        state.usedCameraAngles.clear();
        state.storyContext = {
          currentPhase: 'introduction',
          usedAngles: new Set(),
          lastUsedAngle: null,
          suggestedAngles: []
        };
        state.characterMemory = {
          mainCharacter: null,
          supportingCharacters: [],
          location: null,
          baseScenario: null,
          parsedDetails: null
        };
        state.storyMemory = {
          baseCharacters: null,
          baseLocation: null,
          currentLocation: null,
          previousActions: new Set(),
          storyArc: {
            setup: [],
            confrontation: [],
            resolution: []
          },
          locationChanges: []
        };
      } else {
        return;
      }
    }

    // Lock UI
    toggleControls(false);
    document.getElementById("overlay").style.display = "flex";
    updateProgressBar(0);
    document.getElementById("aiMessage").textContent = "Generating storyboard text...";

    // Merge user negative prompt
    const userNeg = document.getElementById("negativePromptInput").value.trim();
    const mergedNegativePrompt = `${defaultNegativePrompt}, ${userNeg}`;

    // Initialize diversity settings from UI inputs
    const theme = document.getElementById("themeInput")?.value || '';
    const elements = (document.getElementById("elementsInput")?.value || '').split(',') || [];
    const tone = {
      genre: document.getElementById("genreSelect")?.value
    };

    const storyDetails = await initializeStoryDetails();
    if (!storyDetails) {
      alert("Failed to parse scenario. Please try again.");
      toggleControls(true);
      document.getElementById("overlay").style.display = "none";
      return;
    }

    // 2) Generate text for each frame
    for (let i = 1; i <= state.currentFrameCount; i++) {
      if (state.generation.shouldStop) {
        console.log("Generation stopped by user");
        break;
      }

      state.generation.currentFrame = i;
      
      // Set timeout for frame generation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Frame ${i} generation timed out`)), state.generation.timeoutMs);
      });

      try {
        const frameData = await Promise.race([
          generateFrameText(i),
          timeoutPromise
        ]);

        if (!frameData) {
          throw new Error(`No data returned for frame ${i}`);
        }

        fillFrameWithDetails(i, frameData);
        await generateFrameImage(i, mergedNegativePrompt);
        
        updateProgressBar((i / state.currentFrameCount) * 100);
      } catch (error) {
        console.error(`Error generating frame ${i}:`, error);
        state.generation.errors.push({ frame: i, error: error.message });
        
        // Show error but continue with next frame
        showErrorAlert(`Error in frame ${i}: ${error.message}. Continuing with next frame...`);
        continue;
      }
    }

    // Show final status
    if (state.generation.errors.length > 0) {
      const errorSummary = state.generation.errors
        .map(e => `Frame ${e.frame}: ${e.error}`)
        .join('\n');
      console.error('Generation completed with errors:', errorSummary);
      alert(`Generation completed with ${state.generation.errors.length} errors. Check console for details.`);
    } else if (!state.generation.shouldStop) {
      alert("Storyboard generated successfully!");
    }

  } catch (error) {
    console.error('Storyboard generation failed:', error);
    alert('Storyboard generation failed. Please try again.');
  } finally {
    // Clean up
    state.generation.isGenerating = false;
    state.generation.currentFrame = null;
    state.generation.shouldStop = false;
    state.generation.errors = [];
    document.getElementById("overlay").style.display = "none";
    toggleControls(true);
    
    // Remove stop button
    const stopBtn = document.querySelector('.stop-generation-btn');
    if (stopBtn) stopBtn.remove();
  }
}

/**
 * Build images for each frame
 */
async function generateFrameImage(frameNumber, negativePrompt) {
  const frame = document.getElementById(`frame-${frameNumber}`);
  if (!frame) {
    throw new Error(`Frame ${frameNumber} not found`);
  }

  const imgEl = document.getElementById(`image-${frameNumber}`);
  if (!imgEl) {
    throw new Error(`Image element for frame ${frameNumber} not found`);
  }

  // Clear any existing classes
  frame.classList.remove('has-image');
  imgEl.style.display = 'none';

  const generateImage = async () => {
    const basePrompt = document.getElementById(`prompt-${frameNumber}`).value.trim();
    const styleKey = frame.getAttribute("data-style");
    const imageModel = document.getElementById("modelSelection").value;
    const aspect = document.getElementById(`aspectRatio-${frameNumber}`).value;
    const [w, h] = getDimensionsFromAspect(aspect);

    const finalPrompt = buildPromptForImage(basePrompt, styleKey, negativePrompt);
    console.log(`Generating image for frame ${frameNumber} with prompt:`, finalPrompt);

    return await callImageGenerationAPI(finalPrompt, {
      model: imageModel,
      width: w,
      height: h,
      nologo: true,
      privateImage: false,
      enhance: false,
      safe: false
    });
  };

  try {
    const imgUrl = await withRetry(generateImage, {
      maxAttempts: 3,
      delayMs: 2000,
      backoffMultiplier: 1.5,
      timeout: state.generation.timeoutMs
    });

    if (state.generation.shouldStop) {
      throw new Error('Generation stopped by user');
    }

    if (imgUrl) {
      return new Promise((resolve, reject) => {
        imgEl.onload = () => {
          imgEl.style.display = 'block';
          frame.classList.add('has-image');
          resolve(true);
        };
        
        imgEl.onerror = () => {
          reject(new Error(`Failed to load image for frame ${frameNumber}`));
        };
        
        imgEl.src = imgUrl;
      });
    }
  } catch (error) {
    if (!state.generation.shouldStop) {
      console.error(`Error generating image for frame ${frameNumber}:`, error);
      showErrorAlert(`Failed to generate image for frame ${frameNumber}. ${error.message}`);
    }
    throw error;
  }
}

/**********************************************************
 * FILL FRAME DETAILS
 **********************************************************/
function fillFrameWithDetails(frameNum, details) {
  // For frames after #1, keep the same "characters" from base
  if (frameNum > 1 && state.storyMemory.baseCharacters) {
    details.characters = state.storyMemory.baseCharacters;
  }

  // Ensure required keys
  const requiredKeys = [
    "title",
    "action",
    "background",
    "narration",
    "emotion",
    "characters",
    "location",
    "camera",
    "storyProgress",
    "characterPlacement",
    "positioningMovement"
  ];
  requiredKeys.forEach(k => {
    if (!details[k]) details[k] = `Unknown ${k}`;
  });
  // Also store a .prompt for clarity
  details.prompt = `Frame #${frameNum} details.`;

  // Save the JSON in #prompt-{frameNum}
  document.getElementById(`prompt-${frameNum}`).value = JSON.stringify(details);

  // Fill in textual fields
  document.getElementById(`title-${frameNum}`).value = details.title;
  document.getElementById(`action-${frameNum}`).value = details.action;
  document.getElementById(`background-${frameNum}`).value = details.background;
  document.getElementById(`characters-${frameNum}`).value = details.characters;
  document.getElementById(`location-${frameNum}`).value = details.location;
  document.getElementById(`camera-${frameNum}`).value = details.camera;
  
  const narrationDiv = document.getElementById(`narration-${frameNum}`);
  narrationDiv.textContent = details.narration;
  narrationDiv.parentElement.style.display = "block";

  // Update data-style
  const styleKey = document.getElementById("styleSelection").value;
  const frame = document.getElementById(`frame-${frameNum}`);
  frame.setAttribute("data-style", styleKey);

  if (details.camera) {
    frame.setAttribute('data-camera-angle', details.camera);
  }
  if (details.action) {
    frame.setAttribute('data-character-action', details.action);
  }
  if (details.storyProgress) {
    frame.setAttribute('data-story-progress', details.storyProgress);
  }

  // If it's the first frame, update character memory
  if (frameNum === 1) {
    updateCharacterMemory(JSON.stringify(details));
  }

  updateLiveStory(frameNum, details);
}

/**********************************************************
 * REGENERATE A SINGLE FRAME
 **********************************************************/
async function regenerateFrame(frameNum) {
  try {
    document.getElementById("overlay").style.display = "flex";
    document.getElementById("aiMessage").textContent = `Regenerating Frame ${frameNum}...`;
    updateProgressBar(0);

    // Generate frame text with retry
    const generateFrameText = async () => {
      const frameData = await generateFrameText(frameNum);
      if (!frameData) throw new Error('Failed to generate frame text');
      return frameData;
    };

    const frameData = await withRetry(generateFrameText, {
      maxAttempts: 3,
      delayMs: 1500
    });

    fillFrameWithDetails(frameNum, frameData);
    updateProgressBar(50);

    // Generate image with existing retry logic
    const negativePrompt = document.getElementById("negativePromptInput").value.trim();
    const mergedNegative = `${defaultNegativePrompt}, ${negativePrompt}`;
    
    await generateFrameImage(frameNum, mergedNegative);
    updateProgressBar(100);

    document.getElementById("aiMessage").textContent = "Frame regenerated successfully!";
    setTimeout(() => {
      document.getElementById("overlay").style.display = "none";
    }, 800);

  } catch (error) {
    console.error('Frame regeneration error:', error);
    showErrorAlert(`Error regenerating frame ${frameNum}. Retrying...`);
    document.getElementById("overlay").style.display = "none";
  }
}

/**********************************************************
 * ASPECT RATIO -> DIMENSIONS
 **********************************************************/
function getDimensionsFromAspect(aspect) {
  switch (aspect) {
    case "16:9":
      return [1920, 1080];
    case "4:3":
      return [1600, 1200];
    case "9:16":
      return [1080, 1920];
    case "1:1":
      return [1080, 1080];
    default:
      return [1024, 1024];
  }
}

/**********************************************************
 * PROGRESS BAR
 **********************************************************/
function updateProgressBar(pct) {
  const progressBar = document.getElementById("progressBar");
  if (progressBar) {
    progressBar.style.width = `${pct || 0}%`;
  }
}

/**********************************************************
 * FRAME CREATION / REMOVAL
 **********************************************************/
function addFrame() {
  if (state.currentFrameCount >= state.MAX_FRAMES) {
    alert(`Max frames reached (${state.MAX_FRAMES}). Remove some before adding.`);
    return;
  }
  state.currentFrameCount++;
  const framesContainer = document.getElementById("storyboardFrames");
  const frameNum = state.currentFrameCount;

  const style = document.getElementById("styleSelection").value;
  const frame = document.createElement("div");
  frame.classList.add("image-container");
  frame.id = `frame-${frameNum}`;
  frame.setAttribute("draggable", "false");
  frame.setAttribute("data-style", style);

  frame.innerHTML = `
    <div class="frame-header">
      <h3>Frame ${frameNum}: <input type="text" id="title-${frameNum}" placeholder="Frame Title..." aria-label="Frame Title" /></h3>
      <button
        class="remove-frame-btn tooltip"
        aria-label="Remove frame"
        data-tooltip-text="Remove frame"
      >
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
    <div class="input-group">
      <label for="characters-${frameNum}">Characters:</label>
      <textarea
        id="characters-${frameNum}"
        placeholder="Describe characters..."
        rows="2"
        aria-label="Characters"
      ></textarea>
    </div>
    <div class="input-group">
      <label for="location-${frameNum}">Location:</label>
      <input
        type="text"
        id="location-${frameNum}"
        placeholder="Specific location..."
        aria-label="Location"
      />
    </div>
    <div class="input-group">
      <label for="camera-${frameNum}">Camera Angle:</label>
      <input
        type="text"
        id="camera-${frameNum}"
        placeholder="Describe camera angle..."
        aria-label="Camera Angle"
      />
    </div>
    <div class="input-group">
      <label for="action-${frameNum}">Action/Story:</label>
      <textarea
        id="action-${frameNum}"
        placeholder="Describe the action or story..."
        rows="3"
        aria-label="Action/Story"
      ></textarea>
    </div>
    <div class="input-group">
      <label for="background-${frameNum}">Background:</label>
      <textarea
        id="background-${frameNum}"
        placeholder="Describe the background..."
        rows="3"
        aria-label="Background"
      ></textarea>
    </div>
    <div class="input-group">
      <label for="aspectRatio-${frameNum}">Aspect Ratio:</label>
      <select
        id="aspectRatio-${frameNum}"
        aria-label="Select an Aspect ratio"
      >
        <option value="16:9">16:9</option>
        <option value="4:3">4:3</option>
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
      </select>
    </div>
    <div class="input-group">
      <label>Generated Image:</label>
      <div class="image-container-wrapper">
        <img
          id="image-${frameNum}"
          src="#"
          alt="Generated image"
          loading="lazy"
          style="display:none; cursor:pointer;"
          aria-label="Generated Image"
        />
        <button
          class="view-prompt-btn tooltip"
          onclick="viewFullPrompt(${frameNum})"
          aria-label="View full AI prompt"
          data-tooltip-text="View full AI prompt"
        >
          <i class="fas fa-eye"></i>
        </button>
      </div>
    </div>
    <div
      class="input-group narration-group"
      style="margin-top:10px; display:none;"
    >
      <label>Scene:</label>
      <div
        class="narration-text"
        id="narration-${frameNum}"
        style="font-style:italic;"
        aria-live="polite"
        aria-label="Scene Narration"
      ></div>
    </div>
    <input type="hidden" id="prompt-${frameNum}" />
    <button
      class="generate tooltip regenerate-frame-btn"
      style="margin-top:10px;"
      aria-label="Regenerate frame"
      data-tooltip-text="Regenerate current frame"
    >
      <i class="fas fa-sync-alt"></i> REGENERATE FRAME
    </button>
  `;

  framesContainer.appendChild(frame);
  attachFrameEventListeners(frameNum);
}

function removeFrame(num) {
  const frame = document.getElementById(`frame-${num}`);
  if (frame) {
    frame.remove();
    state.currentFrameCount--;
    reindexFrames();
  }
}

function attachFrameEventListeners(frameNumber) {
  const frame = document.getElementById(`frame-${frameNumber}`);
  if (frame) {
    const removeBtn = frame.querySelector(".remove-frame-btn");
    removeBtn.addEventListener("click", () => removeFrame(frameNumber));

    const regenBtn = frame.querySelector(".regenerate-frame-btn");
    regenBtn.addEventListener("click", () => regenerateFrame(frameNumber));

    const imgEl = frame.querySelector("img");
    imgEl.addEventListener("click", () => openModal(frameNumber));
    imgEl.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

/**********************************************************
 * SAVE / LOAD
 **********************************************************/
function saveStoryboard() {
  const storyboard = [];
  for (let i = 1; i <= state.currentFrameCount; i++) {
    const frm = document.getElementById(`frame-${i}`);
    if (!frm) continue;
    const imgEl = frm.querySelector('img');
    const image = imgEl ? imgEl.src : "";
    const title = frm.querySelector(`#title-${i}`).value.trim();
    const characters = frm.querySelector(`#characters-${i}`).value.trim();
    const location = frm.querySelector(`#location-${i}`).value.trim();
    const camera = frm.querySelector(`#camera-${i}`).value.trim();
    const action = frm.querySelector(`#action-${i}`).value.trim();
    const background = frm.querySelector(`#background-${i}`).value.trim();
    const fullPrompt = frm.querySelector(`#prompt-${i}`).value.trim();
    const aspect = frm.querySelector(`#aspectRatio-${i}`).value;
    const style = frm.getAttribute("data-style");
    const narrationEl = frm.querySelector(`#narration-${i}`);
    const narration = narrationEl ? narrationEl.textContent : "";

    storyboard.push({
      image,
      title,
      characters,
      location,
      camera,
      action,
      background,
      fullPrompt,
      aspect,
      style,
      narration
    });
  }
  localStorage.setItem("storyboard", JSON.stringify({ storyboard }));
  alert("Storyboard saved!");
}

function loadStoryboard() {
  try {
    const data = localStorage.getItem("storyboard");
    if (!data) return;

    const parsed = JSON.parse(data);
    if (!parsed || !parsed.storyboard || !Array.isArray(parsed.storyboard)) {
      console.warn('Invalid storyboard data in localStorage');
      return;
    }

    const saved = parsed.storyboard;
    if (saved.length === 0) return;

    // Clear existing frames
    const framesContainer = document.getElementById("storyboardFrames");
    framesContainer.innerHTML = '';
    state.currentFrameCount = 0;

    // Load each saved frame
    saved.forEach((fr, idx) => {
      addFrame();
      const i = idx + 1;

      if (document.getElementById(`title-${i}`)) {
        document.getElementById(`title-${i}`).value = fr.title || "";
        document.getElementById(`characters-${i}`).value = fr.characters || "";
        document.getElementById(`location-${i}`).value = fr.location || "";
        document.getElementById(`camera-${i}`).value = fr.camera || "";
        document.getElementById(`action-${i}`).value = fr.action || "";
        document.getElementById(`background-${i}`).value = fr.background || "";
        document.getElementById(`prompt-${i}`).value = fr.fullPrompt || "";
        document.getElementById(`aspectRatio-${i}`).value = fr.aspect || "16:9";

        const frameDiv = document.getElementById(`frame-${i}`);
        if (frameDiv && fr.style) {
          frameDiv.setAttribute("data-style", fr.style);
        }

        const imgEl = document.getElementById(`image-${i}`);
        if (imgEl && fr.image && fr.image !== "#") {
          imgEl.src = fr.image;
          imgEl.style.display = "block";
        }

        const narrationDiv = document.getElementById(`narration-${i}`);
        if (narrationDiv && fr.narration) {
          narrationDiv.textContent = fr.narration;
          narrationDiv.parentElement.style.display = "block";
        }
      }
    });
    
    renderLiveStory();
  } catch (error) {
    console.error('Error loading storyboard:', error);
    localStorage.removeItem("storyboard"); // Clear corrupted data
  }
}

/**********************************************************
 * PDF & ZIP DOWNLOAD
 **********************************************************/
// PDF logic
async function downloadStoryboardPDF() {
  if (state.currentFrameCount === 0) {
    alert('No frames to download!');
    return;
  }

  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('aiMessage').textContent = 'Creating PDF...';
  updateProgressBar(0);

  try {
    const pdf = new jspdf.jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    for (let i = 1; i <= state.currentFrameCount; i++) {
      if (i > 1) pdf.addPage();
      
      const frame = document.getElementById(`frame-${i}`);
      const image = frame.querySelector('img');
      const title = frame.querySelector(`#title-${i}`).value;
      const characters = frame.querySelector(`#characters-${i}`).value;
      const location = frame.querySelector(`#location-${i}`).value;
      const camera = frame.querySelector(`#camera-${i}`).value;
      const action = frame.querySelector(`#action-${i}`).value;
      const background = frame.querySelector(`#background-${i}`).value;
      const narration = frame.querySelector(`#narration-${i}`).textContent;

      // Add frame number and title
      pdf.setFontSize(16);
      pdf.text(`Frame ${i}: ${title}`, margin, margin + 5);

      // Add image if it exists and is loaded
      if (image && image.complete && image.src && !image.src.endsWith('#')) {
        try {
          const imgData = await getImageDataUrl(image);
          const imgDimensions = getScaledDimensions(
            image.naturalWidth,
            image.naturalHeight,
            pageWidth - (margin * 2),
            pageHeight * 0.6
          );

          // Add image to PDF
          pdf.addImage(
            imgData,
            'JPEG',
            margin,
            margin + 10,
            imgDimensions.width,
            imgDimensions.height
          );

          // Add text below image
          const yStart = margin + imgDimensions.height + 20;
          pdf.setFontSize(12);
          pdf.text(`Characters: ${characters}`, margin, yStart);
          pdf.text(`Location: ${location}`, margin, yStart + 7);
          pdf.text(`Camera Angle: ${camera}`, margin, yStart + 14);
          pdf.text(`Action/Story: ${action}`, margin, yStart + 21);
          pdf.text(`Background: ${background}`, margin, yStart + 28);
          pdf.text(`Scene: ${narration}`, margin, yStart + 35);
        } catch (imgError) {
          console.error(`Error processing image for frame ${i}:`, imgError);
          // Continue with next frame if image fails
          continue;
        }
      }

      updateProgressBar((i / state.currentFrameCount) * 100);
    }

    pdf.save('storyboard.pdf');
    document.getElementById('overlay').style.display = 'none';
    alert('PDF downloaded successfully!');
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Error generating PDF. Please try again.');
    document.getElementById('overlay').style.display = 'none';
  }
}

// ZIP logic
async function downloadStoryboardZIP() {
  if (state.currentFrameCount === 0) {
    alert('No frames to download!');
    return;
  }

  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('aiMessage').textContent = 'Creating ZIP archive...';
  updateProgressBar(0);

  try {
    const zip = new JSZip();
    const detailsFile = [];

    for (let i = 1; i <= state.currentFrameCount; i++) {
      const frame = document.getElementById(`frame-${i}`);
      const image = frame.querySelector('img');
      
      const title = frame.querySelector(`#title-${i}`).value;
      const characters = frame.querySelector(`#characters-${i}`).value;
      const location = frame.querySelector(`#location-${i}`).value;
      const camera = frame.querySelector(`#camera-${i}`).value;
      const action = frame.querySelector(`#action-${i}`).value;
      const background = frame.querySelector(`#background-${i}`).value;
      const narration = frame.querySelector(`#narration-${i}`).textContent;

      detailsFile.push(
        `\nFRAME ${i}: ${title}`,
        `Characters: ${characters}`,
        `Location: ${location}`,
        `Camera Angle: ${camera}`,
        `Action/Story: ${action}`,
        `Background: ${background}`,
        `Scene: ${narration}`,
        '-'.repeat(50)
      );

      if (image && image.src && !image.src.endsWith('#')) {
        const imgData = await getImageDataUrl(image);
        const imgBlob = await fetch(imgData).then(r => r.blob());
        zip.file(`frame-${i}.jpg`, imgBlob);
      }

      updateProgressBar((i / state.currentFrameCount) * 100);
    }

    zip.file('frame_details.txt', detailsFile.join('\n'));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'storyboard.zip');

    document.getElementById('overlay').style.display = 'none';
    alert('ZIP file downloaded successfully!');
  } catch (error) {
    console.error('ZIP generation error:', error);
    alert('Error generating ZIP. Please try again.');
    document.getElementById('overlay').style.display = 'none';
  }
}

/**********************************************************
 * REORDER MODE
 **********************************************************/
function toggleReorderMode() {
  state.reorderModeEnabled = !state.reorderModeEnabled;
  const reorderBtn = document.getElementById("reorderToggleBtn");
  const draggableFrames = document.querySelectorAll('.image-container[id^="frame-"]');

  if (state.reorderModeEnabled) {
    reorderBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> REORDER ON';
    draggableFrames.forEach((f) => {
      f.setAttribute("draggable", "true");
      f.addEventListener("dragstart", onDragStart);
      f.addEventListener("dragover", onDragOver);
      f.addEventListener("drop", onDrop);
    });
  } else {
    reorderBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> REORDER OFF';
    draggableFrames.forEach((f) => {
      f.setAttribute("draggable", "false");
      f.removeEventListener("dragstart", onDragStart);
      f.removeEventListener("dragover", onDragOver);
      f.removeEventListener("drop", onDrop);
    });
  }
}

function onDragStart(e) {
  if (!state.reorderModeEnabled) return;
  e.dataTransfer.setData("text/plain", e.target.id);
  e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e) {
  if (!state.reorderModeEnabled) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function onDrop(e) {
  if (!state.reorderModeEnabled) return;
  e.preventDefault();
  const draggedId = e.dataTransfer.getData("text/plain");
  const draggedEl = document.getElementById(draggedId);
  const dropTarget = e.currentTarget;

  if (draggedEl !== dropTarget) {
    const container = dropTarget.parentNode;
    const framesArr = Array.from(container.children);
    const draggedIndex = framesArr.indexOf(draggedEl);
    const targetIndex = framesArr.indexOf(dropTarget);

    if (draggedIndex < targetIndex) {
      container.insertBefore(draggedEl, dropTarget.nextSibling);
    } else {
      container.insertBefore(draggedEl, dropTarget);
    }
    reindexFrames();
  }
}

function reindexFrames() {
  const allFrames = document.querySelectorAll('.image-container[id^="frame-"]');
  state.currentFrameCount = allFrames.length;
  state.liveStory = [];
  allFrames.forEach((f, index) => {
    const newNum = index + 1;
    f.id = `frame-${newNum}`;
    const title = f.querySelector("h3");
    if (title) title.innerHTML = `Frame ${newNum}: <input type="text" id="title-${newNum}" placeholder="Frame Title..." aria-label="Frame Title" />`;
    f.querySelectorAll("[id]").forEach((el) => {
      const oldId = el.id;
      const matched = oldId.match(/\D+(\d+)$/);
      if (matched) {
        el.id = oldId.replace(/\d+$/, newNum);
      }
    });
    const img = f.querySelector("img");
    if (img) {
      img.addEventListener("click", () => openModal(newNum));
    }
    const regenBtn = f.querySelector("button.regenerate-frame-btn");
    if (regenBtn) {
      regenBtn.addEventListener("click", () => regenerateFrame(newNum));
    }
  });
  renderLiveStory();
}

/**********************************************************
 * LIVE STORY PREVIEW
 **********************************************************/
function updateLiveStory(frameNumber, details) {
  const locationChange = state.storyMemory.locationChanges.find(
    c => c.frame === frameNumber
  );
  const locationInfo = locationChange
    ? `<p><strong>Location Change:</strong> From ${locationChange.from} to ${locationChange.to}</p>`
    : '';

  const frameSummary = `
    <div class="story-frame">
      <h3>Frame ${frameNumber}: ${details.title}</h3>
      ${locationInfo}
      <p><strong>Story Progress:</strong> ${details.storyProgress}</p>
      <p><strong>Phase:</strong> ${state.storyProgression.currentPhase}</p>
      <p><strong>Action:</strong> ${details.action}</p>
      <p><strong>Scene:</strong> ${details.narration}</p>
      <hr />
    </div>
  `;
  state.liveStory[frameNumber - 1] = frameSummary;
  renderLiveStory();
}

function renderLiveStory() {
  const liveStoryContainer = document.getElementById("liveStory");
  liveStoryContainer.innerHTML = state.liveStory.join("");
}

/**********************************************************
 * MODAL
 **********************************************************/
function openModal(n) {
  const imgSrc = document.getElementById(`image-${n}`).src;
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const modalPrompt = modal.querySelector('.modal-prompt');

  if (modalPrompt) {
    modalPrompt.remove();
  }
  modalImg.style.display = 'block';
  modalImg.src = imgSrc;
  modal.style.display = 'flex';
}

function setupModal() {
  const modal = document.getElementById("imageModal");
  const closeBtn = modal.querySelector(".close");

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    const modalPrompt = modal.querySelector('.modal-prompt');
    if (modalPrompt) {
      modalPrompt.remove();
    }
    const modalImg = document.getElementById('modalImage');
    modalImg.style.display = 'block';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeBtn.click();
    }
  });
}

function viewFullPrompt(frameNumber) {
  const basePrompt = document.getElementById(`prompt-${frameNumber}`).value;
  const styleKey = document.getElementById(`frame-${frameNumber}`).getAttribute('data-style');
  const negativePrompt = document.getElementById('negativePromptInput').value;

  const fullPrompt = buildPromptForImage(basePrompt, styleKey, negativePrompt);

  const modal = document.getElementById('imageModal');
  const modalContent = modal.querySelector('.modal-content');
  const modalImg = document.getElementById('modalImage');

  modalImg.style.display = 'none';

  let modalPrompt = modal.querySelector('.modal-prompt');
  if (!modalPrompt) {
    modalPrompt = document.createElement('div');
    modalPrompt.className = 'modal-prompt';
  }

  modalPrompt.innerHTML = `
    <h3>Full AI Prompt for Frame ${frameNumber}</h3>
    <pre>${fullPrompt}</pre>
  `;
  modalContent.appendChild(modalPrompt);
  modal.style.display = 'flex';
}

/**********************************************************
 * DARK MODE
 **********************************************************/
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  const darkBtn = document.getElementById("darkModeToggle");
  if (document.body.classList.contains("dark-mode")) {
    darkBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
    darkBtn.setAttribute("aria-label", "Light Mode");
  } else {
    darkBtn.innerHTML = '<i class="fas fa-moon"></i> 🌙';
    darkBtn.setAttribute("aria-label", "Dark Mode");
  }
  localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
}

function loadDarkMode() {
  const dm = localStorage.getItem("darkMode");
  const darkBtn = document.getElementById("darkModeToggle");
  if (dm === "true") {
    document.body.classList.add("dark-mode");
    darkBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
    darkBtn.setAttribute("aria-label", "Light Mode");
  } else {
    darkBtn.innerHTML = '<i la="fas fa-moon"></i> 🌙';
    darkBtn.setAttribute("aria-label", "Dark Mode");
  }
}

/**********************************************************
 * MISC UTILS & INITIALIZATION
 **********************************************************/
function toggleControls(enable) {
  const controls = document.querySelectorAll("button, select, input, textarea");
  controls.forEach((ctrl) => {
    ctrl.disabled = !enable;
  });
}

function disableImageDownload() {
  const images = document.querySelectorAll("#storyboardFrames img");
  images.forEach((img) => {
    img.oncontextmenu = (e) => e.preventDefault();
    img.draggable = false;
  });
}

function addTooltips() {
  const tooltipElements = document.querySelectorAll("[data-tooltip-text]");
  tooltipElements.forEach((element) => {
    const tooltipText = element.getAttribute("data-tooltip-text");
    if (tooltipText) {
      const tooltipSpan = document.createElement("span");
      tooltipSpan.className = "tooltiptext";
      tooltipSpan.textContent = tooltipText;
      element.appendChild(tooltipSpan);
    }
  });
}

/**********************************************************
 * CHARACTER MEMORY
 **********************************************************/
function updateCharacterMemory(details) {
  try {
    const frameData = JSON.parse(details);
    if (!state.characterMemory.mainCharacter && frameData.characters) {
      state.characterMemory.mainCharacter = frameData.characters;
      state.characterMemory.location = frameData.location;
    }
  } catch (e) {
    console.warn('Could not parse character details:', e);
  }
}

/**
 * Parse user scenario for overall details
 */
function parseScenario(scenario) {
  const prompt = `
Generate a detailed JSON breakdown of the story elements.
Story: "${scenario}"

Required JSON format:
{
  "mainCharacter": "Detailed description with appearance, personality, abilities, etc.",
  "supportingCharacters": [
      {
          "name": "Full name",
          "description": "Detailed appearance/personality/role",
          "role": "Relationship to main character",
          "appearances": ["List of story beats"]
      }
  ],
  "locations": [
      {
          "name": "Location name",
          "description": "Atmosphere, features",
          "relevance": "Why it matters"
      }
  ],
  "plotPoints": [
      "key events"
  ]
}`;

  return callOpenAIAPI(prompt);
}

/**
 * Initialize scenario details
 */
async function initializeStoryDetails() {
  const scenario = document.getElementById("scenarioInput").value.trim();
  if (!scenario) return null;

  const details = await parseScenario(scenario);
  if (details) {
    state.characterMemory.baseScenario = scenario;
    state.characterMemory.parsedDetails = details;
    state.characterMemory.mainCharacter = details.mainCharacter;
    state.characterMemory.supportingCharacters = details.supportingCharacters;
  }
  return details;
}

/**
 * Maintain consistency across frames
 */
function maintainStoryConsistency(frameNumber, details) {
  if (frameNumber === 1) {
    state.storyMemory.baseCharacters = details.characters;
    state.storyMemory.baseLocation = details.location;
    state.storyMemory.currentLocation = details.location;
  }
  if (details.location !== state.storyMemory.currentLocation) {
    state.storyMemory.locationChanges.push({
      frame: frameNumber,
      from: state.storyMemory.currentLocation,
      to: details.location
    });
    state.storyMemory.currentLocation = details.location;
  }
  return details;
}

/**
 * Check if story has changed from last generation
 */
function hasStoryChanged() {
  const currentStory = document.getElementById("scenarioInput").value.trim();
  return currentStory !== state.characterMemory.baseScenario;
}

/**
 * Clear all generated images and prompts
 */
function clearGeneratedContent() {
  for (let i = 1; i <= state.currentFrameCount; i++) {
    const frame = document.getElementById(`frame-${i}`);
    if (frame) {
      const img = frame.querySelector('img');
      if (img) {
        img.src = '#';
        img.style.display = 'none';
      }
      frame.classList.remove('has-image');
      
      // Clear stored prompts and text
      document.getElementById(`prompt-${i}`).value = '';
      const titleInput = document.getElementById(`title-${i}`);
      if (titleInput) titleInput.value = '';
      const narrationDiv = document.getElementById(`narration-${i}`);
      if (narrationDiv) {
        narrationDiv.textContent = '';
        narrationDiv.parentElement.style.display = "none";
      }
      const actionInput = document.getElementById(`action-${i}`);
      if (actionInput) actionInput.value = '';
      const backgroundInput = document.getElementById(`background-${i}`);
      if (backgroundInput) backgroundInput.value = '';
      const cameraInput = document.getElementById(`camera-${i}`);
      if (cameraInput) cameraInput.value = '';
    }
  }
  state.liveStory = [];
  renderLiveStory();
}

/**********************************************************
 * PDF & ZIP DOWNLOAD
 **********************************************************/
// PDF logic
async function downloadStoryboardPDF() {
  if (state.currentFrameCount === 0) {
    alert('No frames to download!');
    return;
  }

  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('aiMessage').textContent = 'Creating PDF...';
  updateProgressBar(0);

  try {
    const pdf = new jspdf.jsPDF('l', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    for (let i = 1; i <= state.currentFrameCount; i++) {
      if (i > 1) pdf.addPage();
      
      const frame = document.getElementById(`frame-${i}`);
      const image = frame.querySelector('img');
      const title = frame.querySelector(`#title-${i}`).value;
      const characters = frame.querySelector(`#characters-${i}`).value;
      const location = frame.querySelector(`#location-${i}`).value;
      const camera = frame.querySelector(`#camera-${i}`).value;
      const action = frame.querySelector(`#action-${i}`).value;
      const background = frame.querySelector(`#background-${i}`).value;
      const narration = frame.querySelector(`#narration-${i}`).textContent;

      // Add frame number and title
      pdf.setFontSize(16);
      pdf.text(`Frame ${i}: ${title}`, margin, margin + 5);

      // Add image if it exists and is loaded
      if (image && image.complete && image.src && !image.src.endsWith('#')) {
        try {
          const imgData = await getImageDataUrl(image);
          const imgDimensions = getScaledDimensions(
            image.naturalWidth,
            image.naturalHeight,
            pageWidth - (margin * 2),
            pageHeight * 0.6
          );

          // Add image to PDF
          pdf.addImage(
            imgData,
            'JPEG',
            margin,
            margin + 10,
            imgDimensions.width,
            imgDimensions.height
          );

          // Add text below image
          const yStart = margin + imgDimensions.height + 20;
          pdf.setFontSize(12);
          pdf.text(`Characters: ${characters}`, margin, yStart);
          pdf.text(`Location: ${location}`, margin, yStart + 7);
          pdf.text(`Camera Angle: ${camera}`, margin, yStart + 14);
          pdf.text(`Action/Story: ${action}`, margin, yStart + 21);
          pdf.text(`Background: ${background}`, margin, yStart + 28);
          pdf.text(`Scene: ${narration}`, margin, yStart + 35);
        } catch (imgError) {
          console.error(`Error processing image for frame ${i}:`, imgError);
          // Continue with next frame if image fails
          continue;
        }
      }

      updateProgressBar((i / state.currentFrameCount) * 100);
    }

    pdf.save('storyboard.pdf');
    document.getElementById('overlay').style.display = 'none';
    alert('PDF downloaded successfully!');
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Error generating PDF. Please try again.');
    document.getElementById('overlay').style.display = 'none';
  }
}

// ZIP logic
async function downloadStoryboardZIP() {
  if (state.currentFrameCount === 0) {
    alert('No frames to download!');
    return;
  }

  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('aiMessage').textContent = 'Creating ZIP archive...';
  updateProgressBar(0);

  try {
    const zip = new JSZip();
    const detailsFile = [];

    for (let i = 1; i <= state.currentFrameCount; i++) {
      const frame = document.getElementById(`frame-${i}`);
      const image = frame.querySelector('img');
      
      const title = frame.querySelector(`#title-${i}`).value;
      const characters = frame.querySelector(`#characters-${i}`).value;
      const location = frame.querySelector(`#location-${i}`).value;
      const camera = frame.querySelector(`#camera-${i}`).value;
      const action = frame.querySelector(`#action-${i}`).value;
      const background = frame.querySelector(`#background-${i}`).value;
      const narration = frame.querySelector(`#narration-${i}`).textContent;

      detailsFile.push(
        `\nFRAME ${i}: ${title}`,
        `Characters: ${characters}`,
        `Location: ${location}`,
        `Camera Angle: ${camera}`,
        `Action/Story: ${action}`,
        `Background: ${background}`,
        `Scene: ${narration}`,
        '-'.repeat(50)
      );

      if (image && image.src && !image.src.endsWith('#')) {
        const imgData = await getImageDataUrl(image);
        const imgBlob = await fetch(imgData).then(r => r.blob());
        zip.file(`frame-${i}.jpg`, imgBlob);
      }

      updateProgressBar((i / state.currentFrameCount) * 100);
    }

    zip.file('frame_details.txt', detailsFile.join('\n'));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'storyboard.zip');

    document.getElementById('overlay').style.display = 'none';
    alert('ZIP file downloaded successfully!');
  } catch (error) {
    console.error('ZIP generation error:', error);
    alert('Error generating ZIP. Please try again.');
    document.getElementById('overlay').style.display = 'none';
  }
}

/**********************************************************
 * REORDER MODE
 **********************************************************/
function toggleReorderMode() {
  state.reorderModeEnabled = !state.reorderModeEnabled;
  const reorderBtn = document.getElementById("reorderToggleBtn");
  const draggableFrames = document.querySelectorAll('.image-container[id^="frame-"]');

  if (state.reorderModeEnabled) {
    reorderBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> REORDER ON';
    draggableFrames.forEach((f) => {
      f.setAttribute("draggable", "true");
      f.addEventListener("dragstart", onDragStart);
      f.addEventListener("dragover", onDragOver);
      f.addEventListener("drop", onDrop);
    });
  } else {
    reorderBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> REORDER OFF';
    draggableFrames.forEach((f) => {
      f.setAttribute("draggable", "false");
      f.removeEventListener("dragstart", onDragStart);
      f.removeEventListener("dragover", onDragOver);
      f.removeEventListener("drop", onDrop);
    });
  }
}

function onDragStart(e) {
  if (!state.reorderModeEnabled) return;
  e.dataTransfer.setData("text/plain", e.target.id);
  e.dataTransfer.effectAllowed = "move";
}

function onDragOver(e) {
  if (!state.reorderModeEnabled) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function onDrop(e) {
  if (!state.reorderModeEnabled) return;
  e.preventDefault();
  const draggedId = e.dataTransfer.getData("text/plain");
  const draggedEl = document.getElementById(draggedId);
  const dropTarget = e.currentTarget;

  if (draggedEl !== dropTarget) {
    const container = dropTarget.parentNode;
    const framesArr = Array.from(container.children);
    const draggedIndex = framesArr.indexOf(draggedEl);
    const targetIndex = framesArr.indexOf(dropTarget);

    if (draggedIndex < targetIndex) {
      container.insertBefore(draggedEl, dropTarget.nextSibling);
    } else {
      container.insertBefore(draggedEl, dropTarget);
    }
    reindexFrames();
  }
}

function reindexFrames() {
  const allFrames = document.querySelectorAll('.image-container[id^="frame-"]');
  state.currentFrameCount = allFrames.length;
  state.liveStory = [];
  allFrames.forEach((f, index) => {
    const newNum = index + 1;
    f.id = `frame-${newNum}`;
    const title = f.querySelector("h3");
    if (title) title.innerHTML = `Frame ${newNum}: <input type="text" id="title-${newNum}" placeholder="Frame Title..." aria-label="Frame Title" />`;
    f.querySelectorAll("[id]").forEach((el) => {
      const oldId = el.id;
      const matched = oldId.match(/\D+(\d+)$/);
      if (matched) {
        el.id = oldId.replace(/\d+$/, newNum);
      }
    });
    const img = f.querySelector("img");
    if (img) {
      img.addEventListener("click", () => openModal(newNum));
    }
    const regenBtn = f.querySelector("button.regenerate-frame-btn");
    if (regenBtn) {
      regenBtn.addEventListener("click", () => regenerateFrame(newNum));
    }
  });
  renderLiveStory();
}

/**********************************************************
 * LIVE STORY PREVIEW
 **********************************************************/
function updateLiveStory(frameNumber, details) {
  const locationChange = state.storyMemory.locationChanges.find(
    c => c.frame === frameNumber
  );
  const locationInfo = locationChange
    ? `<p><strong>Location Change:</strong> From ${locationChange.from} to ${locationChange.to}</p>`
    : '';

  const frameSummary = `
    <div class="story-frame">
      <h3>Frame ${frameNumber}: ${details.title}</h3>
      ${locationInfo}
      <p><strong>Story Progress:</strong> ${details.storyProgress}</p>
      <p><strong>Phase:</strong> ${state.storyProgression.currentPhase}</p>
      <p><strong>Action:</strong> ${details.action}</p>
      <p><strong>Scene:</strong> ${details.narration}</p>
      <hr />
    </div>
  `;
  state.liveStory[frameNumber - 1] = frameSummary;
  renderLiveStory();
}

function renderLiveStory() {
  const liveStoryContainer = document.getElementById("liveStory");
  liveStoryContainer.innerHTML = state.liveStory.join("");
}

/**********************************************************
 * MODAL
 **********************************************************/
function openModal(n) {
  const imgSrc = document.getElementById(`image-${n}`).src;
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const modalPrompt = modal.querySelector('.modal-prompt');

  if (modalPrompt) {
    modalPrompt.remove();
  }
  modalImg.style.display = 'block';
  modalImg.src = imgSrc;
  modal.style.display = 'flex';
}

function setupModal() {
  const modal = document.getElementById("imageModal");
  const closeBtn = modal.querySelector(".close");

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    const modalPrompt = modal.querySelector('.modal-prompt');
    if (modalPrompt) {
      modalPrompt.remove();
    }
    const modalImg = document.getElementById('modalImage');
    modalImg.style.display = 'block';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeBtn.click();
    }
  });
}

function viewFullPrompt(frameNumber) {
  const basePrompt = document.getElementById(`prompt-${frameNumber}`).value;
  const styleKey = document.getElementById(`frame-${frameNumber}`).getAttribute('data-style');
  const negativePrompt = document.getElementById('negativePromptInput').value;

  const fullPrompt = buildPromptForImage(basePrompt, styleKey, negativePrompt);

  const modal = document.getElementById('imageModal');
  const modalContent = modal.querySelector('.modal-content');
  const modalImg = document.getElementById('modalImage');

  modalImg.style.display = 'none';

  let modalPrompt = modal.querySelector('.modal-prompt');
  if (!modalPrompt) {
    modalPrompt = document.createElement('div');
    modalPrompt.className = 'modal-prompt';
  }

  modalPrompt.innerHTML = `
    <h3>Full AI Prompt for Frame ${frameNumber}</h3>
    <pre>${fullPrompt}</pre>
  `;
  modalContent.appendChild(modalPrompt);
  modal.style.display = 'flex';
}

/**********************************************************
 * DARK MODE
 **********************************************************/
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  const darkBtn = document.getElementById("darkModeToggle");
  if (document.body.classList.contains("dark-mode")) {
    darkBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
    darkBtn.setAttribute("aria-label", "Light Mode");
  } else {
    darkBtn.innerHTML = '<i class="fas fa-moon"></i> 🌙';
    darkBtn.setAttribute("aria-label", "Dark Mode");
  }
  localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
}

function loadDarkMode() {
  const dm = localStorage.getItem("darkMode");
  const darkBtn = document.getElementById("darkModeToggle");
  if (dm === "true") {
    document.body.classList.add("dark-mode");
    darkBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
    darkBtn.setAttribute("aria-label", "Light Mode");
  } else {
    darkBtn.innerHTML = '<i la="fas fa-moon"></i> 🌙';
    darkBtn.setAttribute("aria-label", "Dark Mode");
  }
}

/**********************************************************
 * MISC UTILS & INITIALIZATION
 **********************************************************/
function toggleControls(enable) {
  const controls = document.querySelectorAll("button, select, input, textarea");
  controls.forEach((ctrl) => {
    ctrl.disabled = !enable;
  });
}

function disableImageDownload() {
  const images = document.querySelectorAll("#storyboardFrames img");
  images.forEach((img) => {
    img.oncontextmenu = (e) => e.preventDefault();
    img.draggable = false;
  });
}

function addTooltips() {
  const tooltipElements = document.querySelectorAll("[data-tooltip-text]");
  tooltipElements.forEach((element) => {
    const tooltipText = element.getAttribute("data-tooltip-text");
    if (tooltipText) {
      const tooltipSpan = document.createElement("span");
      tooltipSpan.className = "tooltiptext";
      tooltipSpan.textContent = tooltipText;
      element.appendChild(tooltipSpan);
    }
  });
}

/**********************************************************
 * CHARACTER MEMORY
 **********************************************************/
function updateCharacterMemory(details) {
  try {
    const frameData = JSON.parse(details);
    if (!state.characterMemory.mainCharacter && frameData.characters) {
      state.characterMemory.mainCharacter = frameData.characters;
      state.characterMemory.location = frameData.location;
    }
  } catch (e) {
    console.warn('Could not parse character details:', e);
  }
}

/**
 * Parse user scenario for overall details
 */
function parseScenario(scenario) {
  const prompt = `
Generate a detailed JSON breakdown of the story elements.
Story: "${scenario}"

Required JSON format:
{
  "mainCharacter": "Detailed description with appearance, personality, abilities, etc.",
  "supportingCharacters": [
      {
          "name": "Full name",
          "description": "Detailed appearance/personality/role",
          "role": "Relationship to main character",
          "appearances": ["List of story beats"]
      }
  ],
  "locations": [
      {
          "name": "Location name",
          "description": "Atmosphere, features",
          "relevance": "Why it matters"
      }
  ],
  "plotPoints": [
      "key events"
  ]
}`;

  return callOpenAIAPI(prompt);
}

/**
 * Initialize scenario details
 */
async function initializeStoryDetails() {
  const scenario = document.getElementById("scenarioInput").value.trim();
  if (!scenario) return null;

  const details = await parseScenario(scenario);
  if (details) {
    state.characterMemory.baseScenario = scenario;
    state.characterMemory.parsedDetails = details;
    state.characterMemory.mainCharacter = details.mainCharacter;
    state.characterMemory.supportingCharacters = details.supportingCharacters;
  }
  return details;
}

/**
 * Maintain consistency across frames
 */
function maintainStoryConsistency(frameNumber, details) {
  if (frameNumber === 1) {
    state.storyMemory.baseCharacters = details.characters;
    state.storyMemory.baseLocation = details.location;
    state.storyMemory.currentLocation = details.location;
  }
  if (details.location !== state.storyMemory.currentLocation) {
    state.storyMemory.locationChanges.push({
      frame: frameNumber,
      from: state.storyMemory.currentLocation,
      to: details.location
    });
    state.storyMemory.currentLocation = details.location;
  }
  return details;
}

/**
 * Check if story has changed from last generation
 */
function hasStoryChanged() {
  const currentStory = document.getElementById("scenarioInput").value.trim();
  return currentStory !== state.characterMemory.baseScenario;
}

/**
 * Clear all generated images and prompts
 */
function clearGeneratedContent() {
  for (let i = 1; i <= state.currentFrameCount; i++) {
    const frame = document.getElementById(`frame-${i}`);
    if (frame) {
      const img = frame.querySelector('img');
      if (img) {
        img.src = '#';
        img.style.display = 'none';
      }
      frame.classList.remove('has-image');
      
      // Clear stored prompts and text
      document.getElementById(`prompt-${i}`).value = '';
      const titleInput = document.getElementById(`title-${i}`);
      if (titleInput) titleInput.value = '';
      const narrationDiv = document.getElementById(`narration-${i}`);
      if (narrationDiv) {
        narrationDiv.textContent = '';
        narrationDiv.parentElement.style.display = "none";
      }
      const actionInput = document.getElementById(`action-${i}`);
      if (actionInput) actionInput.value = '';
      const backgroundInput = document.getElementById(`background-${i}`);
      if (backgroundInput) backgroundInput.value = '';
      const cameraInput = document.getElementById(`camera-${i}`);
      if (cameraInput) cameraInput.value = '';
    }
  }
  state.liveStory = [];
  renderLiveStory();
}

/**********************************************************
 * DOM READY
 **********************************************************/
document.addEventListener("DOMContentLoaded", () => {
  loadStoryboard();
  loadDarkMode();
  setupModal();
  addTooltips();
  disableImageDownload();

  // If no frames, add the first frame
  if (state.currentFrameCount === 0) {
    addFrame();
  }

  // Hook up UI buttons
  document.getElementById("homeBtn").addEventListener("click", navigateToHome);
  document.getElementById("generatorBtn").addEventListener("click", showGenerator);
  document.getElementById("storyboardBtn").addEventListener("click", navigateToStoryboard);
  document.getElementById("chatBtn").addEventListener("click", navigateToChat);
  document.getElementById("darkModeToggle").addEventListener("click", toggleDarkMode);
  document.getElementById("addFrameBtn").addEventListener("click", addFrame);

  document.getElementById("generateStoryboardBtn").addEventListener("click", () => {
    state.usedCameraAngles.clear();
    state.storyContext = {
      currentPhase: 'introduction',
      usedAngles: new Set(),
      lastUsedAngle: null,
      suggestedAngles: []
    };
    generateStoryboard();
  });

  document.getElementById("reorderToggleBtn").addEventListener("click", toggleReorderMode);
  document.getElementById("saveBtn").addEventListener("click", saveStoryboard);
  document.getElementById("downloadPDFBtn").addEventListener("click", downloadStoryboardPDF);
  document.getElementById("downloadZIPBtn").addEventListener("click", downloadStoryboardZIP);
});

/**********************************************************
 * HELPER: Convert image to data URL
 **********************************************************/
async function getImageDataUrl(imgElement) {
  return new Promise((resolve, reject) => {
    try {
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;
      
      // Draw image to canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0);
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl);
    } catch (error) {
      console.error('Error converting image to data URL:', error);
      reject(error);
    }
  });
}

/**********************************************************
 * HELPER: Calculate scaled dimensions maintaining aspect
 **********************************************************/
function getScaledDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
  let ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
  return {
    width: originalWidth * ratio,
    height: originalHeight * ratio
  };
}

/**********************************************************
 * HELPER: Retry logic
 **********************************************************/
async function withRetry(operation, options = {}) {
  const config = { ...state.retryConfig, ...options };
  let lastError;
  let delay = config.delayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    if (state.generation.shouldStop) {
      throw new Error('Operation cancelled by user');
    }

    try {
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timed out')), 
          options.timeout || 30000)
        )
      ]);

      if (result) return result;
      throw new Error('Operation returned empty result');
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${config.maxAttempts} failed:`, error);
      
      if (attempt < config.maxAttempts && !state.generation.shouldStop) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= config.backoffMultiplier;
      }
    }
  }
  throw lastError;
}

/**
 * Helper function to show error alerts
 */
function showErrorAlert(message) {
  const container = document.createElement('div');
  container.className = 'styled-alert error';
  container.innerHTML = `
    <div class="alert-content">
      <i class="fas fa-exclamation-circle"></i>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(container);
  setTimeout(() => {
    container.classList.add('fade-out');
    setTimeout(() => container.remove(), 500);
  }, 5000);
}

/**********************************************************
 * FORCE STOP GENERATION
 **********************************************************/
async function forceStopGeneration() {
  state.generation.shouldStop = true;
  document.getElementById("aiMessage").textContent = "Stopping generation...";
  console.log("Stopping generation...");
  
  // Wait for any ongoing operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  state.generation.isGenerating = false;
  document.getElementById("overlay").style.display = "none";
  toggleControls(true);
  
  const stopBtn = document.querySelector('.stop-generation-btn');
  if (stopBtn) stopBtn.remove();
  
  alert("Generation stopped by user");
}

/**********************************************************
 * ENHANCE SCENE DIVERSITY
 **********************************************************/
async function enhanceSceneDiversity(frameNumber, basePrompt) {
  const progress = frameNumber / state.currentFrameCount;
  const phase = state.storyProgression.currentPhase;
  
  // Calculate scene variety requirements
  const requiredElements = state.storyDiversity.requiredElements
    .filter(el => !state.storyDiversity.usedElements.has(el))
    .slice(0, 2); // Get up to 2 unused elements

  // Select scene type based on story phase
  let availableTypes = Object.keys(state.sceneTypes)
    .filter(type => !state.storyDiversity.usedSceneTypes.has(type));
  if (availableTypes.length === 0) {
    state.storyDiversity.usedSceneTypes.clear();
    availableTypes = Object.keys(state.sceneTypes);
  }
  
  const sceneType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  state.storyDiversity.usedSceneTypes.add(sceneType);

  // Generate creative scene seed
  const sceneSeed = {
    type: sceneType,
    elements: requiredElements,
    intensity: Math.sin(progress * Math.PI) * 0.5 + 0.5, // Varies from 0 to 1
    mood: state.storyDiversity.toneSettings.mood,
    theme: state.storyDiversity.themeKeywords[0]
  };
  
  state.storyDiversity.sceneSeeds.push(sceneSeed);

  // Enhance the base prompt with scene diversity elements
  const enhancedPrompt = `
Scene Type: ${sceneType}
Required Elements: ${requiredElements.join(', ')}
Emotional Intensity: ${sceneSeed.intensity}
Mood: ${sceneSeed.mood}
Theme: ${sceneSeed.theme}

Original Scenario: ${basePrompt}

Create a scene that:
1. Incorporates the required elements naturally
2. Maintains the ${sceneType} feeling
3. Progresses the story while adding creative elements
4. Matches the emotional intensity and mood
5. Reinforces the central theme

Additional Context:
- Story Phase: ${phase}
- Progress: ${Math.round(progress * 100)}%
- Previous Scenes: ${Array.from(state.storyDiversity.usedSceneTypes).join(', ')}
`;

  return enhancedPrompt;
}

/**********************************************************
 * INITIALIZE STORY DIVERSITY
 **********************************************************/
function initializeStoryDiversity(theme, elements, tone) {
  state.storyDiversity = {
    usedSceneTypes: new Set(),
    usedElements: new Set(),
    requiredElements: elements || [],
    themeKeywords: theme ? theme.split(',').map(t => t.trim()) : [],
    toneSettings: {
      genre: tone?.genre || 'drama',
      mood: tone?.mood || 'neutral',
      intensity: tone?.intensity || 0.5
    },
    sceneSeeds: [],
    noveltyScore: 0
  };
}