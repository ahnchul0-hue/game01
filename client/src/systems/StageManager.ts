import Phaser from 'phaser';
import { STAGE_TRANSITION_DURATION } from '../utils/Constants';
import type { StageType } from '../utils/Constants';
import { getStageForDistance } from '../utils/GameLogic';
import { ensureStageTextures } from '../utils/TextureUtils';

export class StageManager {
    private scene: Phaser.Scene;
    private currentStage: StageType = 'forest';

    // 배경 TileSprite 참조
    private bgSky: Phaser.GameObjects.TileSprite;
    private bgTrees: Phaser.GameObjects.TileSprite;
    private bgGround: Phaser.GameObjects.TileSprite;

    private isTransitioning = false;

    constructor(
        scene: Phaser.Scene,
        bgSky: Phaser.GameObjects.TileSprite,
        bgTrees: Phaser.GameObjects.TileSprite,
        bgGround: Phaser.GameObjects.TileSprite,
    ) {
        this.scene = scene;
        this.bgSky = bgSky;
        this.bgTrees = bgTrees;
        this.bgGround = bgGround;
    }

    /** 거리 기반 스테이지 업데이트. 전환 발생 시 새 스테이지를 반환, 없으면 null */
    update(distance: number): StageType | null {
        const stage = getStageForDistance(distance);
        if (stage === this.currentStage || this.isTransitioning) return null;

        const prevStage = this.currentStage;
        this.currentStage = stage;
        this.transitionTo(stage, prevStage);
        return stage;
    }

    getCurrentStage(): StageType {
        return this.currentStage;
    }

    /** 배경 크로스페이드 전환 */
    private transitionTo(newStage: StageType, _prevStage: StageType): void {
        // lazy 텍스처 생성 (CPU 연산으로 메모리 절약)
        ensureStageTextures(this.scene, newStage);
        this.isTransitioning = true;
        const halfDuration = STAGE_TRANSITION_DURATION / 2;

        // 페이드 아웃 → 텍스처 교체 → 페이드 인
        this.scene.tweens.add({
            targets: [this.bgSky, this.bgTrees, this.bgGround],
            alpha: 0,
            duration: halfDuration,
            ease: 'Power1',
            onComplete: () => {
                if (!this.scene.sys.isActive()) {
                    this.isTransitioning = false;
                    return;
                }
                this.bgSky.setTexture(`bg-sky-${newStage}`);
                this.bgTrees.setTexture(`bg-trees-${newStage}`);
                this.bgGround.setTexture(`bg-ground-${newStage}`);

                this.scene.tweens.add({
                    targets: [this.bgSky, this.bgTrees, this.bgGround],
                    alpha: 1,
                    duration: halfDuration,
                    ease: 'Power1',
                    onComplete: () => {
                        this.isTransitioning = false;
                    },
                });
            },
        });
    }

    reset(): void {
        this.currentStage = 'forest';
        this.isTransitioning = false;
        this.bgSky.setTexture('bg-sky-forest').setAlpha(1);
        this.bgTrees.setTexture('bg-trees-forest').setAlpha(1);
        this.bgGround.setTexture('bg-ground-forest').setAlpha(1);
    }
}
