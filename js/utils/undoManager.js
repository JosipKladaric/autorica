/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { CONFIG } from '../constants.js';

/**
 * Undo/Redo manager using Command pattern
 */
export class UndoManager {
    constructor(maxHistory = CONFIG.UNDO_HISTORY_MAX) {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = maxHistory;
    }

    /**
     * Execute a command and add it to history
     */
    execute(command) {
        // Remove any redo history
        this.history = this.history.slice(0, this.currentIndex + 1);

        // DON'T execute the command here for content edits!
        // The content is already in the editor from user typing.
        // We just store it for undo/redo.
        // command.execute(); // REMOVED - this was causing cursor jumping!

        // Add to history
        this.history.push(command);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
    }

    /**
     * Undo the last command
     */
    undo() {
        if (!this.canUndo()) return false;

        const command = this.history[this.currentIndex];
        command.undo();
        this.currentIndex--;
        return true;
    }

    /**
     * Redo the next command
     */
    redo() {
        if (!this.canRedo()) return false;

        this.currentIndex++;
        const command = this.history[this.currentIndex];
        command.execute();
        return true;
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.currentIndex >= 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Clear history
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
    }
}

/**
 * Content edit command for page manager
 */
export class ContentEditCommand {
    constructor(pageManager, oldContent, newContent) {
        this.pageManager = pageManager;
        this.oldContent = oldContent;
        this.newContent = newContent;
    }

    execute() {
        this.pageManager.loadContent(this.newContent);
    }

    undo() {
        this.pageManager.loadContent(this.oldContent);
    }
}
