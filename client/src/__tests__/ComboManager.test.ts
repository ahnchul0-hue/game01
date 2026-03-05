import { describe, it, expect, beforeEach } from 'vitest';
import { ComboManager } from '../systems/ComboManager';

describe('ComboManager', () => {
    let combo: ComboManager;

    beforeEach(() => {
        combo = new ComboManager();
    });

    // ── 초기 상태 ──────────────────────────────────────────────────────

    describe('초기 상태', () => {
        it('초기 콤보 카운트는 0', () => {
            expect(combo.getCount()).toBe(0);
        });

        it('hit 없이 update 호출 시 false 반환 (만료 없음)', () => {
            expect(combo.update(100)).toBe(false);
        });
    });

    // ── hit (콤보 등록) ─────────────────────────────────────────────────

    describe('hit — 배율 반환', () => {
        it('첫 번째 hit → 배율 1.0 (count=1, BONUS[1])', () => {
            const multiplier = combo.hit();
            expect(multiplier).toBe(1.0);
            expect(combo.getCount()).toBe(1);
        });

        it('두 번째 hit → 배율 1.0 (BONUS[2])', () => {
            combo.hit();
            const multiplier = combo.hit();
            expect(multiplier).toBe(1.2);
            expect(combo.getCount()).toBe(2);
        });

        it('세 번째 hit → 배율 1.5 (BONUS[3])', () => {
            combo.hit();
            combo.hit();
            const multiplier = combo.hit();
            expect(multiplier).toBe(1.5);
            expect(combo.getCount()).toBe(3);
        });

        it('네 번째 hit → 배율 2.0 (BONUS[4], 최대)', () => {
            combo.hit(); combo.hit(); combo.hit();
            const multiplier = combo.hit();
            expect(multiplier).toBe(2.0);
            expect(combo.getCount()).toBe(4);
        });

        it('다섯 번째 이상 hit → 배율 2.0 유지 (인덱스 캡)', () => {
            for (let i = 0; i < 4; i++) combo.hit();
            // 5, 6번째 hit도 최대 배율 유지
            expect(combo.hit()).toBe(2.0);
            expect(combo.hit()).toBe(2.0);
        });
    });

    // ── reset ──────────────────────────────────────────────────────────

    describe('reset', () => {
        it('reset 후 카운트 0', () => {
            combo.hit(); combo.hit();
            combo.reset();
            expect(combo.getCount()).toBe(0);
        });

        it('reset 후 update는 false 반환 (타이머도 초기화)', () => {
            combo.hit();
            combo.reset();
            expect(combo.update(100)).toBe(false);
        });

        it('reset 후 hit 시 배율이 1.0부터 재시작', () => {
            for (let i = 0; i < 4; i++) combo.hit();
            combo.reset();
            expect(combo.hit()).toBe(1.0); // count=1 → BONUS[1]
        });
    });

    // ── 타이머 만료 ─────────────────────────────────────────────────────

    describe('타이머 만료 (update)', () => {
        it('hit 후 2000ms 미만 경과 시 update는 false', () => {
            combo.hit();
            expect(combo.update(1999)).toBe(false);
            expect(combo.getCount()).toBeGreaterThan(0); // 아직 살아있음
        });

        it('hit 후 2000ms 정확히 경과 시 콤보 만료 (update → true)', () => {
            combo.hit();
            expect(combo.update(2000)).toBe(true);
            expect(combo.getCount()).toBe(0);
        });

        it('hit 후 3000ms 경과 시 콤보 만료 (update → true)', () => {
            combo.hit();
            expect(combo.update(3000)).toBe(true);
            expect(combo.getCount()).toBe(0);
        });

        it('만료 후 재차 update 호출 시 false (이미 만료됨)', () => {
            combo.hit();
            combo.update(2000); // 만료
            expect(combo.update(100)).toBe(false);
        });

        it('분할 delta로도 정확히 만료됨 (누적 2000ms)', () => {
            combo.hit();
            combo.update(1000); // 남은 타이머 1000ms
            combo.update(999);  // 남은 타이머 1ms
            expect(combo.update(1)).toBe(true); // 정확히 0ms 도달
            expect(combo.getCount()).toBe(0);
        });

        it('hit으로 타이머 리셋 → 만료 시간 연장됨', () => {
            combo.hit();
            combo.update(1500); // 500ms 남음
            combo.hit();        // 타이머 2000ms 리셋
            expect(combo.update(1999)).toBe(false); // 아직 살아있음
        });
    });
});
