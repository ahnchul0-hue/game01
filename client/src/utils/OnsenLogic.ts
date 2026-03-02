import {
    type Inventory,
    type OnsenLevel,
    type OnsenBuff,
    type UnlockCondition,
    type CompanionId,
    type CompanionUnlockCondition,
    type CompanionAbility,
    ONSEN_LEVEL_THRESHOLDS,
    ONSEN_BUFF_CONFIGS,
    COMPANION_CONFIGS,
    NO_COMPANION_ABILITY,
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

export function getOnsenBuff(level: OnsenLevel): OnsenBuff {
    return ONSEN_BUFF_CONFIGS[level];
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

// ========== 동물 친구 ==========

export function getCompanionAbility(companionId: CompanionId): CompanionAbility {
    if (companionId === 'none') return NO_COMPANION_ABILITY;
    const config = COMPANION_CONFIGS.find(c => c.id === companionId);
    return config ? config.ability : NO_COMPANION_ABILITY;
}

export function isCompanionUnlocked(condition: CompanionUnlockCondition, stats: UnlockStats): boolean {
    switch (condition) {
        case 'always':          return true;
        case 'distance_2000':   return stats.maxDistance >= 2000;
        case 'items_500':       return stats.totalItemsCollected >= 500;
        case 'onsen_level_2':   return stats.onsenLevelIndex >= 1;
        default:                return false;
    }
}

export function getCompanionUnlockProgress(condition: CompanionUnlockCondition, stats: UnlockStats): number {
    switch (condition) {
        case 'always':          return 1;
        case 'distance_2000':   return Math.min(1, stats.maxDistance / 2000);
        case 'items_500':       return Math.min(1, stats.totalItemsCollected / 500);
        case 'onsen_level_2':   return Math.min(1, stats.onsenLevelIndex / 1);
        default:                return 0;
    }
}
