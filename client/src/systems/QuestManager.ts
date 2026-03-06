/**
 * QuestManager — 유한 런 퀘스트 시스템
 *
 * 퀘스트: 특정 목표를 달성하면 게임이 성공적으로 종료됩니다.
 * 타입:
 *   - 'distance'  : 목표 거리 달성
 *   - 'collect'   : 귤(만다린) N개 수집
 *   - 'dodge'     : 장애물 N개 회피
 */

type QuestType = 'distance' | 'collect' | 'dodge';

export interface QuestDefinition {
    id: string;
    type: QuestType;
    target: number;
    description: string;
    /** 완료 시 지급되는 귤 보상 */
    rewardMandarin: number;
}

/** 런타임 진행 상태 */
interface QuestProgress {
    quest: QuestDefinition;
    current: number;
}

/** 기본 퀘스트 목록 (5종) */
export const DEFAULT_QUESTS: QuestDefinition[] = [
    {
        id: 'q_distance_1000',
        type: 'distance',
        target: 1000,
        description: '1,000m 달리기',
        rewardMandarin: 30,
    },
    {
        id: 'q_distance_3000',
        type: 'distance',
        target: 3000,
        description: '3,000m 달리기',
        rewardMandarin: 80,
    },
    {
        id: 'q_collect_30',
        type: 'collect',
        target: 30,
        description: '귤 30개 수집',
        rewardMandarin: 20,
    },
    {
        id: 'q_collect_80',
        type: 'collect',
        target: 80,
        description: '귤 80개 수집',
        rewardMandarin: 60,
    },
    {
        id: 'q_dodge_10',
        type: 'dodge',
        target: 10,
        description: '장애물 10개 피하기',
        rewardMandarin: 25,
    },
];

export class QuestManager {
    private progress: QuestProgress;
    private completed = false;

    constructor(quest: QuestDefinition) {
        this.progress = { quest, current: 0 };
    }

    /**
     * 매 프레임 또는 이벤트 발생 시 호출합니다.
     * @param distance  현재 달린 거리 (m)
     * @param mandarins 현재까지 수집한 귤 수
     * @param dodges    현재까지 회피한 장애물 수
     */
    update(distance: number, mandarins: number, dodges: number): void {
        if (this.completed) return;

        const { quest } = this.progress;
        switch (quest.type) {
            case 'distance':
                this.progress.current = Math.floor(distance);
                break;
            case 'collect':
                this.progress.current = mandarins;
                break;
            case 'dodge':
                this.progress.current = dodges;
                break;
        }

        if (this.progress.current >= quest.target) {
            this.completed = true;
        }
    }

    /** 퀘스트가 완료되었으면 true */
    isComplete(): boolean {
        return this.completed;
    }

    /**
     * 진행 퍼센트 (0 ~ 100)
     * 완료 시 100을 반환합니다.
     */
    getProgress(): number {
        const { current, quest } = this.progress;
        return Math.min(100, Math.floor((current / quest.target) * 100));
    }

    /** 현재 진행 수치 */
    getCurrent(): number {
        return this.progress.current;
    }

    /** 퀘스트 정의 반환 */
    getQuest(): QuestDefinition {
        return this.progress.quest;
    }

    /**
     * 퀘스트 선택 화면용 — 이름/설명에서 적절한 퀘스트를 색인으로 선택합니다.
     * @param index DEFAULT_QUESTS 인덱스 (0 ~ 4)
     */
    static fromIndex(index: number): QuestManager {
        const quest = DEFAULT_QUESTS[Math.max(0, Math.min(index, DEFAULT_QUESTS.length - 1))];
        return new QuestManager(quest);
    }

    static fromId(id: string): QuestManager | null {
        const quest = DEFAULT_QUESTS.find(q => q.id === id) ?? null;
        if (!quest) return null;
        return new QuestManager(quest);
    }
}
