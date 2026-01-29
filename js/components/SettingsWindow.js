/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { appStore, PAPER_SIZES, PAPER_COLORS, BACKGROUND_COLORS, FONTS } from '../store.js';

export function SettingsWindow() {
    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.style.display = 'none'; // Hidden by default

    const window = document.createElement('div');
    window.className = 'settings-window';

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.innerHTML = '<span class="settings-title">Postavke Izgleda</span>';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'settings-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => { overlay.style.display = 'none'; };

    header.appendChild(closeBtn);
    window.appendChild(header);

    // Content Container
    const content = document.createElement('div');
    content.className = 'settings-content';

    // --- Paper Size Section ---
    const sizeSection = document.createElement('div');
    sizeSection.className = 'settings-section';
    sizeSection.innerHTML = '<label class="section-label">Tip Papira</label>';

    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'sidebar-select'; // Reusing sidebar styles for now

    Object.keys(PAPER_SIZES).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.innerText = PAPER_SIZES[key].label;
        if (key === appStore.getState().paperSize) option.selected = true;
        sizeSelect.appendChild(option);
    });

    sizeSelect.addEventListener('change', (e) => {
        appStore.setState({ paperSize: e.target.value });
    });

    sizeSection.appendChild(sizeSelect);
    content.appendChild(sizeSection);

    // --- Paper Color Section ---
    const colorSection = document.createElement('div');
    colorSection.className = 'settings-section';
    colorSection.innerHTML = '<label class="section-label">Boja Papira</label>';

    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-grid';

    Object.entries(PAPER_COLORS).forEach(([name, hex]) => {
        const orb = document.createElement('div');
        orb.className = 'color-option';
        orb.style.backgroundColor = hex;
        orb.title = name;
        orb.dataset.hex = hex;

        orb.addEventListener('click', () => {
            document.querySelectorAll('.settings-window .color-option').forEach(el => el.classList.remove('selected'));
            orb.classList.add('selected');
            appStore.setState({ paperColor: hex });
        });

        if (hex === appStore.getState().paperColor) orb.classList.add('selected');
        colorGrid.appendChild(orb);
    });

    colorSection.appendChild(colorGrid);
    content.appendChild(colorSection);

    // --- Background Theme Section ---
    const bgSection = document.createElement('div');
    bgSection.className = 'settings-section';
    bgSection.innerHTML = '<label class="section-label">Tema Stola</label>';

    const bgGrid = document.createElement('div');
    bgGrid.className = 'color-grid';

    Object.entries(BACKGROUND_COLORS).forEach(([name, hex]) => {
        const orb = document.createElement('div');
        orb.className = 'color-option';
        orb.style.backgroundColor = hex;
        orb.title = name;
        orb.dataset.hex = hex;

        orb.addEventListener('click', () => {
            appStore.setState({ backgroundColor: hex });
        });

        bgGrid.appendChild(orb);
    });

    bgSection.appendChild(bgGrid);
    content.appendChild(bgSection);

    // --- Font Section ---
    const fontSection = document.createElement('div');
    fontSection.className = 'settings-section';
    fontSection.innerHTML = '<label class="section-label">Tipografija</label>';

    const fontSelect = document.createElement('select');
    fontSelect.className = 'sidebar-select';

    FONTS.forEach(font => {
        const option = document.createElement('option');
        option.value = font.value;
        option.innerText = font.name;
        option.style.fontFamily = font.value;
        if (font.value === appStore.getState().fontFamily) option.selected = true;
        fontSelect.appendChild(option);
    });

    fontSelect.addEventListener('change', (e) => {
        appStore.setState({ fontFamily: e.target.value });
    });

    fontSection.appendChild(fontSelect);
    content.appendChild(fontSection);

    // --- Export Section ---
    const exportSection = document.createElement('div');
    exportSection.className = 'settings-section';
    exportSection.innerHTML = '<label class="section-label">Izvoz</label>';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn btn-primary';
    exportBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: background 0.2s;
    `;
    exportBtn.textContent = '📄 Izvezi kao PDF';
    exportBtn.onmouseover = () => exportBtn.style.background = '#2563eb';
    exportBtn.onmouseout = () => exportBtn.style.background = '#3b82f6';
    exportBtn.onclick = () => {
        // Dispatch a custom event that the editor can listen to
        document.body.dispatchEvent(new CustomEvent('autorica:export-pdf'));
        overlay.style.display = 'none';
    };

    exportSection.appendChild(exportBtn);
    content.appendChild(exportSection);

    window.appendChild(content);
    overlay.appendChild(window);

    // Sync UI with Store
    const updateUI = (state) => {
        if (!state) return;

        // Paper Size
        sizeSelect.value = state.paperSize || 'A5';

        // Paper Color
        document.querySelectorAll('.settings-window .color-option').forEach(el => {
            el.classList.remove('selected');
            // Check both paper and bg grids
            if (el.parentElement === colorGrid && el.dataset.hex === state.paperColor) {
                el.classList.add('selected');
            }
            if (el.parentElement === bgGrid && el.dataset.hex === state.backgroundColor) {
                el.classList.add('selected');
            }
        });

        // Font
        fontSelect.value = state.fontFamily || 'Crimson Pro';
    };

    // Initial sync
    updateUI(appStore.getState());

    // Subscribe
    appStore.subscribe(updateUI);

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    return overlay;
}
