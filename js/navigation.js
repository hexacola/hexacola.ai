// Helper to determine if we're in a subdirectory
const isInSubdirectory = () => window.location.pathname.includes('/pages/');

// Helper to determine current directory
const getBasePath = () => window.location.pathname.includes('/pages/') ? '../' : './';

// Navigation functions with absolute paths from root
function navigateToHome() {
    // Use same logic as logo link for consistency
    window.location.href = window.location.pathname.includes('/pages/') ? '../index.html' : './index.html';
}

function navigateToPage(page) {
    if (window.location.pathname.includes('/pages/')) {
        window.location.href = `./${page}.html`;
    } else {
        window.location.href = `./pages/${page}.html`;
    }
}

// Specific page navigation functions
function showGenerator() {
    navigateToPage('generator');
}

function navigateToStoryboard() {
    navigateToPage('storyboard');
}

function navigateToScriptwriter() {
    navigateToPage('scriptwriter');
}

function navigateToChat() {
    navigateToPage('chat');
}

// Update active navigation state
function updateActiveNavigation() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.main-nav button').forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('onclick')?.includes(currentPage)) {
            button.classList.add('active');
        }
    });
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    updateActiveNavigation();
});

// Export navigation functions to global scope
window.navigateToHome = navigateToHome;
window.showGenerator = showGenerator;
window.navigateToStoryboard = navigateToStoryboard;
window.navigateToScriptwriter = navigateToScriptwriter;
window.navigateToChat = navigateToChat;

// Dark mode toggle function
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};

// Initialize dark mode from localStorage
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
});

// Login Modal Functions
function toggleLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'block';
    }
}

function switchTab(tab) {
    // Remove active class from all tabs and forms
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    // Add active class to selected tab and form
    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}Form`).classList.add('active');
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('loginModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Handle form submissions
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            // Handle login logic here
            console.log('Login:', { email, password });
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            // Handle registration logic here
            console.log('Register:', { name, email, password });
        });
    }

    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('loginModal');
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    // Sidebar toggle functionality
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        });

        overlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // Handle mobile navigation responsively
    function adjustForMobile() {
        const header = document.querySelector('.main-header');
        const mainWrapper = document.querySelector('.main-wrapper');
        if (header && mainWrapper) {
            const headerHeight = header.offsetHeight;
            mainWrapper.style.marginTop = `${headerHeight}px`;
        }
    }

    // Call on load and resize
    adjustForMobile();
    window.addEventListener('resize', adjustForMobile);
});
