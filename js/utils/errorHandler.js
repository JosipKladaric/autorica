/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

/**
 * Centralized error handling utility
 */
export class ErrorHandler {
    /**
     * Handle an error with context and user notification
     */
    static handle(error, context = '') {
        console.error(`[${context}]`, error);

        // Show user-friendly notification
        this.showUserNotification({
            type: 'error',
            message: this.getUserMessage(error),
            duration: 5000
        });
    }

    /**
     * Convert error to user-friendly message
     */
    static getUserMessage(error) {
        const message = error.message || error.toString();

        if (message.includes('401') || message.includes('auth') || message.includes('token')) {
            return 'Session expired. Please log in again.';
        }
        if (message.includes('network') || message.includes('fetch') || message.includes('Failed to fetch')) {
            return 'Network error. Please check your connection.';
        }
        if (message.includes('quota') || message.includes('rate limit')) {
            return 'Too many requests. Please wait a moment.';
        }
        if (message.includes('not found')) {
            return 'File not found. It may have been deleted.';
        }

        return 'Something went wrong. Please try again.';
    }

    /**
     * Show a toast notification to the user
     */
    static showUserNotification({ type, message, duration = 5000 }) {
        // Remove any existing toasts
        document.querySelectorAll('.error-toast').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = `error-toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#ef4444' : '#10b981'};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            max-width: 400px;
            animation: slideUp 0.3s ease-out;
        `;

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span>${type === 'error' ? '⚠️' : '✓'}</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; padding: 0; margin-left: 8px;">×</button>
            </div>
        `;

        document.body.appendChild(toast);

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from {
                    transform: translateX(-50%) translateY(20px);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }
        `;
        if (!document.querySelector('#error-toast-styles')) {
            style.id = 'error-toast-styles';
            document.head.appendChild(style);
        }

        setTimeout(() => toast.remove(), duration);
    }

    /**
     * Show success message
     */
    static success(message) {
        this.showUserNotification({
            type: 'success',
            message,
            duration: 3000
        });
    }
}
