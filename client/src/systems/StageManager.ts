import Phaser from 'phaser';
import { STAGE_TRANSITION_DURATION } from '../utils/Constants';
import type { StageType } from '../utils/Constants';
import { getStageForDistance } from '../utils/GameLogic';
import { RoadRenderer } from './RoadRenderer';

export class StageManager {
    private scene: Phaser.Scene;
    private currentStage: StageType = 'forest';
    private roadRenderer: RoadRenderer;
    private isTransitioning = false;

    constructor(scene: Phaser.Scene, roadRenderer: RoadRenderer) {
        this.scene = scene;
        this.roadRenderer = roadRenderer;
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

    /** RoadRenderer에 색상 크로스페이드 요청 */
    private transitionTo(newStage: StageType): void {
        this.isTransitioning = true;
        this.roadRenderer.transitionToStage(newStage, STAGE_TRANSITION_DURATION / 1000);

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
