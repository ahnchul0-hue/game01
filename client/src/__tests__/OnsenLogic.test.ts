import { describe, it, expect } from 'vitest';
import {
    getOnsenLevel,
    getOnsenLevelIndex,
    getOnsenBuff,
    getTotalItems,
    isSkinUnlocked,
    getUnlockProgress,
    getCompanionAbility,
    isCompanionUnlocked,
    getCompanionUnlockProgress,
    type UnlockStats,
} from '../utils/OnsenLogic';

describe('getOnsenLevel', () => {
    it('returns basic for 0 items', () => {
        expect(getOnsenLevel(0)).toBe('basic');
    });

    it('returns basic for 14 items', () => {
        expect(getOnsenLevel(14)).toBe('basic');
    });

    it('returns forest for 15 items', () => {
        expect(getOnsenLevel(15)).toBe('forest');
    });

    it('returns forest for 20 items', () => {
        expect(getOnsenLevel(20)).toBe('forest');
    });

    it('returns snow for 35 items', () => {
        expect(getOnsenLevel(35)).toBe('snow');
    });

    it('returns snow for 50 items', () => {
        expect(getOnsenLevel(50)).toBe('snow');
    });

    it('returns luxury for 60 items', () => {
        expect(getOnsenLevel(60)).toBe('luxury');
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
        expect(getTotalItems({ gem: 0, mandarin: 0, watermelon: 0, hotspring_material: 0 })).toBe(0);
    });

    it('sums all items', () => {
        expect(getTotalItems({ gem: 0, mandarin: 10, watermelon: 5, hotspring_material: 3 })).toBe(18);
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

describe('getUnlockProgress', () => {
    const baseStats: UnlockStats = {
        maxDistance: 0,
        onsenLevelIndex: 0,
        totalItemsCollected: 0,
    };

    it('returns 1 for "always"', () => {
        expect(getUnlockProgress('always', baseStats)).toBe(1);
    });

    it('returns 0.5 for distance_5000 at 2500m', () => {
        expect(getUnlockProgress('distance_5000', { ...baseStats, maxDistance: 2500 })).toBe(0.5);
    });

    it('caps at 1 for distance_5000 at 10000m', () => {
        expect(getUnlockProgress('distance_5000', { ...baseStats, maxDistance: 10000 })).toBe(1);
    });

    it('returns 0.5 for onsen_level_3 at index 1', () => {
        expect(getUnlockProgress('onsen_level_3', { ...baseStats, onsenLevelIndex: 1 })).toBe(0.5);
    });

    it('returns 0.1 for items_1000 at 100 items', () => {
        expect(getUnlockProgress('items_1000', { ...baseStats, totalItemsCollected: 100 })).toBe(0.1);
    });

    it('returns 1 for items_1000 at 2000 items', () => {
        expect(getUnlockProgress('items_1000', { ...baseStats, totalItemsCollected: 2000 })).toBe(1);
    });
});

describe('getOnsenBuff', () => {
    it('returns no buffs for basic level', () => {
        const buff = getOnsenBuff('basic');
        expect(buff.scoreMultiplier).toBe(1.0);
        expect(buff.startingShield).toBe(false);
        expect(buff.itemMagnetRange).toBe(0);
    });

    it('returns 1.1x score and 50px magnet for forest level', () => {
        const buff = getOnsenBuff('forest');
        expect(buff.scoreMultiplier).toBe(1.1);
        expect(buff.startingShield).toBe(false);
        expect(buff.itemMagnetRange).toBe(50);
    });

    it('returns 1.2x score, shield, and 100px magnet for snow level', () => {
        const buff = getOnsenBuff('snow');
        expect(buff.scoreMultiplier).toBe(1.2);
        expect(buff.startingShield).toBe(true);
        expect(buff.itemMagnetRange).toBe(100);
    });

    it('returns 1.3x score, shield, and 150px magnet for luxury level', () => {
        const buff = getOnsenBuff('luxury');
        expect(buff.scoreMultiplier).toBe(1.3);
        expect(buff.startingShield).toBe(true);
        expect(buff.itemMagnetRange).toBe(150);
    });

    it('integrates with getOnsenLevel — 0 placed items gives basic buff', () => {
        const level = getOnsenLevel(0);
        const buff = getOnsenBuff(level);
        expect(buff.scoreMultiplier).toBe(1.0);
    });

    it('integrates with getOnsenLevel — 60 placed items gives luxury buff', () => {
        const level = getOnsenLevel(60);
        const buff = getOnsenBuff(level);
        expect(buff.scoreMultiplier).toBe(1.3);
        expect(buff.startingShield).toBe(true);
        expect(buff.itemMagnetRange).toBe(150);
    });

    it('forest buff multiplier is strictly between basic and snow', () => {
        const basic = getOnsenBuff('basic');
        const forest = getOnsenBuff('forest');
        const snow = getOnsenBuff('snow');
        expect(forest.scoreMultiplier).toBeGreaterThan(basic.scoreMultiplier);
        expect(forest.scoreMultiplier).toBeLessThan(snow.scoreMultiplier);
    });

    it('magnet range increases with each level', () => {
        const levels: Array<'basic' | 'forest' | 'snow' | 'luxury'> = ['basic', 'forest', 'snow', 'luxury'];
        for (let i = 1; i < levels.length; i++) {
            expect(getOnsenBuff(levels[i]).itemMagnetRange)
                .toBeGreaterThan(getOnsenBuff(levels[i - 1]).itemMagnetRange);
        }
    });
});

// ========== 동물 친구 ==========

describe('getCompanionAbility', () => {
    it('returns no-ability for "none"', () => {
        const ability = getCompanionAbility('none');
        expect(ability.scoreMultiplier).toBe(1.0);
        expect(ability.shieldChance).toBe(0);
        expect(ability.itemMagnetRange).toBe(0);
    });

    it('returns magnet ability for otter', () => {
        const ability = getCompanionAbility('otter');
        expect(ability.itemMagnetRange).toBe(100);
        expect(ability.scoreMultiplier).toBe(1.0);
        expect(ability.shieldChance).toBe(0);
    });

    it('returns score multiplier for duck', () => {
        const ability = getCompanionAbility('duck');
        expect(ability.scoreMultiplier).toBe(1.2);
        expect(ability.shieldChance).toBe(0);
        expect(ability.itemMagnetRange).toBe(0);
    });

    it('returns shield chance for turtle', () => {
        const ability = getCompanionAbility('turtle');
        expect(ability.shieldChance).toBe(0.15);
        expect(ability.scoreMultiplier).toBe(1.0);
        expect(ability.itemMagnetRange).toBe(0);
    });

    it('returns no-ability for unknown id', () => {
        const ability = getCompanionAbility('dragon' as any);
        expect(ability.scoreMultiplier).toBe(1.0);
    });
});

describe('isCompanionUnlocked', () => {
    it('always unlocks "always" condition', () => {
        expect(isCompanionUnlocked('always', { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(true);
    });

    it('unlocks otter at 2000m', () => {
        expect(isCompanionUnlocked('distance_2000', { maxDistance: 1999, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(false);
        expect(isCompanionUnlocked('distance_2000', { maxDistance: 2000, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(true);
    });

    it('unlocks duck at 500 items', () => {
        expect(isCompanionUnlocked('items_500', { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 499 })).toBe(false);
        expect(isCompanionUnlocked('items_500', { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 500 })).toBe(true);
    });

    it('unlocks turtle at onsen level 2', () => {
        expect(isCompanionUnlocked('onsen_level_2', { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(false);
        expect(isCompanionUnlocked('onsen_level_2', { maxDistance: 0, onsenLevelIndex: 1, totalItemsCollected: 0 })).toBe(true);
    });
});

describe('getCompanionUnlockProgress', () => {
    it('returns 1 for always', () => {
        expect(getCompanionUnlockProgress('always', { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(1);
    });

    it('returns 0.5 for distance_2000 at 1000m', () => {
        expect(getCompanionUnlockProgress('distance_2000', { maxDistance: 1000, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(0.5);
    });

    it('returns 0.4 for items_500 at 200 items', () => {
        expect(getCompanionUnlockProgress('items_500', { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 200 })).toBeCloseTo(0.4);
    });

    it('clamps at 1', () => {
        expect(getCompanionUnlockProgress('distance_2000', { maxDistance: 5000, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(1);
    });

    it('returns 0 for onsen_level_2 at index 0', () => {
        expect(getCompanionUnlockProgress('onsen_level_2', { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 0 })).toBe(0);
    });

    it('returns 1 for onsen_level_2 at index 1', () => {
        expect(getCompanionUnlockProgress('onsen_level_2', { maxDistance: 0, onsenLevelIndex: 1, totalItemsCollected: 0 })).toBe(1);
    });
});

// ========== 경계값 테스트 ==========

describe('getOnsenLevel — 경계값', () => {
    it('1개 아이템 → basic (최솟값 이상)', () => {
        expect(getOnsenLevel(1)).toBe('basic');
    });

    it('forest 임계값 직전 (14) → basic', () => {
        expect(getOnsenLevel(14)).toBe('basic');
    });

    it('forest 임계값 정확히 (15) → forest', () => {
        expect(getOnsenLevel(15)).toBe('forest');
    });

    it('snow 임계값 정확히 (35) → snow', () => {
        expect(getOnsenLevel(35)).toBe('snow');
    });

    it('snow 임계값 직전 (34) → forest', () => {
        expect(getOnsenLevel(34)).toBe('forest');
    });

    it('luxury 임계값 정확히 (60) → luxury', () => {
        expect(getOnsenLevel(60)).toBe('luxury');
    });

    it('luxury 임계값 직전 (59) → snow', () => {
        expect(getOnsenLevel(59)).toBe('snow');
    });

    it('매우 큰 값 (999999) → luxury (최대 레벨 유지)', () => {
        expect(getOnsenLevel(999999)).toBe('luxury');
    });
});

describe('getTotalItems — 경계값', () => {
    it('모든 값이 0인 경우 → 0', () => {
        expect(getTotalItems({ gem: 0, mandarin: 0, watermelon: 0, hotspring_material: 0 })).toBe(0);
    });

    it('한 종류만 있는 경우 → 해당 값', () => {
        expect(getTotalItems({ gem: 0, mandarin: 100, watermelon: 0, hotspring_material: 0 })).toBe(100);
    });

    it('매우 큰 값에서도 정확히 합산', () => {
        expect(getTotalItems({ gem: 0, mandarin: 10000, watermelon: 5000, hotspring_material: 2500 })).toBe(17500);
    });
});

describe('getUnlockProgress — 경계값', () => {
    const baseStats: UnlockStats = { maxDistance: 0, onsenLevelIndex: 0, totalItemsCollected: 0 };

    it('distance_5000: maxDistance=0 → 0', () => {
        expect(getUnlockProgress('distance_5000', { ...baseStats, maxDistance: 0 })).toBe(0);
    });

    it('distance_5000: maxDistance=4999 → 0.9998', () => {
        expect(getUnlockProgress('distance_5000', { ...baseStats, maxDistance: 4999 })).toBeCloseTo(4999 / 5000, 4);
    });

    it('items_1000: totalItemsCollected=0 → 0', () => {
        expect(getUnlockProgress('items_1000', { ...baseStats, totalItemsCollected: 0 })).toBe(0);
    });

    it('items_1000: totalItemsCollected=1001 → 1 (캡)', () => {
        expect(getUnlockProgress('items_1000', { ...baseStats, totalItemsCollected: 1001 })).toBe(1);
    });

    it('onsen_level_3: onsenLevelIndex=0 → 0', () => {
        expect(getUnlockProgress('onsen_level_3', { ...baseStats, onsenLevelIndex: 0 })).toBe(0);
    });

    it('onsen_level_3: onsenLevelIndex=2 → 1', () => {
        expect(getUnlockProgress('onsen_level_3', { ...baseStats, onsenLevelIndex: 2 })).toBe(1);
    });

    it('onsen_level_3: onsenLevelIndex=3 (초과) → 1 (캡)', () => {
        expect(getUnlockProgress('onsen_level_3', { ...baseStats, onsenLevelIndex: 3 })).toBe(1);
    });
});
