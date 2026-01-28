/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { appStore } from '../store.js';
import { hexToRgba } from '../utils/colorUtils.js';

export function MetaPicker() {
    const overlay = document.createElement('div');
    overlay.className = 'meta-picker-overlay';
    overlay.style.display = 'none';

    const picker = document.createElement('div');
    picker.className = 'meta-picker';

    let currentType = 'character'; // or 'tag'
    let currentSelectionRange = null;

    // -- Event Listener to Open --
    window.addEventListener('open-entity-picker', (e) => {
        currentType = e.detail.type;
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            currentSelectionRange = selection.getRangeAt(0).cloneRange();
        }
        render();
        overlay.style.display = 'flex';
    });

    const render = () => {
        picker.innerHTML = ''; // Clear

        // Header
        const header = document.createElement('div');
        header.className = 'meta-header';
        header.innerText = currentType === 'character' ? 'Select Character' : 'Select Tag';
        picker.appendChild(header);

        // List Existing
        const entities = appStore.getState().entities.filter(e => e.type === currentType);

        if (entities.length > 0) {
            const list = document.createElement('div');
            list.className = 'meta-list';

            entities.forEach(entity => {
                const item = document.createElement('div');
                item.className = 'meta-item';

                const dot = document.createElement('div');
                dot.className = 'meta-dot';
                dot.style.backgroundColor = entity.color;

                const name = document.createElement('span');
                name.textContent = entity.name; // Use textContent to prevent XSS

                item.appendChild(dot);
                item.appendChild(name);

                item.onclick = () => selectEntity(entity);
                list.appendChild(item);
            });
            picker.appendChild(list);
        } else {
            const empty = document.createElement('div');
            empty.className = 'meta-empty';
            empty.innerText = 'No items yet.';
            picker.appendChild(empty);
        }

        // Create New
        const createSection = document.createElement('div');
        createSection.className = 'meta-create';

        const input = document.createElement('input');
        input.placeholder = `New ${currentType} name...`;
        input.className = 'meta-input';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = currentType === 'character' ? '#ffcccc' : '#ccffcc';
        colorInput.className = 'meta-color';

        const addBtn = document.createElement('button');
        addBtn.innerText = 'Add';
        addBtn.className = 'meta-add-btn';

        addBtn.onclick = () => {
            if (!input.value.trim()) return;
            const newEntity = {
                id: Date.now().toString(),
                type: currentType,
                name: input.value.trim(),
                color: colorInput.value,
                pageRefs: []
            };
            appStore.addEntity(newEntity);
            selectEntity(newEntity);
        };

        createSection.appendChild(colorInput);
        createSection.appendChild(input);
        createSection.appendChild(addBtn);
        picker.appendChild(createSection);

        // Close Button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'meta-close-btn';
        closeBtn.innerText = 'Cancel';
        closeBtn.onclick = () => { overlay.style.display = 'none'; };
        picker.appendChild(closeBtn);
    };

    const selectEntity = (entity) => {
        // Restore selection
        if (currentSelectionRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(currentSelectionRange);

            const span = document.createElement('span');
            span.className = 'entity-highlight';
            span.dataset.entityId = entity.id;
            span.style.backgroundColor = hexToRgba(entity.color, 0.3);
            span.style.borderBottom = `2px solid ${entity.color}`;
            span.title = `${entity.type}: ${entity.name}`;

            try {
                currentSelectionRange.surroundContents(span);
            } catch (err) {
                console.error("Cannot wrap split selection:", err);
                alert("Please select text within a single block for tagging.");
            }
        }
        overlay.style.display = 'none';
    };

    overlay.appendChild(picker);

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    return overlay;
}
