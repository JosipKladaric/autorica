/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { readFile, updateFile, createFile } from './drive.js';

let currentBook = null;
let currentBookId = null;
let bookFolderId = null;
let loadedChapters = []; // Array of { id, title, file, text, fileId }
let autosaveTimers = {}; // Map chapterId -> timer

// Default Settings
const DEFAULT_SETTINGS = {
    pageFormat: 'A4',
    font: 'Inter',
    fontSize: 12,
    theme: 'dark',
    paperTexture: 'texture-white'
};

const DEFAULT_TAGS = [
    { id: 't1', name: 'Important', color: 'rgba(239, 68, 68, 0.3)' }, // Red
    { id: 't2', name: 'Character', color: 'rgba(59, 130, 246, 0.3)' }, // Blue
    { id: 't3', name: 'Plot', color: 'rgba(16, 185, 129, 0.3)' }, // Green
    { id: 't4', name: 'Revision', color: 'rgba(245, 158, 11, 0.3)' }, // Orange
];

export async function loadEditor(bookId, container) {
    currentBookId = bookId;
    container.innerHTML = `
        <div class="center-screen">
            <div class="spinner"></div>
            <p>Opening book...</p>
        </div>
    `;

    let bookFolderId = null; // Store parent folder ID

    try {
        // 1. Get Folder ID from book.json's parent
        const fileMeta = await gapi.client.drive.files.get({
            fileId: bookId,
            fields: 'parents'
        });
        bookFolderId = fileMeta.result.parents[0];

        const bookData = await readFile(bookId);
        currentBook = typeof bookData === 'string' ? JSON.parse(bookData) : bookData;

        // Ensure settings exist and merge defaults
        currentBook.settings = { ...DEFAULT_SETTINGS, ...currentBook.settings };

        // Ensure tags exist
        if (!currentBook.tags) currentBook.tags = [...DEFAULT_TAGS];

        // Load ALL chapters
        await loadAllChapters();

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

async function loadAllChapters() {
    loadedChapters = [];
    if (!currentBook.chapters || currentBook.chapters.length === 0) {
        // Create default if none
        return;
    }

    // Parallel fetch
    const promises = currentBook.chapters.map(async (chMeta) => {
        try {
            const fileId = await findChapterId(chMeta.file, currentBookId);
            if (!fileId) return { ...chMeta, text: '', error: 'File not found' };

            const content = await readFile(fileId);
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            return {
                ...chMeta,
                fileId: fileId,
                text: parsed.text || '',
                title: parsed.title // Sync title from file if needed
            };
        } catch (e) {
            console.warn("Failed to load chapter", chMeta.title, e);
            return { ...chMeta, text: 'Error loading content.', error: e.message };
        }
    });

    loadedChapters = await Promise.all(promises);
}

async function findChapterId(filename, bookJsonId) {
    const meta = await gapi.client.drive.files.get({
        fileId: bookJsonId,
        fields: 'parents'
    });
    const parentId = meta.result.parents[0];

    const res = await gapi.client.drive.files.list({
        q: `name = '${filename}' and '${parentId}' in parents and trashed = false`,
        fields: 'files(id)'
    });

    return res.result.files[0]?.id;
}


function renderEditorUI(container) {
    // Determine font stack
    const fontMap = {
        'Inter': "'Inter', sans-serif",
        'Roboto': "'Roboto', sans-serif",
        'Open Sans': "'Open Sans', sans-serif",
        'Lato': "'Lato', sans-serif",
        'Merriweather': "'Merriweather', serif",
        'Crimson Text': "'Crimson Text', serif",
        'Libre Baskerville': "'Libre Baskerville', serif",
        'EB Garamond': "'EB Garamond', serif"
    };
    const fontStr = fontMap[currentBook.settings.font] || "'Inter', sans-serif";

    container.innerHTML = `
        <div class="editor-grid">
            <!-- Sidebar -->
            <aside class="sidebar">
                <div style="padding: 1rem;">
                    <button id="back-dashboard-btn" class="btn btn-secondary" style="width: 100%; font-size: 0.8rem;">← Dashboard</button>
                </div>
                
                <!-- Format Panel -->
                <div class="sidebar-panel">
                    <div class="panel-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        Page Format <span>▼</span>
                    </div>
                    <div class="panel-content">
                         <label style="display: block; margin-bottom: 0.2rem; font-size: 0.8rem; color: var(--text-secondary);">Size</label>
                        <select id="format-select" class="toolbar-select" style="width: 100%; margin-bottom: 0.5rem;">
                            <option value="A4" ${currentBook.settings.pageFormat === 'A4' ? 'selected' : ''}>A4</option>
                            <option value="A5" ${currentBook.settings.pageFormat === 'A5' ? 'selected' : ''}>A5</option>
                            <option value="B5" ${currentBook.settings.pageFormat === 'B5' ? 'selected' : ''}>B5</option>
                        </select>

                        <label style="display: block; margin-bottom: 0.2rem; font-size: 0.8rem; color: var(--text-secondary);">Texture</label>
                         <select id="texture-select" class="toolbar-select" style="width: 100%;">
                            <option value="texture-white" ${currentBook.settings.paperTexture === 'texture-white' ? 'selected' : ''}>White Paper</option>
                            <option value="texture-cream" ${currentBook.settings.paperTexture === 'texture-cream' ? 'selected' : ''}>Cream Paper</option>
                            <option value="texture-ivory" ${currentBook.settings.paperTexture === 'texture-ivory' ? 'selected' : ''}>Ivory Paper</option>
                            <option value="texture-warm" ${currentBook.settings.paperTexture === 'texture-warm' ? 'selected' : ''}>Warm Paper</option>
                        </select>
                    </div>
                </div>

                <!-- Chapters List (Sidebar) -->
                <div class="sidebar-panel">
                    <div class="panel-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        Chapters <span>▼</span>
                    </div>
                    <div class="panel-content hidden">
                        <ul id="chapter-list" style="list-style: none; margin-bottom: 0.5rem;">
                            ${loadedChapters.map((ch, idx) => `
                                <li style="padding: 0.4rem; cursor: pointer; opacity: 0.8"
                                    onclick="document.getElementById('page-${ch.id}').scrollIntoView({behavior: 'smooth', inline: 'center'})">
                                    ${idx + 1}. ${ch.title}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </div>

                <!-- Tags Panel -->
                <div class="sidebar-panel">
                     <div class="panel-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        Tags <span>▼</span>
                    </div>
                    <div class="panel-content">
                        <div id="tags-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                             ${currentBook.tags.map(tag => `
                                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;">
                                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${tag.color.replace('0.3', '1')}"></div>
                                    <span>${tag.name}</span>
                                </div>
                             `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Characters Panel -->
                <div class="sidebar-panel">
                    <div class="panel-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        Characters <span>▼</span>
                    </div>
                    <div class="panel-content hidden">
                        <p style="font-size: 0.8rem; color: var(--text-secondary);">No characters added yet.</p>
                        <button class="btn btn-secondary" style="width: 100%; font-size: 0.8rem; margin-top: 0.5rem;">+ Add Character</button>
                    </div>
                </div>
            </aside>

            <!-- Top Bar -->
            <header class="top-bar">
                <div class="toolbar-group">
                     <span style="font-weight: 600;">${currentBook.title}</span>
                </div>
                <div class="toolbar-group">
                    <select id="font-select" class="toolbar-select">
                        <optgroup label="Serif">
                            <option value="Merriweather" ${currentBook.settings.font === 'Merriweather' ? 'selected' : ''}>Merriweather</option>
                            <option value="Crimson Text" ${currentBook.settings.font === 'Crimson Text' ? 'selected' : ''}>Crimson Text</option>
                            <option value="Libre Baskerville" ${currentBook.settings.font === 'Libre Baskerville' ? 'selected' : ''}>Libre Baskerville</option>
                            <option value="EB Garamond" ${currentBook.settings.font === 'EB Garamond' ? 'selected' : ''}>EB Garamond</option>
                        </optgroup>
                        <optgroup label="Sans Serif">
                            <option value="Inter" ${currentBook.settings.font === 'Inter' ? 'selected' : ''}>Inter (Default)</option>
                            <option value="Roboto" ${currentBook.settings.font === 'Roboto' ? 'selected' : ''}>Roboto</option>
                            <option value="Open Sans" ${currentBook.settings.font === 'Open Sans' ? 'selected' : ''}>Open Sans</option>
                            <option value="Lato" ${currentBook.settings.font === 'Lato' ? 'selected' : ''}>Lato</option>
                        </optgroup>
                    </select>
                    <select id="size-select" class="toolbar-select">
                        <option value="10">10pt</option>
                        <option value="11">11pt</option>
                        <option value="12" selected>12pt</option>
                        <option value="14">14pt</option>
                        <option value="16">16pt</option>
                        <option value="18">18pt</option>
                        <option value="24">24pt</option>
                        <option value="30">30pt</option>
                        <option value="36">36pt</option>
                    </select>
                </div>
                <div class="toolbar-group">
                    <span id="save-status" style="font-size: 0.75rem; color: var(--text-secondary);">All Saved</span>
                </div>
            </header>

            <!-- Main Editor Area -->
            <main class="editor-main">
                <!-- Page Container (Filmstrip) -->
                <div class="page-container" id="filmstrip-container">
                    
                    ${loadedChapters.map((ch, idx) => `
                        <div id="page-${ch.id}" class="page ${currentBook.settings.pageFormat} ${currentBook.settings.paperTexture}" 
                             style="font-family: ${fontStr};">
                             
                             <div style="font-size: 0.7rem; color: rgba(0,0,0,0.5); margin-bottom: 2rem; text-align: center; text-transform: uppercase;">
                                Chapter ${idx + 1}
                             </div>

                            <!-- Content Editable Area -->
                            <div contenteditable="true" class="chapter-content" 
                                 data-chapter-idx="${idx}"
                                 data-file-id="${ch.fileId}"
                                 style="width: 100%; height: 100%; outline: none;" spellcheck="false">
                                 ${ch.text || `<h1 style="margin-bottom: 1rem;">${ch.title}</h1><p>Start writing...</p>`}
                            </div>
                        </div>
                    `).join('')}

                      <!-- Add New Page Placeholder -->
                     <div class="page ${currentBook.settings.pageFormat} ${currentBook.settings.paperTexture}" 
                          style="opacity: 0.5; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px dashed rgba(0,0,0,0.2);"
                          id="add-chapter-card">
                          <div style="text-align: center;">
                              <div style="font-size: 3rem; color: rgba(0,0,0,0.3);">+</div>
                              <div style="color: rgba(0,0,0,0.5);">New Page</div>
                          </div>
                     </div>

                </div>
            </main>
        </div>
    `;

    // Initialize Selection Handling
    initSelectionHandler();

    // Bind Events
    document.getElementById('back-dashboard-btn').addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('autorica:view-dashboard'));
    });

    const updateSettings = async () => {
        const format = document.getElementById('format-select').value;
        const texture = document.getElementById('texture-select').value;
        const font = document.getElementById('font-select').value;

        // Update local state
        currentBook.settings.pageFormat = format;
        currentBook.settings.paperTexture = texture;
        currentBook.settings.font = font;

        // Update UI immediately (All pages)
        const pages = document.querySelectorAll('.page');
        pages.forEach(p => {
            // Keep existing classes if any (like placeholder) but replace format/texture
            if (p.id === 'add-chapter-card') return; // handle differently if needed
            p.className = `page ${format} ${texture}`;
            // Simplify font update
            const fontMap = {
                'Inter': "'Inter', sans-serif",
                'Roboto': "'Roboto', sans-serif",
                'Open Sans': "'Open Sans', sans-serif",
                'Lato': "'Lato', sans-serif",
                'Merriweather': "'Merriweather', serif",
                'Crimson Text': "'Crimson Text', serif",
                'Libre Baskerville': "'Libre Baskerville', serif",
                'EB Garamond': "'EB Garamond', serif"
            };
            p.style.fontFamily = fontMap[font] || "'Inter', sans-serif";
        });

        // Persist settings
        await saveBookMetadata();
    };

    document.getElementById('format-select').addEventListener('change', updateSettings);
    document.getElementById('texture-select').addEventListener('change', updateSettings);
    document.getElementById('font-select').addEventListener('change', updateSettings);

    // Font Size selection (Selection based)
    document.getElementById('size-select').addEventListener('change', (e) => {
        const size = e.target.value;
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('insertHTML', false, `<span style="font-size: ${size}pt">${window.getSelection().toString()}</span>`);
    });

    // Add Chapter Handler
    document.getElementById('add-chapter-card').addEventListener('click', addNewChapter);

    // Autosave Logic (Delegated)
    document.querySelectorAll('.chapter-content').forEach(editor => {
        editor.addEventListener('input', (e) => {
            const idx = e.target.dataset.chapterIdx;
            const fileId = e.target.dataset.fileId;

            document.getElementById('save-status').textContent = 'Unsaved changes...';

            if (autosaveTimers[fileId]) clearTimeout(autosaveTimers[fileId]);

            autosaveTimers[fileId] = setTimeout(async () => {
                await saveChapter(idx, e.target.innerHTML);
            }, 2000);
        });
    });
}

function initSelectionHandler() {
    // Remove existing popover if any
    const existing = document.getElementById('tag-floating-btn');
    if (existing) existing.remove();

    // Create popover element
    const popover = document.createElement('div');
    popover.id = 'tag-floating-btn';
    popover.className = 'hidden';
    popover.innerHTML = currentBook.tags.map(tag => `
        <div class="tag-option-btn" 
             style="background-color: ${tag.color.replace('0.3', '1')}" 
             title="${tag.name}"
             data-tag-id="${tag.id}">
        </div>
    `).join('');

    document.body.appendChild(popover);

    // Click handler for tags
    popover.querySelectorAll('.tag-option-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => { // CHANGED to mousedown to prevent focus loss
            e.preventDefault();
            e.stopPropagation();
            const tagId = btn.dataset.tagId;
            applyTag(tagId);
            popover.classList.add('hidden');
        });
    });

    // Handle Selection Events - Global mouseup
    document.addEventListener('mouseup', (e) => {
        const selection = window.getSelection();
        const editor = e.target.closest('.chapter-content');

        // Logic: If selection is inside ANY editor and not empty
        if (editor && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Position popover
            popover.style.top = `${rect.top - 45 + window.scrollY}px`;
            popover.style.left = `${rect.left + (rect.width / 2) - (popover.offsetWidth / 2)}px`;

            popover.classList.remove('hidden');
            popover.classList.add('visible');
        } else if (!popover.contains(e.target)) {
            popover.classList.add('hidden');
            popover.classList.remove('visible');
        }
    });
}

function applyTag(tagId) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const tag = currentBook.tags.find(t => t.id === tagId);
    if (!tag) return;

    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, tag.color);

    // Trigger autosave (manually dispatch event on the active editor)
    const editor = selection.anchorNode.parentElement.closest('.chapter-content');
    if (editor) editor.dispatchEvent(new Event('input'));
}

async function saveBookMetadata() {
    try {
        await updateFile(currentBookId, JSON.stringify(currentBook, null, 2));
    } catch (e) {
        console.error("Failed to save book settings", e);
    }
}

async function saveChapter(idx, htmlContent) {
    const ch = loadedChapters[idx];
    const statusEl = document.getElementById('save-status');
    statusEl.textContent = 'Saving...';

    try {
        // Update loaded model
        ch.text = htmlContent;

        // Save using ch.fileId (which we found during load)
        await updateFile(ch.fileId, JSON.stringify({
            title: ch.title,
            text: ch.text,
            id: ch.id
        }, null, 2));

        statusEl.textContent = 'All Saved';
    } catch (err) {
        console.error("Autosave failed for chapter " + ch.title, err);
        statusEl.textContent = 'Error Saving!';
        statusEl.style.color = '#ef4444';
    }
}

async function addNewChapter() {
    const container = document.getElementById('filmstrip-container');
    // Show temp spinner text or something?

    const newCount = loadedChapters.length + 1;
    const newTitle = `Page ${newCount}`;
    const newFileName = `page_${newCount.toString().padStart(2, '0')}.json`;
    const newId = 'pg-' + Date.now();

    // 1. Create file in Drive
    // Use the fetched folder ID, not the file ID
    const fileMeta = await createFile(newFileName, bookFolderId, JSON.stringify({
        title: newTitle,
        text: '', // Empty text for new page
        id: newId
    }, null, 2));

    // 2. Update Book Metadata
    const newChapterObj = {
        title: newTitle,
        file: newFileName,
        id: newId
    };
    currentBook.chapters.push(newChapterObj);
    await saveBookMetadata();

    // 3. Add to local state
    loadedChapters.push({
        ...newChapterObj,
        text: '', // or default
        fileId: fileMeta.id
    });

    // 4. Re-render UI (Efficient enough for now)
    const app = document.getElementById('app');
    renderEditorUI(app);

    // 5. Scroll to end
    setTimeout(() => {
        const pages = document.querySelectorAll('.page');
        const last = pages[pages.length - 2]; // The one before placeholder
        if (last) last.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }, 100);
}
