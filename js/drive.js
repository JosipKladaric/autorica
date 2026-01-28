/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { getAccessToken } from './auth.js';
import { RateLimiter } from './utils/rateLimiter.js';
import { createMultipartBody } from './drive-utils.js';

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const APP_FOLDER_NAME = 'Autorica';

let gapiInitialized = false;
let autoricaFolderId = null;

// Rate limiter for Drive API
const driveRateLimiter = new RateLimiter();

export async function initDrive() {
    return new Promise((resolve, reject) => {
        if (typeof gapi === 'undefined') {
            // If script hasn't loaded yet, wait a bit
            const interval = setInterval(() => {
                if (typeof gapi !== 'undefined') {
                    clearInterval(interval);
                    loadGapiClient().then(resolve).catch(reject);
                }
            }, 100);
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(interval);
                reject(new Error("Google API Client (gapi) failed to load."));
            }, 5000);
        } else {
            loadGapiClient().then(resolve).catch(reject);
        }
    });
}

async function loadGapiClient() {
    await new Promise((resolve, reject) => {
        gapi.load('client', { callback: resolve, onerror: reject });
    });

    await gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
    });

    gapiInitialized = true;
    console.log('GAPI client initialized');

    // Attempt to set token if already logged in via auth.js
    try {
        const token = getAccessToken();
        if (token) {
            gapi.client.setToken({ access_token: token });
            console.log('Token sync to GAPI client');
        }
    } catch (e) {
        console.warn('Could not sync token on init', e);
    }
}

/**
 * Get or create the Autorica folder in the user's Drive
 */
async function getAutoricaFolder() {
    if (autoricaFolderId) return autoricaFolderId;

    // Search for existing Autorica folder
    const response = await gapi.client.drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.folder' and name = '${APP_FOLDER_NAME}' and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive'
    });

    if (response.result.files && response.result.files.length > 0) {
        autoricaFolderId = response.result.files[0].id;
        console.log('Found existing Autorica folder:', autoricaFolderId);
    } else {
        // Create the folder
        const folderMetadata = {
            name: APP_FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const folder = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id'
        });

        autoricaFolderId = folder.result.id;
        console.log('Created Autorica folder:', autoricaFolderId);
    }

    return autoricaFolderId;
}

/**
 * List all books (JSON files in the Autorica folder)
 */
export async function listBooks() {
    return driveRateLimiter.execute(async () => {
        if (!gapiInitialized) throw new Error('Drive API not initialized');

        try {
            const folderId = await getAutoricaFolder();

            const response = await gapi.client.drive.files.list({
                pageSize: 100,
                fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
                q: `'${folderId}' in parents and mimeType = 'application/json' and trashed = false`
            });

            return response.result.files || [];
        } catch (err) {
            console.error('Error listing books:', err);
            throw err;
        }
    });
}

/**
 * Create a new book (single JSON file in Autorica folder)
 */
export async function createBook(title) {
    if (!gapiInitialized) throw new Error('Drive API not initialized');

    try {
        const folderId = await getAutoricaFolder();

        // Create book data with embedded chapters
        const bookData = {
            id: crypto.randomUUID(),
            title: title,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            settings: {
                pageFormat: 'A4',
                font: 'Crimson Pro',
                fontSize: 12,
                theme: 'light'
            },
            chapters: [
                {
                    id: 'ch-1',
                    title: 'Chapter One',
                    text: '<p>It was a dark and stormy night...</p>',
                    created: new Date().toISOString()
                }
            ],
            characters: [],
            notes: ''
        };

        // Generate filename from title (sanitized)
        const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${sanitizedTitle}_${Date.now()}.json`;

        const file = await createFile(folderId, filename, JSON.stringify(bookData, null, 2));

        console.log('Book created successfully:', file.id);
        return { ...bookData, fileId: file.id };

    } catch (err) {
        console.error('Error creating book:', err);
        throw err;
    }
}

/**
 * Create a file in Drive
 */
export async function createFile(parentId, filename, content, mimeType = 'application/json') {
    return driveRateLimiter.execute(async () => {
        const boundary = '-------314159265358979323846';
        const metadata = {
            name: filename,
            parents: [parentId],
            mimeType: mimeType
        };

        const multipartRequestBody = createMultipartBody(metadata, content, boundary);

        const response = await gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: { uploadType: 'multipart' },
            headers: {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            body: multipartRequestBody
        });

        return response.result;
    });
}

/**
 * Read file content from Drive
 */
export async function readFile(fileId) {
    return driveRateLimiter.execute(async () => {
        if (!gapiInitialized) throw new Error('Drive API not initialized');

        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            return response.body;
        } catch (err) {
            console.error(`Error reading file ${fileId}:`, err);
            throw err;
        }
    });
}

/**
 * Update existing file content
 */
export async function updateFile(fileId, content) {
    return driveRateLimiter.execute(async () => {
        if (!gapiInitialized) throw new Error('Drive API not initialized');

        try {
            const response = await gapi.client.request({
                path: `https://www.googleapis.com/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'media' },
                body: content
            });
            return response;
        } catch (err) {
            console.error(`Error updating file ${fileId}:`, err);
            throw err;
        }
    });
}

/**
 * Delete a book file
 */
export async function deleteBook(fileId) {
    return driveRateLimiter.execute(async () => {
        if (!gapiInitialized) throw new Error('Drive API not initialized');

        try {
            await gapi.client.drive.files.delete({
                fileId: fileId
            });
            console.log('Book deleted:', fileId);
        } catch (err) {
            console.error('Error deleting book:', err);
            throw err;
        }
    });
}
