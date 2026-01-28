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
                text: '',
                file: 'chapter_01.json'
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
    // Find and read chapter file from Drive
    const fileMeta = await gapi.client.drive.files.get({
        fileId: currentBookId,
        fields: 'parents'
    });
    const parentId = fileMeta.result.parents[0];

    const res = await gapi.client.drive.files.list({
        q: `name = '${chapterMeta.file}' and '${parentId}' in parents and trashed = false`,
        fields: 'files(id)'
    });

    const fileId = res.result.files[0]?.id;
    if (!fileId) {
        console.error("Chapter file not found:", chapterMeta.file);
        currentChapter = { ...chapterMeta, text: '', fileId: null };
        return;
    }

    const content = await readFile(fileId);
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    currentChapter = {
        ...chapterMeta,
        fileId: fileId,
        text: parsed.text || ''
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

function createFocusModeButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '🎯';
    btn.className = 'focus-mode-toggle';
    btn.title = 'Toggle Focus Mode (F11)';

    btn.onclick = () => {
        const isActive = focusMode.toggle();
        btn.classList.toggle('active', isActive);
        btn.title = isActive ? 'Exit Focus Mode (F11)' : 'Toggle Focus Mode (F11)';
    };

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

    // Settings Button
    const settingsBtn = document.createElement('button');
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.className = 'settings-toggle-btn';
    settingsBtn.title = 'Open Settings';
    container.appendChild(settingsBtn);

    // Stats Button
    container.appendChild(createStatsButton());

    // PDF Export Button
    container.appendChild(createPDFButton());

    // Focus Mode Button
    container.appendChild(createFocusModeButton());

    // Settings Window
    const settingsWindow = SettingsWindow();
    container.appendChild(settingsWindow);
    settingsBtn.onclick = () => {
        settingsWindow.style.display = 'flex';
    };

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
                btn.classList.toggle('active', isActive);
                btn.title = isActive ? 'Exit Focus Mode (F11)' : 'Toggle Focus Mode (F11)';
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

    // Add chapter selector if multiple chapters
    const selector = createChapterSelector();
    if (selector) {
        container.appendChild(selector);
    }

    // Initialize word count
    updateWordCount();
}

async function saveCurrentChapter() {
    if (!currentChapter || !currentChapter.fileId) {
        console.warn("No chapter to save");
        return;
    }

    try {
        // Get all content from PageManager
        const htmlContent = pageManager.getAllContent();

        // Update chapter
        currentChapter.text = htmlContent;

        // Save to Drive
        await updateFile(currentChapter.fileId, JSON.stringify({
            id: currentChapter.id,
            title: currentChapter.title,
            text: currentChapter.text
        }, null, 2));

        console.log("Chapter saved successfully");
        ErrorHandler.success('Chapter saved');
    } catch (err) {
        ErrorHandler.handle(err, 'SaveChapter');
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
