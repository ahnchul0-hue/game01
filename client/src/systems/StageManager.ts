import Phaser from 'phaser';
import { STAGE_TRANSITION_DURATION } from '../utils/Constants';
import type { StageType } from '../utils/Constants';
import { getStageForDistance } from '../utils/GameLogic';
import { RoadRenderer } from './RoadRenderer';
import { SoundManager } from '../services/SoundManager';
import type { BgmName } from '../services/SoundManager';
import type { GameMode } from '../utils/Constants';

/** 스테이지 ID → BGM 이름 매핑 */
export const STAGE_BGM: Record<StageType, BgmName> = {
    forest:  'bgm-forest',
    river:   'bgm-river',
    village: 'bgm-village',
    onsen:   'bgm-onsen-stage',
};

export class StageManager {
    private scene: Phaser.Scene;
    private currentStage: StageType = 'forest';
    private roadRenderer: RoadRenderer;
    private isTransitioning = false;
    private gameMode: GameMode;

    constructor(scene: Phaser.Scene, roadRenderer: RoadRenderer, gameMode: GameMode = 'normal') {
        this.scene = scene;
        this.roadRenderer = roadRenderer;
        this.gameMode = gameMode;
    }

    /** 거리 기반 스테이지 업데이트. 전환 발생 시 새 스테이지를 반환, 없으면 null */
    update(distance: number): StageType | null {
        const stage = getStageForDistance(distance);
        if (stage === this.currentStage || this.isTransitioning) return null;

        this.currentStage = stage;
        this.transitionTo(stage);
        return stage;
    }

    getCurrentStage(): StageType {
        return this.currentStage;
    }

    /** RoadRenderer에 색상 크로스페이드 요청 + 스테이지 BGM 전환 */
    private transitionTo(newStage: StageType): void {
        this.isTransitioning = true;
        this.roadRenderer.transitionToStage(newStage, STAGE_TRANSITION_DURATION / 1000);

        // 릴렉스 모드는 항상 bgm-onsen 유지 (스테이지 BGM 변경 안 함)
        if (this.gameMode !== 'relax') {
            SoundManager.getInstance().playBgm(STAGE_BGM[newStage]);
        }

        // 전환 완료 후 플래그 해제
        this.scene.time.delayedCall(STAGE_TRANSITION_DURATION, () => {
            this.isTransitioning = false;
        });
    }

    reset(): void {
        this.currentStage = 'forest';
        this.isTransitioning = false;
        this.roadRenderer.setStage('forest');
    }
}
