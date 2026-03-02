import {
    STAGE_THRESHOLDS,
    STAGE_LOOP_DISTANCE,
    POWERUP_MIN_DISTANCE,
    POWERUP_SPAWN_CHANCE,
    ITEM_WEIGHTS,
} from './Constants';
import type { StageType, ItemType, PowerUpType, CoinPattern } from './Constants';

/** 거리에 해당하는 스테이지 계산 (STAGE_LOOP_DISTANCE 이후 루프) */
export function getStageForDistance(distance: number): StageType {
    const looped = distance >= STAGE_LOOP_DISTANCE
        ? distance % STAGE_LOOP_DISTANCE
        : distance;

    let result: StageType = 'forest';
    for (const { stage, minDistance } of STAGE_THRESHOLDS) {
        if (looped >= minDistance) {
            result = stage;
        }
    }
    return result;
}

/** 파워업 스폰 여부 판정 (300m+ 이후, 확률 기반) */
export function shouldSpawnPowerUp(distance: number, random: number): boolean {
    if (distance < POWERUP_MIN_DISTANCE) return false;
    return random < POWERUP_SPAWN_CHANCE;
}

/** 가중치 기반 아이템 타입 선택 */
export function weightedRandomItem(random: number): ItemType {
    const entries = Object.entries(ITEM_WEIGHTS) as [ItemType, number][];
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let scaled = random * totalWeight;

    for (const [type, weight] of entries) {
        scaled -= weight;
        if (scaled <= 0) return type;
    }

    return entries[0][0];
}

/** 균등 확률 파워업 타입 선택 (magnet 포함) */
export function randomPowerUpType(random: number): PowerUpType {
    const types: PowerUpType[] = ['helmet', 'tube', 'friend', 'magnet'];
    const index = Math.min(Math.floor(random * types.length), types.length - 1);
    return types[index];
}

/** 랜덤 코인 패턴 선택 */
export function randomCoinPattern(random: number): CoinPattern {
    const patterns: CoinPattern[] = ['line', 'line', 'arc', 'zigzag']; // line 확률 높음
    const index = Math.min(Math.floor(random * patterns.length), patterns.length - 1);
    return patterns[index];
}
