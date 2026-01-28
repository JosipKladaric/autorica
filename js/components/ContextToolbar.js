/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

export function ContextToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'context-toolbar';
    toolbar.style.display = 'none'; // Hidden by default

    // Helper to create buttons
    const createBtn = (icon, action, tooltip) => {
        const btn = document.createElement('button');
        btn.className = 'toolbar-btn';
        btn.innerHTML = icon;
        btn.title = tooltip || '';
        btn.onmousedown = (e) => {
            e.preventDefault(); // Prevent losing focus
            action(e);
        };
        return btn;
    };

    const createSeparator = () => {
        const sep = document.createElement('div');
        sep.className = 'toolbar-sep';
        return sep;
    };

    // --- SECTION 1: STRUCTURE (Titles) ---
    const sectionStructure = document.createElement('div');
    sectionStructure.className = 'toolbar-section';

    sectionStructure.appendChild(createBtn('Title', () => document.execCommand('formatBlock', false, 'H1'), 'Chapter Title'));
    sectionStructure.appendChild(createBtn('Subtitle', () => document.execCommand('formatBlock', false, 'H2'), 'Subtitle'));
    sectionStructure.appendChild(createBtn('Text', () => document.execCommand('formatBlock', false, 'P'), 'Normal Text'));

    toolbar.appendChild(sectionStructure);
    toolbar.appendChild(createSeparator());

    // --- SECTION 2: FORMATTING (B, I, Size, Align) ---
    const sectionFormat = document.createElement('div');
    sectionFormat.className = 'toolbar-section';

    sectionFormat.appendChild(createBtn('<b>B</b>', () => document.execCommand('bold', false, null), 'Bold'));
    sectionFormat.appendChild(createBtn('<i>I</i>', () => document.execCommand('italic', false, null), 'Italic'));

    // Font Size (Incremental)
    // browser execCommand fontSize is 1-7. Default is 3.
    sectionFormat.appendChild(createBtn('A+', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // Get actual computed font size of selected text
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        // Try to get current fontSize value, default to middle (4) if not set
        let size = parseInt(document.queryCommandValue('fontSize'));
        if (!size || isNaN(size)) {
            size = 4; // Default to medium-large instead of 3
        }

        if (size < 7) document.execCommand('fontSize', false, size + 1);
    }, 'Increase Size'));

    sectionFormat.appendChild(createBtn('A-', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // Get actual computed font size of selected text
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

        // Try to get current fontSize value, default to middle (4) if not set
        let size = parseInt(document.queryCommandValue('fontSize'));
        if (!size || isNaN(size)) {
            size = 4; // Default to medium-large instead of 3
        }

        if (size > 1) document.execCommand('fontSize', false, size - 1);
    }, 'Decrease Size'));

    // Align Center
    sectionFormat.appendChild(createBtn('equiv;', () => document.execCommand('justifyCenter', false, null), 'Center'));
    sectionFormat.appendChild(createBtn('≡', () => document.execCommand('justifyLeft', false, null), 'Left'));

    toolbar.appendChild(sectionFormat);
    toolbar.appendChild(createSeparator());

    // --- SECTION 3: METADATA (Char, Tag) ---
    const sectionMeta = document.createElement('div');
    sectionMeta.className = 'toolbar-section';

    sectionMeta.appendChild(createBtn('👤', () => {
        // Dispatch event or callback to open Character Picker
        const event = new CustomEvent('open-entity-picker', { detail: { type: 'character' } });
        window.dispatchEvent(event);
    }, 'Mark as Character'));

    sectionMeta.appendChild(createBtn('🏷️', () => {
        // Dispatch event or callback to open Tag Picker
        const event = new CustomEvent('open-entity-picker', { detail: { type: 'tag' } });
        window.dispatchEvent(event);
    }, 'Add Tag'));

    toolbar.appendChild(sectionMeta);

    // --- LOGIC: POSITIONING ---
    const updatePosition = () => {
        const selection = window.getSelection();
        if (selection.rangeCount === 0 || selection.isCollapsed) {
            toolbar.style.display = 'none';
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Check if selection is inside workspace
        if (rect.top === 0 && rect.bottom === 0) {
            toolbar.style.display = 'none';
            return;
        }

        toolbar.style.display = 'flex';
        // Position above selection
        toolbar.style.top = `${rect.top - 50 + window.scrollY}px`;
        // Center horizontally
        toolbar.style.left = `${rect.left + (rect.width / 2) - (toolbar.offsetWidth / 2)}px`;
    };

    // Listeners attached to document in main.js will call updatePosition
    // But we can attach a self-update helper
    toolbar.update = updatePosition;

    return toolbar;
}
