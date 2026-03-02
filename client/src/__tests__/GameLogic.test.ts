import { describe, it, expect } from 'vitest';
import {
    getStageForDistance,
    shouldSpawnPowerUp,
    weightedRandomItem,
    randomPowerUpType,
} from '../utils/GameLogic';
import { POWERUP_MIN_DISTANCE, POWERUP_SPAWN_CHANCE } from '../utils/Constants';

describe('getStageForDistance', () => {
    it('returns forest at distance 0', () => {
        expect(getStageForDistance(0)).toBe('forest');
    });

    it('returns forest below 500m', () => {
        expect(getStageForDistance(499)).toBe('forest');
    });

    it('returns river at 500m', () => {
        expect(getStageForDistance(500)).toBe('river');
    });

    it('returns village at 1500m', () => {
        expect(getStageForDistance(1500)).toBe('village');
    });

    it('returns village just before 3000m (onsen threshold)', () => {
        // 2999 < 3000 (onsen threshold), so still village
        expect(getStageForDistance(2999)).toBe('village');
    });

    it('loops back to forest at 3000m', () => {
        expect(getStageForDistance(3000)).toBe('forest');
    });

    it('loops correctly at 3500m (river)', () => {
        expect(getStageForDistance(3500)).toBe('river');
    });

    it('loops correctly at 6000m (forest again)', () => {
        expect(getStageForDistance(6000)).toBe('forest');
    });
});

describe('shouldSpawnPowerUp', () => {
    it('returns false below POWERUP_MIN_DISTANCE regardless of random', () => {
        expect(shouldSpawnPowerUp(0, 0)).toBe(false);
        expect(shouldSpawnPowerUp(POWERUP_MIN_DISTANCE - 1, 0)).toBe(false);
    });

    it('returns true at POWERUP_MIN_DISTANCE with low random', () => {
        expect(shouldSpawnPowerUp(POWERUP_MIN_DISTANCE, 0)).toBe(true);
    });

    it('returns false at POWERUP_MIN_DISTANCE with high random', () => {
        expect(shouldSpawnPowerUp(POWERUP_MIN_DISTANCE, 0.99)).toBe(false);
    });

    it('boundary: returns false when random equals POWERUP_SPAWN_CHANCE', () => {
        expect(shouldSpawnPowerUp(500, POWERUP_SPAWN_CHANCE)).toBe(false);
    });

    it('boundary: returns true when random is just below POWERUP_SPAWN_CHANCE', () => {
        expect(shouldSpawnPowerUp(500, POWERUP_SPAWN_CHANCE - 0.001)).toBe(true);
    });
});

describe('weightedRandomItem', () => {
    // ITEM_WEIGHTS: mandarin=0.7, watermelon=0.2, hotspring_material=0.1
    it('returns mandarin for random=0', () => {
        expect(weightedRandomItem(0)).toBe('mandarin');
    });

    it('returns mandarin for random near 0.69', () => {
        expect(weightedRandomItem(0.69)).toBe('mandarin');
    });

    it('returns watermelon for random near 0.75', () => {
        expect(weightedRandomItem(0.75)).toBe('watermelon');
    });

    it('returns hotspring_material for random near 0.95', () => {
        expect(weightedRandomItem(0.95)).toBe('hotspring_material');
    });

    it('returns mandarin for random=0 (fallback)', () => {
        expect(weightedRandomItem(0)).toBe('mandarin');
    });
});

describe('randomPowerUpType', () => {
    it('returns helmet for random in [0, 0.33)', () => {
        expect(randomPowerUpType(0)).toBe('helmet');
        expect(randomPowerUpType(0.32)).toBe('helmet');
    });

    it('returns tube for random in [0.33, 0.66)', () => {
        expect(randomPowerUpType(0.34)).toBe('tube');
        expect(randomPowerUpType(0.65)).toBe('tube');
    });

    it('returns friend for random in [0.66, 1)', () => {
        expect(randomPowerUpType(0.67)).toBe('friend');
        expect(randomPowerUpType(0.99)).toBe('friend');
    });
});
