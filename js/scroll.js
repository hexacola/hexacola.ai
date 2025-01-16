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
        placeholder: 'Start writing your script...'
    });

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
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }

    // Core formatting function
    function applyFormat(formatType) {
        const element = SCRIPT_ELEMENTS[formatType];
        if (!element) return;

        const range = quill.getSelection(true);
        const currentPosition = range ? range.index : quill.getLength();

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
        // Prevent default browser shortcuts when using our format shortcuts
        if (e.ctrlKey && SHORTCUTS[e.key]) {
            e.preventDefault();
            e.stopPropagation();
            applyFormat(SHORTCUTS[e.key]);
            return false;
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

    // Smart Enter Key Handling
    function handleEnterKey(quill) {
        const range = quill.getSelection();
        if (!range) return;

        const [line] = quill.getLine(range.index);
        const text = line.text();
        const currentFormat = detectScriptElement(text);

        // Determine next element based on context
        let nextFormat;
        switch (currentFormat) {
            case 'scene-heading':
                nextFormat = 'action';
                break;
            case 'action':
                nextFormat = text.length < 3 ? 'scene-heading' : 'character';
                break;
            case 'character':
                nextFormat = 'dialogue';
                break;
            case 'dialogue':
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

        applyScriptFormat(quill, nextFormat);
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
    }

    // Initialize
    setupEventListeners();
    initializeScriptwriter(quill);

    // Prevent browser shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true);

    // Initialize the AI suggestions with Quill
    try {
        const aiSuggestions = new AISuggestionHandler(quill);

        // Load saved settings
        aiSuggestions.loadSettings();

    } catch (error) {
        console.error('Error initializing scriptwriter:', error);
        showNotification('Failed to initialize editor', 'error');
    }

    // Consolidate scroll-related setup here
    const targetNode = document.getElementById('some-scrollable-element');
    const observer = new MutationObserver(mutations => {
        // ...existing code handling changed DOM...
    });

    // Original DOMNodeInserted removed, now observer is used
    observer.observe(targetNode, { childList: true, subtree: true });
});

// Updated AI Suggestion Handler with fixed format handling
class AISuggestionHandler {
    constructor(quill) {
        if (!quill) throw new Error('Quill editor instance is required');

        this.quill = quill;
        this.enabled = true;
        this.currentSuggestion = null;
        this.suggestionTimeout = null;

        // Map format types to their proper script elements
        this.formatMap = {
            'scene-heading': 'scene-heading',
            'action': 'action',
            'character': 'character',
            'dialogue': 'dialogue',
            'parenthetical': 'parenthetical'
        };

        this.settings = {
            frequency: 'medium',
            detail: 'sentence',
            enabledTypes: new Set(Object.keys(this.formatMap))
        };

        // Initialize UI and handlers
        this.initializeUI();
        this.setupHandlers();
    }

    initializeUI() {
        // Set initial state of toggle button and panel
        const toggleBtn = document.getElementById('toggleSuggestions');
        const panel = document.querySelector('.settings-panel');
        
        if (toggleBtn && panel) {
            toggleBtn.classList.toggle('active', this.enabled);
            panel.classList.toggle('hidden', true);
            
            // Initialize checkboxes with correct states
            Object.keys(this.formatMap).forEach(format => {
                const checkbox = document.querySelector(`input[value="${format}"]`);
                if (checkbox) {
                    checkbox.checked = this.settings.enabledTypes.has(format);
                }
            });
        }
    }

    setupHandlers() {
        // Toggle button handler
        const toggleBtn = document.getElementById('toggleSuggestions');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panel = document.querySelector('.settings-panel');
                if (panel) {
                    panel.classList.toggle('hidden');
                    toggleBtn.classList.toggle('active');
                }
            });
        }

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.querySelector('.settings-panel');
            const toggleBtn = document.getElementById('toggleSuggestions');
            if (panel && toggleBtn && !panel.contains(e.target) && !toggleBtn.contains(e.target)) {
                panel.classList.add('hidden');
                toggleBtn.classList.remove('active');
            }
        });

        // Setup format type checkboxes
        Object.keys(this.formatMap).forEach(format => {
            const checkbox = document.querySelector(`input[value="${format}"]`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.settings.enabledTypes.add(format);
                    } else {
                        this.settings.enabledTypes.delete(format);
                    }
                    this.saveSettings();
                });
            }
        });

        // Handle text changes with debounce
        this.quill.on('text-change', this.debounce((delta, oldContents, source) => {
            if (source === 'user' && this.enabled) {
                this.handleTextChange();
            }
        }, 500));

        // Handle Tab key for accepting suggestions
        this.quill.keyboard.addBinding(
            { key: 'Tab' },
            (range, context) => {
                if (this.currentSuggestion) {
                    this.acceptSuggestion();
                    return false;
                }
                return true;
            }
        );
    }

    async handleTextChange() {
        if (!this.enabled) return;
        this.removeSuggestion();

        const range = this.quill.getSelection();
        if (!range) return;

        try {
            const [line] = this.quill.getLine(range.index);
            if (!line || !line.domNode) return;

            const format = line.domNode.getAttribute('data-format');
            if (!format || !this.settings.enabledTypes.has(format)) return;

            const text = line.domNode.textContent || '';
            if (!text.trim()) return;

            this.showLoadingIndicator();

            const suggestion = await this.generateSuggestion(text, format);
            if (suggestion) {
                this.displaySuggestion(suggestion, range.index + range.length);
            }
        } catch (error) {
            console.error('Error generating suggestion:', error);
        } finally {
            this.hideLoadingIndicator();
        }
    }

    displaySuggestion(suggestion, index) {
        if (!suggestion || typeof index !== 'number') return;

        this.removeSuggestion();
        
        try {
            this.currentSuggestion = {
                text: suggestion,
                index: index,
                length: suggestion.length
            };

            this.quill.insertText(
                index,
                suggestion,
                {
                    'color': '#666666',
                    'suggestion': true,
                    'background': 'rgba(107, 142, 35, 0.1)'
                },
                'api'
            );

            // Add visual indicator
            const [line] = this.quill.getLine(index);
            if (line?.domNode) {
                line.domNode.classList.add('has-suggestion');
            }
        } catch (error) {
            console.error('Error displaying suggestion:', error);
        }
    }

    acceptSuggestion() {
        if (!this.currentSuggestion) return false;

        try {
            // Remove suggestion formatting but keep text
            this.quill.formatText(
                this.currentSuggestion.index,
                this.currentSuggestion.length,
                {
                    'color': null,
                    'suggestion': false,
                    'background': null
                },
                'api'
            );

            // Remove visual indicator
            const [line] = this.quill.getLine(this.currentSuggestion.index);
            if (line?.domNode) {
                line.domNode.classList.remove('has-suggestion');
            }

            // Move cursor to end of accepted suggestion
            this.quill.setSelection(
                this.currentSuggestion.index + this.currentSuggestion.length,
                0
            );

            this.currentSuggestion = null;
            return true;
        } catch (error) {
            console.error('Error accepting suggestion:', error);
            return false;
        }
    }

    debounce(fn, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }
}

// Updated scroll.js with MutationObserver
document.addEventListener('DOMContentLoaded', () => {
    // Use MutationObserver instead of deprecated DOMNodeInserted
    const scrollObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            const scrollables = mutation.target.querySelectorAll('.scrollable:not([data-scroll-initialized])');
            scrollables.forEach(initializeScrollable);
        });
    });

    function initializeScrollable(element) {
        if (!element || element.hasAttribute('data-scroll-initialized')) return;
        
        element.setAttribute('data-scroll-initialized', 'true');

        // Touch handling
        let startY, startScrollTop;
        let isDragging = false;

        const handlers = {
            start: (e) => {
                isDragging = true;
                startY = e.type === 'mousedown' ? e.pageY : e.touches[0].pageY;
                startScrollTop = element.scrollTop;
                element.classList.add('scrolling');
            },
            move: (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const y = e.type === 'mousemove' ? e.pageY : e.touches[0].pageY;
                const walk = (y - startY) * 2;
                element.scrollTop = startScrollTop - walk;
            },
            end: () => {
                isDragging = false;
                element.classList.remove('scrolling');
            }
        };

        // Mouse events
        element.addEventListener('mousedown', handlers.start);
        window.addEventListener('mousemove', handlers.move);
        window.addEventListener('mouseup', handlers.end);

        // Touch events
        element.addEventListener('touchstart', handlers.start);
        element.addEventListener('touchmove', handlers.move);
        element.addEventListener('touchend', handlers.end);

        // Store cleanup function
        element.cleanup = () => {
            element.removeEventListener('mousedown', handlers.start);
            window.removeEventListener('mousemove', handlers.move);
            window.removeEventListener('mouseup', handlers.end);
            element.removeEventListener('touchstart', handlers.start);
            element.removeEventListener('touchmove', handlers.move);
            element.removeEventListener('touchend', handlers.end);
        };
    }

    // Initialize existing elements
    document.querySelectorAll('.scrollable:not([data-scroll-initialized])').forEach(initializeScrollable);

    // Watch for new elements
    scrollObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
    });

    // Cleanup on page unload
    window.addEventListener('unload', () => {
        document.querySelectorAll('.scrollable[data-scroll-initialized]').forEach(el => {
            if (typeof el.cleanup === 'function') el.cleanup();
        });
        scrollObserver.disconnect();
    });
});
