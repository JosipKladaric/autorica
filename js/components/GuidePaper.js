/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { appStore } from '../store.js';
import { hexToRgba } from '../utils/colorUtils.js';

export function GuidePaper() {
    const container = document.createElement('div');
    container.className = 'guide-paper';

    // Subscribe to updates (Color & Entities)
    appStore.subscribe((state) => {
        container.style.backgroundColor = state.paperColor;
        updateLists(state.entities);
    });

    // Title / Header
    const header = document.createElement('div');
    header.className = 'guide-header';
    header.innerHTML = 'Vodič';
    container.appendChild(header);

    // Sections Containers
    const chaptersSection = createSectionContainer('Poglavlja'); // Placeholder for now
    const charsSection = createSectionContainer('Likovi');
    const tagsSection = createSectionContainer('Oznake');

    container.appendChild(chaptersSection);
    container.appendChild(charsSection);
    container.appendChild(tagsSection);

    // Initial Render
    const cleanState = appStore.getState();
    container.style.backgroundColor = cleanState.paperColor;
    updateLists(cleanState.entities);

    // --- Logic: Page Scanning ---
    function scanEntities() {
        const locations = {}; // { entityId: [pageIndex1, pageIndex2] }

        // 1. Scan Entities (Characters/Tags)
        document.querySelectorAll('.entity-highlight').forEach(span => {
            const id = span.dataset.entityId;
            if (!id) return;

            const page = span.closest('.book-page-container');
            if (page && page.id) {
                const pageNum = parseInt(page.id.replace('page-container-', ''));
                if (!locations[id]) locations[id] = new Set();
                locations[id].add(pageNum);
            }
        });

        // 2. Scan Chapters (H1)
        const chapters = [];
        document.querySelectorAll('h1').forEach(h1 => {
            const page = h1.closest('.book-page-container');
            if (page && page.id) {
                const pageNum = parseInt(page.id.replace('page-container-', ''));
                chapters.push({ title: h1.innerText, page: pageNum });
            }
        });

        // Update UI
        updatePageRefs(locations);
        renderChapters(chapters);
    }

    function renderChapters(chapters) {
        const content = chaptersSection.querySelector('.guide-content');
        if (!content) return;
        content.innerHTML = '';

        if (chapters.length === 0) {
            content.innerHTML = '<div class="guide-item" style="color:#cecece; font-style:italic;">No chapters yet</div>';
            return;
        }

        chapters.forEach(ch => {
            const item = document.createElement('div');
            item.className = 'guide-item';
            item.innerHTML = `
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ch.title}</span>
                <span class="guide-refs" style="margin-left:5px;">
                   <span class="page-link" onclick="document.getElementById('page-container-${ch.page}').scrollIntoView({behavior:'smooth'})">${ch.page}</span>
                </span>
            `;
            content.appendChild(item);
        });
    }

    // Debounced scan attached to workspace input
    let timeout;
    document.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(scanEntities, 1000);
    });

    // Immediate scan when entity is highlighted
    window.addEventListener('entity-highlighted', () => {
        scanEntities();
    });

    // Watch for deletion of highlighted text
    const observer = new MutationObserver((mutations) => {
        let highlightRemoved = false;
        mutations.forEach(mutation => {
            mutation.removedNodes.forEach(node => {
                // Check if removed node or its children had entity highlights
                if (node.classList && node.classList.contains('entity-highlight')) {
                    highlightRemoved = true;
                } else if (node.querySelectorAll) {
                    if (node.querySelectorAll('.entity-highlight').length > 0) {
                        highlightRemoved = true;
                    }
                }
            });
        });

        if (highlightRemoved) {
            // Immediate scan when highlight is deleted
            scanEntities();
        }
    });

    // Content Loaded Event - Sync point for initial load
    window.addEventListener('content-loaded', () => {
        // 1. Reapply colors to tags in the text
        const state = appStore.getState();
        if (state.entities) {
            reapplyHighlightColors(state.entities);
        }

        // 2. Scan for page numbers immediately
        scanEntities();

        // 3. Start observer
        const workspace = document.querySelector('.book-workspace');
        if (workspace) {
            observer.disconnect(); // Prevent duplicates
            observer.observe(workspace, {
                childList: true,
                subtree: true
            });
        }
    });

    // Observe the workspace for changes (fallback)
    setTimeout(() => {
        const workspace = document.querySelector('.book-workspace');
        if (workspace) {
            observer.observe(workspace, {
                childList: true,
                subtree: true
            });
        }
    }, 1000);

    setInterval(scanEntities, 2000); // Keep periodic scan as backup
    setTimeout(scanEntities, 500);

    function updateLists(entities) {
        if (!entities) return;
        const chars = entities.filter(e => e.type === 'character');
        const tags = entities.filter(e => e.type === 'tag');
        renderList(charsSection, chars);
        renderList(tagsSection, tags);

        // Reapply colors to all existing highlights
        reapplyHighlightColors(entities);

        setTimeout(scanEntities, 100);
    }

    // NEW: Reapply colors to existing highlights from store data
    function reapplyHighlightColors(entities) {
        entities.forEach(entity => {
            document.querySelectorAll(`.entity-highlight[data-entity-id="${entity.id}"]`).forEach(el => {
                el.style.backgroundColor = hexToRgba(entity.color, 0.3);
                el.style.borderBottom = `2px solid ${entity.color}`;
                el.title = `${entity.type}: ${entity.name}`;
            });
        });
    }

    function renderList(section, items) {
        const content = section.querySelector('.guide-content');
        content.innerHTML = '';

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'guide-item';
            row.dataset.id = item.id;

            // Color picker
            const colorWrapper = document.createElement('div');
            colorWrapper.className = 'guide-color-wrapper';
            colorWrapper.style.backgroundColor = item.color;

            const colorDot = document.createElement('input');
            colorDot.type = 'color';
            colorDot.className = 'guide-color-input';
            colorDot.value = item.color;
            colorDot.oninput = (e) => {
                colorWrapper.style.backgroundColor = e.target.value;
                appStore.updateEntity(item.id, { color: e.target.value });
                document.querySelectorAll(`.entity-highlight[data-entity-id="${item.id}"]`).forEach(el => {
                    el.style.backgroundColor = hexToRgba(e.target.value, 0.3);
                    el.style.borderBottomColor = e.target.value;
                });
            };

            colorWrapper.appendChild(colorDot);
            row.appendChild(colorWrapper);

            const name = document.createElement('span');
            name.className = 'guide-name';
            name.innerText = item.name;

            // Name Click -> Show Toolbar
            name.onclick = (e) => {
                e.stopPropagation();
                showEntityToolbar(item, name);
            };

            const refs = document.createElement('span');
            refs.className = 'guide-refs';
            refs.style.marginLeft = '6px';
            refs.innerText = '';

            row.appendChild(name);
            row.appendChild(refs);
            content.appendChild(row);
        });

        // "Add" button
        const addBtn = document.createElement('div');
        addBtn.className = 'guide-item guide-add-btn';
        addBtn.innerText = '+ Dodaj Novo';
        addBtn.style.color = '#3b82f6';
        addBtn.onclick = () => {
            const event = new CustomEvent('open-entity-picker', {
                detail: { type: section === charsSection ? 'character' : 'tag' }
            });
            window.dispatchEvent(event);
        };
        content.appendChild(addBtn);
    }

    let activeToolbar = null;

    function showEntityToolbar(entity, element) {
        if (activeToolbar) activeToolbar.remove();

        const toolbar = document.createElement('div');
        toolbar.className = 'entity-toolbar';

        // 1. Rename
        const renameBtn = document.createElement('button');
        renameBtn.innerHTML = '✏️ Preimenuj';
        renameBtn.onclick = () => {
            const newName = prompt('Preimenuj oznaku:', entity.name);
            if (newName && newName.trim()) {
                appStore.updateEntity(entity.id, { name: newName.trim() });
                // Re-render happens via subscription, scanning happens via observer
            }
            toolbar.remove();
        };

        // 2. Delete
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️ Ukloni';
        deleteBtn.onclick = () => {
            if (confirm(`Ukloniti "${entity.name}" i sve lokalne oznake?`)) {

                // 1. Remove highlights from text
                unwrapHighlights(entity.id);

                // 2. Remove from store
                appStore.deleteEntity(entity.id);

                // 3. Scan to update guide UI
                scanEntities();
            }
            toolbar.remove();
        };

        toolbar.appendChild(renameBtn);
        toolbar.appendChild(deleteBtn);

        document.body.appendChild(toolbar);
        activeToolbar = toolbar;

        // Position it
        const rect = element.getBoundingClientRect();
        toolbar.style.top = `${rect.bottom + 5}px`;
        toolbar.style.left = `${rect.left}px`;

        // Click outside to close
        const closeHandler = (e) => {
            if (!toolbar.contains(e.target) && e.target !== element) {
                toolbar.remove();
                document.removeEventListener('mousedown', closeHandler);
                activeToolbar = null;
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeHandler), 0);
    }

    function unwrapHighlights(entityId) {
        const highlights = document.querySelectorAll(`.entity-highlight[data-entity-id="${entityId}"]`);
        let modified = false;

        highlights.forEach(span => {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            modified = true;
        });

        // Trigger input event to save changes if needed
        if (modified) {
            document.querySelector('.book-workspace')?.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function updatePageRefs(locations) {
        // Iterate over ALL guide items to ensure we clear those that no longer have locations
        const allItems = container.querySelectorAll('.guide-item[data-id]');

        allItems.forEach(row => {
            const id = row.dataset.id;
            const refsFn = row.querySelector('.guide-refs');

            if (locations[id] && locations[id].size > 0) {
                // Determine pages
                const pages = Array.from(locations[id]).sort((a, b) => a - b);
                const links = pages.map(p =>
                    `<span class="page-link" onclick="document.getElementById('page-container-${p}').scrollIntoView({behavior:'smooth'})">${p}</span>`
                ).join(', ');
                refsFn.innerHTML = `(${links})`;
            } else {
                // No locations found -> Clear it
                refsFn.innerHTML = '';
            }
        });
    }

    return container;
}

function createSectionContainer(title) {
    const section = document.createElement('div');
    section.className = 'guide-section';
    section.innerHTML = `<label class="guide-label">${title}</label><div class="guide-content"></div>`;
    return section;
}
