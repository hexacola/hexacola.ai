document.addEventListener('DOMContentLoaded', () => {
    const editorElement = document.getElementById('editor');
    
    if (editorElement) {
        // Initialize Quill
        const quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'Start writing your script...',
            modules: {
                toolbar: {
                    container: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'align': [] }],
                        ['blockquote', 'code-block'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link', 'image'],
                        ['clean']
                    ]
                }
            }
        });

        // Auto-save functionality
        let typingTimer;
        const doneTypingInterval = 1000; // 1 second

        quill.on('text-change', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(saveContent, doneTypingInterval);
        });

        // Save content to localStorage
        function saveContent() {
            const content = quill.getContents();
            const title = document.getElementById('scriptTitle').value; // Changed from 'document-title' to 'scriptTitle'
            localStorage.setItem('scriptContent', JSON.stringify(content));
            localStorage.setItem('scriptTitle', title);
            showSaveIndicator();
        }

        // Show save indicator
        function showSaveIndicator() {
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            }, 2000);
        }

        // Load saved content
        const savedContent = localStorage.getItem('scriptContent');
        const savedTitle = localStorage.getItem('scriptTitle');
        if (savedContent) {
            quill.setContents(JSON.parse(savedContent));
        }
        if (savedTitle) {
            document.getElementById('scriptTitle').value = savedTitle; // Changed from 'document-title' to 'scriptTitle'
        }

        // Manual save button
        document.getElementById('saveBtn').addEventListener('click', saveContent);

        // Export functionality
        document.getElementById('exportBtn').addEventListener('click', () => {
            const content = quill.root.innerHTML;
            const blob = new Blob([content], { type: 'text/html' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${document.getElementById('scriptTitle').value || 'script'}.html`; // Changed from 'document-title' to 'scriptTitle'
            a.click();
            window.URL.revokeObjectURL(url);
        });

        // Dark mode handling
        function updateEditorTheme() {
            const isDarkMode = document.body.classList.contains('dark-mode');
            document.querySelector('.editor-container').classList.toggle('dark', isDarkMode);
        }

        // Listen for dark mode changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    updateEditorTheme();
                }
            });
        });

        observer.observe(document.body, { attributes: true });
        updateEditorTheme();

        // Formatting Functions
        function formatScriptElement(type) {
            const range = quill.getSelection(true);
            if (!range) {
                // If no selection, create a new line at the end
                quill.setSelection(quill.getLength(), 0);
            }

            const currentPosition = range ? range.index : quill.getLength();
            const selectedText = range ? quill.getText(range.index, range.length) : '';

            // Add a newline before if we're not at the start of the document
            if (currentPosition > 0) {
                quill.insertText(currentPosition, '\n');
                quill.setSelection(currentPosition + 1, 0);
            }

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
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey) {
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
        document.getElementById('templateSelect').addEventListener('change', function() {
            const template = this.value;
            switch(template) {
                case 'film':
                    quill.setText('');  // Clear existing content
                    quill.insertText(0, 'INT. LOCATION - DAY\n\n', {
                        'bold': true,
                        'header': 1
                    });
                    quill.insertText(quill.getLength(), 'Description of the scene.\n\n');
                    break;
                case 'television':
                    quill.setText('');
                    quill.insertText(0, 'EXT. LOCATION - NIGHT\n\n', {
                        'bold': true,
                        'header': 1
                    });
                    quill.insertText(quill.getLength(), 'Action lines.\n\n');
                    break;
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

        backupBtn.addEventListener('click', () => {
            const content = document.getElementById('editor').innerHTML;
            const timestamp = new Date().toLocaleString();
            let backups = JSON.parse(localStorage.getItem('scriptBackups')) || [];
            backups.push({ timestamp, content });
            localStorage.setItem('scriptBackups', JSON.stringify(backups));
            alert('Backup saved!');
        });

        restoreBtn.addEventListener('click', () => {
            versionModal.style.display = 'flex';
            const backups = JSON.parse(localStorage.getItem('scriptBackups')) || [];
            versionList.innerHTML = backups.map((backup, index) => `<li><button onclick="restoreVersion(${index})">${backup.timestamp}</button></li>`).join('');
        });

        closeModal.addEventListener('click', () => {
            versionModal.style.display = 'none';
        });

        window.onclick = function(event) {
            if (event.target == versionModal) {
                versionModal.style.display = 'none';
            }
        }

        function restoreVersion(index) {
            const backups = JSON.parse(localStorage.getItem('scriptBackups')) || [];
            if (backups[index]) {
                document.getElementById('editor').innerHTML = backups[index].content;
                versionModal.style.display = 'none';
                alert('Version restored!');
            }
        }

        // Automatic Backups
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
