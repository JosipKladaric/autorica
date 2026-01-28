/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { LinkBookPage } from './BookPage.js';

export class PageManager {
    constructor(workspaceElement) {
        this.workspace = workspaceElement;
        this.pages = []; // Array of page objects { id, contentEl, ... }
        this.counter = 0;
        this.isProcessing = false;
    }

    init() {
        this.addPage();
        this.lastInputTime = 0;
        this.isTyping = false;

        // Global input listener for checking overflow (SMART debounce)
        let overflowCheckTimer = null;
        let typingTimer = null;

        this.workspace.addEventListener('input', (e) => {
            this.lastInputTime = Date.now();
            this.isTyping = true;

            // Clear previous timers
            if (overflowCheckTimer) clearTimeout(overflowCheckTimer);
            if (typingTimer) clearTimeout(typingTimer);

            // Mark as not typing after 500ms of no input
            typingTimer = setTimeout(() => {
                this.isTyping = false;
            }, 500);

            // Only check overflow 1 second after typing stops
            overflowCheckTimer = setTimeout(() => {
                if (!this.isTyping) {
                    this.checkOverflow(e);
                }
            }, 1000);
        });
    }

    addPage() {
        this.counter++;
        const { container, page, content } = LinkBookPage(this.counter);
        this.workspace.appendChild(container);

        this.pages.push({
            id: this.counter,
            container,
            page,
            content
        });

        return content;
    }

    checkOverflow(e) {
        if (this.isProcessing) return;
        this.isProcessing = true; // Debounce/Lock

        // We only need to check the page where input happened, and subsequent pages if we shift content.
        // For simplicity, let's find the active page index.
        const activeContent = e.target.closest('.book-content');
        if (!activeContent) {
            this.isProcessing = false;
            return;
        }

        let pageIndex = this.pages.findIndex(p => p.content === activeContent);

        if (pageIndex !== -1) {
            this.propagateContent(pageIndex);
        }

        this.isProcessing = false;
    }

    propagateContent(startIndex) {
        // Iterate from startIndex onwards
        for (let i = startIndex; i < this.pages.length; i++) {
            const pageObj = this.pages[i];
            const contentEl = pageObj.content;
            const pageEl = pageObj.page;

            // Paper content height logic
            // We need to know the max height allowed for text.
            // Padding is 25mm top + 25mm bottom. 
            // We can check if scrollHeight > clientHeight of the CONTENT element? 
            // Or Page element?
            // In CSS, .book-page has padding. .book-content height is 100%.
            // If content overflows, .book-content scrollHeight will exceed .book-content clientHeight.

            while (contentEl.scrollHeight > contentEl.clientHeight) {
                // Content acts as a continuous block. We need to move the last child (node) to the next page.

                // Get last child node (could be text or element)
                let lastNode = contentEl.lastChild;
                if (!lastNode) break;

                // --- CURSOR TRACKING ---
                const selection = window.getSelection();
                let isFocused = false;
                let offset = 0;

                // Check if the user's cursor is inside the node we are about to move
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    // Check if the moved node contains the selection (startContainer usually)
                    if (lastNode === range.startContainer || lastNode.contains(range.startContainer)) {
                        isFocused = true;
                        offset = range.startOffset;
                    }
                }

                // Create next page if strictly needed
                let nextPageObj = this.pages[i + 1];
                if (!nextPageObj) {
                    this.addPage();
                    nextPageObj = this.pages[i + 1];
                }

                // Move node to next page (prepend)
                if (nextPageObj.content.firstChild) {
                    nextPageObj.content.insertBefore(lastNode, nextPageObj.content.firstChild);
                } else {
                    nextPageObj.content.appendChild(lastNode);
                }

                // --- CURSOR RESTORATION ---
                if (isFocused) {
                    // We need to set the cursor to the text node inside lastNode if it's an element,
                    // or lastNode itself if it's a TextNode.
                    const newRange = document.createRange();

                    // Simple Restoration: If it was a text node, restore offset.
                    // If complex element, might default to start.
                    if (lastNode.nodeType === Node.TEXT_NODE) {
                        newRange.setStart(lastNode, offset);
                        newRange.collapse(true);
                    } else {
                        // Fallback for elements
                        newRange.selectNodeContents(lastNode);
                        newRange.collapse(true); // to start
                    }

                    selection.removeAllRanges();
                    selection.addRange(newRange);

                    // Scroll into view if needed
                    lastNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            // If we moved stuff to next page, we must check next page for overflow too!
            // Loop continues.
        }
    }

    // Get all content as HTML string
    getAllContent() {
        return this.pages.map(p => p.content.innerHTML).join('');
    }

    // Load content into the first page (clears existing pages)
    loadContent(htmlContent) {
        // Clear all pages except first
        while (this.pages.length > 1) {
            const lastPage = this.pages.pop();
            lastPage.container.remove();
        }

        // Reset counter
        this.counter = this.pages.length;

        // Set content to first page
        if (this.pages[0]) {
            this.pages[0].content.innerHTML = htmlContent;
            // Trigger overflow check
            this.propagateContent(0);
        }
    }
}
