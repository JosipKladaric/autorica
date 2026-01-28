/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

/**
 * Text analysis and statistics utilities
 */

const AVERAGE_READING_SPEED_WPM = 250; // Average adult reading speed

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(text) {
    const words = countWords(text);
    const minutes = Math.ceil(words / AVERAGE_READING_SPEED_WPM);
    return minutes;
}

/**
 * Format reading time as human-readable string
 */
export function formatReadingTime(minutes) {
    if (minutes < 1) return '< 1 min';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
        return hours === 1 ? '1 hour' : `${hours} hours`;
    }

    return `${hours}h ${mins}m`;
}

/**
 * Count words in text (strips HTML)
 */
export function countWords(text) {
    const cleanText = text
        .replace(/<[^>]*>/g, '') // Strip HTML
        .trim();

    if (!cleanText) return 0;

    return cleanText.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Count characters (excluding HTML)
 */
export function countCharacters(text) {
    return text.replace(/<[^>]*>/g, '').length;
}

/**
 * Count sentences
 */
export function countSentences(text) {
    const cleanText = text.replace(/<[^>]*>/g, '');
    const sentences = cleanText.match(/[.!?]+/g);
    return sentences ? sentences.length : 0;
}

/**
 * Count paragraphs
 */
export function countParagraphs(text) {
    const cleanText = text.replace(/<[^>]*>/g, '').trim();
    if (!cleanText) return 0;

    const paragraphs = cleanText.split(/\n\n+/);
    return paragraphs.filter(p => p.trim().length > 0).length;
}

/**
 * Calculate average words per sentence
 */
export function averageWordsPerSentence(text) {
    const words = countWords(text);
    const sentences = countSentences(text);

    if (sentences === 0) return 0;
    return Math.round(words / sentences);
}

/**
 * Get comprehensive chapter statistics
 */
export function getChapterStats(text) {
    const words = countWords(text);
    const characters = countCharacters(text);
    const sentences = countSentences(text);
    const paragraphs = countParagraphs(text);
    const readingTime = calculateReadingTime(text);
    const avgWordsPerSentence = averageWordsPerSentence(text);

    return {
        words,
        characters,
        sentences,
        paragraphs,
        readingTime,
        readingTimeFormatted: formatReadingTime(readingTime),
        avgWordsPerSentence,
        charactersWithSpaces: text.replace(/<[^>]*>/g, '').length,
        charactersNoSpaces: text.replace(/<[^>]*>/g, '').replace(/\s/g, '').length
    };
}

/**
 * Get book-level statistics from all chapters
 */
export function getBookStats(chapters) {
    const stats = {
        totalWords: 0,
        totalCharacters: 0,
        totalSentences: 0,
        totalParagraphs: 0,
        totalReadingTime: 0,
        chapters: []
    };

    chapters.forEach((chapter, index) => {
        const chapterStats = getChapterStats(chapter.text || '');
        stats.totalWords += chapterStats.words;
        stats.totalCharacters += chapterStats.characters;
        stats.totalSentences += chapterStats.sentences;
        stats.totalParagraphs += chapterStats.paragraphs;
        stats.totalReadingTime += chapterStats.readingTime;

        stats.chapters.push({
            index,
            title: chapter.title,
            ...chapterStats
        });
    });

    stats.totalReadingTimeFormatted = formatReadingTime(stats.totalReadingTime);
    stats.avgWordsPerChapter = Math.round(stats.totalWords / (chapters.length || 1));

    return stats;
}
