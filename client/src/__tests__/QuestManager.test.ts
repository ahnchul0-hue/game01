import { describe, it, expect, beforeEach } from 'vitest';
import { QuestManager, DEFAULT_QUESTS, type QuestDefinition } from '../systems/QuestManager';

// ──────────────────────────────────────────────
// 헬퍼: 특정 타입 퀘스트 정의 찾기
// ──────────────────────────────────────────────
function findQuest(type: QuestDefinition['type']): QuestDefinition {
    const q = DEFAULT_QUESTS.find(q => q.type === type);
    if (!q) throw new Error(`퀘스트 타입 ${type}이 DEFAULT_QUESTS에 없습니다`);
    return q;
}

// ──────────────────────────────────────────────
// DEFAULT_QUESTS 구조 검증
// ──────────────────────────────────────────────
describe('DEFAULT_QUESTS', () => {
    it('8개의 퀘스트를 포함한다', () => {
        expect(DEFAULT_QUESTS).toHaveLength(8);
    });

    it('모든 퀘스트에 고유한 id가 있다', () => {
        const ids = DEFAULT_QUESTS.map(q => q.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('모든 퀘스트의 target은 양수이다', () => {
        DEFAULT_QUESTS.forEach(q => {
            expect(q.target).toBeGreaterThan(0);
        });
    });

    it('모든 퀘스트의 rewardMandarin은 양수이다', () => {
        DEFAULT_QUESTS.forEach(q => {
            expect(q.rewardMandarin).toBeGreaterThan(0);
        });
    });

    it('distance, collect, dodge 타입이 각각 존재한다', () => {
        const types = new Set(DEFAULT_QUESTS.map(q => q.type));
        expect(types.has('distance')).toBe(true);
        expect(types.has('collect')).toBe(true);
        expect(types.has('dodge')).toBe(true);
    });
});

// ──────────────────────────────────────────────
// QuestManager 기본 동작
// ──────────────────────────────────────────────
describe('QuestManager - 초기 상태', () => {
    let mgr: QuestManager;

    beforeEach(() => {
        mgr = QuestManager.fromIndex(0); // distance 퀘스트
    });

    it('초기에는 완료되지 않았다', () => {
        expect(mgr.isComplete()).toBe(false);
    });

    it('초기 진행 퍼센트는 0이다', () => {
        expect(mgr.getProgress()).toBe(0);
    });

    it('초기 current는 0이다', () => {
        expect(mgr.getCurrent()).toBe(0);
    });

    it('getQuest()는 퀘스트 정의를 반환한다', () => {
        const q = mgr.getQuest();
        expect(q.id).toBeTruthy();
        expect(q.target).toBeGreaterThan(0);
    });
});

// ──────────────────────────────────────────────
// distance 타입 퀘스트
// ──────────────────────────────────────────────
describe('QuestManager - distance 타입', () => {
    let mgr: QuestManager;
    let quest: QuestDefinition;

    beforeEach(() => {
        quest = findQuest('distance');
        mgr = new QuestManager(quest);
    });

    it('distance가 증가하면 진행도가 올라간다', () => {
        mgr.update(quest.target / 2, 0, 0);
        expect(mgr.getProgress()).toBe(50);
    });

    it('distance가 target에 도달하면 완료된다', () => {
        mgr.update(quest.target, 0, 0);
        expect(mgr.isComplete()).toBe(true);
    });

    it('distance가 target을 초과해도 progress는 100을 넘지 않는다', () => {
        mgr.update(quest.target * 2, 0, 0);
        expect(mgr.getProgress()).toBe(100);
    });

    it('귤/회피 수는 distance 타입에 영향을 주지 않는다', () => {
        mgr.update(0, 9999, 9999);
        expect(mgr.isComplete()).toBe(false);
        expect(mgr.getProgress()).toBe(0);
    });
});

// ──────────────────────────────────────────────
// collect 타입 퀘스트
// ──────────────────────────────────────────────
describe('QuestManager - collect 타입', () => {
    let mgr: QuestManager;
    let quest: QuestDefinition;

    beforeEach(() => {
        quest = findQuest('collect');
        mgr = new QuestManager(quest);
    });

    it('귤 수집량이 target에 도달하면 완료된다', () => {
        mgr.update(0, quest.target, 0);
        expect(mgr.isComplete()).toBe(true);
    });

    it('부분 수집 시 올바른 진행 퍼센트를 반환한다', () => {
        // target의 절반 수집 → 50%
        mgr.update(0, Math.floor(quest.target / 2), 0);
        expect(mgr.getProgress()).toBe(50);
    });

    it('distance/dodge는 collect 타입에 영향을 주지 않는다', () => {
        mgr.update(9999, 0, 9999);
        expect(mgr.isComplete()).toBe(false);
    });
});

// ──────────────────────────────────────────────
// dodge 타입 퀘스트
// ──────────────────────────────────────────────
describe('QuestManager - dodge 타입', () => {
    let mgr: QuestManager;
    let quest: QuestDefinition;

    beforeEach(() => {
        quest = findQuest('dodge');
        mgr = new QuestManager(quest);
    });

    it('장애물 회피가 target에 도달하면 완료된다', () => {
        mgr.update(0, 0, quest.target);
        expect(mgr.isComplete()).toBe(true);
    });

    it('부분 회피 시 올바른 진행 퍼센트를 반환한다', () => {
        mgr.update(0, 0, Math.floor(quest.target / 2));
        expect(mgr.getProgress()).toBe(50);
    });

    it('distance/collect는 dodge 타입에 영향을 주지 않는다', () => {
        mgr.update(9999, 9999, 0);
        expect(mgr.isComplete()).toBe(false);
    });
});

// ──────────────────────────────────────────────
// 완료 후 불변 보장
// ──────────────────────────────────────────────
describe('QuestManager - 완료 후 상태 불변', () => {
    it('완료 후 update를 호출해도 상태가 변하지 않는다', () => {
        const quest = findQuest('distance');
        const mgr = new QuestManager(quest);

        mgr.update(quest.target, 0, 0);
        expect(mgr.isComplete()).toBe(true);

        // 완료 이후 추가 update 호출
        mgr.update(quest.target * 3, 9999, 9999);
        expect(mgr.isComplete()).toBe(true);
        expect(mgr.getProgress()).toBe(100);
    });
});

// ──────────────────────────────────────────────
// 팩토리 메서드
// ──────────────────────────────────────────────
describe('QuestManager.fromId / fromIndex', () => {
    it('fromId — 유효한 id로 QuestManager를 반환한다', () => {
        const id = DEFAULT_QUESTS[0].id;
        const mgr = QuestManager.fromId(id);
        expect(mgr).not.toBeNull();
        expect(mgr!.getQuest().id).toBe(id);
    });

    it('fromId — 존재하지 않는 id는 null을 반환한다', () => {
        const mgr = QuestManager.fromId('not_exist_id');
        expect(mgr).toBeNull();
    });

    it('fromIndex — 인덱스 0~4 범위는 정상 반환한다', () => {
        for (let i = 0; i < DEFAULT_QUESTS.length; i++) {
            const mgr = QuestManager.fromIndex(i);
            expect(mgr.getQuest().id).toBe(DEFAULT_QUESTS[i].id);
        }
    });

    it('fromIndex — 범위 초과 인덱스는 클램프된다', () => {
        const mgrNeg = QuestManager.fromIndex(-1);
        expect(mgrNeg.getQuest().id).toBe(DEFAULT_QUESTS[0].id);

        const mgrOver = QuestManager.fromIndex(999);
        expect(mgrOver.getQuest().id).toBe(DEFAULT_QUESTS[DEFAULT_QUESTS.length - 1].id);
    });
});
