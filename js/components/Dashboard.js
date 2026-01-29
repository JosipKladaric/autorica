/* 
 * Dashboard Component
 * Handles the book selection screen, stats, and user actions.
 */

import { writingStreaks } from '../utils/writingStreaks.js';
import { appStore } from '../store.js';

export class Dashboard {
    constructor(container, onBookSelect, onCreateBook, onLogout) {
        this.container = container;
        this.onBookSelect = onBookSelect;
        this.onCreateBook = onCreateBook;
        this.onLogout = onLogout;
        this.render();
    }

    async render() {
        // Clear container
        this.container.innerHTML = '';
        this.container.className = 'dashboard-view'; // Specific class for scoping styles

        // 1. Fetch Books w/ Metadata
        const { listBooks, readFile } = await import('../drive.js');
        let books = [];
        try {
            books = await listBooks();
        } catch (err) {
            console.error("Failed to list files:", err);
            this.renderError(err);
            return;
        }

        const booksWithMetadata = await Promise.all(books.map(async (file) => {
            try {
                const content = await readFile(file.id);
                const book = typeof content === 'string' ? JSON.parse(content) : content;
                return {
                    id: file.id,
                    title: book.title || file.name.replace('.json', ''),
                    chapters: book.chapters || [],
                    modified: file.modifiedTime
                };
            } catch (e) {
                console.error("Failed to load book metadata", e);
                return { id: file.id, title: file.name, chapters: [] };
            }
        }));

        // 2. Build Dashboard HTML
        const wrapper = document.createElement('div');
        wrapper.className = 'dashboard-container fade-in';

        // HEADER
        const header = document.createElement('div');
        header.className = 'dashboard-header';

        const title = document.createElement('h1');
        title.textContent = 'Moja Knjižnica';

        const stats = document.createElement('div');
        stats.className = 'dashboard-stats';

        stats.appendChild(this.createStatCard(booksWithMetadata.length, 'KNJIGE'));
        stats.appendChild(this.createStatCard(writingStreaks.getStats().currentStreak, 'DNEVNI NIZ'));
        stats.appendChild(this.createStatCard(writingStreaks.getStats().totalWords, 'UKUPNO RIJEČI'));

        header.appendChild(title);
        header.appendChild(stats);
        wrapper.appendChild(header);

        // GRID
        const grid = document.createElement('div');
        grid.className = 'books-grid';

        // "Create New" Card
        const createCard = document.createElement('div');
        createCard.className = 'book-card create-new';
        createCard.innerHTML = `
            <div class="create-new-icon">➕</div>
            <div class="create-new-text">Nova Knjiga</div>
        `;
        createCard.onclick = () => this.onCreateBook();
        grid.appendChild(createCard);

        // Book Cards
        booksWithMetadata.forEach(book => {
            grid.appendChild(this.createBookCard(book));
        });

        wrapper.appendChild(grid);

        // LOGOUT
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'dashboard-logout-btn';
        logoutBtn.textContent = 'Odjavi se';
        logoutBtn.onclick = () => this.onLogout();
        wrapper.appendChild(logoutBtn);

        this.container.appendChild(wrapper);
    }

    createStatCard(value, label) {
        const el = document.createElement('div');
        el.className = 'dashboard-stat';
        el.innerHTML = `
            <div class="dashboard-stat-value">${value.toLocaleString()}</div>
            <div class="dashboard-stat-label">${label}</div>
        `;
        return el;
    }

    createBookCard(book) {
        const wordCount = book.chapters?.reduce((sum, ch) => {
            return sum + (ch.text || '').split(/\s+/).filter(w => w.length > 0).length;
        }, 0) || 0;

        const card = document.createElement('div');
        card.className = 'book-card';
        card.onclick = () => this.onBookSelect(book.id);

        card.innerHTML = `
            <div class="book-card-content">
                <h3>${book.title || 'Neimenovana Knjiga'}</h3>
                <div class="book-meta">
                    <span>${wordCount.toLocaleString()}r</span>
                    <span>${book.chapters?.length || 0}pog</span>
                </div>
            </div>
        `;
        return card;
    }

    renderError(err) {
        this.container.innerHTML = `
            <div class="dashboard-error">
                <h2>Greška pri učitavanju knjižnice</h2>
                <p>${err.message}</p>
                <button class="dashboard-logout-btn" onclick="location.reload()">Pokušaj ponovno</button>
            </div>
        `;
    }
}
