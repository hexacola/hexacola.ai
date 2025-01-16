document.addEventListener('DOMContentLoaded', () => {
    // This event listener makes sure that the code runs only after the entire HTML page is loaded.
    
    // Find the HTML element where the rich text editor will be placed
    const editorElement = document.getElementById('editor');
    
    // Checks if an element with the id "editor" exists.
    if (editorElement) {
        // Initialize Quill
        // Quill is a library that provides rich text editing capabilities
        const quill = new Quill('#editor', {
            // Sets the visual theme of the editor.
            theme: 'snow',
            // Sets the text that appears when the editor is empty.
            placeholder: 'Start writing your script...',
            // `modules` configures the functionality that Quill will have.
            modules: {
                // Configures the toolbar, the set of buttons for editing text
                toolbar: {
                    // container: the list of buttons
                    container: [
                        // Header sizes
                        [{ 'header': [1, 2, 3, false] }],
                         // Basic text styling (bold, italic, underline, strike)
                        ['bold', 'italic', 'underline', 'strike'],
                        // Text color and background
                        [{ 'color': [] }, { 'background': [] }],
                        // Text alignment
                        [{ 'align': [] }],
                         // Block formatting (blockquote, code block)
                        ['blockquote', 'code-block'],
                        // List styles (ordered and bulleted)
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        // Adding links and images
                        ['link', 'image'],
                        // Removes all formatting
                        ['clean']
                    ]
                }
            }
        });

        // Auto-save functionality
        // This variable holds the timeout for auto-saving.
        let typingTimer;
        // Sets the delay for autosave
        const doneTypingInterval = 1000; // 1 second

        // Listen for changes in the editor text.
        quill.on('text-change', () => {
            // Clear the previous timeout so we only save after the interval
            clearTimeout(typingTimer);
            // Start a new timeout to save content after delay
            typingTimer = setTimeout(saveContent, doneTypingInterval);
        });

        // Save content to localStorage
         // This function retrieves the text and title from the editor and stores them in the local storage
        function saveContent() {
            // Gets the content of the editor
            const content = quill.getContents();
            // gets the value of the document title input
            const title = document.getElementById('scriptTitle').value; // Changed from 'document-title' to 'scriptTitle'
            // Stores content in local storage as a JSON
            localStorage.setItem('scriptContent', JSON.stringify(content));
            // Stores the title
            localStorage.setItem('scriptTitle', title);
            // Show save confirmation
            showSaveIndicator();
        }

        // Show save indicator
        // Provides a visual message to show that changes have been saved
        function showSaveIndicator() {
             // Gets the save button
            const saveBtn = document.getElementById('saveBtn');
             // Changes the content of the button to show "saved"
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
            // After two seconds, revert to original button
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            }, 2000);
        }

        // Load saved content
        // Load saved text from localStorage
        const savedContent = localStorage.getItem('scriptContent');
        // Load saved document title from localStorage
        const savedTitle = localStorage.getItem('scriptTitle');
        // If we have saved data, use it to set text
        if (savedContent) {
            quill.setContents(JSON.parse(savedContent));
        }
         // If we have a saved title, display it
        if (savedTitle) {
            document.getElementById('scriptTitle').value = savedTitle; // Changed from 'document-title' to 'scriptTitle'
        }

        // Manual save button
        // Adds an event listener for the manual save button
        document.getElementById('saveBtn').addEventListener('click', saveContent);

        // Export functionality
         // Adds an event listener to the export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            // Get the HTML content of the editor
            const content = quill.root.innerHTML;
            // Create a Blob object (binary large object) from the content
            const blob = new Blob([content], { type: 'text/html' });
            // Create a URL for the blob object
            const url = window.URL.createObjectURL(blob);
            // Creates a link element
            const a = document.createElement('a');
            // Set the download path
            a.href = url;
            // Set the download name using the title from the input, with a fallback if none
            a.download = `${document.getElementById('scriptTitle').value || 'script'}.html`; // Changed from 'document-title' to 'scriptTitle'
             // Add to DOM
            a.click();
             // Revoke url for memory management
            window.URL.revokeObjectURL(url);
        });

        // Dark mode handling
         // Function to toggle the theme based on whether dark mode is active
        function updateEditorTheme() {
            // Check if the body has a dark-mode class
            const isDarkMode = document.body.classList.contains('dark-mode');
            // Add or remove the dark class to the editor container
            document.querySelector('.editor-container').classList.toggle('dark', isDarkMode);
        }
        
         // Set up a MutationObserver to watch for changes in the body's class
        const observer = new MutationObserver((mutations) => {
            // Check all mutations
            mutations.forEach((mutation) => {
                // If the attribute that changed is a class, update the theme
                if (mutation.attributeName === 'class') {
                    updateEditorTheme();
                }
            });
        });
        // Start observing the body element for the class change
        observer.observe(document.body, { attributes: true });
        // Initial setting of the theme
        updateEditorTheme();

       // Formatting Functions
         // Formats a selected text based on a specific type (scene-heading, action, character, dialogue, parenthetical)
        function formatScriptElement(type) {
             // Get the current selection within Quill
            const range = quill.getSelection(true);
            // If no selection, create a new line at the end
            if (!range) {
                quill.setSelection(quill.getLength(), 0);
            }
             // Get the current position of the text
            const currentPosition = range ? range.index : quill.getLength();
            // Get selected text, or empty string
            const selectedText = range ? quill.getText(range.index, range.length) : '';
            
            // Add a newline before if we're not at the start of the document
            if (currentPosition > 0) {
                quill.insertText(currentPosition, '\n');
                quill.setSelection(currentPosition + 1, 0);
            }
             // switch to add different formatting based on the passed `type`
            switch(type) {
                case 'scene-heading':
                    // Scene headings: Bold, uppercase, left-aligned with proper spacing
                    const sceneText = selectedText ? selectedText.toUpperCase() : 'INT. LOCATION - DAY';
                    quill.insertText(quill.getSelection().index, sceneText, {
                        'bold': true,
                        'header': 1,
                        'align': 'left'
                    });
                    quill.insertText(quill.getSelection().index + sceneText.length, '\n\n');
                    break;

                case 'action':
                    // Action: Regular text, left-aligned with proper spacing
                    quill.format('bold', false);
                    quill.format('header', false);
                    quill.format('align', 'left');
                    quill.format('indent', 0);
                    if (!selectedText) {
                        quill.insertText(quill.getSelection().index, 'Action description goes here.');
                    }
                    quill.insertText(quill.getSelection().index + (selectedText ? selectedText.length : 0), '\n\n');
                    break;

                case 'character':
                    // Character: Uppercase, center-aligned, proper margins
                    const charText = selectedText ? selectedText.toUpperCase() : 'CHARACTER NAME';
                    quill.insertText(quill.getSelection().index, charText, {
                        'bold': true,
                        'align': 'center',
                        'indent': 4
                    });
                    quill.insertText(quill.getSelection().index + charText.length, '\n');
                    break;

                case 'dialogue':
                    // Dialogue: Center-aligned with proper margins
                    quill.format('bold', false);
                    quill.format('align', 'center');
                    quill.format('indent', 2);
                    if (!selectedText) {
                        quill.insertText(quill.getSelection().index, 'Dialogue goes here.');
                    }
                    quill.insertText(quill.getSelection().index + (selectedText ? selectedText.length : 0), '\n\n');
                    break;

                case 'parenthetical':
                    // Parenthetical: Italicized, center-aligned, wrapped in parentheses
                    let parentheticalText = selectedText || 'action description';
                    if (!parentheticalText.startsWith('(')) parentheticalText = '(' + parentheticalText;
                    if (!parentheticalText.endsWith(')')) parentheticalText += ')';
                    
                    quill.insertText(quill.getSelection().index, parentheticalText, {
                        'italic': true,
                        'align': 'center',
                        'indent': 3
                    });
                    quill.insertText(quill.getSelection().index + parentheticalText.length, '\n');
                    break;
            }
        }

        // Keyboard Shortcuts
        // Listens for keyboard events to allow formatting with ctrl + num
        document.addEventListener('keydown', function(e) {
            // If control is pressed
            if (e.ctrlKey) {
                // Switch over the key pressed
                switch(e.key) {
                    case '1':
                        e.preventDefault();
                        formatScriptElement('scene-heading');
                        break;
                    case '2':
                        e.preventDefault();
                        formatScriptElement('action');
                        break;
                    case '3':
                        e.preventDefault();
                        formatScriptElement('character');
                        break;
                    case '4':
                        e.preventDefault();
                        formatScriptElement('dialogue');
                        break;
                    case '5':
                        e.preventDefault();
                        formatScriptElement('parenthetical');
                        break;
                }
            }
        });

        // Update the click handlers for formatting buttons
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                formatScriptElement(btn.getAttribute('data-format'));
            });
        });

       // Update manual format select handler
        document.getElementById('manualFormatSelect').addEventListener('change', function() {
            if (this.value) {
                formatScriptElement(this.value);
                this.value = '';
            }
        });

        // Script Templates
        // Adds an event listener for the template select
        document.getElementById('templateSelect').addEventListener('change', function() {
           // Get the template from the select element
            const template = this.value;
            // Switch over different template values
            switch(template) {
                 // Loads film template
                case 'film':
                    quill.setText('');  // Clear existing content
                    quill.insertText(0, 'INT. LOCATION - DAY\n\n', {
                        'bold': true,
                        'header': 1
                    });
                    quill.insertText(quill.getLength(), 'Description of the scene.\n\n');
                    break;
                // Loads television template
                case 'television':
                    quill.setText('');
                    quill.insertText(0, 'EXT. LOCATION - NIGHT\n\n', {
                        'bold': true,
                        'header': 1
                    });
                    quill.insertText(quill.getLength(), 'Action lines.\n\n');
                    break;
                // Loads theatre template
                case 'theatre':
                    quill.setText('');
                    quill.insertText(0, 'CHARACTER NAME\n\n', {
                        'bold': true,
                        'header': 2
                    });
                    quill.insertText(quill.getLength(), 'Dialogue goes here.\n\n');
                    break;
            }
            this.value = '';
        });

        // Data Backup and Recovery
        const backupBtn = document.getElementById('backupBtn');
        const restoreBtn = document.getElementById('restoreBtn');
        const versionModal = document.getElementById('versionModal');
        const closeModal = document.querySelector('.close-button');
        const versionList = document.getElementById('versionList');

        // Add event listener to save the current HTML of the editor to local storage
        backupBtn.addEventListener('click', () => {
            const content = document.getElementById('editor').innerHTML;
            const timestamp = new Date().toLocaleString();
            let backups = JSON.parse(localStorage.getItem('scriptBackups')) || [];
            backups.push({ timestamp, content });
            localStorage.setItem('scriptBackups', JSON.stringify(backups));
            alert('Backup saved!');
        });
        // Add event listener to the restore button to show the backup modal
        restoreBtn.addEventListener('click', () => {
            versionModal.style.display = 'flex';
            const backups = JSON.parse(localStorage.getItem('scriptBackups')) || [];
            versionList.innerHTML = backups.map((backup, index) => `<li><button onclick="restoreVersion(${index})">${backup.timestamp}</button></li>`).join('');
        });
        // Adds click handler for closing the backup modal
        closeModal.addEventListener('click', () => {
            versionModal.style.display = 'none';
        });
         // Adds a close handler when clicking outside the modal
        window.onclick = function(event) {
            if (event.target == versionModal) {
                versionModal.style.display = 'none';
            }
        }

        // Restores a specific backup from local storage
        function restoreVersion(index) {
            const backups = JSON.parse(localStorage.getItem('scriptBackups')) || [];
            if (backups[index]) {
                document.getElementById('editor').innerHTML = backups[index].content;
                versionModal.style.display = 'none';
                alert('Version restored!');
            }
        }
        
        // Automatic Backups
        // Makes an automatic backup every 5 minutes
        setInterval(() => {
            const content = document.getElementById('editor').innerHTML;
            const timestamp = new Date().toLocaleString();
            let backups = JSON.parse(localStorage.getItem('scriptBackups')) || [];
            backups.push({ timestamp, content });
            if (backups.length > 20) backups.shift(); // Keep last 20 backups
            localStorage.setItem('scriptBackups', JSON.stringify(backups));
        }, 300000); // Every 5 minutes

        // Accessible Event Listeners for Action Buttons
          document.getElementById('backupBtn').addEventListener('click', backupDocument);
        document.getElementById('restoreBtn').addEventListener('click', restoreDocument);

        function backupDocument() {
            // Backup functionality
        }

        function restoreDocument() {
            // Restore functionality
        }

        // Ensure buttons are focusable and operable via keyboard
        document.querySelectorAll('.action-btn, .format-btn').forEach(button => {
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                }
            });
        });
    } else {
        console.error("Editor element not found. Please ensure the element with id 'editor' exists.");
    }
});
