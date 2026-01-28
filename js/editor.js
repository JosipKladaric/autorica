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

let currentBook = null;
let currentBookId = null;
let currentChapter = null;
let pageManager = null;
let autosaveTimer = null;

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
        console.error("Failed to load editor:", err);
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

function renderEditorUI(container) {
    container.innerHTML = '';

    // Settings Button
    const settingsBtn = document.createElement('button');
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.className = 'settings-toggle-btn';
    settingsBtn.title = 'Open Settings';
    container.appendChild(settingsBtn);

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

    // Load chapter content into PageManager
    if (currentChapter && currentChapter.text) {
        pageManager.loadContent(currentChapter.text);
    }

    // Subscribe to background color updates
    appStore.subscribe((state) => {
        document.body.style.backgroundColor = state.backgroundColor;
    });
    document.body.style.backgroundColor = appStore.getState().backgroundColor;

    // Setup autosave on content changes
    workspace.addEventListener('input', () => {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(saveCurrentChapter, 2000);
    });
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
    } catch (err) {
        console.error("Failed to save chapter:", err);
    }
}
