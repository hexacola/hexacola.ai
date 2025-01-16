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
            prefix: '',
            format: (text) => {
                text = text.toUpperCase();
                if (!text.match(/^(INT\.|EXT\.|INT\/EXT\.)/)) {
                    text = 'INT. ' + text;
                }
                if (!text.includes(' - ')) {
                    text += ' - DAY';
                }
                return text;
            },
            nextElement: 'action',
            shortcut: '1'
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
            shortcut: '2'
        },
        'character': {
            style: { 
                bold: true,
                align: 'center',
                indent: 4 
            },
            format: (text) => text.toUpperCase(),
            nextElement: 'dialogue',
            shortcut: '3'
        },
        'dialogue': {
            style: { 
                align: 'center',
                indent: 2 
            },
            format: (text) => text,
            nextElement: 'character',
            shortcut: '4'
        },
        'parenthetical': {
            style: { 
                align: 'center',
                indent: 3,
                italic: true 
            },
            format: (text) => {
                text = text.trim();
                if (!text.startsWith('(')) text = '(' + text;
                if (!text.endsWith(')')) text += ')';
                return text;
            },
            nextElement: 'dialogue',
            shortcut: '5'
        },
        'transition': {
            style: { 
                bold: true,
                align: 'right',
                indent: 0 
            },
            format: (text) => {
                text = text.toUpperCase();
                if (!text.endsWith('TO:')) text += ' TO:';
                return text;
            },
            nextElement: 'scene-heading',
            shortcut: '6'
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
        const format = FORMATS[formatType];
        if (!format) return;

        const range = quill.getSelection(true);
        const currentPosition = range ? range.index : quill.getLength();

        // Add newline if not at start
        if (currentPosition > 0) {
            quill.insertText(currentPosition, '\n');
            quill.setSelection(currentPosition + 1, 0);
        }

        let text = range ? quill.getText(range.index, range.length) : format.prefix || '';
        
        if (format.uppercase) {
            text = text.toUpperCase();
        }
        if (format.brackets && !text.startsWith('(')) {
            text = `(${text})`;
        }

        // Apply format
        quill.insertText(quill.getSelection()?.index || 0, text, format.style);
        quill.insertText(quill.getSelection()?.index || 0, '\n');
        
        // Auto-focus back to editor
        quill.focus();
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

    // Keyboard shortcuts handler
    function handleKeyboardShortcuts(e) {
        if (e.ctrlKey && SHORTCUTS[e.key]) {
            e.preventDefault();
            applyFormat(SHORTCUTS[e.key]);
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
});
