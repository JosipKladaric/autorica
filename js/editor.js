/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { readFile, updateFile } from './drive.js';
import { PageManager } from './components/PageManager.js';
import { SettingsWindow } from './components/SettingsWindow.js';
import { GuidePaper } from './components/GuidePaper.js';
import { NotesPaper } from './components/NotesPaper.js';
import { ContextToolbar } from './components/ContextToolbar.js';
import { MetaPicker } from './components/MetaPicker.js';
import { appStore } from './store.js';
import { CONFIG } from './constants.js';
import { ErrorHandler } from './utils/errorHandler.js';
import { UndoManager, ContentEditCommand } from './utils/undoManager.js';
import { getChapterStats } from './utils/textStats.js';
import { showPDFExportDialog } from './utils/pdfExport.js';
import { FocusMode } from './utils/focusMode.js';
import { WritingStreaks } from './utils/writingStreaks.js';

let currentBook = null;
let currentBookId = null;
let currentChapter = null;
let pageManager = null;
let autosaveTimer = null;
let undoManager = null;
let lastContent = '';
let focusMode = null;
let writingStreaks = new WritingStreaks();
let cleanupFunctions = [];

export async function loadEditor(bookId, container) {
    currentBookId = bookId;
    container.innerHTML = `
        <div class="center-screen">
            <div class="spinner"></div>
            <p>Opening book...</p>
        </div>
    `;

    try {
        // Load book metadata
        const bookData = await readFile(bookId);
        currentBook = typeof bookData === 'string' ? JSON.parse(bookData) : bookData;

        // Load settings into store
        appStore.loadSettingsFromBook(currentBook.settings);
        appStore.setCurrentBook(bookId);

        // Load entities and notes if they exist
        appStore.loadEntitiesAndNotes(currentBook);

        // Load first chapter (Option A: Single Chapter Mode)
        if (currentBook.chapters && currentBook.chapters.length > 0) {
            const firstChapter = currentBook.chapters[0];
            await loadChapter(firstChapter);
        } else {
            currentChapter = {
                id: 'ch-1',
                title: 'Chapter One',
                text: ''
            };
        }

        renderEditorUI(container);

    } catch (err) {
        ErrorHandler.handle(err, 'LoadEditor');
        container.innerHTML = `
            <div class="center-screen">
                <h1 style="color: #ef4444">Error</h1>
                <p>Could not open book.</p>
                <button class="btn btn-secondary" onclick="window.dispatchEvent(new CustomEvent('autorica:view-dashboard'))">Back to Dashboard</button>
            </div>
        `;
    }
}

async function loadChapter(chapterMeta) {
    // With embedded chapters, we just need to set the current chapter
    // The chapter data is already in the book object
    currentChapter = {
        ...chapterMeta,
        text: chapterMeta.text || ''
    };

    appStore.setCurrentChapter(currentChapter);
}

function createChapterSelector() {
    if (!currentBook.chapters || currentBook.chapters.length <= 1) {
        return null; // Don't show if only one chapter
    }

    const dropdown = document.createElement('select');
    dropdown.className = 'chapter-selector';
    dropdown.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 100;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    currentBook.chapters.forEach((ch, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = ch.title || `Chapter ${index + 1}`;
        option.selected = ch.id === currentChapter.id;
        dropdown.appendChild(option);
    });

    dropdown.addEventListener('change', async (e) => {
        const chapter = currentBook.chapters[e.target.value];
        try {
            await loadChapter(chapter);
            pageManager.loadContent(currentChapter.text || '');
            updateWordCount();
        } catch (err) {
            ErrorHandler.handle(err, 'SwitchChapter');
        }
    });

    return dropdown;
}

function createStatsButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '📊';
    btn.className = 'stats-toggle-btn';
    btn.title = 'View Statistics';
    btn.style.cssText = `
        position: fixed;
        top: 70px;
        right: 20px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 99;
    `;

    btn.onclick = () => showStatsPanel();
    return btn;
}

function createPDFButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '📄';
    btn.className = 'pdf-toggle-btn';
    btn.title = 'Export to PDF';
    btn.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 99;
    `;

    btn.onclick = () => showPDFExportDialog(currentBook, currentChapter);
    return btn;
}

function showStatsPanel() {
    const stats = getChapterStats(currentChapter.text || '');

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;

    panel.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px;">${currentChapter.title || 'Chapter Statistics'}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Words</div>
                <div style="font-size: 28px; font-weight: bold; color: #1f2937;">${stats.words.toLocaleString()}</div>
            </div>
            <div style="padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Reading Time</div>
                <div style="font-size: 28px; font-weight: bold; color: #1f2937;">${stats.readingTimeFormatted}</div>
            </div>
            <div style="padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Characters</div>
                <div style="font-size: 20px; font-weight: bold; color: #1f2937;">${stats.characters.toLocaleString()}</div>
            </div>
            <div style="padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Sentences</div>
                <div style="font-size: 20px; font-weight: bold; color: #1f2937;">${stats.sentences.toLocaleString()}</div>
            </div>
            <div style="padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Paragraphs</div>
                <div style="font-size: 20px; font-weight: bold; color: #1f2937;">${stats.paragraphs.toLocaleString()}</div>
            </div>
            <div style="padding: 16px; background: #f3f4f6; border-radius: 8px;">
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Avg Words/Sentence</div>
                <div style="font-size: 20px; font-weight: bold; color: #1f2937;">${stats.avgWordsPerSentence}</div>
            </div>
        </div>
        <button id="close-stats" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; width: 100%;">Close</button>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    panel.querySelector('#close-stats').onclick = () => overlay.remove();
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
}

function renderEditorUI(container) {
    container.innerHTML = '';

    // Create button group container
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'editor-button-group';
    buttonGroup.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 100;
        display: flex;
        gap: 8px;
    `;

    // Helper to create icon button
    const createIconButton = (icon, title, className = '') => {
        const btn = document.createElement('button');
        btn.innerHTML = icon;
        btn.className = `icon-btn ${className}`;
        btn.title = title;
        btn.style.cssText = `
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: white;
            border: 1px solid rgba(0, 0, 0, 0.1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            cursor: pointer;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        btn.onmouseover = () => {
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        };
        btn.onmouseout = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        };
        return btn;
    };

    // Settings Button
    const settingsBtn = createIconButton('⚙️', 'Settings');
    buttonGroup.appendChild(settingsBtn);

    // Fullscreen Button
    const fullscreenBtn = createIconButton('⛶', 'Toggle Fullscreen');
    fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                fullscreenBtn.innerHTML = '⛶'; // Exit fullscreen icon
                fullscreenBtn.title = 'Exit Fullscreen';
            }).catch(err => {
                console.error('Fullscreen error:', err);
                ErrorHandler.handle(err, 'Fullscreen');
            });
        } else {
            document.exitFullscreen().then(() => {
                fullscreenBtn.innerHTML = '⛶';
                fullscreenBtn.title = 'Toggle Fullscreen';
            });
        }
    };
    buttonGroup.appendChild(fullscreenBtn);

    // Focus Mode Button
    const focusBtn = createIconButton('🎯', 'Focus Mode (F11)', 'focus-mode-toggle');
    focusBtn.onclick = () => {
        const isActive = focusMode.toggle();
        if (isActive) {
            focusBtn.style.background = '#6366f1';
            focusBtn.style.color = 'white';
            focusBtn.style.borderColor = '#6366f1';
        } else {
            focusBtn.style.background = 'white';
            focusBtn.style.color = 'black';
            focusBtn.style.borderColor = 'rgba(0, 0, 0, 0.1)';
        }
        focusBtn.title = isActive ? 'Exit Focus Mode (F11)' : 'Focus Mode (F11)';
    };
    buttonGroup.appendChild(focusBtn);

    container.appendChild(buttonGroup);

    // Stats Button (bottom right)
    container.appendChild(createStatsButton());

    // PDF Export Button (bottom right)
    container.appendChild(createPDFButton());

    // Settings Window
    const settingsWindow = SettingsWindow();
    container.appendChild(settingsWindow);
    settingsBtn.onclick = () => {
        settingsWindow.style.display = 'flex';
    };

    // Listen for fullscreen changes (e.g., when user presses ESC)
    const fullscreenChangeHandler = () => {
        if (!document.fullscreenElement) {
            fullscreenBtn.innerHTML = '⛶';
            fullscreenBtn.title = 'Toggle Fullscreen';
        } else {
            fullscreenBtn.innerHTML = '⛶';
            fullscreenBtn.title = 'Exit Fullscreen';
        }
    };
    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    cleanupFunctions.push(() => {
        document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
    });

    // Context Toolbar
    const toolbar = ContextToolbar();
    container.appendChild(toolbar);

    // Toolbar selection logic
    document.addEventListener('selectionchange', () => {
        toolbar.update();
    });
    document.addEventListener('scroll', () => {
        toolbar.update();
    }, true);

    // Meta Picker
    container.appendChild(MetaPicker());

    // Guide Paper (Left)
    container.appendChild(GuidePaper());

    // Notes Paper (Right)
    container.appendChild(NotesPaper());

    // Workspace
    const workspace = document.createElement('div');
    workspace.className = 'book-workspace';
    container.appendChild(workspace);

    // Initialize PageManager
    pageManager = new PageManager(workspace);
    pageManager.init();

    // Initialize Focus Mode
    focusMode = new FocusMode(workspace);

    // Initialize Undo Manager
    undoManager = new UndoManager();
    lastContent = currentChapter?.text || '';

    // Load chapter content into PageManager
    if (currentChapter && currentChapter.text) {
        pageManager.loadContent(currentChapter.text);
    }

    // Subscribe to background color updates
    appStore.subscribe((state) => {
        document.body.style.backgroundColor = state.backgroundColor;
        // Clear the wood texture when changing background
        document.body.style.backgroundImage = 'none';
    });
    // Set initial background
    document.body.style.backgroundColor = appStore.getState().backgroundColor;
    document.body.style.backgroundImage = 'none';

    // Setup autosave on content changes
    const autosaveHandler = () => {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(saveCurrentChapter, CONFIG.AUTOSAVE_DELAY_MS);
        updateWordCount();

        // Track content for undo/redo
        const newContent = pageManager.getAllContent();
        if (newContent !== lastContent) {
            const command = new ContentEditCommand(pageManager, lastContent, newContent);
            undoManager.execute(command);
            lastContent = newContent;
        }
    };
    workspace.addEventListener('input', autosaveHandler);

    // Undo/Redo keyboard shortcuts
    const keyboardHandler = (e) => {
        // Ctrl+Z for undo
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            if (undoManager.undo()) {
                lastContent = pageManager.getAllContent();
                ErrorHandler.success('Undone');
            }
        }
        // Ctrl+Y or Ctrl+Shift+Z for redo
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            if (undoManager.redo()) {
                lastContent = pageManager.getAllContent();
                ErrorHandler.success('Redone');
            }
        }
        // F11 for Focus Mode
        if (e.key === 'F11') {
            e.preventDefault();
            const isActive = focusMode.toggle();
            const btn = document.querySelector('.focus-mode-toggle');
            if (btn) {
                if (isActive) {
                    btn.style.background = '#6366f1';
                    btn.style.color = 'white';
                    btn.style.borderColor = '#6366f1';
                } else {
                    btn.style.background = 'white';
                    btn.style.color = 'black';
                    btn.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                }
                btn.title = isActive ? 'Exit Focus Mode (F11)' : 'Focus Mode (F11)';
            }
            ErrorHandler.success(isActive ? 'Focus Mode Enabled' : 'Focus Mode Disabled');
        }
    };
    document.addEventListener('keydown', keyboardHandler);

    // Track for cleanup
    cleanupFunctions.push(() => {
        workspace.removeEventListener('input', autosaveHandler);
        document.removeEventListener('keydown', keyboardHandler);
        if (autosaveTimer) clearTimeout(autosaveTimer);
        if (undoManager) undoManager.clear();
    });

    // Listen for PDF export event from settings
    const pdfExportHandler = () => {
        showPDFExportDialog(currentBook, currentChapter);
    };
    window.addEventListener('autorica:export-pdf', pdfExportHandler);

    cleanupFunctions.push(() => {
        window.removeEventListener('autorica:export-pdf', pdfExportHandler);
    });

    // Add chapter selector if multiple chapters
    const selector = createChapterSelector();
    if (selector) {
        container.appendChild(selector);
    }

    // Initialize word count
    updateWordCount();
}

async function saveCurrentChapter() {
    if (!currentChapter || !currentBook || !currentBookId) {
        console.warn("No chapter/book to save");
        return;
    }

    try {
        // Get all content from PageManager
        const htmlContent = pageManager.getAllContent();

        // Update current chapter text
        currentChapter.text = htmlContent;

        // Find and update the chapter in the book
        const chapterIndex = currentBook.chapters.findIndex(ch => ch.id === currentChapter.id);
        if (chapterIndex !== -1) {
            currentBook.chapters[chapterIndex] = { ...currentChapter };
        }

        // Update modification time
        currentBook.modified = new Date().toISOString();

        // Save entire book to Drive
        await updateFile(currentBookId, JSON.stringify(currentBook, null, 2));

        console.log("Book saved successfully");
        ErrorHandler.success('Saved');

        // Track writing for streaks
        const wordCount = htmlContent.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(w => w.length > 0).length;
        writingStreaks.logSession(wordCount);

    } catch (err) {
        ErrorHandler.handle(err, 'SaveBook');
    }
}

function updateWordCount() {
    if (!pageManager) return;

    const text = pageManager.getAllContent()
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .trim();

    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const chars = text.length;

    let counter = document.getElementById('word-count');
    if (!counter) {
        counter = document.createElement('div');
        counter.id = 'word-count';
        counter.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 1000;
            font-family: var(--font-sans);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(counter);
    }

    counter.textContent = `${words.toLocaleString()} words • ${chars.toLocaleString()} characters`;
}
