import {
    type Inventory,
    type OnsenLevel,
    type UnlockCondition,
    ONSEN_LEVEL_THRESHOLDS,
} from './Constants';

export function getOnsenLevel(placedItemCount: number): OnsenLevel {
    let result: OnsenLevel = 'basic';
    for (const { level, minItems } of ONSEN_LEVEL_THRESHOLDS) {
        if (placedItemCount >= minItems) {
            result = level;
        }
    }
    return result;
}

export function getOnsenLevelIndex(level: OnsenLevel): number {
    const idx = ONSEN_LEVEL_THRESHOLDS.findIndex((t) => t.level === level);
    return idx >= 0 ? idx : 0;
}

export function getTotalItems(inventory: Inventory): number {
    return inventory.mandarin + inventory.watermelon + inventory.hotspring_material;
}

export interface UnlockStats {
    maxDistance: number;
    onsenLevelIndex: number;
    totalItemsCollected: number;
}

export function getUnlockProgress(condition: UnlockCondition, stats: UnlockStats): number {
    switch (condition) {
        case 'always':         return 1;
        case 'distance_5000':  return Math.min(1, stats.maxDistance / 5000);
        case 'onsen_level_3':  return Math.min(1, stats.onsenLevelIndex / 2);
        case 'items_1000':     return Math.min(1, stats.totalItemsCollected / 1000);
        default:               return 0;
    }
}

export function isSkinUnlocked(condition: UnlockCondition, stats: UnlockStats): boolean {
    switch (condition) {
        case 'always':
            return true;
        case 'distance_5000':
            return stats.maxDistance >= 5000;
        case 'onsen_level_3':
            return stats.onsenLevelIndex >= 2;
        case 'items_1000':
            return stats.totalItemsCollected >= 1000;
        default:
            return false;
    }
}
