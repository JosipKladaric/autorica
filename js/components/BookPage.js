/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { appStore, PAPER_SIZES } from '../store.js';

export function LinkBookPage(pageId) {
    const container = document.createElement('div');
    container.className = 'book-page-container';
    container.id = `page-container-${pageId}`;

    const page = document.createElement('div');
    page.className = 'book-page';
    page.id = `page-${pageId}`;

    // Editable content area
    const content = document.createElement('div');
    content.className = 'book-content';
    content.contentEditable = true;
    content.setAttribute('placeholder', pageId === 1 ? 'Once upon a time...' : '');
    content.spellcheck = false;
    content.id = `content-${pageId}`;

    // Footer for page number
    const footer = document.createElement('div');
    footer.className = 'page-footer';
    footer.innerText = pageId;

    page.appendChild(content);
    page.appendChild(footer);
    container.appendChild(page);

    // Subscribe to store updates
    const updatePageStyle = (state) => {
        // Size
        const size = PAPER_SIZES[state.paperSize];
        if (size) {
            page.style.width = size.width;
            // Fixed height for pagination check
            page.style.height = size.height;
            page.style.minHeight = size.height;
        }

        // Color
        page.style.backgroundColor = state.paperColor;

        // Font
        content.style.fontFamily = state.fontFamily;
    };

    // Initial Sync
    updatePageStyle(appStore.getState());

    // Listen
    appStore.subscribe(updatePageStyle);

    return { container, page, content };
}
