/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let gapiInited = false;


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

    gapiInited = true;
    console.log('GAPI client initialized');

    // Attempt to set token if already logged in via auth.js
    try {
        const { getAccessToken } = await import('./auth.js');
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
 * List files created by this app
 */
export async function listBooks() {
    if (!gapiInited) throw new Error('Drive API not initialized');

    try {
        const response = await gapi.client.drive.files.list({
            'pageSize': 100,
            'fields': 'files(id, name, mimeType, createdTime, modifiedTime)',
            'q': "mimeType = 'application/json' and name = 'book.json' and trashed = false"
        });
        return response.result.files;
    } catch (err) {
        console.error('Error listing books:', err);
        throw err;
    }
}

/**
 * Create a new book (Folder + book.json + chapter_01.json)
 */
export async function createBook(title) {
    if (!gapiInited) throw new Error('Drive API not initialized');

    try {
        // 1. Create Folder
        const folderId = await createFolder(title);

        // 2. Create book.json
        const bookMetadata = {
            id: crypto.randomUUID(),
            title: title,
            created: new Date().toISOString(),
            settings: {
                pageFormat: 'A4', // Default
                font: 'Inter',
                fontSize: 12,
                theme: 'dark'
            },
            characters: [],
            chapters: [
                { id: 'ch-1', title: 'Chapter One', file: 'chapter_01.json' }
            ]
        };

        await createFile('book.json', folderId, JSON.stringify(bookMetadata, null, 2));

        // 3. Create chapter_01.json
        const chapterContent = {
            id: 'ch-1',
            title: 'Chapter One',
            text: 'It was a dark and stormy night...'
        };

        await createFile('chapter_01.json', folderId, JSON.stringify(chapterContent, null, 2));

        console.log('Book created successfully');
        return bookMetadata;

    } catch (err) {
        console.error('Error creating book:', err);
        throw err;
    }
}

async function createFolder(name) {
    const fileMetadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    };

    const response = await gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id'
    });

    return response.result.id;
}

import { createMultipartBody } from './drive-utils.js';

export async function createFile(name, parentId, content) {
    const boundary = '-------314159265358979323846';
    const metadata = {
        name: name,
        parents: [parentId],
        mimeType: 'application/json'
    };

    const multipartRequestBody = createMultipartBody(metadata, content, boundary);

    const response = await gapi.client.request({
        'path': '/upload/drive/v3/files',
        'method': 'POST',
        'params': { 'uploadType': 'multipart' },
        'headers': {
            'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
    });

    return response.result;
}

/**
 * Read file content from Drive
 */
export async function readFile(fileId) {
    if (!gapiInited) throw new Error('Drive API not initialized');

    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        return response.result;
    } catch (err) {
        console.error(`Error reading file ${fileId}:`, err);
        throw err;
    }
}

/**
 * Update existing file content
 */
export async function updateFile(fileId, content) {
    if (!gapiInited) throw new Error('Drive API not initialized');

    try {
        const response = await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: content
        });
        return response.result;
    } catch (err) {
        console.error(`Error updating file ${fileId}:`, err);
        throw err;
    }
}
