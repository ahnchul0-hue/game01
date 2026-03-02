import { describe, it, expect } from 'vitest';
import {
    getStageForDistance,
    shouldSpawnPowerUp,
    weightedRandomItem,
    randomPowerUpType,
    randomCoinPattern,
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

    it('returns onsen at 3000m', () => {
        expect(getStageForDistance(3000)).toBe('onsen');
    });

    it('returns onsen just before loop', () => {
        expect(getStageForDistance(3999)).toBe('onsen');
    });

    it('loops back to forest at STAGE_LOOP_DISTANCE', () => {
        expect(getStageForDistance(4000)).toBe('forest');
    });

    it('loops correctly at 4500m (river)', () => {
        expect(getStageForDistance(4500)).toBe('river');
    });

    it('loops correctly at 8000m (forest again)', () => {
        expect(getStageForDistance(8000)).toBe('forest');
    });

    it('returns forest for negative distance', () => {
        expect(getStageForDistance(-100)).toBe('forest');
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
});

describe('randomPowerUpType', () => {
    it('returns helmet for random in [0, 0.25)', () => {
        expect(randomPowerUpType(0)).toBe('helmet');
        expect(randomPowerUpType(0.24)).toBe('helmet');
    });

    it('returns tube for random in [0.25, 0.5)', () => {
        expect(randomPowerUpType(0.26)).toBe('tube');
        expect(randomPowerUpType(0.49)).toBe('tube');
    });

    it('returns friend for random in [0.5, 0.75)', () => {
        expect(randomPowerUpType(0.51)).toBe('friend');
        expect(randomPowerUpType(0.74)).toBe('friend');
    });

    it('returns magnet for random in [0.75, 1)', () => {
        expect(randomPowerUpType(0.76)).toBe('magnet');
        expect(randomPowerUpType(0.99)).toBe('magnet');
    });
});

describe('randomCoinPattern', () => {
    it('returns line for low random (weighted higher)', () => {
        expect(randomCoinPattern(0)).toBe('line');
        expect(randomCoinPattern(0.24)).toBe('line');
    });

    it('returns line for random in [0.25, 0.5)', () => {
        expect(randomCoinPattern(0.26)).toBe('line');
        expect(randomCoinPattern(0.49)).toBe('line');
    });

    it('returns arc for random in [0.5, 0.75)', () => {
        expect(randomCoinPattern(0.51)).toBe('arc');
        expect(randomCoinPattern(0.74)).toBe('arc');
    });

    it('returns zigzag for random in [0.75, 1)', () => {
        expect(randomCoinPattern(0.76)).toBe('zigzag');
        expect(randomCoinPattern(0.99)).toBe('zigzag');
    });

    it('returns a valid CoinPattern type', () => {
        for (let i = 0; i < 10; i++) {
            const pattern = randomCoinPattern(Math.random());
            expect(['line', 'arc', 'zigzag']).toContain(pattern);
        }
    });
});
