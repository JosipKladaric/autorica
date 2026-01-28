/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

import { appStore } from '../store.js';

/**
 * PDF Export using jsPDF
 * Note: This requires adding jsPDF library to index.html
 * Add: <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
 */

/**
 * Export current chapter or entire book to PDF
 */
export async function exportToPDF(content, options = {}) {
    const {
        title = 'Document',
        author = '',
        chapters = null, // Array of {title, text}
        includePageNumbers = true,
        includeStats = true
    } = options;

    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined') {
        throw new Error('jsPDF library not loaded. Please add it to index.html');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const state = appStore.getState();
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 25; // Match book page margins
    const contentWidth = pageWidth - (margin * 2);

    // Set font based on current settings
    let fontFamily = 'times'; // Default
    if (state.fontFamily.includes('Garamond')) fontFamily = 'times';
    else if (state.fontFamily.includes('Courier')) fontFamily = 'courier';
    else if (state.fontFamily.includes('Helvetica')) fontFamily = 'helvetica';

    doc.setFont(fontFamily);

    let yPosition = margin;
    let pageNumber = 1;

    // Helper to add new page
    const addNewPage = () => {
        doc.addPage();
        pageNumber++;
        yPosition = margin;
    };

    // Helper to add page numbers
    const addPageNumber = () => {
        if (includePageNumbers && pageNumber > 1) {
            doc.setFontSize(10);
            doc.setTextColor(128, 128, 128);
            doc.text(String(pageNumber - 1), pageWidth / 2, pageHeight - 15, { align: 'center' });
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
        }
    };

    // Title page
    doc.setFontSize(24);
    doc.text(title, pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

    if (author) {
        doc.setFontSize(14);
        doc.text(`by ${author}`, pageWidth / 2, pageHeight / 2, { align: 'center' });
    }

    addNewPage();

    // Process content
    const processChapter = (chapterTitle, chapterText) => {
        // Chapter title
        if (chapterTitle) {
            if (yPosition > margin + 10) {
                addNewPage(); // Start chapter on new page
            }

            doc.setFontSize(18);
            doc.setFont(fontFamily, 'bold');
            doc.text(chapterTitle, margin, yPosition);
            yPosition += 15;
            doc.setFont(fontFamily, 'normal');
            doc.setFontSize(12);
        }

        // Strip HTML and process text
        const cleanText = chapterText.replace(/<[^>]*>/g, '').trim();
        const paragraphs = cleanText.split(/\n\n+/);

        paragraphs.forEach(para => {
            const lines = doc.splitTextToSize(para.trim(), contentWidth);

            lines.forEach(line => {
                if (yPosition > pageHeight - margin - 20) {
                    addPageNumber();
                    addNewPage();
                }

                doc.text(line, margin, yPosition);
                yPosition += 7; // Line height
            });

            yPosition += 5; // Paragraph spacing
        });
    };

    // Export chapters or single content
    if (chapters && Array.isArray(chapters)) {
        chapters.forEach(chapter => {
            processChapter(chapter.title, chapter.text);
        });
    } else {
        processChapter('', content);
    }

    // Add final page number
    addPageNumber();

    // Statistics page (optional)
    if (includeStats && chapters) {
        addNewPage();
        doc.setFontSize(16);
        doc.text('Book Statistics', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        const stats = calculateBookStats(chapters);
        const statsText = [
            `Chapters: ${chapters.length}`,
            `Total Words: ${stats.totalWords.toLocaleString()}`,
            `Total Characters: ${stats.totalCharacters.toLocaleString()}`,
            `Estimated Reading Time: ${stats.readingTime}`,
            `Average Words per Chapter: ${stats.avgWordsPerChapter.toLocaleString()}`
        ];

        statsText.forEach(stat => {
            doc.text(stat, margin, yPosition);
            yPosition += 6;
        });
    }

    // Save the PDF
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(filename);

    return filename;
}

/**
 * Calculate book statistics for PDF
 */
function calculateBookStats(chapters) {
    let totalWords = 0;
    let totalCharacters = 0;

    chapters.forEach(chapter => {
        const text = chapter.text.replace(/<[^>]*>/g, '');
        totalWords += text.split(/\s+/).filter(w => w.length > 0).length;
        totalCharacters += text.length;
    });

    const readingMinutes = Math.ceil(totalWords / 250);
    const hours = Math.floor(readingMinutes / 60);
    const mins = readingMinutes % 60;
    const readingTime = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

    return {
        totalWords,
        totalCharacters,
        readingTime,
        avgWordsPerChapter: Math.round(totalWords / chapters.length)
    };
}

/**
 * Show PDF export dialog
 */
export function showPDFExportDialog(currentBook, currentChapter) {
    const overlay = document.createElement('div');
    overlay.className = 'pdf-export-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;

    dialog.innerHTML = `
        <h2 style="margin: 0 0 16px 0; font-size: 20px;">Export to PDF</h2>
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px;">
                <input type="radio" name="export-scope" value="chapter" checked>
                Current Chapter Only
            </label>
            <label style="display: block; margin-bottom: 8px;">
                <input type="radio" name="export-scope" value="book">
                Entire Book
            </label>
        </div>
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-size: 14px;">Author Name (optional):</label>
            <input type="text" id="pdf-author" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; font-size: 14px;">
                <input type="checkbox" id="pdf-page-numbers" checked style="margin-right: 8px;">
                Include page numbers
            </label>
            <label style="display: flex; align-items: center; font-size: 14px; margin-top: 8px;">
                <input type="checkbox" id="pdf-stats" checked style="margin-right: 8px;">
                Include statistics page
            </label>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="pdf-cancel" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="pdf-export" style="padding: 8px 16px; border: none; background: #3b82f6; color: white; border-radius: 6px; cursor: pointer;">Export PDF</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Handle cancel
    dialog.querySelector('#pdf-cancel').onclick = () => overlay.remove();
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Handle export
    dialog.querySelector('#pdf-export').onclick = async () => {
        const scope = dialog.querySelector('input[name="export-scope"]:checked').value;
        const author = dialog.querySelector('#pdf-author').value;
        const includePageNumbers = dialog.querySelector('#pdf-page-numbers').checked;
        const includeStats = dialog.querySelector('#pdf-stats').checked;

        const exportBtn = dialog.querySelector('#pdf-export');
        exportBtn.textContent = 'Exporting...';
        exportBtn.disabled = true;

        try {
            if (scope === 'chapter') {
                await exportToPDF(currentChapter.text, {
                    title: currentChapter.title || 'Chapter',
                    author,
                    includePageNumbers,
                    includeStats: false
                });
            } else {
                await exportToPDF('', {
                    title: currentBook.title,
                    author,
                    chapters: currentBook.chapters,
                    includePageNumbers,
                    includeStats
                });
            }

            overlay.remove();
        } catch (err) {
            alert('PDF export failed: ' + err.message);
            exportBtn.textContent = 'Export PDF';
            exportBtn.disabled = false;
        }
    };
}
