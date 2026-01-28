/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { initAuth, checkLoginStatus } from './auth.js';
import { loadEditor } from './editor.js';
import { WritingStreaks } from './utils/writingStreaks.js';
import { listBooks, readFile, createBook } from './drive.js'; // Ensure drive functions are imported

// Application State
const state = {
    isAuthenticated: false,
    currentUser: null,
    currentView: 'loading', // loading, login, dashboard, editor
};

// Cleanup functions for current view
let cleanupFunctions = [];

// Writing streaks instance
const writingStreaks = new WritingStreaks();

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
        // initDrive is no longer needed here as drive functions are imported directly
        // await initDrive(); // Removed as per new dashboard logic

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
        const files = await listBooks();
        const booksWithMetadata = await Promise.all(files.map(async (file) => {
            try {
                const content = await readFile(file.id);
                const metadata = typeof content === 'string' ? JSON.parse(content) : content;
                return {
                    folderId: file.id,
                    title: metadata.title || file.name,
                    chapters: metadata.chapters || [],
                    lastModified: file.modifiedTime // Assuming file object has this
                };
            } catch (e) {
                console.error("Failed to load book metadata", e);
                return { folderId: file.id, title: file.name, chapters: [] };
            }
        }));

        const dashboardHtml = `
            <div class="dashboard-container fade-in">
                <div class="dashboard-header">
                    <h1>My Library</h1>
                    <div class="dashboard-stats">
                        <div class="dashboard-stat">
                            <div class="dashboard-stat-value">${booksWithMetadata.length}</div>
                            <div class="dashboard-stat-label">Books</div>
                        </div>
                        <div class="dashboard-stat">
                            <div class="dashboard-stat-value">${writingStreaks.getStats().currentStreak}</div>
                            <div class="dashboard-stat-label">Day Streak</div>
                        </div>
                        <div class="dashboard-stat">
                            <div class="dashboard-stat-value">${Math.floor(writingStreaks.getStats().totalWords / 1000)}k</div>
                            <div class="dashboard-stat-label">Total Words</div>
                        </div>
                    </div>
                </div>
                
                ${booksWithMetadata.length === 0 ? `
                    <div class="dashboard-empty">
                        <h2>Every masterpiece starts with a single word.</h2>
                        <p>Create your first book and begin your writing journey.</p>
                        <button class="btn btn-primary create-book-btn">Create New Book</button>
                    </div>
                ` : `
                    <div class="books-grid">
                        <div class="book-card create-new" data-action="create">
                            <div class="create-new-icon">➕</div>
                            <div class="create-new-text">Create New Book</div>
                        </div>
                        ${booksWithMetadata.map(book => {
            const wordCount = book.chapters?.reduce((sum, ch) => {
                return sum + (ch.text || '').split(/\s+/).filter(w => w.length > 0).length;
            }, 0) || 0;

            const targetWords = 80000; // Average novel
            const progress = Math.min(100, (wordCount / targetWords) * 100);

            // Random gradient for cover
            const gradients = [
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
            ];
            const gradient = gradients[Math.floor(Math.random() * gradients.length)];

            return `
                                <div class="book-card" data-book-id="${book.folderId}">
                                    <div class="book-cover" style="background: ${gradient}">
                                        <div class="book-icon">📖</div>
                                    </div>
                                    <div class="book-card-content">
                                        <h3>${book.title || 'Untitled Book'}</h3>
                                        <div class="book-meta">
                                            <span>📝 ${wordCount.toLocaleString()} words</span>
                                            <span>📚 ${book.chapters?.length || 0} chapters</span>
                                        </div>
                                        <div class="progress-bar">
                                            <div class="progress" style="--progress-width: ${progress}%; width: ${progress}%"></div>
                                        </div>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                    
                    <div class="streak-calendar">
                        <h3>🔥 Writing Activity</h3>
                        <div class="calendar-grid">
                            ${writingStreaks.getCalendarData(3).slice(-30).map(day => {
            let className = 'calendar-day';
            if (day.count > 0) className += ' has-words';
            if (day.metGoal) className += ' met-goal';
            return `<div class="${className}" title="${day.date}: ${day.count} words"></div>`;
        }).join('')}
                        </div>
                    </div>
                `}
            </div>
        `;

        container.innerHTML = dashboardHtml;

        // Handle book card clicks
        document.querySelectorAll('.book-card[data-book-id]').forEach(card => {
            card.onclick = () => {
                const bookId = card.dataset.bookId;
                loadEditor(bookId, container); // Use the imported loadEditor
            };
        });

        // Handle create new book
        const createCard = document.querySelector('.book-card.create-new');
        if (createCard) {
            createCard.onclick = async () => {
                const title = prompt('Enter book title:');
                if (title) {
                    try {
                        await createBook(title);
                        renderDashboard(container); // Refresh dashboard
                    } catch (err) {
                        alert('Failed to create book: ' + err.message);
                    }
                }
            };
        }

        // Bind Create Book buttons (for empty state)
        const createBtns = document.querySelectorAll('.create-book-btn');
        createBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const title = prompt("Enter book title:");
                if (title) {
                    btn.textContent = 'Creating...';
                    btn.disabled = true;
                    try {
                        await createBook(title);
                        renderDashboard(container);
                    } catch (err) {
                        alert('Failed to create book. Check console.');
                        btn.textContent = 'Create New Book';
                        btn.disabled = false;
                    }
                }
            });
        });

        // Add a logout button if needed, or integrate into a header
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn';
        logoutBtn.className = 'btn btn-secondary';
        logoutBtn.textContent = 'Sign Out';
        logoutBtn.style.marginTop = 'var(--space-md)';
        logoutBtn.addEventListener('click', () => {
            import('./auth.js').then(auth => auth.logout());
        });
        // Append logout button to a suitable place, e.g., after the dashboard container
        const dashboardContainer = container.querySelector('.dashboard-container');
        if (dashboardContainer) {
            dashboardContainer.appendChild(logoutBtn);
        }


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
