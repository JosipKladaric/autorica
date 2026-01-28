/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

// Application Configuration Constants
export const CONFIG = {
    // Autosave and persistence
    AUTOSAVE_DELAY_MS: 2000,
    SETTINGS_SAVE_DELAY_MS: 1000,

    // UI updates
    ENTITY_SCAN_INTERVAL_MS: 2000,
    PAGE_OVERFLOW_CHECK_DEBOUNCE_MS: 300,
    WORD_COUNT_UPDATE_DELAY_MS: 500,

    // Typography
    TYPOGRAPHY: {
        BOOK_CONTENT_FONT_SIZE: '19px',
        LINE_HEIGHT: 1.6,
    },

    // Drive API
    DRIVE_API: {
        MAX_RETRIES: 3,
        RETRY_DELAY_MS: 1000,
        MAX_REQUESTS_PER_SECOND: 10,
    },

    // Editor
    UNDO_HISTORY_MAX: 50,
};
