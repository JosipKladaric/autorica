/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

/**
 * Focus Mode - Typewriter effect with dimmed paragraphs
 */
export class FocusMode {
    constructor(workspace) {
        this.workspace = workspace;
        this.isActive = false;
        this.currentParagraph = null;
    }

    toggle() {
        this.isActive = !this.isActive;

        if (this.isActive) {
            this.enable();
        } else {
            this.disable();
        }

        return this.isActive;
    }

    enable() {
        document.body.classList.add('focus-mode');
        this.updateFocus();

        // Track cursor position to update focus
        this.workspace.addEventListener('click', this.updateFocus.bind(this));
        this.workspace.addEventListener('keyup', this.updateFocus.bind(this));
    }

    disable() {
        document.body.classList.remove('focus-mode');

        // Remove dimming from all paragraphs
        const paragraphs = this.workspace.querySelectorAll('.book-content p');
        paragraphs.forEach(p => p.classList.remove('focused-paragraph'));
    }

    updateFocus() {
        if (!this.isActive) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const container = range.startContainer;

        // Find the parent paragraph
        let paragraph = container.nodeType === Node.TEXT_NODE
            ? container.parentElement
            : container;

        while (paragraph && paragraph.tagName !== 'P' && paragraph !== this.workspace) {
            paragraph = paragraph.parentElement;
        }

        if (paragraph && paragraph.tagName === 'P') {
            // Remove focus from previous paragraph
            if (this.currentParagraph && this.currentParagraph !== paragraph) {
                this.currentParagraph.classList.remove('focused-paragraph');
            }

            // Add focus to current paragraph
            paragraph.classList.add('focused-paragraph');
            this.currentParagraph = paragraph;

            // Scroll paragraph to center (typewriter effect)
            this.scrollToCenter(paragraph);
        }
    }

    scrollToCenter(element) {
        const elementRect = element.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const middle = absoluteElementTop - (window.innerHeight / 3);

        window.scrollTo({
            top: middle,
            behavior: 'smooth'
        });
    }
}
