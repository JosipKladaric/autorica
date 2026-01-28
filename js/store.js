/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { CONFIG } from './constants.js';

export class Store {
    constructor() {
        // Default State
        this.state = {
            paperSize: 'A5', // A4, A5, Letter, Legal
            paperColor: '#fdfbf7', // white, warm white, cream, ivory
            fontFamily: 'Crimson Pro', // Garamond, Caslon, Baskervville, Crimson Pro
            hasTexture: true,
            backgroundColor: '#e2e8f0', // Mist
            entities: [], // { id, type, name, color, pageRefs: [] }
            notesContent: '', // Persistent notes

            // Drive-related state
            currentBookId: null,
            currentChapterId: null,
            currentChapter: null, // { id, title, file, text, fileId }
        };
        this.subscribers = [];
        this.autosaveTimer = null;
    }

    addEntity(entity) {
        this.state.entities = [...this.state.entities, entity];
        this.notify();
    }

    updateEntity(id, updates) {
        this.state.entities = this.state.entities.map(e =>
            e.id === id ? { ...e, ...updates } : e
        );
        this.notify();
    }

    updateNotes(content) {
        this.state.notesContent = content;
        this.notify();
    }

    getState() {
        return this.state;
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        // Return unsubscribe function
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    notify() {
        this.subscribers.forEach(callback => callback(this.state));

        // Autosave settings to Drive (debounced)
        if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
            this.saveSettingsToDrive().catch(err => {
                console.error('Failed to autosave settings:', err);
            });
        }, CONFIG.SETTINGS_SAVE_DELAY_MS);
    }

    // Drive integration methods
    setCurrentBook(bookId) {
        this.state.currentBookId = bookId;
    }

    setCurrentChapter(chapter) {
        this.state.currentChapterId = chapter.id;
        this.state.currentChapter = chapter;
        this.notify();
    }

    loadSettingsFromBook(bookSettings) {
        // Merge book settings into store state
        if (bookSettings) {
            if (bookSettings.pageFormat) {
                // Map old format names to new ones if needed
                const formatMap = {
                    'A4': 'A4',
                    'A5': 'A5',
                    'B5': 'A5', // Fallback
                    'Letter': 'Letter',
                    'Legal': 'Legal'
                };
                this.state.paperSize = formatMap[bookSettings.pageFormat] || 'A5';
            }
            if (bookSettings.font) {
                // Map old font names to new ones
                const fontMap = {
                    'Inter': 'Crimson Pro', // Default to Crimson Pro
                    'Roboto': 'Crimson Pro',
                    'Merriweather': 'Crimson Pro',
                    'Crimson Text': 'Crimson Pro',
                    'Libre Baskerville': 'Baskervville',
                    'EB Garamond': 'EB Garamond',
                    'Crimson Pro': 'Crimson Pro',
                    'Baskervville': 'Baskervville',
                    'Libre Caslon Text': 'Libre Caslon Text'
                };
                this.state.fontFamily = fontMap[bookSettings.font] || 'Crimson Pro';
            }
            if (bookSettings.paperTexture) {
                // Map texture to paper color
                const textureMap = {
                    'texture-white': '#ffffff',
                    'texture-cream': '#F5F5DC',
                    'texture-ivory': '#FFFFF0',
                    'texture-warm': '#fdfbf7'
                };
                this.state.paperColor = textureMap[bookSettings.paperTexture] || '#fdfbf7';
            }
            if (bookSettings.theme === 'dark') {
                this.state.backgroundColor = '#414040ff'; // Carbon
            }
        }
        this.notify();
    }

    /**
     * Save current settings back to Drive's book.json
     */
    async saveSettingsToDrive() {
        if (!this.state.currentBookId) return;

        try {
            const { readFile, updateFile } = await import('./drive.js');
            const bookData = await readFile(this.state.currentBookId);
            const book = typeof bookData === 'string' ? JSON.parse(bookData) : bookData;

            // Update settings from current state
            book.settings = {
                pageFormat: this.state.paperSize,
                font: this.state.fontFamily,
                paperTexture: this.getPaperTextureFromColor(this.state.paperColor),
                theme: this.getThemeFromBackground(this.state.backgroundColor)
            };

            // Save entities and notes
            book.entities = this.state.entities || [];
            book.notes = this.state.notesContent || '';

            await updateFile(this.state.currentBookId, JSON.stringify(book, null, 2));
            console.log('Settings saved to Drive');
        } catch (err) {
            // Silent fail - don't interrupt user
            console.error('Settings autosave failed:', err);
        }
    }

    /**
     * Map paper color back to texture name
     */
    getPaperTextureFromColor(color) {
        const map = {
            '#ffffff': 'texture-white',
            '#F5F5DC': 'texture-cream',
            '#FFFFF0': 'texture-ivory',
            '#fdfbf7': 'texture-warm'
        };
        return map[color] || 'texture-warm';
    }

    /**
     * Map background color to theme name
     */
    getThemeFromBackground(color) {
        // Dark backgrounds
        if (color === '#414040ff' || color === '#44545cff' ||
            color === '#24201f' || color === '#2b2c28ff') {
            return 'dark';
        }
        return 'light';
    }

    /**
     * Load entities and notes from book metadata
     */
    loadEntitiesAndNotes(bookData) {
        if (bookData.entities) {
            this.state.entities = bookData.entities;
        }
        if (bookData.notes) {
            this.state.notesContent = bookData.notes;
        }
        this.notify();
    }
}

// Singleton instance
export const appStore = new Store();

// Constants for UI options
export const PAPER_SIZES = {
    'A4': { width: '210mm', height: '297mm', label: 'A4 (210 x 297 mm)' },
    'A5': { width: '148mm', height: '210mm', label: 'A5 (148 x 210 mm)' },
    'Letter': { width: '215.9mm', height: '279.4mm', label: 'Letter (8.5 x 11 in)' },
    'Legal': { width: '215.9mm', height: '355.6mm', label: 'Legal (8.5 x 14 in)' }
};

export const PAPER_COLORS = {
    'White': '#ffffff',
    'Warm White': '#fdfbf7',
    'Ivory': '#FFFFF0',
    'Cream': '#F5F5DC',
};

export const BACKGROUND_COLORS = {
    'Carbon': '#414040ff',    // Neutral, high contrast
    'Navy': '#44545cff',      // Cool, subtle blue tint
    'Espresso': '#24201f',  // Warm, subtle brown tint
    'Olive': '#2b2c28ff',     // Earthy, subtle green tint
    'Latte': '#e6dcc6',     // Warm beige (light)
    'Mist': '#e2e8f0',      // Cool light gray
    'Pebble': '#dcd7d1',    // Neutral light/warm gray
    'Soft Sage': '#dee5da', // Light green
};

export const FONTS = [
    { name: 'Crimson Pro', value: 'Crimson Pro' },
    { name: 'Garamond', value: 'EB Garamond' },
    { name: 'Caslon Book', value: 'Libre Caslon Text' },
    { name: 'Baskervville', value: 'Baskervville' }
];
