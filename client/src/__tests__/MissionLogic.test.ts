import { describe, it, expect } from 'vitest';

/**
 * 미션/스트릭 보상 로직 테스트.
 * Missions.ts에 인라인된 보상 계산 로직을 동일하게 테스트.
 */

// ─── 보상 타입 → 표시 라벨 변환 (Missions.ts onClaimMissionReward 로직) ──
function rewardLabel(rewardType: string): string {
    return rewardType === 'mandarin' ? '귤'
        : rewardType === 'watermelon' ? '수박'
        : '온천 재료';
}

// ─── 스트릭 보상 계산 (Missions.ts onClaimStreakReward 로직) ──────────
interface StreakReward {
    mandarin: number;
    watermelon: number;
    hotspring_material: number;
}

function calcStreakReward(currentStreak: number): StreakReward {
    const cycleDay = ((currentStreak - 1) % 7) + 1;
    const reward = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
    if (cycleDay <= 3) {
        reward.mandarin = 5;
    } else if (cycleDay <= 6) {
        reward.watermelon = 3;
    } else {
        reward.hotspring_material = 2;
    }
    return reward;
}

function streakRewardLabel(currentStreak: number): string {
    const cycleDay = ((currentStreak - 1) % 7) + 1;
    if (cycleDay <= 3) return '+귤 x5 (연속 보너스)';
    if (cycleDay <= 6) return '+수박 x3 (연속 보너스)';
    return '+온천 재료 x2 (연속 보너스)';
}

// ─── 미션 보상 → 인벤토리 매핑 (Missions.ts onClaimMissionReward 로직) ──
function calcMissionReward(rewardType: string, rewardAmount: number): StreakReward {
    const items = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
    const key = rewardType as keyof typeof items;
    if (key in items) {
        items[key] = rewardAmount;
    }
    return items;
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('MissionLogic — rewardLabel', () => {
    it('mandarin → 귤', () => {
        expect(rewardLabel('mandarin')).toBe('귤');
    });

    it('watermelon → 수박', () => {
        expect(rewardLabel('watermelon')).toBe('수박');
    });

    it('hotspring_material → 온천 재료', () => {
        expect(rewardLabel('hotspring_material')).toBe('온천 재료');
    });

    it('unknown type → 온천 재료 (fallback)', () => {
        expect(rewardLabel('unknown')).toBe('온천 재료');
    });
});

describe('MissionLogic — calcMissionReward', () => {
    it('mandarin reward populates mandarin field', () => {
        expect(calcMissionReward('mandarin', 10)).toEqual({ mandarin: 10, watermelon: 0, hotspring_material: 0 });
    });

    it('watermelon reward populates watermelon field', () => {
        expect(calcMissionReward('watermelon', 3)).toEqual({ mandarin: 0, watermelon: 3, hotspring_material: 0 });
    });

    it('hotspring_material reward populates hotspring_material field', () => {
        expect(calcMissionReward('hotspring_material', 2)).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 2 });
    });

    it('unknown reward type leaves all zero', () => {
        expect(calcMissionReward('gold', 100)).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 0 });
    });
});

describe('MissionLogic — streakReward cycle (7-day)', () => {
    it('day 1 → mandarin x5', () => {
        expect(calcStreakReward(1)).toEqual({ mandarin: 5, watermelon: 0, hotspring_material: 0 });
    });

    it('day 2 → mandarin x5', () => {
        expect(calcStreakReward(2)).toEqual({ mandarin: 5, watermelon: 0, hotspring_material: 0 });
    });

    it('day 3 → mandarin x5', () => {
        expect(calcStreakReward(3)).toEqual({ mandarin: 5, watermelon: 0, hotspring_material: 0 });
    });

    it('day 4 → watermelon x3', () => {
        expect(calcStreakReward(4)).toEqual({ mandarin: 0, watermelon: 3, hotspring_material: 0 });
    });

    it('day 5 → watermelon x3', () => {
        expect(calcStreakReward(5)).toEqual({ mandarin: 0, watermelon: 3, hotspring_material: 0 });
    });

    it('day 6 → watermelon x3', () => {
        expect(calcStreakReward(6)).toEqual({ mandarin: 0, watermelon: 3, hotspring_material: 0 });
    });

    it('day 7 → hotspring_material x2', () => {
        expect(calcStreakReward(7)).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 2 });
    });

    it('day 8 (cycle restart) → mandarin x5', () => {
        expect(calcStreakReward(8)).toEqual({ mandarin: 5, watermelon: 0, hotspring_material: 0 });
    });

    it('day 14 (full 2nd cycle) → hotspring_material x2', () => {
        expect(calcStreakReward(14)).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 2 });
    });

    it('day 21 (3rd cycle end) → hotspring_material x2', () => {
        expect(calcStreakReward(21)).toEqual({ mandarin: 0, watermelon: 0, hotspring_material: 2 });
    });
});

describe('MissionLogic — streakRewardLabel', () => {
    it('day 1 → 귤 text', () => {
        expect(streakRewardLabel(1)).toBe('+귤 x5 (연속 보너스)');
    });

    it('day 4 → 수박 text', () => {
        expect(streakRewardLabel(4)).toBe('+수박 x3 (연속 보너스)');
    });

    it('day 7 → 온천 재료 text', () => {
        expect(streakRewardLabel(7)).toBe('+온천 재료 x2 (연속 보너스)');
    });

    it('day 15 → mandarin (cycle restart)', () => {
        expect(streakRewardLabel(15)).toBe('+귤 x5 (연속 보너스)');
    });
});
