/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

// Configuration
// IMPORTANT: This needs to be replaced with the actual Client ID from the Google Cloud Console
const GOOGLE_CLIENT_ID = '1037042768683-na45tls3sc9egkr0pf0h1dal4vchs10b.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;
let tokenExpirationTime = 0;

/**
 * Initialize the Google Identity Services client
 */
export async function initAuth() {
    if (tryRestoreSession()) {
        // Even if session is restored, we need to init the client for future token requests/revocation
        const interval = setInterval(() => {
            if (typeof google !== 'undefined' && google.accounts) {
                clearInterval(interval);
                setupTokenClient();
            }
        }, 100);
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        try {
            // Wait for the GIS library to load
            if (typeof google === 'undefined') {
                // If script hasn't loaded yet, wait a bit
                const interval = setInterval(() => {
                    if (typeof google !== 'undefined' && google.accounts) {
                        clearInterval(interval);
                        setupTokenClient();
                        resolve();
                    }
                }, 100);
                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error("Google Identity Services failed to load."));
                }, 5000);
            } else {
                setupTokenClient();
                resolve();
            }
        } catch (err) {
            reject(err);
        }
    });
}

function setupTokenClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
                console.error(tokenResponse);
                throw tokenResponse;
            }

            accessToken = tokenResponse.access_token;
            // Calculate expiration time (usually 1 hour)
            tokenExpirationTime = Date.now() + (Number(tokenResponse.expires_in) * 1000);

            // Persist to session storage
            sessionStorage.setItem('autorica_token', accessToken);
            sessionStorage.setItem('autorica_token_expiry', tokenExpirationTime.toString());

            console.log('Access token received');

            // Set token for Drive API if initialized
            if (typeof gapi !== 'undefined' && gapi.client) {
                gapi.client.setToken({ access_token: accessToken });
            }

            // Dispatch a custom event so the app knows auth is successful
            window.dispatchEvent(new CustomEvent('autorica:auth-success'));
        },
    });
}

/**
 * Trigger the login flow
 */
export function requestLogin() {
    if (!tokenClient) {
        console.error('Auth not initialized');
        return;
    }

    // Skip if token is valid
    if (accessToken && Date.now() < tokenExpirationTime) {
        // Ensure GAPI has the token
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken({ access_token: accessToken });
        }
        window.dispatchEvent(new CustomEvent('autorica:auth-success'));
        return;
    }

    // Request a new token
    // prompt: '' will try to silently refresh without popup if possible, 
    // but for initial login we might want 'consent' or not specify it.
    tokenClient.requestAccessToken({ prompt: '' });
}

/**
 * Check if we have a valid access token
 */
export function checkLoginStatus() {
    return !!(accessToken && Date.now() < tokenExpirationTime);
}

/**
 * Get the current access token
 */
export function getAccessToken() {
    return accessToken;
}

/**
 * Logout - revoke token
 */
export function logout() {
    const token = accessToken;
    if (token) {
        google.accounts.oauth2.revoke(token, () => {
            console.log('Token revoked');
        });
        // Clear gapi token
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken(null);
        }
    }
    accessToken = null;
    tokenExpirationTime = 0;
    sessionStorage.removeItem('autorica_token');
    sessionStorage.removeItem('autorica_token_expiry');
    window.dispatchEvent(new CustomEvent('autorica:logout'));
}

function tryRestoreSession() {
    const storedToken = sessionStorage.getItem('autorica_token');
    const storedExpiry = sessionStorage.getItem('autorica_token_expiry');

    if (storedToken && storedExpiry) {
        if (Date.now() < Number(storedExpiry)) {
            accessToken = storedToken;
            tokenExpirationTime = Number(storedExpiry);
            console.log('Session restored from storage');
            // NOTE: We do NOT dispatch 'auth-success' here to avoid race conditions with initDrive.
            // app.js will check login status manually after initialization completes.
            return true;
        } else {
            sessionStorage.removeItem('autorica_token');
            sessionStorage.removeItem('autorica_token_expiry');
        }
    }
    return false;
}
