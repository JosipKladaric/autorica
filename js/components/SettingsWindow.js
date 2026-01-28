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
    header.innerHTML = '<span class="settings-title">Formatting &amp; Theme</span>';

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
    sizeSection.innerHTML = '<label class="section-label">Paper Type</label>';

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
    colorSection.innerHTML = '<label class="section-label">Paper Color</label>';

    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-grid';

    Object.entries(PAPER_COLORS).forEach(([name, hex]) => {
        const orb = document.createElement('div');
        orb.className = 'color-option';
        orb.style.backgroundColor = hex;
        orb.title = name;

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
    bgSection.innerHTML = '<label class="section-label">Desk Theme</label>';

    const bgGrid = document.createElement('div');
    bgGrid.className = 'color-grid';

    Object.entries(BACKGROUND_COLORS).forEach(([name, hex]) => {
        const orb = document.createElement('div');
        orb.className = 'color-option';
        orb.style.backgroundColor = hex;
        orb.title = name;

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
    fontSection.innerHTML = '<label class="section-label">Typography</label>';

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

    window.appendChild(content);
    overlay.appendChild(window);

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    return overlay;
}
