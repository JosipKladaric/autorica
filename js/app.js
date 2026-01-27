/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { initAuth, checkLoginStatus } from './auth.js';
import { initDrive } from './drive.js';

// Application State
const state = {
    isAuthenticated: false,
    currentUser: null,
    currentView: 'loading', // loading, login, dashboard, editor
};

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
        await initDrive();

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

    // Clear current content
    app.innerHTML = '';

    if (state.isAuthenticated) {
        renderDashboard(app);
    } else {
        renderLogin(app);
    }
}

/**
 * Render the Login View
 */
function renderLogin(container) {
    const loginView = document.createElement('div');
    loginView.className = 'center-screen fade-in';
    loginView.innerHTML = `
    <div class="card">
        <h1>Autorica</h1>
        <p style="margin: var(--space-md) 0 var(--space-lg);">
            The privacy-first writing platform. <br>
            Your words, your drive, your control.
        </p>
        <div id="g_id_onload"
                data-client_id="YOUR_GOOGLE_CLIENT_ID"
                data-context="signin"
                data-ux_mode="popup"
                data-callback="handleCredentialResponse"
                data-auto_prompt="false">
        </div>
        <div class="g_id_signin"
                data-type="standard"
                data-shape="pill"
                data-theme="filled_black"
                data-text="signin_with"
                data-size="large"
                data-logo_alignment="left">
        </div>
        
        <!-- Login Button -->
        <button id="login-btn" class="btn btn-primary" style="margin-top: var(--space-lg); width: 100%;">
            Sign in with Google
        </button>
    </div>
    <p style="margin-top: var(--space-lg); font-size: 0.8rem; opacity: 0.6;">
        Data stored directly in your Google Drive. No 3rd party servers.
    </p>
`;

    container.appendChild(loginView);

    // Bind login button
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            import('./auth.js').then(auth => auth.requestLogin());
        });
    }
}

async function renderDashboard(container) {
    container.innerHTML = `
    <div class="center-screen fade-in">
        <h1>Dashboard</h1>
        <p>Loading your books...</p>
        <div class="spinner" style="margin-top: var(--space-md)"></div>
    </div>
`;

    try {
        const { listBooks, readFile } = await import('./drive.js');
        const files = await listBooks();

        if (files.length === 0) {
            container.innerHTML = `
            <div class="center-screen fade-in">
                <h1>No books found</h1>
                <p>It looks like you haven't created any books yet.</p>
                <button class="btn btn-primary create-book-btn" style="margin-top: var(--space-lg)">
                    Create First Book
                </button>
                <button id="logout-btn" class="btn btn-secondary" style="margin-top: var(--space-md)">
                    Sign Out
                </button>
            </div>
        `;
        } else {
            // Fetch real titles in parallel
            const booksWithMetadata = await Promise.all(files.map(async (file) => {
                try {
                    const content = await readFile(file.id);
                    const metadata = typeof content === 'string' ? JSON.parse(content) : content;
                    return { id: file.id, name: metadata.title || file.name };
                } catch (e) {
                    console.error("Failed to load book metadata", e);
                    return { id: file.id, name: file.name };
                }
            }));

            container.innerHTML = `
            <div class="center-screen fade-in">
                <h1>Your Library</h1>
                <p>Found ${booksWithMetadata.length} book(s)</p>
                    <ul style="margin-top: var(--space-lg); list-style: none; width: 100%; max-width: 480px;">
                    ${booksWithMetadata.map(book => `
                        <li class="book-item" data-id="${book.id}" style="background: var(--bg-card); padding: 1rem; margin-bottom: 0.5rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); cursor: pointer; transition: border-color 0.2s;">
                            <strong>${book.name}</strong>
                        </li>
                    `).join('')}
                </ul>
                    <button id="logout-btn" class="btn btn-secondary" style="margin-top: var(--space-md)">
                    Sign Out
                </button>
            </div>
        `;
        }

        // Bind Book Click
        document.querySelectorAll('.book-item').forEach(item => {
            item.addEventListener('click', () => {
                const bookId = item.dataset.id;
                import('./editor.js').then(editor => editor.loadEditor(bookId, container));
            });
        });

        // Bind logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            import('./auth.js').then(auth => auth.logout());
        });

        // Bind Create Book buttons
        const createBtns = document.querySelectorAll('.create-book-btn');
        createBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const title = prompt("Enter book title:");
                if (title) {
                    // Show loading state
                    btn.textContent = 'Creating...';
                    btn.disabled = true;

                    try {
                        const { createBook } = await import('./drive.js');
                        await createBook(title);
                        // Refresh dashboard
                        renderDashboard(container);
                    } catch (err) {
                        alert('Failed to create book. Check console.');
                        btn.textContent = 'Create Book';
                        btn.disabled = false;
                    }
                }
            });
        });

    } catch (err) {
        console.error("Dashboard error:", err);
        container.innerHTML = `
        <div class="center-screen fade-in">
            <h1 style="color: #ef4444">Error</h1>
            <p>Failed to load books. See console for details.</p>
                <button id="logout-btn" class="btn btn-secondary" style="margin-top: var(--space-md)">
                    Sign Out
            </button>
        </div>
    `;
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            import('./auth.js').then(auth => auth.logout());
        });
    }
}

// Start the app
window.addEventListener('DOMContentLoaded', init);
