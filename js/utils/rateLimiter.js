/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { CONFIG } from '../constants.js';

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
    constructor(maxRequests = CONFIG.DRIVE_API.MAX_REQUESTS_PER_SECOND, perSeconds = 1) {
        this.maxRequests = maxRequests;
        this.perSeconds = perSeconds;
        this.queue = [];
    }

    /**
     * Execute a function with rate limiting
     */
    async execute(fn) {
        // Remove requests older than perSeconds
        const now = Date.now();
        this.queue = this.queue.filter(time => now - time < this.perSeconds * 1000);

        // If at limit, wait
        if (this.queue.length >= this.maxRequests) {
            const oldestRequest = this.queue[0];
            const waitTime = this.perSeconds * 1000 - (now - oldestRequest);
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            // Clean queue again after waiting
            const afterWait = Date.now();
            this.queue = this.queue.filter(time => afterWait - time < this.perSeconds * 1000);
        }

        // Execute and track
        this.queue.push(Date.now());
        return fn();
    }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff(fn, maxRetries = CONFIG.DRIVE_API.MAX_RETRIES, baseDelay = CONFIG.DRIVE_API.RETRY_DELAY_MS) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Don't retry on certain errors
            if (error.message?.includes('401') || error.message?.includes('403')) {
                throw error; // Auth errors shouldn't retry
            }

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
