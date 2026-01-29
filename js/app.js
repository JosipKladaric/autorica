/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { initAuth, checkLoginStatus } from './auth.js';
import { loadEditor, cleanup as cleanupEditor } from './editor.js';
import { writingStreaks } from './utils/writingStreaks.js';
import { listBooks, readFile, createBook, initDrive } from './drive.js'; // Ensure drive functions are imported

// Application State
const state = {
    isAuthenticated: false,
    currentUser: null,
    currentView: 'loading', // loading, login, dashboard, editor
};

// Cleanup functions for current view
let cleanupFunctions = [];

// Writing streaks instance (Imported singleton)
// const writingStreaks = new WritingStreaks();

/**
 * Initialize the application
 */
/**
 * Initialize the application
 */
async function init() {
    console.log('Autorica initializing...');

    try {
        // Listen for auth events BEFORE init
        window.addEventListener('autorica:auth-success', () => {
            updateState({ isAuthenticated: true });
        });

        window.addEventListener('autorica:logout', () => {
            updateState({ isAuthenticated: false });
        });

        window.addEventListener('autorica:view-dashboard', () => {
            render();
        });

        await initAuth();
        await initDrive(); // Initialize Drive API

        // Check initial login status
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.remove('visible');
            loadingScreen.classList.add('hidden');
        }

        // Render initial view
        render();

    } catch (error) {
        console.error('Initialization failed:', error);
        document.querySelector('#loading-screen p').textContent = 'Error initializing application. Please refresh.';
        document.querySelector('#loading-screen p').style.color = '#ef4444';
    }
}

/**
 * Update application state and re-render
 */
function updateState(newState) {
    Object.assign(state, newState);
    render();
}

/**
 * Main render function - switches views based on state
 */
function render() {
    const app = document.getElementById('app');

    // Cleanup previous view to prevent memory leaks
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions = [];
    cleanupEditor(); // Cleanup editor widgets (stats, listeners)

    // Clear current content
    app.innerHTML = '';

    if (state.isAuthenticated) {
        // Set warm background for dashboard
        document.body.style.backgroundColor = '#9d9182';
        document.body.style.backgroundImage = 'none';
        renderDashboard(app);
    } else {
        // Set neutral background for login
        document.body.style.backgroundColor = '#f3f4f6';
        document.body.style.backgroundImage = 'none';
        renderLogin(app);
    }
}

/**
 * Render the Login View
 */
// Import Login Component
import { Login } from './components/Login.js';

function renderLogin(container) {
    new Login(container, () => {
        import('./auth.js').then(auth => auth.requestLogin());
    });
}

// Import Dashboard Component
import { Dashboard } from './components/Dashboard.js';

async function renderDashboard(container) {
    // Show loading state briefly or handle it inside Dashboard
    container.innerHTML = '';

    // Create new Dashboard instance
    new Dashboard(
        container,
        // Handler: onBookSelect
        (bookId) => {
            loadEditor(bookId, container);
        },
        // Handler: onCreateBook
        async () => {
            const title = prompt('Enter book title:');
            if (title) {
                try {
                    await createBook(title);
                    renderDashboard(container); // Refresh
                } catch (err) {
                    alert('Failed to create book: ' + err.message);
                }
            }
        },
        // Handler: onLogout
        () => {
            import('./auth.js').then(auth => auth.logout());
        }
    );
}

// Start the app
window.addEventListener('DOMContentLoaded', init);
