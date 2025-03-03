// Define the AISuggestionHandler class at the top level, before usage
class AISuggestionHandler {
    constructor(quill) {
        if (!quill) throw new Error('Quill editor instance is required');
        
        this.quill = quill;
        this.enabled = localStorage.getItem('aiSuggestionsEnabled') !== 'false';
        this.currentSuggestion = null;
        this.loadingIndicator = null;
        this.settings = this.loadSettings();
        
        // Bind methods
        this.handleTextChange = this.debounce(this.handleTextChange.bind(this), 500);
        this.toggleSuggestions = this.toggleSuggestions.bind(this);
        this.storyContext = new StoryContext();
        this.lastSuggestion = null;
    }

    loadSettings() {
        const defaultSettings = {
            enabledTypes: new Set(['scene-heading', 'character', 'dialogue', 'parenthetical', 'action']),
            frequency: 'medium',
            detail: 'sentence'
        };

        try {
            const saved = JSON.parse(localStorage.getItem('aiSuggestionSettings'));
            return {
                ...defaultSettings,
                ...saved,
                enabledTypes: new Set(saved?.enabledTypes || defaultSettings.enabledTypes)
            };
        } catch {
            return defaultSettings;
        }
    }

    initialize() {
        this.createLoadingIndicator();
        this.setupEventListeners();
        this.updateUIState();
        return this; // Enable method chaining
    }

    createLoadingIndicator() {
        // Create loading indicator element
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'suggestion-loading';
        this.loadingIndicator.innerHTML = `
            <span>Thinking</span>
            <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
        this.quill.container.appendChild(this.loadingIndicator);
    }

    setupEventListeners() {
        // Toggle button
        const toggleBtn = document.getElementById('toggleSuggestions');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', this.toggleSuggestions);
        }

        // Settings panel controls
        document.getElementById('suggestionFrequency')?.addEventListener('change', (e) => {
            this.settings.frequency = e.target.value;
            localStorage.setItem('aiSuggestionFrequency', e.target.value);
        });

        document.getElementById('suggestionDetail')?.addEventListener('change', (e) => {
            this.settings.detail = e.target.value;
            localStorage.setItem('aiSuggestionDetail', e.target.value);
        });

        // Format type checkboxes
        document.querySelectorAll('input[name="suggestFor"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.settings.enabledTypes.add(e.target.value);
                } else {
                    this.settings.enabledTypes.delete(e.target.value);
                }
                localStorage.setItem('aiSuggestionTypes', JSON.stringify([...this.settings.enabledTypes]));
            });
        });

        // Text change handler
        this.quill.on('text-change', this.handleTextChange);

        // Tab key handler for accepting suggestions
        this.quill.keyboard.addBinding(
            { key: 'Tab' },
            this.handleTabKey
        );
    }

    async handleTextChange(delta, oldContents, source) {
        if (!this.enabled || source !== 'user') return;

        const range = this.quill.getSelection();
        if (!range) return;

        const [line] = this.quill.getLine(range.index);
        const format = line?.domNode?.getAttribute('data-format');

        if (!format || !this.settings.enabledTypes.has(format)) return;

        const text = line.domNode.textContent;
        if (!text.trim()) return;

        // Update story context
        this.storyContext.updateContext(text, format);

        this.showLoadingIndicator();
        
        try {
            const suggestion = await this.generateSuggestion(text, format);
            if (suggestion) {
                this.displaySuggestion(suggestion, range.index + range.length);
            }
        } catch (error) {
            console.error('Failed to generate suggestion:', error);
            this.showError('Failed to generate suggestion');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    async generateSuggestion(text, format) {
        const promptTemplates = {
            'scene-heading': (text) => `Suggest a compelling scene heading that follows this context: ${text}. 
                                      Consider the story flow and visual impact.`,
            
            'character': (text) => `Based on this character context: ${text}
                                  Suggest character development details including:
                                  - Backstory elements
                                  - Key motivations
                                  - Relationship dynamics
                                  - Character traits and quirks`,
            
            'dialogue': (text) => `For this dialogue context: ${text}
                                 Suggest authentic and engaging dialogue that:
                                 - Reveals character personality
                                 - Advances the plot
                                 - Creates subtext
                                 - Shows not tells
                                 - Maintains voice consistency`,
            
            'action': (text) => `For this action sequence: ${text}
                               Suggest vivid action description that:
                               - Sets the scene atmosphere
                               - Shows character through behavior
                               - Maintains visual flow
                               - Highlights important details`,
            
            'parenthetical': (text) => `For this acting instruction context: ${text}
                                      Suggest subtle character direction that:
                                      - Shows emotional state
                                      - Indicates delivery style
                                      - Avoids being too prescriptive`
        };

        const prompt = promptTemplates[format](text);
        
        try {
            // Call Pollinations API
            const response = await fetch('https://text.pollinations.ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    model: 'mistral', // Can be switched to other models
                    systemPrompt: 'You are an expert screenwriter. Provide specific, contextual suggestions that enhance character depth, plot progression, and thematic resonance.',
                    maxTokens: 100
                })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();
            return this.formatSuggestion(data.text, format);
        } catch (error) {
            console.error('Suggestion generation failed:', error);
            return null;
        }
    }

    formatSuggestion(text, format) {
        // Clean and format the suggestion based on type
        switch (format) {
            case 'scene-heading':
                return text.toUpperCase().trim();
            case 'character':
                return text.toUpperCase().trim();
            case 'parenthetical':
                text = text.toLowerCase().trim();
                return text.startsWith('(') ? text : `(${text})`;
            default:
                return text.trim();
        }
    }

    displaySuggestion(suggestion, index) {
        this.removeSuggestion();

        // Insert suggestion with special formatting
        this.quill.insertText(
            index,
            suggestion,
            {
                color: '#666666',
                background: 'rgba(107, 142, 35, 0.1)',
                'suggestion': true
            },
            'api'
        );

        this.currentSuggestion = {
            text: suggestion,
            index: index,
            length: suggestion.length
        };

        // Add visual indicator
        const [line] = this.quill.getLine(index);
        if (line?.domNode) {
            line.domNode.classList.add('has-suggestion');
        }
    }

    handleTabKey() {
        if (this.currentSuggestion) {
            this.acceptSuggestion();
            return false;
        }
        return true;
    }

    acceptSuggestion() {
        if (!this.currentSuggestion) return false;

        // Remove suggestion formatting but keep text
        this.quill.removeFormat(
            this.currentSuggestion.index,
            this.currentSuggestion.length,
            'api'
        );

        // Move cursor to end of accepted suggestion
        this.quill.setSelection(
            this.currentSuggestion.index + this.currentSuggestion.length,
            0
        );

        // Remove visual indicator
        const [line] = this.quill.getLine(this.currentSuggestion.index);
        if (line?.domNode) {
            line.domNode.classList.remove('has-suggestion');
        }

        this.currentSuggestion = null;
        return true;
    }

    removeSuggestion() {
        if (this.currentSuggestion) {
            this.quill.deleteText(
                this.currentSuggestion.index,
                this.currentSuggestion.length,
                'api'
            );
            this.currentSuggestion = null;
        }
    }

    toggleSuggestions() {
        this.enabled = !this.enabled;
        localStorage.setItem('aiSuggestionsEnabled', this.enabled);
        this.updateUIState();
        
        if (!this.enabled) {
            this.removeSuggestion();
        }
    }

    updateUIState() {
        const toggleBtn = document.getElementById('toggleSuggestions');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', this.enabled);
            toggleBtn.innerHTML = `
                <i class="fas fa-lightbulb"></i> 
                AI Suggestions ${this.enabled ? 'On' : 'Off'}
            `;
        }
    }

    showLoadingIndicator() {
        this.loadingIndicator.classList.add('visible');
    }

    hideLoadingIndicator() {
        this.loadingIndicator.classList.remove('visible');
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'error-message';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }
}

class StoryContext {
    constructor() {
        this.characters = new Map();
        this.plotPoints = [];
        this.settings = new Set();
        this.themes = new Set();
    }

    updateContext(text, format) {
        switch (format) {
            case 'character':
                this.updateCharacter(text);
                break;
            case 'dialogue':
                this.updateDialogue(text);
                break;
            case 'scene-heading':
                this.updateSetting(text);
                break;
            case 'action':
                this.updatePlotPoint(text);
                break;
        }
    }

    updateCharacter(text) {
        const character = text.toUpperCase().trim();
        if (!this.characters.has(character)) {
            this.characters.set(character, {
                appearances: 1,
                traits: new Set(),
                relationships: new Map(),
                arcs: []
            });
        } else {
            const char = this.characters.get(character);
            char.appearances++;
        }
    }

    // ... rest of context tracking methods
}

document.addEventListener('DOMContentLoaded', () => {
    // Constants and DOM elements
    const FORMATS = {
        'scene-heading': { style: { bold: true, header: 1 }, prefix: 'INT./EXT.' },
        'character': { style: { bold: true, align: 'center' }, uppercase: true },
        'dialogue': { style: { align: 'center', indent: 2 } },
        'parenthetical': { style: { align: 'center', indent: 3, italic: true }, brackets: true },
        'action': { style: { align: 'left' } }
    };

    const SHORTCUTS = {
        '1': 'scene-heading',
        '2': 'action',
        '3': 'character',
        '4': 'dialogue',
        '5': 'parenthetical'
    };

    // Initialize editor with proper configuration
    const quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: false,
            keyboard: {
                bindings: {
                    tab: false,
                    'indent-1': false,
                    'indent+1': false
                }
            }
        },
        placeholder: 'Start writing your script...',
        formats: ['bold', 'italic', 'align', 'header'], // Limit available formats
        bounds: '#editor'
    });

    // Force proper formatting
    quill.root.style.fontFamily = "'Courier Prime', monospace";
    quill.root.style.fontSize = '12pt';
    quill.root.style.lineHeight = '1.5';

    // Initialize AI suggestions with error handling
    let aiHandler;
    try {
        aiHandler = new AISuggestionHandler(quill).initialize();
    } catch (error) {
        console.error('Failed to initialize AI suggestions:', error);
        showNotification('AI suggestions unavailable', 'error');
    }

    // Screenplay Element Definitions
    const SCRIPT_ELEMENTS = {
        'scene-heading': {
            style: { 
                bold: true, 
                header: 1,
                align: 'left',
                indent: 0 
            },
            format: (text) => {
                text = text.toUpperCase();
                // Ensure proper scene heading format
                if (!text.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/)) {
                    text = 'INT. ' + text;
                }
                if (!text.includes(' - ')) {
                    text += ' - DAY';
                }
                return text;
            },
            nextElement: 'action',
            shortcut: '1',
            margin: { top: 24, bottom: 12 }
        },
        'action': {
            style: { 
                bold: false,
                header: false,
                align: 'left',
                indent: 0 
            },
            format: (text) => text,
            nextElement: 'character',
            shortcut: '2',
            margin: { top: 12, bottom: 12 }
        },
        'character': {
            style: { 
                bold: true,
                align: 'center',
                indent: 192 // 2 inches from left 
            },
            format: (text) => text.toUpperCase(),
            nextElement: 'dialogue',
            shortcut: '3',
            margin: { top: 24, bottom: 0 }
        },
        'dialogue': {
            style: { 
                align: 'left',
                indent: 96, // 1 inch from left
                width: 216 // 3.5 inches wide
            },
            format: (text) => text,
            nextElement: 'character',
            shortcut: '4',
            margin: { top: 0, bottom: 12 }
        },
        'parenthetical': {
            style: { 
                align: 'left',
                indent: 144, // 1.5 inches from left
                italic: true,
                width: 168 // 2.5 inches wide
            },
            format: (text) => {
                text = text.trim();
                if (!text.startsWith('(')) text = '(' + text;
                if (!text.endsWith(')')) text += ')';
                return text;
            },
            nextElement: 'dialogue',
            shortcut: '5',
            margin: { top: 0, bottom: 0 }
        }
    };

    // Event Handlers
    function setupEventListeners() {
        // Format buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                if (format) applyFormat(format);
            });
        });

        // Manual format dropdown
        document.getElementById('manualFormatSelect')?.addEventListener('change', (e) => {
            if (e.target.value) {
                applyFormat(e.target.value);
                e.target.value = ''; // Reset select
            }
        });

        // Save functionality
        document.getElementById('saveBtn')?.addEventListener('click', saveDocument);
        
        // Export functionality
        document.getElementById('exportBtn')?.addEventListener('click', exportDocument);
        
        // Template selection
        document.getElementById('templateSelect')?.addEventListener('change', (e) => {
            if (e.target.value) loadTemplate(e.target.value);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                const shortcut = e.key;
                if (SHORTCUTS[shortcut]) {
                    e.preventDefault();
                    e.stopPropagation();
                    applyFormat(SHORTCUTS[shortcut]);
                }
            }
        });

        // Toggle AI suggestions
        const toggleBtn = document.getElementById('toggleSuggestions');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (aiHandler) {
                    aiHandler.toggleSuggestions();
                }
            });
        }
    }

    // Core formatting function
    function applyFormat(formatType) {
        const element = SCRIPT_ELEMENTS[formatType];
        if (!element) return;

        const range = quill.getSelection(true);
        const currentPosition = range ? range.index : quill.getLength();

        // Check if current line already has the same format
        const [currentLine] = quill.getLine(currentPosition);
        const currentFormat = currentLine?.domNode?.getAttribute('data-format');
        
        if (currentFormat === formatType && currentLine.text().trim() === '') {
            return; // Prevent duplicate formatting on empty lines
        }

        // Add proper spacing before element
        if (currentPosition > 0) {
            const [previousLine] = quill.getLine(currentPosition - 1);
            const prevFormat = previousLine.domNode.dataset.format;
            const prevElement = SCRIPT_ELEMENTS[prevFormat];
            
            // Add appropriate spacing based on previous element
            if (prevElement && prevElement.margin && prevElement.margin.bottom > 0) {
                quill.insertText(currentPosition, '\n'.repeat(Math.ceil(prevElement.margin.bottom / 12)));
            }
        }

        // Get and format text
        let text = range ? quill.getText(range.index, range.length) : element.prefix || '';
        text = element.format(text);

        // Apply formatting with proper industry-standard margins
        const format = {
            ...element.style,
            indent: element.style.indent || 0,
            margin: element.margin || { top: 0, bottom: 0 }
        };

        // Insert formatted text
        const insertPosition = quill.getSelection()?.index || quill.getLength();
        quill.insertText(insertPosition, text, format);
        
        // Add proper spacing after element
        if (element.margin && element.margin.bottom > 0) {
            quill.insertText(quill.getSelection()?.index || quill.getLength(), '\n');
        }

        // Move cursor to next line
        quill.setSelection((quill.getSelection()?.index || 0) + text.length + 1);
    }

    // Save functionality
    function saveDocument() {
        try {
            const content = quill.getContents();
            const title = document.getElementById('scriptTitle')?.value || 'Untitled';
            
            localStorage.setItem('scriptContent', JSON.stringify(content));
            localStorage.setItem('scriptTitle', title);
            
            showNotification('Saved successfully!', 'success');
        } catch (error) {
            showNotification('Failed to save document', 'error');
        }
    }

    // Enhanced export functionality
    async function exportDocument() {
        const format = document.getElementById('exportFormat').value;
        const title = document.getElementById('scriptTitle')?.value || 'script';
        const content = quill.root.innerHTML;

        try {
            switch (format) {
                case 'pdf':
                    await exportToPDF(content, title);
                    break;
                case 'fdx':
                    exportToFDX(content, title);
                    break;
                case 'fountain':
                    exportToFountain(content, title);
                    break;
                default:
                    throw new Error('Unsupported format');
            }
            showNotification('Export successful!', 'success');
        } catch (error) {
            showNotification('Export failed: ' + error.message, 'error');
        }
    }

    async function exportToPDF(content, title) {
        const element = document.createElement('div');
        element.innerHTML = content;
        
        const options = {
            margin: [72, 72, 72, 72], // 1-inch margins
            filename: `${title}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' }
        };

        await html2pdf().set(options).from(element).save();
    }

    function exportToFDX(content, title) {
        // Convert to Final Draft XML format
        const fdxContent = convertToFDX(content);
        const blob = new Blob([fdxContent], { type: 'text/xml' });
        saveAs(blob, `${title}.fdx`);
    }

    function exportToFountain(content, title) {
        // Convert to Fountain markup
        const fountainContent = convertToFountain(content);
        const blob = new Blob([fountainContent], { type: 'text/plain' });
        saveAs(blob, `${title}.fountain`);
    }

    function convertToFDX(content) {
        // Basic FDX structure
        return `<?xml version="1.0" encoding="UTF-8"?>
                <FinalDraft DocumentType="Script">
                    ${convertHTMLtoFDX(content)}
                </FinalDraft>`;
    }

    function convertToFountain(content) {
        let fountain = '';
        const dom = new DOMParser().parseFromString(content, 'text/html');
        
        dom.querySelectorAll('p').forEach(p => {
            const format = p.dataset.format;
            const text = p.textContent.trim();
            
            switch (format) {
                case 'scene-heading':
                    fountain += `\n\n${text}\n`;
                    break;
                case 'action':
                    fountain += `\n${text}\n`;
                    break;
                case 'character':
                    fountain += `\n\n${text}\n`;
                    break;
                case 'dialogue':
                    fountain += `${text}\n`;
                    break;
                case 'parenthetical':
                    fountain += `(${text})\n`;
                    break;
            }
        });
        
        return fountain.trim();
    }

    // Template loader
    function loadTemplate(templateType) {
        quill.setText('');
        
        const templates = {
            'film': [
                { type: 'scene-heading', text: 'INT. LOCATION - DAY' },
                { type: 'action', text: 'Description of the scene.' },
            ],
            'television': [
                { type: 'scene-heading', text: 'TEASER' },
                { type: 'action', text: 'FADE IN:' },
            ],
            'theatre': [
                { type: 'scene-heading', text: 'ACT 1' },
                { type: 'action', text: 'SCENE 1' },
            ]
        };

        const template = templates[templateType];
        if (template) {
            template.forEach(item => {
                applyFormat(item.type);
                quill.insertText(quill.getLength() - 1, item.text);
            });
        }
    }

    // Enhanced keyboard shortcut handler
    function handleKeyboardShortcuts(e) {
        // Only handle if Ctrl is pressed without Shift or Alt
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            const key = e.key;
            if (SHORTCUTS[key]) {
                e.preventDefault();
                e.stopPropagation();
                applyScriptFormat(quill, SHORTCUTS[key]);
                return false;
            }
        }
    }

    // Notification system
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    window.showNotification = showNotification;

    // Smart Format Detection
    function detectScriptElement(text) {
        text = text.trim().toUpperCase();
        
        // Scene Heading Detection
        if (text.match(/^(INT\.|EXT\.|INT\/EXT\.)/)) {
            return 'scene-heading';
        }
        
        // Transition Detection
        if (text.endsWith('TO:')) {
            return 'transition';
        }
        
        // Parenthetical Detection
        if (text.startsWith('(') && text.endsWith(')')) {
            return 'parenthetical';
        }
        
        // Character Detection
        if (text === text.toUpperCase() && !text.includes('.') && text.length > 0) {
            return 'character';
        }
        
        // Default to Action
        return 'action';
    }

    // Smart Script Formatting
    function applyScriptFormat(quill, formatType, customText = null) {
        const element = SCRIPT_ELEMENTS[formatType];
        if (!element) return;

        const range = quill.getSelection(true);
        if (!range) return;
        
        // Check for existing format to prevent duplication
        const [line] = quill.getLine(range.index);
        const existingFormat = line?.domNode?.getAttribute('data-format');
        // Fix: Use getText() instead of text()
        const existingText = line ? quill.getText(line.offset(), line.length()) : '';

        // Only apply format if it's different or there's new text
        if (existingFormat === formatType && existingText.trim() === '' && !customText) {
            return;
        }

        const position = range ? range.index : quill.getLength();
        
        // Add newline if not at document start
        if (position > 0) {
            quill.insertText(position, '\n');
            quill.setSelection(position + 1, 0);
        }

        // Get text to format
        let text = customText || (range ? quill.getText(range.index, range.length) : '');
        if (!text) {
            text = getDefaultText(formatType);
        }

        // Apply element's formatting
        text = element.format(text);

        // Insert formatted text
        const insertPosition = quill.getSelection()?.index || quill.getLength();
        quill.insertText(insertPosition, text, element.style);
        quill.insertText(quill.getSelection().index + text.length, '\n');

        // Set focus for next element
        quill.setSelection(quill.getLength());
    }

    function getDefaultText(formatType) {
        const defaults = {
            'scene-heading': 'INT. LOCATION - DAY',
            'action': 'Description of the scene.',
            'character': 'CHARACTER NAME',
            'dialogue': 'Character dialogue goes here.',
            'parenthetical': '(acting instruction)',
            'transition': 'CUT TO:'
        };
        return defaults[formatType] || '';
    }

    // Enhanced Keyboard Navigation
    function setupKeyboardShortcuts(quill) {
        document.addEventListener('keydown', (e) => {
            // Format Shortcuts (Ctrl + 1-6)
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                Object.entries(SCRIPT_ELEMENTS).forEach(([type, element]) => {
                    if (e.key === element.shortcut) {
                        e.preventDefault();
                        applyScriptFormat(quill, type);
                    }
                });
            }

            // Tab Key Logic
            if (e.key === 'Tab') {
                e.preventDefault();
                handleTabNavigation(quill, e.shiftKey);
            }

            // Enter Key Logic
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEnterKey(quill);
            }
        });
    }

    // Smart Tab Navigation
    function handleTabNavigation(quill, isShiftTab) {
        const range = quill.getSelection();
        if (!range) return;

        const [line] = quill.getLine(range.index);
        const text = line.text();
        const currentFormat = detectScriptElement(text);
        const element = SCRIPT_ELEMENTS[currentFormat];

        if (isShiftTab) {
            // Find previous element type
            const formats = Object.keys(SCRIPT_ELEMENTS);
            const currentIndex = formats.indexOf(currentFormat);
            const prevFormat = formats[currentIndex === 0 ? formats.length - 1 : currentIndex - 1];
            applyScriptFormat(quill, prevFormat);
        } else {
            // Go to next element type
            applyScriptFormat(quill, element.nextElement);
        }
    }

    // Smart Enter Key Handling - Modified to fix duplication
    function handleEnterKey(quill) {
        const range = quill.getSelection();
        if (!range) return;

        const [line] = quill.getLine(range.index);
        const text = line.text();
        const currentFormat = detectScriptElement(text);

        // Clear current line if it's empty to prevent duplication
        if (text.trim() === '') {
            quill.deleteText(range.index - 1, 1);
            return;
        }

        // Prevent duplication by checking if next line already exists
        const [nextLine] = quill.getLine(range.index + 1);
        if (nextLine) {
            const nextText = nextLine.text();
            if (nextText.trim() !== '') {
                // If next line has content, just add a new line
                quill.insertText(range.index + 1, '\n');
                return;
            }
        }

        // Modified next format determination
        let nextFormat;
        switch (currentFormat) {
            case 'scene-heading':
                nextFormat = 'action';
                break;
            case 'action':
                // Only go to character if the line has content
                nextFormat = text.trim().length > 3 ? 'character' : 'action';
                break;
            case 'character':
                nextFormat = 'dialogue';
                break;
            case 'dialogue':
                // Check if there's a parenthetical, if not go to character
                nextFormat = 'character';
                break;
            case 'parenthetical':
                nextFormat = 'dialogue';
                break;
            case 'transition':
                nextFormat = 'scene-heading';
                break;
            default:
                nextFormat = 'action';
        }

        // Apply format with empty text to prevent duplication
        applyScriptFormat(quill, nextFormat, '');
    }

    // Initialize Screenplay Features
    function initializeScriptwriter(quill) {
        setupKeyboardShortcuts(quill);
        
        // Add format buttons handlers
        document.querySelectorAll('.format-btn').forEach(btn => {
            const format = btn.dataset.format;
            if (format) {
                btn.addEventListener('click', () => applyScriptFormat(quill, format));
            }
        });

        const characterTracker = new CharacterTracker();
    
        quill.on('text-change', function(delta, oldContents, source) {
            if (source !== 'user') return;

            const text = quill.getText();
            const lines = text.split('\n');
            let lastCharacter = null;

            lines.forEach(line => {
                const format = detectScriptElement(line.trim());
                
                if (format === 'scene-heading') {
                    characterTracker.trackScene(line.trim());
                } else if (format === 'character') {
                    const character = line.trim().toUpperCase();
                    characterTracker.trackCharacter(character);
                    
                    if (lastCharacter && lastCharacter !== character) {
                        characterTracker.trackInteraction(lastCharacter, character);
                        characterTracker.trackInteraction(character, lastCharacter);
                    }
                    lastCharacter = character;
                }
            });

            // Debounced save
            clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => {
                saveDocument();
                updateCharacterGraph();
            }, 2000);
        });
    }

    function updateCharacterGraph() {
        const graphData = characterTracker.generateRelationshipGraph();
        const container = document.getElementById('characterGraph');
        
        if (!container) return;

        // Using vis.js for visualization
        const options = {
            nodes: {
                shape: 'dot',
                scaling: {
                    min: 10,
                    max: 30,
                    label: {
                        min: 8,
                        max: 30,
                        drawThreshold: 12,
                        maxVisible: 20
                    }
                }
            },
            edges: {
                width: 0.15,
                smooth: {
                    type: 'continuous'
                }
            },
            physics: {
                stabilization: false,
                barnesHut: {
                    gravitationalConstant: -80000,
                    springConstant: 0.001,
                    springLength: 200
                }
            }
        };

        const network = new vis.Network(container, graphData, options);

        // Add interaction handlers
        network.on('click', function(params) {
            if (params.nodes.length > 0) {
                const character = params.nodes[0];
                showCharacterReport(character);
            }
        });
    }

    function showCharacterReport(character) {
        const report = characterTracker.getCharacterReport(character);
        if (!report) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content character-report">
                <h2>${report.name}</h2>
                <p>First Appearance: ${report.firstAppearance}</p>
                <p>Total Scenes: ${report.totalScenes}</p>
                <h3>Interactions</h3>
                <ul>
                    ${report.interactions
                        .map(i => `<li>${i.character}: ${i.count} interactions</li>`)
                        .join('')}
                </ul>
                <button class="close-btn">Close</button>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('.close-btn').onclick = () => modal.remove();
    }

    // Prevent browser shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    // Initialize AI suggestions
    aiHandler.initialize(); // Ensure this method exists and sets up AI functionality

    setupMobileNav();
});

// Add CSS for ghost text and tooltip
const style = document.createElement('style');
style.textContent = `
    .ghost-text {
        font-family: 'Courier Prime', monospace;
        font-size: 12pt;
        background: transparent;
        z-index: 1000;
    }
    
    .suggestion-tooltip {
        background: #333;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
    }
`;
document.head.appendChild(style);

// Add Character Relationship Tracker
class CharacterTracker {
    constructor() {
        this.characters = new Map();
        this.relationships = new Map();
        this.scenes = new Map();
        this.currentScene = null;
    }

    trackScene(content) {
        if (content.startsWith('INT.') || content.startsWith('EXT.')) {
            this.currentScene = content;
            if (!this.scenes.has(content)) {
                this.scenes.set(content, new Set());
            }
        }
    }

    trackCharacter(character) {
        if (!this.characters.has(character)) {
            this.characters.set(character, {
                firstAppearance: this.currentScene,
                appearances: new Set([this.currentScene]),
                interactions: new Map()
            });
        } else {
            this.characters.get(character).appearances.add(this.currentScene);
        }

        if (this.currentScene) {
            this.scenes.get(this.currentScene).add(character);
        }
    }

    trackInteraction(character1, character2) {
        if (!this.relationships.has(character1)) {
            this.relationships.set(character1, new Map());
        }
        if (!this.relationships.get(character1).has(character2)) {
            this.relationships.get(character1).set(character2, 0);
        }
        this.relationships.get(character1).set(
            character2,
            this.relationships.get(character1).get(character2) + 1
        );
    }

    getCharacterReport(character) {
        const info = this.characters.get(character);
        if (!info) return null;

        return {
            name: character,
            firstAppearance: info.firstAppearance,
            totalScenes: info.appearances.size,
            scenes: Array.from(info.appearances),
            interactions: Array.from(this.relationships.get(character) || [])
                .map(([other, count]) => ({ character: other, count }))
                .sort((a, b) => b.count - a.count)
        };
    }

    generateRelationshipGraph() {
        const nodes = Array.from(this.characters.keys()).map(name => ({
            id: name,
            label: name,
            value: this.characters.get(name).appearances.size
        }));

        const edges = [];
        this.relationships.forEach((interactions, char1) => {
            interactions.forEach((count, char2) => {
                edges.push({
                    from: char1,
                    to: char2,
                    value: count,
                    title: `${count} interactions`
                });
            });
        });

        return { nodes, edges };
    }
}

// Initialize everything in a single DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Quill with proper configuration
    const quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline'],
                ['clean']
            ],
            keyboard: {
                bindings: {
                    tab: false,
                    'indent-1': false,
                    'indent+1': false
                }
            }
        },
        placeholder: 'Start writing your script...'
    });

    // Initialize AI suggestions
    let aiHandler;
    try {
        aiHandler = new AISuggestionHandler(quill).initialize();
    } catch (error) {
        console.error('Failed to initialize AI suggestions:', error);
        showError('AI suggestions unavailable');
    }

    // Initialize character tracker
    const characterTracker = new CharacterTracker();

    // Setup format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
        const format = btn.dataset.format;
        if (format) {
            btn.addEventListener('click', () => applyFormat(quill, format));
        }
    });

    // Save functionality
    document.getElementById('saveScript')?.addEventListener('click', () => {
        saveDocument(quill);
    });

    // Export functionality
    document.getElementById('exportScript')?.addEventListener('click', () => {
        exportDocument(quill);
    });

    // Setup keyboard shortcuts
    setupKeyboardShortcuts(quill);

    // Track text changes for character relationships
    quill.on('text-change', function(delta, oldContents, source) {
        if (source !== 'user') return;
        
        const text = quill.getText();
        const lines = text.split('\n');
        let lastCharacter = null;

        lines.forEach(line => {
            const format = detectScriptElement(line.trim());
            
            if (format === 'scene-heading') {
                characterTracker.trackScene(line.trim());
            } else if (format === 'character') {
                const character = line.trim().toUpperCase();
                characterTracker.trackCharacter(character);
                
                if (lastCharacter && lastCharacter !== character) {
                    characterTracker.trackInteraction(lastCharacter, character);
                }
                lastCharacter = character;
            }
        });

        // Debounced save
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(() => {
            saveDocument(quill);
        }, 2000);
    });
});

// Helper functions
function showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 3000);
}

function saveDocument(quill) {
    try {
        const content = quill.getContents();
        localStorage.setItem('scriptContent', JSON.stringify(content));
        showSuccess('Script saved successfully!');
    } catch (error) {
        showError('Failed to save script');
    }
}

function showSuccess(message) {
    const success = document.createElement('div');
    success.className = 'success-message';
    success.textContent = message;
    document.body.appendChild(success);
    setTimeout(() => success.remove(), 3000);
}

/* ... rest of existing code ... */

// Global constants
const FORMATS = {
    'scene-heading': { style: { bold: true, header: 1 }, prefix: 'INT./EXT.' },
    'character': { style: { bold: true, align: 'center' }, uppercase: true },
    'dialogue': { style: { align: 'center', indent: 2 } },
    'parenthetical': { style: { align: 'center', indent: 3, italic: true }, brackets: true },
    'action': { style: { align: 'left' } }
};

const SHORTCUTS = {
    '1': 'scene-heading',
    '2': 'action',
    '3': 'character',
    '4': 'dialogue',
    '5': 'parenthetical'
};

// Initialize script editor
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Quill with MutationObserver instead of deprecated DOMNodeInserted
    const quill = initializeQuillEditor();
    const aiHandler = initializeAIHandler(quill);
    setupEventListeners(quill, aiHandler);
});

function initializeQuillEditor() {
    const quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: false,
            keyboard: {
                bindings: {
                    tab: false,
                    'indent-1': false,
                    'indent+1': false
                }
            }
        },
        placeholder: 'Start writing your script...'
    });

    // Setup MutationObserver for dynamic content
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                handleContentChange(mutation.target);
            }
        });
    });

    observer.observe(quill.root, {
        childList: true,
        subtree: true
    });

    return quill;
}

function initializeAIHandler(quill) {
    try {
        return new AISuggestionHandler(quill).initialize();
    } catch (error) {
        console.error('Failed to initialize AI suggestions:', error);
        showError('AI suggestions unavailable');
        return null;
    }
}

function setupEventListeners(quill, aiHandler) {
    // Format buttons
    document.querySelectorAll('.format-btn').forEach(btn => {
        const format = btn.dataset.format;
        if (format) {
            btn.addEventListener('click', () => applyFormat(quill, format));
        }
    });

    // Save and Export buttons
    document.getElementById('saveScript')?.addEventListener('click', () => saveDocument(quill));
    document.getElementById('exportScript')?.addEventListener('click', () => exportDocument(quill));

    // Keyboard shortcuts
    setupKeyboardShortcuts(quill);

    // AI suggestions toggle
    const toggleBtn = document.getElementById('toggleSuggestions');
    if (toggleBtn && aiHandler) {
        toggleBtn.addEventListener('click', () => aiHandler.toggleSuggestions());
    }
}

// Core formatting function
function applyFormat(quill, formatType) {
    const element = FORMATS[formatType];
    if (!element) return;

    const range = quill.getSelection(true);
    const currentPosition = range ? range.index : quill.getLength();
    
    // Get current line and format
    const [currentLine] = quill.getLine(currentPosition);
    const currentFormat = currentLine?.domNode?.getAttribute('data-format');

    // Prevent duplicate formatting
    if (currentFormat === formatType && currentLine.text().trim() === '') {
        return;
    }

    // Format text
    let text = range ? quill.getText(range.index, range.length) : element.prefix || '';
    if (element.uppercase) {
        text = text.toUpperCase();
    }

    // Apply formatting
    quill.format('align', element.style.align);
    if (element.style.bold) quill.format('bold', true);
    if (element.style.italic) quill.format('italic', true);
    if (element.style.header) quill.format('header', element.style.header);
    
    // Insert formatted text
    quill.insertText(currentPosition, text + '\n');
    quill.setSelection(currentPosition + text.length + 1);
}

// Keyboard shortcuts setup
function setupKeyboardShortcuts(quill) {
    document.addEventListener('keydown', (e) => {
        // Format shortcuts (Ctrl + 1-5)
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            const shortcut = SHORTCUTS[e.key];
            if (shortcut) {
                e.preventDefault();
                applyFormat(quill, shortcut);
            }
        }

        // Tab navigation
        if (e.key === 'Tab') {
            e.preventDefault();
            handleTabNavigation(quill, e.shiftKey);
        }

        // Enter key handling
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnterKey(quill);
        }
    });
}

// ... rest of your existing code for AISuggestionHandler and other classes ...

// Save and Export Functions
function saveDocument(quill) {
    try {
        const content = quill.getContents();
        localStorage.setItem('scriptContent', JSON.stringify(content));
        showSuccess('Script saved successfully!');
    } catch (error) {
        showError('Failed to save script');
    }
}

function exportDocument(quill) {
    const format = document.getElementById('exportFormat')?.value || 'txt';
    const title = document.getElementById('scriptTitle')?.value || 'script';
    const content = quill.getText();

    const blob = new Blob([content], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
}

// Utility Functions
function showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 3000);
}

function showSuccess(message) {
    const success = document.createElement('div');
    success.className = 'success-message';
    success.textContent = message;
    document.body.appendChild(success);
    setTimeout(() => success.remove(), 3000);
}

// Content change handler for MutationObserver
function handleContentChange(element) {
    // Add any specific handling for dynamic content changes
    // This replaces the deprecated DOMNodeInserted functionality
}

/* ... rest of your existing code ... */

const SCREENPLAY_FORMATS = {
    'scene-heading': {
        prefix: 'INT./EXT.',
        style: {
            marginTop: '24pt',
            marginBottom: '12pt',
            marginLeft: '0',
            textTransform: 'uppercase',
            fontWeight: 'bold'
        }
    },
    'action': {
        style: {
            marginTop: '12pt',
            marginBottom: '12pt',
            marginLeft: '0',
            textAlign: 'left'
        }
    },
    'character': {
        style: {
            marginTop: '24pt',
            marginBottom: '0',
            marginLeft: '2.2in', // Industry standard
            textTransform: 'uppercase',
            width: '4in'
        }
    },
    'dialogue': {
        style: {
            marginTop: '0',
            marginBottom: '12pt',
            marginLeft: '1in', // Industry standard
            width: '3.5in'
        }
    },
    'parenthetical': {
        style: {
            marginTop: '0',
            marginBottom: '0',
            marginLeft: '1.6in', // Industry standard
            width: '2in',
            fontStyle: 'italic'
        },
        wrapper: '()',
    },
    'transition': {
        style: {
            marginTop: '12pt',
            marginBottom: '12pt',
            marginLeft: '4in', // Industry standard
            textTransform: 'uppercase',
            textAlign: 'right'
        },
        suffix: 'TO:'
    }
};

function applyFormat(quill, formatType) {
    const format = SCREENPLAY_FORMATS[formatType];
    if (!format) return;

    const range = quill.getSelection(true);
    if (!range) return;

    let text = '';
    if (range.length > 0) {
        text = quill.getText(range.index, range.length);
    }

    // Apply format-specific modifications
    if (format.prefix && !text.startsWith(format.prefix)) {
        text = `${format.prefix} ${text}`;
    }
    if (format.suffix && !text.endsWith(format.suffix)) {
        text = `${text} ${format.suffix}`;
    }
    if (format.wrapper) {
        text = `${format.wrapper[0]}${text}${format.wrapper[1]}`;
    }
    if (format.style.textTransform === 'uppercase') {
        text = text.toUpperCase();
    }

    // Delete old text if there was a selection
    if (range.length > 0) {
        quill.deleteText(range.index, range.length);
    }

    // Insert formatted text with proper styling
    quill.insertText(range.index, text, {
        ...format.style,
        'data-format': formatType
    });
    quill.insertText(range.index + text.length, '\n');

    // Move cursor to next line
    quill.setSelection(range.index + text.length + 1, 0);
}

// Update event listeners
document.addEventListener('DOMContentLoaded', () => {
    /* ... existing initialization code ... */

    // Setup format buttons with proper industry standards
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const format = btn.dataset.format;
            if (format) {
                applyFormat(quill, format);
            }
        });
    });

    // Setup keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && !e.shiftKey && !e.altKey) {
            const shortcutKey = e.key;
            const button = document.querySelector(`[data-shortcut="${shortcutKey}"]`);
            if (button) {
                e.preventDefault();
                const format = button.dataset.format;
                applyFormat(quill, format);
            }
        }
    });
});

function setupMobileNav() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}

// Add to your DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    /* ... existing code ... */
    setupMobileNav();
});

// ... existing code ...

function setupSidebarFeatures(quill) {
    // Template handlers
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const template = btn.dataset.template;
            loadTemplate(quill, template);
        });
    });

    // Library item handlers
    document.querySelectorAll('.library-item').forEach(item => {
        item.addEventListener('click', () => {
            loadScript(item.querySelector('span').textContent);
        });
    });

    // Recent scripts handlers
    document.querySelectorAll('.recent-script-item').forEach(item => {
        item.addEventListener('click', () => {
            loadScript(item.querySelector('.script-title').textContent);
        });
    });
}

// Add to your initialization
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...
    setupSidebarFeatures(quill);
});