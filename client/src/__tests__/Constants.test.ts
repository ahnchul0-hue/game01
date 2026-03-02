import { describe, it, expect } from 'vitest';
import {
    STAGE_THRESHOLDS,
    STAGE_LOOP_DISTANCE,
    ITEM_WEIGHTS,
    POWERUP_CONFIGS,
} from '../utils/Constants';
import type { ItemType, PowerUpType } from '../utils/Constants';

describe('STAGE_THRESHOLDS', () => {
    it('has minDistance in ascending order', () => {
        for (let i = 1; i < STAGE_THRESHOLDS.length; i++) {
            expect(STAGE_THRESHOLDS[i].minDistance).toBeGreaterThan(
                STAGE_THRESHOLDS[i - 1].minDistance,
            );
        }
    });

    it('starts at 0', () => {
        expect(STAGE_THRESHOLDS[0].minDistance).toBe(0);
    });

    it('has STAGE_LOOP_DISTANCE equal to last threshold', () => {
        const last = STAGE_THRESHOLDS[STAGE_THRESHOLDS.length - 1];
        expect(STAGE_LOOP_DISTANCE).toBe(last.minDistance);
    });

    it('contains 4 stages', () => {
        expect(STAGE_THRESHOLDS).toHaveLength(4);
    });
});

describe('ITEM_WEIGHTS', () => {
    it('sums to approximately 1.0', () => {
        const total = Object.values(ITEM_WEIGHTS).reduce((s, w) => s + w, 0);
        expect(total).toBeCloseTo(1.0);
    });

    it('contains exactly 3 item types', () => {
        const keys = Object.keys(ITEM_WEIGHTS) as ItemType[];
        expect(keys).toHaveLength(3);
        expect(keys).toContain('mandarin');
        expect(keys).toContain('watermelon');
        expect(keys).toContain('hotspring_material');
    });

    it('all weights are positive', () => {
        for (const weight of Object.values(ITEM_WEIGHTS)) {
            expect(weight).toBeGreaterThan(0);
        }
    });
});

describe('POWERUP_CONFIGS', () => {
    it('contains 3 powerup types', () => {
        const keys = Object.keys(POWERUP_CONFIGS) as PowerUpType[];
        expect(keys).toHaveLength(3);
        expect(keys).toContain('helmet');
        expect(keys).toContain('tube');
        expect(keys).toContain('friend');
    });

    it('helmet has duration 0 (one-time use)', () => {
        expect(POWERUP_CONFIGS.helmet.duration).toBe(0);
    });

    it('tube and friend have positive durations', () => {
        expect(POWERUP_CONFIGS.tube.duration).toBeGreaterThan(0);
        expect(POWERUP_CONFIGS.friend.duration).toBeGreaterThan(0);
    });
});
