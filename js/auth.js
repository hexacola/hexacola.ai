// User management
const users = JSON.parse(localStorage.getItem('users')) || [];

// Check if user is logged in
function isLoggedIn() {
    return localStorage.getItem('currentUser') !== null;
}

// Handle login
function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        const { password, ...userWithoutPassword } = user;
        localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        window.location.href = '../index.html';
    } else {
        alert('Invalid email or password');
    }
}

// Handle registration
function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return false;
    }

    if (users.some(user => user.email === email)) {
        alert('Email already registered');
        return false;
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        password,
        created: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    const { password: pwd, ...userWithoutPassword } = newUser;
    localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));

    window.location.href = '../index.html';
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
}

// Check login status on page load
document.addEventListener('DOMContentLoaded', () => {
    const currentPath = window.location.pathname;
    
    // Don't redirect on login/register pages
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
        if (isLoggedIn()) {
            window.location.href = '../index.html';
        }
        return;
    }

    // Redirect to login if not logged in
    if (!isLoggedIn() && !currentPath.includes('index.html')) {
        window.location.href = 'login.html';
    }
});
