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
    header.innerHTML = 'Guide';
    container.appendChild(header);

    // Sections Containers
    const chaptersSection = createSectionContainer('Chapters'); // Placeholder for now
    const charsSection = createSectionContainer('Characters');
    const tagsSection = createSectionContainer('Tags');

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

    setInterval(scanEntities, 2000);
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
        addBtn.innerText = '+ Add New';
        addBtn.style.color = '#3b82f6';
        addBtn.onclick = () => {
            const event = new CustomEvent('open-entity-picker', {
                detail: { type: section === charsSection ? 'character' : 'tag' }
            });
            window.dispatchEvent(event);
        };
        content.appendChild(addBtn);
    }

    function updatePageRefs(locations) {
        Object.keys(locations).forEach(id => {
            const row = container.querySelector(`.guide-item[data-id="${id}"]`);
            if (row) {
                const refsFn = row.querySelector('.guide-refs');
                const pages = Array.from(locations[id]).sort((a, b) => a - b);

                if (pages.length > 0) {
                    const links = pages.map(p =>
                        `<span class="page-link" onclick="document.getElementById('page-container-${p}').scrollIntoView({behavior:'smooth'})">${p}</span>`
                    ).join(', ');
                    refsFn.innerHTML = `(${links})`;
                } else {
                    refsFn.innerHTML = '';
                }
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
