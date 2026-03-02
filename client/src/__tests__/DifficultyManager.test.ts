import { describe, it, expect } from 'vitest';
import { DifficultyManager } from '../systems/DifficultyManager';
import {
    BASE_SPEED,
    MAX_SPEED,
    RELAX_SPEED_MULTIPLIER,
    SPAWN_INTERVAL_START,
    SPAWN_INTERVAL_MIN,
    DIFFICULTY_EASY_MAX,
    DIFFICULTY_MEDIUM_MAX,
} from '../utils/Constants';

const dm = new DifficultyManager();

describe('DifficultyManager.getSpeed', () => {
    it('returns BASE_SPEED at distance 0', () => {
        expect(dm.getSpeed(0, false)).toBe(BASE_SPEED);
    });

    it('increases with distance', () => {
        expect(dm.getSpeed(1000, false)).toBeGreaterThan(BASE_SPEED);
    });

    it('caps at MAX_SPEED', () => {
        expect(dm.getSpeed(1_000_000, false)).toBe(MAX_SPEED);
    });

    it('applies relax multiplier', () => {
        const normal = dm.getSpeed(500, false);
        const relax = dm.getSpeed(500, true);
        expect(relax).toBeCloseTo(normal * RELAX_SPEED_MULTIPLIER);
    });
});

describe('DifficultyManager.getSpawnInterval', () => {
    it('returns SPAWN_INTERVAL_START at distance 0', () => {
        expect(dm.getSpawnInterval(0, false)).toBe(SPAWN_INTERVAL_START);
    });

    it('decreases with distance', () => {
        expect(dm.getSpawnInterval(1000, false)).toBeLessThan(SPAWN_INTERVAL_START);
    });

    it('never goes below SPAWN_INTERVAL_MIN', () => {
        expect(dm.getSpawnInterval(1_000_000, false)).toBe(SPAWN_INTERVAL_MIN);
    });

    it('is longer in relax mode', () => {
        const normal = dm.getSpawnInterval(500, false);
        const relax = dm.getSpawnInterval(500, true);
        expect(relax).toBeCloseTo(normal * 1.5);
    });
});

describe('DifficultyManager.getLevel', () => {
    it('returns easy below DIFFICULTY_EASY_MAX', () => {
        expect(dm.getLevel(0)).toBe('easy');
        expect(dm.getLevel(DIFFICULTY_EASY_MAX - 1)).toBe('easy');
    });

    it('returns medium between easy and medium thresholds', () => {
        expect(dm.getLevel(DIFFICULTY_EASY_MAX)).toBe('medium');
        expect(dm.getLevel(DIFFICULTY_MEDIUM_MAX - 1)).toBe('medium');
    });

    it('returns hard at DIFFICULTY_MEDIUM_MAX and above', () => {
        expect(dm.getLevel(DIFFICULTY_MEDIUM_MAX)).toBe('hard');
        expect(dm.getLevel(10_000)).toBe('hard');
    });
});

describe('DifficultyManager.getAvailableObstacleTypes', () => {
    it('returns only rock for easy', () => {
        expect(dm.getAvailableObstacleTypes('easy')).toEqual(['rock']);
    });

    it('returns all 3 types for medium', () => {
        expect(dm.getAvailableObstacleTypes('medium')).toEqual(['rock', 'branch_high', 'puddle']);
    });

    it('returns all 3 types for hard', () => {
        expect(dm.getAvailableObstacleTypes('hard')).toEqual(['rock', 'branch_high', 'puddle']);
    });
});

describe('DifficultyManager.getMaxObstaclesPerSpawn', () => {
    it('returns 1 for easy', () => {
        expect(dm.getMaxObstaclesPerSpawn('easy')).toBe(1);
    });

    it('returns 1 for medium', () => {
        expect(dm.getMaxObstaclesPerSpawn('medium')).toBe(1);
    });

    it('returns 2 for hard', () => {
        expect(dm.getMaxObstaclesPerSpawn('hard')).toBe(2);
    });
});
