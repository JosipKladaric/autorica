/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

/**
 * Helper to construct a multipart/related body for Google Drive API
 * (Required to upload metadata + content in one go)
 */
export function createMultipartBody(metadata, content, boundary) {
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const base64Content = btoa(content); // Encode text to Base64

    return delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Content +
        close_delim;
}
