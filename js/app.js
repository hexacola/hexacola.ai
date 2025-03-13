/*******************************************************
 * app.js – Hexacola AI Image Generator
 *
 * Major Updates and Improvements:
 * 1. **Language Unification**: Converted all user-facing strings from Lithuanian to English for clarity.
 * 2. **Removed Duplication**: Unified repeated sanitizeHTML() function into a single function.
 * 3. **Refined Error Handling**: Updated error messages and alerts in English for consistency.
 * 4. **Performance Enhancements**: Improved concurrency in image generation and prompt optimization logic.
 * 5. **Readability & Maintainability**: Added explanatory comments, modularized functionality, and used modern JS practices.
 * 6. **Enhanced Generation Logic**: Now handles complex inputs more consistently by integrating style, camera features, and color schemes.
 *******************************************************/

/*******************************************************
 * GLOBAL VARIABLES & LISTS
 *******************************************************/
let timerInterval;
let autoMode = false;
let totalImages = 0;
let generatedImagesCount = 0;

// Comprehensive Lists
const cameraFeaturesList = [
  "DSLR",
  "Wide-angle lens",
  "Ultra-wide lens",
  "Telephoto lens",
  "Macro lens",
  "Fisheye lens",
  "Tilt-shift lens",
  "Pinhole camera",
  "360-degree panorama",
  "Satellite imagery",
  "Super-resolution microscopy",
  "Infrared photography",
  "Black-and-white film",
  "Vintage film camera",
  "Polaroid/instant camera",
  "Action camera (e.g., GoPro)",
  "Low-light/night photography lens",
  "Portrait lens (e.g., 85mm f/1.4)",
  "Large-format camera",
  "Medium-format camera",
  "Smartphone lens simulation",
  "Cinematic anamorphic lens",
  "Experimental lens effects (e.g., lens flare, kaleidoscope)"
];

const colorSchemesList = [
  "Complementary",
  "Analogous",
  "Triadic",
  "Tetradic",
  "Split-Complementary",
  "Monochromatic"
];

// Descriptions (Not used directly in code below, but you can reference them)
const cameraFeatureDescriptions = {
  "DSLR": "Digital Single-Lens Reflex cameras are known for their versatility, high image quality, and interchangeable lenses.",
  "Wide-angle lens": "A lens with a shorter focal length that captures a wider field of view than standard lenses.",
  "Ultra-wide lens": "A lens with an extremely wide field of view, ideal for capturing expansive landscapes and architecture.",
  "Telephoto lens": "A lens with a long focal length that allows photographers to capture distant subjects with magnification.",
  "Macro lens": "A lens designed for extreme close-up photography, allowing you to capture fine details of small subjects.",
  "Fisheye lens": "An ultra wide-angle lens that creates a spherical, distorted view, often used for creative and artistic photography.",
  "Tilt-shift lens": "A lens that allows for tilting and shifting to control the plane of focus and perspective distortion.",
  "Pinhole camera": "A simple camera without glass lenses, using a tiny aperture for unique depth and focus effects.",
  "360-degree panorama": "A camera feature that captures a full 360-degree panoramic view.",
  "Satellite imagery": "Images of Earth or other planets captured by satellites, used for mapping, forecasting, and more.",
  "Super-resolution microscopy": "Advanced microscopy techniques to reveal finer details beyond standard diffraction limits.",
  "Infrared photography": "Capturing images using infrared light, unveiling details not visible to the naked eye.",
  "Black-and-white film": "Photography using monochromatic film, emphasizing contrast and composition.",
  "Vintage film camera": "Classic cameras known for their unique build and nostalgic photographic style.",
  "Polaroid/instant camera": "Cameras producing instant prints, giving a tangible, immediate photographic experience.",
  "Action camera (e.g., GoPro)": "Compact, durable cameras for capturing adventure/action footage.",
  "Low-light/night photography lens": "Optimized lenses for clear images in low-light conditions.",
  "Portrait lens (e.g., 85mm f/1.4)": "Ideal focal lengths for flattering portraits with shallow depth of field.",
  "Large-format camera": "Uses large film/sensors for high resolution and detail.",
  "Medium-format camera": "Uses medium film/sensors, balancing quality and portability.",
  "Smartphone lens simulation": "Lens effects mimicking modern smartphone camera capabilities.",
  "Cinematic anamorphic lens": "Wide aspect ratio and distinctive lens flares, commonly used in filmmaking.",
  "Experimental lens effects (e.g., lens flare, kaleidoscope)": "Artistic lens effects adding unique visual elements to images."
};

const colorSchemeDescriptions = {
  "Complementary": "Opposite colors on the color wheel for high contrast and vibrant looks.",
  "Analogous": "Colors adjacent on the wheel, giving harmonious, pleasing aesthetics.",
  "Triadic": "Three colors evenly spaced around the wheel for a balanced, vibrant palette.",
  "Tetradic": "Four colors in two complementary pairs, creating a rich, varied color palette.",
  "Split-Complementary": "One base color + two adjacent complementary colors, offering contrast with less tension.",
  "Monochromatic": "Variations in lightness and saturation of a single color, providing a cohesive, elegant look."
};

// Loading & Thinking UI
const loadingMessages = [
  "Channeling creative energies...",
  "Mixing digital paint...",
  "Consulting the AI muses...",
  "Weaving pixels together...",
  "Calibrating artistic parameters...",
  "Brewing visual magic...",
  "Crafting your masterpiece...",
  "Adding finishing touches..."
];

let loadingMessageInterval;
let thinkingStepTimeout;

// Add new proxy list near the top with other constants
const corsProxies = [
  '', // Direct request first
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors-proxy.htmldriven.com/?url=',
  'https://crossorigin.me/',
  'https://cors-anywhere.herokuapp.com/',
  'https://api.codetabs.com/v1/proxy?quest='
];

/*******************************************************
 * UTILITY / UI-RELATED FUNCTIONS
 *******************************************************/

/** 
 * Updates rotating loading message 
 */
function updateLoadingMessage() {
  const loadingMessageEl = document.getElementById('loadingMessage');
  loadingMessageEl.textContent = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
}

/** 
 * Animates the step-based thinking process 
 */
function animateThinkingProcess() {
  const steps = document.querySelectorAll('.thinking-step');
  let currentStep = 0;

  function activateStep(index) {
    steps.forEach((step, i) => {
      if (i < index) {
        step.classList.add('complete', 'active');
      } else if (i === index) {
        step.classList.add('active');
        step.classList.remove('complete');
      } else {
        step.classList.remove('active', 'complete');
      }
    });
  }

  function nextStep() {
    if (currentStep < steps.length) {
      activateStep(currentStep);
      currentStep++;
      thinkingStepTimeout = setTimeout(nextStep, 2000); // Next step every 2s
    }
  }

  nextStep();
}

/** 
 * Saves current settings to localStorage 
 */
function saveSettings() {
  const backgroundPrompt = document.getElementById('backgroundPrompt').value;
  const characterPrompt = document.getElementById('characterPrompt').value;
  const negativePrompt = document.getElementById('negativePrompt').value;
  const model = document.getElementById('model').value;
  const width = document.getElementById('width').value;
  const height = document.getElementById('height').value;
  const seed = document.getElementById('seed').value;
  const imageOptions = document.getElementById('imageOptions').value;
  const style = document.getElementById('style').value;

  // Gather additional character descriptions
  const additionalCharacterDescriptions = [];
  const additionalGroups = document.querySelectorAll('.additional-character-group textarea');
  additionalGroups.forEach(textarea => {
    const desc = textarea.value.trim();
    if (desc) {
      additionalCharacterDescriptions.push(desc);
    }
  });

  // Gather active camera features
  const selectedCameraFeatures = Array.from(document.querySelectorAll('#cameraFeaturesToggles button.active'))
    .map(btn => btn.textContent);

  // Gather active color schemes
  const selectedColorSchemes = Array.from(document.querySelectorAll('#colorSchemesToggles button.active'))
    .map(btn => btn.textContent);

  // Persist to localStorage
  localStorage.setItem('backgroundPrompt', backgroundPrompt);
  localStorage.setItem('characterPrompt', characterPrompt);
  localStorage.setItem('negativePrompt', negativePrompt);
  localStorage.setItem('model', model);
  localStorage.setItem('width', width);
  localStorage.setItem('height', height);
  localStorage.setItem('seed', seed);
  localStorage.setItem('imageOptions', imageOptions);
  localStorage.setItem('style', style);
  localStorage.setItem('autoMode', autoMode);
  localStorage.setItem('additionalCharacterDescriptions', JSON.stringify(additionalCharacterDescriptions));
  localStorage.setItem('selectedCameraFeatures', JSON.stringify(selectedCameraFeatures));
  localStorage.setItem('selectedColorSchemes', JSON.stringify(selectedColorSchemes));
}

/** 
 * Loads settings from localStorage 
 */
function loadSettings() {
  const backgroundPrompt = localStorage.getItem('backgroundPrompt');
  const characterPrompt = localStorage.getItem('characterPrompt');
  const negativePrompt = localStorage.getItem('negativePrompt');
  const model = localStorage.getItem('model');
  const width = localStorage.getItem('width');
  const height = localStorage.getItem('height');
  const seed = localStorage.getItem('seed');
  const imageOptions = localStorage.getItem('imageOptions');
  const style = localStorage.getItem('style');
  const savedAutoMode = localStorage.getItem('autoMode');
  const additionalCharacterDescriptions = JSON.parse(localStorage.getItem('additionalCharacterDescriptions') || '[]');
  const selectedCameraFeatures = JSON.parse(localStorage.getItem('selectedCameraFeatures') || '[]');
  const selectedColorSchemes = JSON.parse(localStorage.getItem('selectedColorSchemes') || '[]');

  if (backgroundPrompt) document.getElementById('backgroundPrompt').value = backgroundPrompt;
  if (characterPrompt) document.getElementById('characterPrompt').value = characterPrompt;
  if (negativePrompt) document.getElementById('negativePrompt').value = negativePrompt;
  if (model) document.getElementById('model').value = model;
  if (width) document.getElementById('width').value = width;
  if (height) document.getElementById('height').value = height;
  if (seed) document.getElementById('seed').value = seed;
  if (imageOptions) document.getElementById('imageOptions').value = imageOptions;
  if (style) document.getElementById('style').value = style;

  if (savedAutoMode === 'true') {
    autoMode = true;
    document.getElementById('autoToggleBtn').classList.add('active');
    document.getElementById('autoToggleBtn').innerHTML = '<i class="fas fa-robot"></i> AUTO ON';
    document.getElementById('autoToggleBtn').setAttribute('aria-pressed', 'true');
  } else {
    autoMode = false;
    document.getElementById('autoToggleBtn').classList.remove('active');
    document.getElementById('autoToggleBtn').innerHTML = '<i class="fas fa-robot"></i> AUTO OFF';
    document.getElementById('autoToggleBtn').setAttribute('aria-pressed', 'false');
  }

  // Load additional character descriptions
  additionalCharacterDescriptions.forEach(desc => {
    addCharacterDescription(desc);
  });

  // Load selected camera features
  selectedCameraFeatures.forEach(feature => {
    toggleFeature('cameraFeaturesToggles', feature);
  });

  // Load selected color schemes
  selectedColorSchemes.forEach(scheme => {
    toggleFeature('colorSchemesToggles', scheme);
  });

  updateDynamicDescription();
}

/*******************************************************
 * DOM INITIALIZATION
 *******************************************************/
document.addEventListener('DOMContentLoaded', () => {
  populateCameraFeatureToggles();
  populateColorSchemeToggles();
  loadSettings();
  loadDarkMode();
  setupModal();
  initializeNegativePrompt();
  loadLibraryImages();
  disableImageDownload();
  addEventListeners();
});

/*******************************************************
 * CAMERA & COLOR TOGGLE POPULATION
 *******************************************************/
function populateCameraFeatureToggles() {
  const container = document.getElementById('cameraFeaturesToggles');
  cameraFeaturesList.forEach(feature => {
    const btn = document.createElement('button');
    btn.textContent = feature;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', feature);
    btn.onclick = () => {
      btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', btn.classList.contains('active'));
      updateDynamicDescription();
      saveSettings();
    };
    container.appendChild(btn);
  });
}

function populateColorSchemeToggles() {
  const container = document.getElementById('colorSchemesToggles');
  colorSchemesList.forEach(scheme => {
    const btn = document.createElement('button');
    btn.textContent = scheme;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', scheme);
    btn.onclick = () => {
      btn.classList.toggle('active');
      btn.setAttribute('aria-pressed', btn.classList.contains('active'));
      updateDynamicDescription();
      saveSettings();
    };
    container.appendChild(btn);
  });
}

/*******************************************************
 * FEATURE SELECTION TOGGLE
 *******************************************************/
function toggleFeature(groupId, feature) {
  const container = document.getElementById(groupId);
  const button = Array.from(container.children).find(btn => btn.textContent === feature);
  if (button && !button.classList.contains('active')) {
    button.classList.add('active');
    button.setAttribute('aria-pressed', 'true');
  }
}

/*******************************************************
 * DYNAMIC DESCRIPTION
 *******************************************************/
function updateDynamicDescription() {
  const selectedCameraFeatures = Array.from(document.querySelectorAll('#cameraFeaturesToggles button.active')).map(btn => btn.textContent);
  const selectedColorSchemes = Array.from(document.querySelectorAll('#colorSchemesToggles button.active')).map(btn => btn.textContent);
  let description = '';

  if (selectedCameraFeatures.length > 0) {
    description += `<strong>Camera Features:</strong> ${selectedCameraFeatures.join(', ')}<br>`;
  }

  if (selectedColorSchemes.length > 0) {
    description += `<strong>Color Schemes:</strong> ${selectedColorSchemes.join(', ')}<br>`;
  }

  // Include additional character descriptions
  const additionalGroups = document.querySelectorAll('.additional-character-group textarea');
  if (additionalGroups.length > 0) {
    const additionalDescriptions = [];
    additionalGroups.forEach(textarea => {
      const desc = textarea.value.trim();
      if (desc) {
        additionalDescriptions.push(desc);
      }
    });
    if (additionalDescriptions.length > 0) {
      description += `<strong>Additional Character Descriptions:</strong> ${additionalDescriptions.join('; ')}<br>`;
    }
  }

  document.getElementById('dynamicDescription').innerHTML = description;
}

/*******************************************************
 * DARK MODE
 *******************************************************/
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const toggleBtn = document.querySelector('.dark-mode-toggle');
  if (document.body.classList.contains('dark-mode')) {
    toggleBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
    toggleBtn.setAttribute('aria-label', 'Switch to light mode');
    toggleBtn.setAttribute('aria-pressed', 'true');
  } else {
    toggleBtn.innerHTML = '<i class="fas fa-moon"></i> 🌙';
    toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
    toggleBtn.setAttribute('aria-pressed', 'false');
  }
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function loadDarkMode() {
  const darkMode = localStorage.getItem('darkMode');
  const toggleBtn = document.querySelector('.dark-mode-toggle');
  if (darkMode === 'true') {
    document.body.classList.add('dark-mode');
    toggleBtn.innerHTML = '<i class="fas fa-sun"></i> ☀️';
    toggleBtn.setAttribute('aria-label', 'Switch to light mode');
    toggleBtn.setAttribute('aria-pressed', 'true');
  } else {
    toggleBtn.innerHTML = '<i class="fas fa-moon"></i> 🌙';
    toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
    toggleBtn.setAttribute('aria-pressed', 'false');
  }
}

/*******************************************************
 * AUTO MODE
 *******************************************************/
function toggleAutoMode() {
  autoMode = !autoMode;
  const toggleBtn = document.getElementById('autoToggleBtn');
  if (autoMode) {
    toggleBtn.classList.add('active');
    toggleBtn.innerHTML = '<i class="fas fa-robot"></i> AUTO ON';
    toggleBtn.setAttribute('aria-pressed', 'true');
  } else {
    toggleBtn.classList.remove('active');
    toggleBtn.innerHTML = '<i class="fas fa-robot"></i> AUTO OFF';
    toggleBtn.setAttribute('aria-pressed', 'false');
  }
  localStorage.setItem('autoMode', autoMode);
}

/*******************************************************
 * ADDITIONAL CHARACTER DESCRIPTIONS
 *******************************************************/
function addCharacterDescription(description = '') {
  const container = document.getElementById('additionalCharacterDescriptions');
  const descriptionCount = container.children.length;
  
  // Limit to 5 additional descriptions
  if (descriptionCount >= 5) {
    alert('You can add up to 5 additional character descriptions.');
    return;
  }

  const newGroup = document.createElement('div');
  newGroup.classList.add('input-group', 'additional-character-group');

  const label = document.createElement('label');
  label.textContent = `Additional character description ${descriptionCount + 1}:`;
  label.setAttribute('for', `additionalCharacterPrompt${descriptionCount + 1}`);

  const textarea = document.createElement('textarea');
  textarea.id = `additionalCharacterPrompt${descriptionCount + 1}`;
  textarea.placeholder = 'For example, black hair, blue eyes, wearing a red scarf and white shirt.';
  textarea.value = description;
  textarea.setAttribute('aria-label', `Additional character description ${descriptionCount + 1}`);
  textarea.oninput = updateDynamicDescription;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '–';
  removeBtn.title = 'Remove description';
  removeBtn.setAttribute('aria-label', 'Remove description');
  removeBtn.onclick = () => {
    container.removeChild(newGroup);
    updateDynamicDescription();
    saveSettings();
  };

  newGroup.appendChild(label);
  newGroup.appendChild(textarea);
  newGroup.appendChild(removeBtn);

  container.appendChild(newGroup);
  updateDynamicDescription();
}

/*******************************************************
 * LIBRARY & GENERATOR VIEW
 *******************************************************/
function showLibrary() {
  document.getElementById('generatorContainer').classList.remove('active');
  document.getElementById('libraryContainer').classList.add('active');
  disableImageDownload();
}

function showGenerator() {
  document.getElementById('libraryContainer').classList.remove('active');
  document.getElementById('generatorContainer').classList.add('active');
  disableImageDownload();
}

/*******************************************************
 * IMAGE LIBRARY
 *******************************************************/
function addImageToLibraryGallery(url, prompt, model, width, height, seed, mimeType) {
  const libraryImagesDiv = document.getElementById('libraryImages');
  const imageContainer = document.createElement('div');
  imageContainer.classList.add('image-container');

  const imgElement = document.createElement('img');
  imgElement.src = url;
  imgElement.alt = 'Generated Image';
  imgElement.title = 'Press to enlarge';
  imgElement.dataset.type = mimeType; // For correct file extension
  imageContainer.appendChild(imgElement);

  // Caption
  const caption = document.createElement('div');
  caption.classList.add('caption');
  caption.innerHTML = `
    <strong>Prompt:</strong> ${sanitizeHTML(prompt)}<br>
    <strong>Model:</strong> ${sanitizeHTML(model)}<br>
    <strong>Dimensions:</strong> ${sanitizeHTML(width)}px x ${sanitizeHTML(height)}px<br>
    <strong>Seed:</strong> ${sanitizeHTML(seed)}
  `;
  imageContainer.appendChild(caption);

  // Download options
  const downloadOptions = document.createElement('div');
  downloadOptions.classList.add('download-options');

  const formatSelect = document.createElement('select');
  formatSelect.innerHTML = `
    <option value="png">PNG</option>
    <option value="jpg">JPG</option>
    <option value="webp">WEBP</option>
  `;
  downloadOptions.appendChild(formatSelect);

  const downloadBtn = document.createElement('button');
  downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
  downloadBtn.setAttribute('aria-label', 'Download image');
  downloadBtn.onclick = () => {
    const format = formatSelect.value;
    downloadImage(url, `hexacola_image_${sanitizeFileName(seed)}.${format}`, format);
  };
  downloadOptions.appendChild(downloadBtn);

  imageContainer.appendChild(downloadOptions);
  libraryImagesDiv.appendChild(imageContainer);
}

function loadLibraryImages() {
  const images = JSON.parse(localStorage.getItem('generatedImages')) || [];
  images.forEach(image => {
    addImageToLibraryGallery(
      image.url,
      image.prompt,
      image.model,
      image.width,
      image.height,
      image.seed,
      image.mimeType
    );
  });
}

function clearLibrary() {
  if (confirm('Are you sure you want to clear all images from the library?')) {
    localStorage.removeItem('generatedImages');
    document.getElementById('libraryImages').innerHTML = '';
    alert('Library successfully cleared.');
  }
}

/*******************************************************
 * PROMPT GENERATION & IMAGE FETCH
 *******************************************************/

/** 
 * Sanitize HTML to prevent XSS 
 */
function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/** 
 * Sanitize file name for downloads 
 */
function sanitizeFileName(seed) {
  return String(seed).replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

/** 
 * Download an image in a selected format 
 */
async function downloadImage(url, filename, format) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to download image.');
    const blob = await response.blob();
    let convertedBlob = blob;

    // Convert if format differs
    if (format !== blob.type.split('/')[1]) {
      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imageBitmap, 0, 0);
      convertedBlob = await new Promise(resolve => canvas.toBlob(resolve, `image/${format}`));
      if (!convertedBlob) throw new Error('Could not convert image format.');
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(convertedBlob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (error) {
    console.error('Download error:', error);
    alert('Error downloading image. Please try again.');
  }
}

/** 
 * Save image info to localStorage 
 */
function saveImage(url, prompt, model, width, height, seed, mimeType) {
  const images = JSON.parse(localStorage.getItem('generatedImages')) || [];
  images.push({ url, prompt, model, width, height, seed, mimeType });
  localStorage.setItem('generatedImages', JSON.stringify(images));
}

/** 
 * Load images into "generatedImage" container 
 */
function loadGeneratedImages() {
  const images = JSON.parse(localStorage.getItem('generatedImages')) || [];
  images.forEach(image => {
    addImageToGallery(
      image.url, 
      image.prompt, 
      image.model, 
      image.width, 
      image.height, 
      image.seed, 
      image.mimeType
    );
  });
}

/** 
 * Add image to the generator gallery 
 */
function addImageToGallery(url, prompt, model, width, height, seed, mimeType) {
  const generatedImageDiv = document.getElementById('generatedImage');
  const imageContainer = document.createElement('div');
  imageContainer.classList.add('image-container');

  const imgElement = document.createElement('img');
  imgElement.src = url;
  imgElement.alt = 'Generated Image';
  imgElement.title = 'Press to enlarge';
  imgElement.dataset.type = mimeType;
  imageContainer.appendChild(imgElement);

  const caption = document.createElement('div');
  caption.classList.add('caption');
  caption.innerHTML = `
    <strong>Prompt:</strong> ${sanitizeHTML(prompt)}<br>
    <strong>Model:</strong> ${sanitizeHTML(model)}<br>
    <strong>Dimensions:</strong> ${sanitizeHTML(width)}px x ${sanitizeHTML(height)}px<br>
    <strong>Seed:</strong> ${sanitizeHTML(seed)}
  `;
  imageContainer.appendChild(caption);

  const downloadOptions = document.createElement('div');
  downloadOptions.classList.add('download-options');

  const formatSelect = document.createElement('select');
  formatSelect.innerHTML = `
    <option value="png">PNG</option>
    <option value="jpg">JPG</option>
    <option value="webp">WEBP</option>
  `;
  downloadOptions.appendChild(formatSelect);

  const downloadBtn = document.createElement('button');
  downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download';
  downloadBtn.setAttribute('aria-label', 'Download Image');
  downloadBtn.onclick = () => {
    const format = formatSelect.value;
    downloadImage(url, `hexacola_image_${sanitizeFileName(seed)}.${format}`, format);
  };
  downloadOptions.appendChild(downloadBtn);

  imageContainer.appendChild(downloadOptions);
  generatedImageDiv.appendChild(imageContainer);
}

/*******************************************************
 * IMAGE GENERATION LOGIC
 *******************************************************/

/** 
 * Main generate image function 
 */
class ImageProcessor {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
    this.results = [];
  }

  async processUrls(urls) {
    this.queue = [...urls];
    this.results = new Array(urls.length);
    
    const workers = new Array(this.concurrency).fill(null).map(() => this.worker());
    await Promise.all(workers);
    
    return this.results;
  }

  async worker() {
    while (this.queue.length > 0) {
      const { url, index } = this.queue.shift();
      this.active++;
      
      try {
        const blob = await this.fetchWithAdaptiveRetry(url);
        this.results[index] = { blob, index, success: true };
      } catch (error) {
        console.error(`Worker failed for index ${index}:`, error);
        this.results[index] = { blob: null, index, success: false };
      }
      
      this.active--;
      generatedImagesCount++;
      updateProgressBar();
    }
  }

  async fetchWithAdaptiveRetry(url, attempt = 1, maxAttempts = 12) {
    const baseDelay = 3000;
    const maxDelay = 45000;
    const adaptiveTimeout = Math.min(30000 * Math.pow(1.5, attempt - 1), 180000);
    const backoffDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    try {
      const response = await fetchWithProxies(url, adaptiveTimeout);
      
      if (response.status === 500) {
        const currentModel = url.match(/model=([^&]+)/)[1];
        const alternativeModel = getAlternativeModel(currentModel);
        
        if (alternativeModel && attempt <= 4) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const newUrl = url.replace(`model=${currentModel}`, `model=${alternativeModel}`);
          return this.fetchWithAdaptiveRetry(newUrl, 1, maxAttempts);
        }
        
        throw new Error(`Server error (500) with model ${currentModel}`);
      }

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('image/')) {
        throw new Error('Invalid content type received');
      }

      const blob = await response.blob();
      if (blob.size < 1000) throw new Error('Invalid image data received');

      return blob;

    } catch (error) {
      if (attempt < maxAttempts) {
        console.warn(`Attempt ${attempt} failed:`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        if (attempt > 3 && (error.message.includes('500') || error.message.includes('timeout'))) {
          const currentModel = url.match(/model=([^&]+)/)[1];
          const alternativeModel = getAlternativeModel(currentModel);
          if (alternativeModel) {
            const newUrl = url.replace(`model=${currentModel}`, `model=${alternativeModel}`);
            console.log(`Failure recovery: switching to model ${alternativeModel}`);
            return this.fetchWithAdaptiveRetry(newUrl, attempt + 1, maxAttempts);
          }
        }
        
        return this.fetchWithAdaptiveRetry(url, attempt + 1, maxAttempts);
      }
      throw error;
    }
  }
}

// Replace the existing generateImage function with this updated version
async function generateImage() {
  const generateButton = document.querySelector('.generate');
  generateButton.disabled = true;
  
  // Gather user inputs
  const backgroundPrompt = document.getElementById('backgroundPrompt').value.trim();
  const characterPrompt = document.getElementById('characterPrompt').value.trim();
  const negativePrompt = document.getElementById('negativePrompt').value.trim();
  const model = document.getElementById('model').value;
  const width = parseInt(document.getElementById('width').value, 10);
  const height = parseInt(document.getElementById('height').value, 10);
  const seedInput = document.getElementById('seed').value.trim();
  const seed = seedInput ? parseInt(seedInput, 10) : null;
  const imageOptions = parseInt(document.getElementById('imageOptions').value, 10);
  const style = document.getElementById('style').value;
  
  // Additional character descriptions
  const additionalCharacterDescriptions = [];
  const additionalGroups = document.querySelectorAll('.additional-character-group textarea');
  additionalGroups.forEach(textarea => {
    const desc = textarea.value.trim();
    if (desc) additionalCharacterDescriptions.push(desc);
  });
  
  const selectedCameraFeatures = Array.from(document.querySelectorAll('#cameraFeaturesToggles button.active')).map(btn => btn.textContent);
  const selectedColorSchemes = Array.from(document.querySelectorAll('#colorSchemesToggles button.active')).map(btn => btn.textContent);

  // Check if all prompts are empty
  const noPrompts = !backgroundPrompt && !characterPrompt && additionalCharacterDescriptions.length === 0;
  let backgroundCombinedPrompt = '';
  let characterCombinedPrompt = '';

  // Auto-generate background & character if user gave no prompts
  if (noPrompts) {
    try {
      [backgroundCombinedPrompt, characterCombinedPrompt] = await Promise.all([
        generateRandomPromptFunction('background', style, selectedCameraFeatures, selectedColorSchemes),
        generateRandomPromptFunction('character', style, selectedCameraFeatures, selectedColorSchemes)
      ]);
      document.getElementById('backgroundPrompt').value = backgroundCombinedPrompt;
      document.getElementById('characterPrompt').value = characterCombinedPrompt;
    } catch (error) {
      console.error(error);
      alert('Failed to generate random description. Please try again.');
      generateButton.disabled = false;
      return;
    }
  } else {
    backgroundCombinedPrompt = backgroundPrompt;
    characterCombinedPrompt = characterPrompt;
  }

  // Ensure at least one prompt is present
  if (!backgroundCombinedPrompt && !characterCombinedPrompt) {
    alert('Please provide at least one background or character prompt.');
    generateButton.disabled = false;
    return;
  }

  saveSettings();

  // Initialize prompt strings for optimization
  let optimizedBackgroundPrompt = backgroundCombinedPrompt;
  let optimizedCharacterPrompt = characterCombinedPrompt;
  let optimizedNegativePrompt = "low quality, blurry, bad anatomy, out of focus, noise, duplicate, watermark, text, ugly, messy, " + negativePrompt;

  // If auto-mode is on, attempt prompt optimization with AI
  if (autoMode) {
    try {
      if (backgroundCombinedPrompt) {
        optimizedBackgroundPrompt = await optimizePrompt(
          `Optimize the following background prompt for high-quality image generation in ${style} style with camera features ${selectedCameraFeatures.join(', ')} and color schemes ${selectedColorSchemes.join(', ')}: "${backgroundCombinedPrompt}"`
        );
      }
      if (characterCombinedPrompt) {
        optimizedCharacterPrompt = await optimizePrompt(
          `Optimize the following character prompt for high-quality image generation in ${style} style with camera features ${selectedCameraFeatures.join(', ')} and color schemes ${selectedColorSchemes.join(', ')}: "${characterCombinedPrompt}"`
        );
      }
      for (let i = 0; i < additionalCharacterDescriptions.length; i++) {
        additionalCharacterDescriptions[i] = await optimizePrompt(
          `Optimize the following character description to match the ${style} style with camera features ${selectedCameraFeatures.join(', ')} and color schemes ${selectedColorSchemes.join(', ')}: "${additionalCharacterDescriptions[i]}"`
        );
      }
      if (negativePrompt) {
        optimizedNegativePrompt = "low quality, blurry, bad anatomy, out of focus, noise, duplicate, watermark, text, ugly, messy, " + 
          await optimizePrompt(`Optimize the following negative prompt to exclude unwanted elements: "${negativePrompt}"`);
      }
    } catch (error) {
      console.error(error);
      alert('Error optimizing descriptions with AI. Please try again.');
      generateButton.disabled = false;
      return;
    }
  }

  // Integrate additional character descriptions
  let fullCharacterPrompt = optimizedCharacterPrompt;
  if (additionalCharacterDescriptions.length > 0) {
    fullCharacterPrompt += ' ' + additionalCharacterDescriptions.join(' ');
    fullCharacterPrompt += ' Ensure all characters maintain the same style, facial structure, and clothing.';
  }

  // Merge background + character
  let combinedPrompt = '';
  if (optimizedBackgroundPrompt && fullCharacterPrompt) {
    combinedPrompt = `${optimizedBackgroundPrompt}, ${fullCharacterPrompt}, with correct proportions, good perspective, and excellent composition.`;
  } else if (optimizedBackgroundPrompt) {
    combinedPrompt = `${optimizedBackgroundPrompt}, with correct proportions, good perspective, and excellent composition.`;
  } else if (fullCharacterPrompt) {
    combinedPrompt = `${fullCharacterPrompt}, with correct proportions, good perspective, and excellent composition.`;
  }

  // Apply style
  if (style === 'Mix') {
    combinedPrompt = appendMixStyleToPrompt(combinedPrompt);
  } else if (style !== 'None') {
    combinedPrompt = appendStyleToPrompt(combinedPrompt, style);
  }

  // Prepend camera features & color schemes
  if (selectedCameraFeatures.length > 0) {
    combinedPrompt = `${selectedCameraFeatures.join(', ')}, ${combinedPrompt}`;
  }
  if (selectedColorSchemes.length > 0) {
    combinedPrompt = `${selectedColorSchemes.join(', ')}, ${combinedPrompt}`;
  }

  // Create the base URL without proxy
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(combinedPrompt)}`;
  
  // Add parameters separately to avoid encoding issues
  const params = new URLSearchParams({
    model: model,
    width: width.toString(),
    height: height.toString(),
    nologo: 'true'
  });

  // Combine URL and parameters
  const fullUrl = `${imageUrl}?${params.toString()}`;

  try {
    // Show overlay and start animations
    const overlay = document.getElementById('overlay');
    const timer = document.getElementById('timer');
    overlay.style.display = 'flex';

    let seconds = 0;
    timer.textContent = `Generation time: ${seconds}s`;
    timerInterval = setInterval(() => {
      seconds++;
      timer.textContent = `Generation time: ${seconds}s`;
    }, 1000);

    // Rotate loading messages every 3s
    updateLoadingMessage();
    loadingMessageInterval = setInterval(updateLoadingMessage, 3000);

    // Thinking process animation
    animateThinkingProcess();

    // Progress bar
    totalImages = imageOptions;
    generatedImagesCount = 0;
    updateProgressBar();

    // Clear previously generated images
    const generatedImageDiv = document.getElementById('generatedImage');
    generatedImageDiv.innerHTML = '';

    // Prepare URLs for parallel processing
    const urls = [];
    for (let i = 0; i < imageOptions; i++) {
      const uniqueSeed = seed ? seed + i : Math.floor(Math.random() * 100000);
      urls.push({
        url: `${fullUrl}&seed=${uniqueSeed}`,
        index: i
      });
    }

    // Process images in parallel with controlled concurrency
    const processor = new ImageProcessor(3); // Process 3 images concurrently
    const results = await processor.processUrls(urls);

    // Handle results
    const successCount = results.filter(r => r.success).length;
    if (successCount === 0) {
      throw new Error('All image generation attempts failed. Please try again with different parameters.');
    }

    results.forEach(({ blob, index, success }) => {
      if (success && blob) {
        const imgUrl = URL.createObjectURL(blob);
        addImageToGallery(
          imgUrl,
          combinedPrompt,
          model,
          width,
          height,
          seed ? seed + index : `Random_${Date.now()}`,
          blob.type
        );
        saveImage(
          imgUrl,
          combinedPrompt,
          model,
          width,
          height,
          seed ? seed + index : `Random_${Date.now()}`,
          blob.type
        );
      }
    });

    if (successCount < imageOptions) {
      alert(`Generated ${successCount} out of ${imageOptions} images. Some images failed to generate.`);
    }

  } catch (error) {
    console.error('Image generation error:', error);
    alert(`Error generating image${error.message ? ': ' + error.message : '. Please try again.'}`);
    document.getElementById('generatedImage').innerHTML = '';
  } finally {
    clearInterval(timerInterval);
    clearInterval(loadingMessageInterval);
    clearTimeout(thinkingStepTimeout);
    document.querySelectorAll('.thinking-step').forEach(step => step.classList.remove('active', 'complete'));

    document.getElementById('overlay').style.display = 'none';
    generateButton.disabled = false;
    document.getElementById('progressOverlay').style.display = 'none';
  }
}

/** 
 * Update generation progress bar 
 */
function updateProgressBar() {
  const progressBar = document.getElementById('progressOverlayBar');
  const progressPercentage = (generatedImagesCount / totalImages) * 100;
  progressBar.style.width = `${progressPercentage}%`;
  if (progressPercentage >= 100) {
    progressBar.style.backgroundColor = '#4caf50'; // Green when done
  }
}

/** 
 * Optimizes a prompt string using Pollinations.AI 
 */
async function optimizePrompt(prompt) {
  try {
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      mode: 'cors',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are hexacola background and character generator for AI art' },
          { role: 'user', content: prompt }
        ],
        model: 'openai',
        seed: Math.floor(Math.random() * 100000),
        jsonMode: false
      })
    });
    if (!response.ok) {
      console.warn('API response not ok, using original prompt.');
      return prompt;
    }
    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    return prompt;
  } catch (error) {
    console.error('Error optimizing prompt:', error);
    return prompt;
  }
}

/** 
 * Generates a random prompt for background or character 
 */
async function generateRandomPromptFunction(target, style, cameraFeatures, colorSchemes) {
  let basePrompt = '';
  if (target === 'background') {
    basePrompt = 'Generate a completely random background, ensuring each response is unique and unpredictable. The setting should feel fresh, with no repetition in themes, elements, or style for AI image generation.';
  } else if (target === 'character') {
    basePrompt = 'Create a fully random character, making sure every response is entirely distinct. The design, personality, and features must always change to keep outcomes varied for AI image generation.';
  } else {
    throw new Error('Invalid target for prompt generation.');
  }

  // Integrate camera features & color schemes first
  let enhancedPrompt = '';
  if (cameraFeatures.length > 0) {
    enhancedPrompt += `${cameraFeatures.join(', ')}, `;
  }
  if (colorSchemes.length > 0) {
    enhancedPrompt += `${colorSchemes.join(', ')}, `;
  }
  enhancedPrompt += basePrompt;

  const response = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are hexacola background and character generator for AI art' },
        { role: 'user', content: enhancedPrompt }
      ],
      model: 'openai',
      seed: Math.floor(Math.random() * 100000),
      jsonMode: false
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to contact AI service.');
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0 && data.choices[0].message) {
    let generatedPrompt = data.choices[0].message.content.trim();
    // If style is chosen, apply it
    if (style && style !== 'None') {
      generatedPrompt = appendStyleToPrompt(generatedPrompt, style);
    }
    return generatedPrompt;
  } else {
    throw new Error('Invalid AI response.');
  }
}

async function generateRandomPrompt(target) {
  const style = document.getElementById('style').value;
  const selectedCameraFeatures = Array.from(document.querySelectorAll('#cameraFeaturesToggles button.active')).map(btn => btn.textContent);
  const selectedColorSchemes = Array.from(document.querySelectorAll('#colorSchemesToggles button.active')).map(btn => btn.textContent);
  const generateButtons = document.querySelectorAll('.generate-prompt');
  generateButtons.forEach(button => button.disabled = true);

  try {
    const prompt = await generateRandomPromptFunction(target, style, selectedCameraFeatures, selectedColorSchemes);
    if (target === 'background') {
      document.getElementById('backgroundPrompt').value = prompt;
    } else if (target === 'character') {
      document.getElementById('characterPrompt').value = prompt;
    }
    alert(`Successfully generated ${target} description!`);
  } catch (error) {
    console.error(error);
    alert('Error generating description. Please try again.');
  } finally {
    generateButtons.forEach(button => button.disabled = false);
  }
}

/*******************************************************
 * STYLE MANAGEMENT
 *******************************************************/
function appendStyleToPrompt(prompt, style) {
  const styleDescriptions = {
    'Film': `${prompt}, cinematic masterpiece, shot with an anamorphic 35mm lens, ultra-wide aspect ratio, natural film grain, rich and moody cinematic color palette, deep contrast, dynamic range, soft and detailed lighting, natural bokeh, shallow depth of field, evocative storytelling, authentic vintage film aesthetics, timeless Hollywood style`,
    'Pixel Art': `${prompt}, in classic pixel art style, inspired by retro games like Final Fantasy and Chrono Trigger, 16-bit aesthetic, carefully crafted pixel details, vibrant tones, smooth shading, and authentic retro charm`,
    'Anime': `${prompt}, in anime style inspired by classics like Attack on Titan and Demon Slayer, vivid color schemes, expressive characters, dramatic lighting, intricate line work, and cinematic anime atmosphere`,
    'Realistic': `${prompt}, photorealistic, meticulously rendered textures, lifelike proportions, dynamic/natural lighting, realistic depth of field, authentic environments, nuanced color grading`,
    'Storyboard': `${prompt}, in black-and-white storyboard style, emphasizing composition, perspective, dynamic camera angles, cinematic framing, character blocking, rough pencil sketch aesthetic`,
    'Film Noir': `${prompt}, in classic film noir style, high contrast black-and-white, dramatic chiaroscuro, deep shadows, vintage aesthetics, suspenseful mood, smoky urban settings`,
    'Vintage': `${prompt}, in a vintage style, muted earthy palette, soft film grain, faded textures, nostalgic atmosphere, delicate vignetting, retro-inspired designs`,
    'Graphic Design': `${prompt}, in a modern graphic design style, clean layouts, bold typography, striking color combos, minimalist aesthetics, geometric shapes, visually compelling branding`,
    'Cartoon': `${prompt}, Cartoon Network-inspired, bold outlines, exaggerated proportions, vibrant colors, playful comedic style, reminiscent of Adventure Time or Gumball`,
    'Watercolor': `${prompt}, delicate watercolor painting style, soft brush strokes, pastel and muted tones, organic textures, flowing gradients, dreamy artistic atmosphere`,
    'Surrealism': `${prompt}, surreal, dreamlike imagery, abstract forms, unconventional compositions, a fusion of reality and imagination`,
    'Comics Style': `${prompt}, in a vibrant comics style, bold outlines, dynamic panels, exaggerated action, halftone patterns, speech bubbles, reminiscent of Marvel/DC classics`,
    'Mix': appendMixStyleToPrompt(prompt)
  };
  return styleDescriptions[style] || prompt;
}

function getRandomStyles() {
  const styles = [
    'Film', 'Pixel Art', 'Anime', 'Realistic', 'Storyboard', 
    'Film Noir', 'Vintage', 'Graphic Design', 'Cartoon',
    'Watercolor', 'Surrealism', 'Comics Style'
  ];
  let first = styles[Math.floor(Math.random() * styles.length)];
  let second = styles[Math.floor(Math.random() * styles.length)];
  while (second === first) {
    second = styles[Math.floor(Math.random() * styles.length)];
  }
  return `${first} and ${second}`;
}

function appendMixStyleToPrompt(prompt) {
  const randomStyles = getRandomStyles();
  return `${prompt}, in ${randomStyles} styles, merging elements from both for a unique, captivating image`;
}

/*******************************************************
 * MODAL SETUP
 *******************************************************/
function setupModal() {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImage");
  const closeBtn = document.getElementsByClassName("close")[0];

  closeBtn.onclick = function() { 
    modal.style.display = "none";
  };
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
  document.getElementById('generatedImage').addEventListener('click', function(event) {
    if (event.target.tagName === 'IMG') {
      modal.style.display = "block";
      modalImg.src = event.target.src;
    }
  });
  document.getElementById('libraryImages').addEventListener('click', function(event) {
    if (event.target.tagName === 'IMG') {
      modal.style.display = "block";
      modalImg.src = event.target.src;
    }
  });
}

/*******************************************************
 * DOWNLOAD ALL IMAGES IN LIBRARY
 *******************************************************/
async function downloadAllLibraryImages() {
  const images = document.querySelectorAll('#libraryImages img');
  if (images.length === 0) {
    alert('No images to download.');
    return;
  }
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const mimeType = img.dataset.type || 'image/png'; 
    const extension = mimeType.split('/')[1] || 'png';
    const seedCaption = img.parentElement.querySelector('.caption strong:nth-child(4)');
    let seedText = 'unknown_seed';
    if (seedCaption && seedCaption.nextSibling && seedCaption.nextSibling.textContent) {
      seedText = seedCaption.nextSibling.textContent.trim();
    }
    const filename = `hexacola_image_${sanitizeFileName(seedText)}.${extension}`;
    await downloadImage(img.src, filename, extension);
  }
}

/*******************************************************
 * CHAT FUNCTIONALITY
 *******************************************************/
async function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();
  if (message === '') return;

  appendMessage('user', message);
  chatInput.value = '';

  try {
    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      mode: 'cors',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are hexacola background and character generator for AI art' },
          { role: 'user', content: message }
        ],
        model: 'openai',
        seed: Math.floor(Math.random() * 100000),
        jsonMode: false
      }),
    });

    if (!response.ok) {
      throw new Error('Could not connect to AI service.');
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      appendMessage('assistant', data.choices[0].message.content);
    } else {
      throw new Error('Invalid AI response.');
    }
  } catch (error) {
    console.error(error);
    appendMessage('assistant', 'Error communicating with HEXACOLA.AI. Please try again.');
  }
}

/** 
 * Append chat message 
 */
function appendMessage(role, content) {
  const chat = document.getElementById('chat');
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('chat-message', role);
  messageDiv.textContent = content;
  chat.appendChild(messageDiv);
  chat.scrollTop = chat.scrollHeight;
}

/*******************************************************
 * DISABLE IMAGE DOWNLOAD / RIGHT-CLICK
 *******************************************************/
function disableImageDownload() {
  const images = document.querySelectorAll('.generated-image img, .library-container img');
  images.forEach(img => {
    img.oncontextmenu = (e) => e.preventDefault();
    img.draggable = false;
  });
}

/*******************************************************
 * NEGATIVE PROMPT INITIALIZATION
 *******************************************************/
function initializeNegativePrompt() {
  const negativePromptField = document.getElementById('negativePrompt');
  if (!negativePromptField.value) {
    negativePromptField.value = "low quality, blurry, bad anatomy, out of focus, noise, duplicate, watermark, text, ugly, messy";
  }
}

/*******************************************************
 * ADDITIONAL EVENT LISTENERS & VALIDATIONS
 *******************************************************/
function addEventListeners() {
  // Modal close & ESC
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImage');
  const closeBtn = document.querySelector('.close');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      modal.style.display = 'none';
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      generateImage();
    }
  });

  // Validate dimension inputs
  const widthInput = document.getElementById('width');
  const heightInput = document.getElementById('height');
  const imageOptionsInput = document.getElementById('imageOptions');

  [widthInput, heightInput].forEach(input => {
    input.addEventListener('change', () => {
      const value = parseInt(input.value, 10);
      if (value < 64) input.value = 64;
      if (value > 2048) input.value = 2048;
    });
  });

  // Validate imageOptions for 1–10
  imageOptionsInput.addEventListener('change', () => {
    const value = parseInt(imageOptionsInput.value, 10);
    if (value < 1) imageOptionsInput.value = 1;
    if (value > 10) imageOptionsInput.value = 10;
  });
}

/** 
 * Fetch with enhanced retry logic and timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = 180000) { // Increased to 180s for larger images
  const controller = new AbortController();
  let timeoutId;
  
  try {
    const fetchPromise = fetch(url, {
      ...options,
      mode: 'no-cors', // Add no-cors mode
      signal: controller.signal,
      headers: {
        ...options.headers,
        'Accept': 'image/*'
        // Removed Cache-Control and Pragma headers
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('Request timeout'));
      }, timeout);
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return response;

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request was aborted due to timeout');
    }
    throw error;
  }
}

/**
 * Improved model fallback chain with all available models
 */
function getAlternativeModel(currentModel) {
  const modelFallbacks = {
    'flux': ['flux-pro', 'turbo', 'flux-anime', 'flux-3d', 'flux-realism'],
    'flux-pro': ['flux', 'turbo', 'flux-anime'],
    'turbo': ['flux', 'flux-pro', 'flux-anime'],
    'flux-anime': ['flux', 'flux-pro', 'turbo'],
    'flux-3d': ['flux', 'flux-pro', 'flux-realism'],
    'flux-realism': ['flux', 'flux-pro', 'flux-3d'],
    'flux-cablyal': ['flux-pro', 'flux', 'turbo'],
    'any-dark': ['flux', 'flux-pro', 'turbo'],
    'Unity': ['flux-pro', 'flux', 'turbo']
  };

  const fallbacks = modelFallbacks[currentModel];
  if (!fallbacks) return 'flux'; // Default fallback
  
  // Return the first fallback model that hasn't been tried yet
  return fallbacks[0];
}

/** 
 * Improved retry logic with progressive timeouts and model rotation
 */
async function fetchWithRetry(url, attempt = 1, maxAttempts = 12, triedModels = new Set()) {
  const backoffDelay = Math.min(3000 * Math.pow(1.5, attempt - 1), 45000);
  const currentModel = url.match(/model=([^&]+)/)?.[1];
  
  try {
    console.log(`Attempt ${attempt}/${maxAttempts} using model: ${currentModel}`);
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      if (response.status === 500 && currentModel) {
        triedModels.add(currentModel);
        const alternativeModel = getAlternativeModel(currentModel);
        
        if (alternativeModel && !triedModels.has(alternativeModel)) {
          console.log(`Switching to model: ${alternativeModel}`);
          const newUrl = url.replace(`model=${currentModel}`, `model=${alternativeModel}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchWithRetry(newUrl, 1, maxAttempts, triedModels);
        }
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('image/')) {
      throw new Error('Invalid content type received');
    }

    const blob = await response.blob();
    if (blob.size < 1000) {
      throw new Error('Invalid image data received');
    }

    return blob;

  } catch (error) {
    console.warn(`Attempt ${attempt} failed:`, error.message);

    if (attempt < maxAttempts) {
      console.log(`Retrying in ${backoffDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      if (attempt % 3 === 0 && currentModel) {
        triedModels.add(currentModel);
        const alternativeModel = getAlternativeModel(currentModel);
        
        if (alternativeModel && !triedModels.has(alternativeModel)) {
          const newUrl = url.replace(`model=${currentModel}`, `model=${alternativeModel}`);
          return fetchWithRetry(newUrl, attempt + 1, maxAttempts, triedModels);
        }
      }
      
      return fetchWithRetry(url, attempt + 1, maxAttempts, triedModels);
    }

    throw new Error(`Failed after ${maxAttempts} attempts: ${error.message}`);
  }
}

/**
 * Try different CORS proxies until one works
 */
async function fetchWithProxies(imageUrl, timeout = 180000) {
  let lastError;
  
  for (const proxy of corsProxies) {
    try {
      const fullUrl = proxy ? `${proxy}${encodeURIComponent(imageUrl)}` : imageUrl;
      const response = await fetch(fullUrl, {
        mode: proxy ? 'cors' : 'no-cors',
        headers: {
          'Accept': 'image/*'
        },
        timeout: timeout
      });
      
      if (response.ok) {
        return response;
      }
    } catch (error) {
      lastError = error;
      console.warn(`Proxy ${proxy || 'direct'} failed:`, error);
      continue;
    }
  }
  
  throw lastError || new Error('All proxies failed');
}

// Resource loading error handler
function handleResourceError(resource, type) {
    console.error(`Failed to load ${type}: ${resource}`);
    if (type === 'image') {
        return './assets/images/placeholder.png';
    }
    return null;
}

// Image loading with error handling
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Failed to load image: ${src}`);
            img.src = handleResourceError(src, 'image');
            resolve(img);
        };
        img.src = src;
    });
}