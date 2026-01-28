/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { appStore } from '../store.js';

export function NotesPaper() {
    const container = document.createElement('div');
    container.className = 'notes-paper';

    // Title / Header
    const header = document.createElement('div');
    header.className = 'notes-header';
    header.innerHTML = 'Notes';
    container.appendChild(header);

    // Text Area
    const textarea = document.createElement('textarea');
    textarea.className = 'notes-content';
    textarea.placeholder = 'Jot down your ideas here...';
    textarea.spellcheck = false;

    // Load initial state
    const state = appStore.getState();
    textarea.value = state.notesContent || '';

    // Update store on input
    textarea.addEventListener('input', (e) => {
        appStore.updateNotes(e.target.value);
    });

    container.appendChild(textarea);

    return container;
}
