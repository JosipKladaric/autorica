/* 
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 */

/**
 * Writing Streaks & Goals Manager
 */
export class WritingStreaks {
    constructor() {
        this.storageKey = 'autorica_writing_streaks';
        this.data = this.load();
    }

    load() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            return JSON.parse(stored);
        }

        return {
            dailyGoal: 500, // words
            currentStreak: 0,
            longestStreak: 0,
            totalWords: 0,
            history: {}, // { 'YYYY-MM-DD': wordCount }
            milestones: [] // achievements
        };
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    /**
     * Record words written today
     */
    recordWords(wordCount) {
        const today = this.getToday();

        // Update today's count
        this.data.history[today] = wordCount;
        this.data.totalWords += wordCount;

        // Update streak
        this.updateStreak();

        // Check for milestones
        this.checkMilestones(wordCount);

        this.save();
    }

    getToday() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    getYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    updateStreak() {
        const today = this.getToday();
        const yesterday = this.getYesterday();

        const wroteToday = (this.data.history[today] || 0) >= this.data.dailyGoal;
        const wroteYesterday = (this.data.history[yesterday] || 0) >= this.data.dailyGoal;

        if (wroteToday) {
            if (wroteYesterday || this.data.currentStreak === 0) {
                this.data.currentStreak++;
            } else {
                // Streak broken, start new
                this.data.currentStreak = 1;
            }

            if (this.data.currentStreak > this.data.longestStreak) {
                this.data.longestStreak = this.data.currentStreak;
            }
        }
    }

    checkMilestones(wordCount) {
        const milestones = [
            { id: 'first_100', words: 100, title: 'First 100 Words', emoji: '🌱' },
            { id: 'first_1000', words: 1000, title: 'First 1,000 Words', emoji: '📝' },
            { id: 'first_10k', words: 10000, title: 'First 10,000 Words', emoji: '🎯' },
            { id: 'first_50k', words: 50000, title: 'NaNoWriMo!', emoji: '🏆' },
            { id: 'first_100k', words: 100000, title: 'First Novel Length', emoji: '📚' },
            { id: 'streak_7', streak: 7, title: '7-Day Streak', emoji: '🔥' },
            { id: 'streak_30', streak: 30, title: '30-Day Streak', emoji: '💪' },
            { id: 'streak_100', streak: 100, title: '100-Day Streak', emoji: '🌟' }
        ];

        const newMilestones = [];

        milestones.forEach(milestone => {
            const alreadyAchieved = this.data.milestones.includes(milestone.id);

            if (!alreadyAchieved) {
                let achieved = false;

                if (milestone.words && this.data.totalWords >= milestone.words) {
                    achieved = true;
                }

                if (milestone.streak && this.data.currentStreak >= milestone.streak) {
                    achieved = true;
                }

                if (achieved) {
                    this.data.milestones.push(milestone.id);
                    newMilestones.push(milestone);
                }
            }
        });

        return newMilestones; // Return so we can show celebrations
    }

    /**
     * Get calendar data for heatmap
     */
    getCalendarData(monthsBack = 3) {
        const data = [];
        const today = new Date();

        for (let i = monthsBack * 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            data.push({
                date: dateStr,
                count: this.data.history[dateStr] || 0,
                metGoal: (this.data.history[dateStr] || 0) >= this.data.dailyGoal
            });
        }

        return data;
    }

    /**
     * Set daily word goal
     */
    setDailyGoal(words) {
        this.data.dailyGoal = words;
        this.save();
    }

    /**
     * Get current stats
     */
    getStats() {
        const today = this.getToday();

        return {
            todayWords: this.data.history[today] || 0,
            dailyGoal: this.data.dailyGoal,
            currentStreak: this.data.currentStreak,
            longestStreak: this.data.longestStreak,
            totalWords: this.data.totalWords,
            goalProgress: Math.min(100, ((this.data.history[today] || 0) / this.data.dailyGoal) * 100)
        };
    }
}

export const writingStreaks = new WritingStreaks();
