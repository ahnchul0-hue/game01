import { describe, it, expect } from 'vitest';
import { DIARY_ENTRIES, getUnlockedCount, getEntryProgress } from '../utils/DiaryData';

describe('DiaryData', () => {
    it('has 10 entries', () => {
        expect(DIARY_ENTRIES).toHaveLength(10);
    });

    it('entries are sorted by distance ascending', () => {
        for (let i = 1; i < DIARY_ENTRIES.length; i++) {
            expect(DIARY_ENTRIES[i].distance).toBeGreaterThanOrEqual(DIARY_ENTRIES[i - 1].distance);
        }
    });

    it('all entries have required fields', () => {
        for (const entry of DIARY_ENTRIES) {
            expect(entry.id).toBeGreaterThan(0);
            expect(entry.distance).toBeGreaterThanOrEqual(0);
            expect(entry.title.length).toBeGreaterThan(0);
            expect(entry.story.length).toBeGreaterThan(0);
            expect(['forest', 'river', 'village', 'onsen']).toContain(entry.stage);
        }
    });

    it('IDs are unique', () => {
        const ids = DIARY_ENTRIES.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('first entry unlocks at 0m', () => {
        expect(DIARY_ENTRIES[0].distance).toBe(0);
    });

    describe('getUnlockedCount', () => {
        it('returns 1 for 0m', () => {
            expect(getUnlockedCount(0)).toBe(1);
        });
        it('returns 3 for 500m', () => {
            expect(getUnlockedCount(500)).toBe(3);
        });
        it('returns 10 for 10000m', () => {
            expect(getUnlockedCount(10000)).toBe(10);
        });
        it('returns 10 for beyond max', () => {
            expect(getUnlockedCount(99999)).toBe(10);
        });
    });

    describe('getEntryProgress', () => {
        it('returns 1 for distance=0 entry', () => {
            expect(getEntryProgress(DIARY_ENTRIES[0], 0)).toBe(1);
        });
        it('returns 0.5 for halfway', () => {
            expect(getEntryProgress(DIARY_ENTRIES[3], 500)).toBe(0.5);
        });
        it('clamps at 1', () => {
            expect(getEntryProgress(DIARY_ENTRIES[1], 9999)).toBe(1);
        });
    });
});
