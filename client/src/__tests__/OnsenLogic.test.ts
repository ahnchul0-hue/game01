import { describe, it, expect } from 'vitest';
import {
    getOnsenLevel,
    getOnsenLevelIndex,
    getTotalItems,
    isSkinUnlocked,
    type UnlockStats,
} from '../utils/OnsenLogic';

describe('getOnsenLevel', () => {
    it('returns basic for 0 items', () => {
        expect(getOnsenLevel(0)).toBe('basic');
    });

    it('returns basic for 2 items', () => {
        expect(getOnsenLevel(2)).toBe('basic');
    });

    it('returns forest for 3 items', () => {
        expect(getOnsenLevel(3)).toBe('forest');
    });

    it('returns forest for 5 items', () => {
        expect(getOnsenLevel(5)).toBe('forest');
    });

    it('returns snow for 6 items', () => {
        expect(getOnsenLevel(6)).toBe('snow');
    });

    it('returns snow for 9 items', () => {
        expect(getOnsenLevel(9)).toBe('snow');
    });

    it('returns luxury for 10 items', () => {
        expect(getOnsenLevel(10)).toBe('luxury');
    });

    it('returns luxury for 100 items', () => {
        expect(getOnsenLevel(100)).toBe('luxury');
    });
});

describe('getOnsenLevelIndex', () => {
    it('returns 0 for basic', () => {
        expect(getOnsenLevelIndex('basic')).toBe(0);
    });

    it('returns 1 for forest', () => {
        expect(getOnsenLevelIndex('forest')).toBe(1);
    });

    it('returns 2 for snow', () => {
        expect(getOnsenLevelIndex('snow')).toBe(2);
    });

    it('returns 3 for luxury', () => {
        expect(getOnsenLevelIndex('luxury')).toBe(3);
    });
});

describe('getTotalItems', () => {
    it('returns 0 for empty inventory', () => {
        expect(getTotalItems({ mandarin: 0, watermelon: 0, hotspring_material: 0 })).toBe(0);
    });

    it('sums all items', () => {
        expect(getTotalItems({ mandarin: 10, watermelon: 5, hotspring_material: 3 })).toBe(18);
    });
});

describe('isSkinUnlocked', () => {
    const baseStats: UnlockStats = {
        maxDistance: 0,
        onsenLevelIndex: 0,
        totalItemsCollected: 0,
    };

    it('always returns true for "always"', () => {
        expect(isSkinUnlocked('always', baseStats)).toBe(true);
    });

    it('returns false for distance_5000 when distance < 5000', () => {
        expect(isSkinUnlocked('distance_5000', { ...baseStats, maxDistance: 4999 })).toBe(false);
    });

    it('returns true for distance_5000 when distance = 5000', () => {
        expect(isSkinUnlocked('distance_5000', { ...baseStats, maxDistance: 5000 })).toBe(true);
    });

    it('returns true for distance_5000 when distance > 5000', () => {
        expect(isSkinUnlocked('distance_5000', { ...baseStats, maxDistance: 10000 })).toBe(true);
    });

    it('returns false for onsen_level_3 when index < 2', () => {
        expect(isSkinUnlocked('onsen_level_3', { ...baseStats, onsenLevelIndex: 1 })).toBe(false);
    });

    it('returns true for onsen_level_3 when index = 2', () => {
        expect(isSkinUnlocked('onsen_level_3', { ...baseStats, onsenLevelIndex: 2 })).toBe(true);
    });

    it('returns false for items_1000 when items < 1000', () => {
        expect(isSkinUnlocked('items_1000', { ...baseStats, totalItemsCollected: 999 })).toBe(false);
    });

    it('returns true for items_1000 when items = 1000', () => {
        expect(isSkinUnlocked('items_1000', { ...baseStats, totalItemsCollected: 1000 })).toBe(true);
    });
});
