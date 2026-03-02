import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    EFFECT_RED_FLASH_DURATION,
    EFFECT_SLOWMO_DURATION,
    EFFECT_PARTICLE_LIFESPAN,
    EFFECT_STAGE_TEXT_DURATION,
    DEPTH_EFFECT_OVERLAY,
    DEPTH_STAGE_TEXT,
    STAGE_NAMES,
} from '../utils/Constants';
import type { StageType } from '../utils/Constants';

export class EffectManager {
    private scene: Phaser.Scene;

    // 슬로우모션
    isSlowmo = false;
    private slowmoStart = 0;

    // 빨간 플래시 오버레이 (재사용)
    private flashOverlay: Phaser.GameObjects.Graphics;

    // 파티클 이미터
    private particleEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // 빨간 플래시 오버레이 (미리 생성, 숨김)
        this.flashOverlay = scene.add.graphics().setDepth(DEPTH_EFFECT_OVERLAY);
        this.flashOverlay.fillStyle(0xFF0000, 0.3);
        this.flashOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.flashOverlay.setAlpha(0);

        // 파티클 이미터 (burst 모드로 사용)
        this.particleEmitter = scene.add.particles(0, 0, 'particle', {
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            lifespan: EFFECT_PARTICLE_LIFESPAN,
            quantity: 6,
            emitting: false,
        }).setDepth(DEPTH_EFFECT_OVERLAY);
    }

    /** 아이템 수집 이펙트: 스파클 파티클 + 점수 카운터 바운스 */
    onItemCollected(x: number, y: number, scoreText: Phaser.GameObjects.Text): void {
        // 파티클 burst
        this.particleEmitter.setPosition(x, y);
        this.particleEmitter.setParticleTint(0xFFD700);
        this.particleEmitter.explode(6, x, y);

        // 점수 텍스트 바운스
        this.scene.tweens.add({
            targets: scoreText,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 100,
            yoyo: true,
            ease: 'Power2',
        });
    }

    /** 장애물 충돌 이펙트: 빨간 플래시 + 강화된 카메라 흔들림 */
    onObstacleHit(): void {
        // 빨간 플래시
        this.flashOverlay.setAlpha(1);
        this.scene.tweens.add({
            targets: this.flashOverlay,
            alpha: 0,
            duration: EFFECT_RED_FLASH_DURATION,
            ease: 'Power1',
        });

        // 카메라 흔들림 (강화)
        this.scene.cameras.main.shake(150, 0.01);
    }

    /** 파워업 획득 이펙트: 깜빡임 + 슬로우모션 */
    onPowerUpCollected(player: Phaser.GameObjects.Sprite): void {
        // 깜빡임
        this.scene.tweens.add({
            targets: player,
            alpha: 0.5,
            duration: 80,
            yoyo: true,
            repeat: 2,
        });

        // 슬로우모션 활성화
        this.isSlowmo = true;
        this.slowmoStart = performance.now();
    }

    /** 스테이지 전환 이펙트: 스테이지명 텍스트 */
    onStageTransition(stage: StageType): void {
        const name = STAGE_NAMES[stage];
        const text = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, `${name}에 도착!`, {
            fontFamily: 'Arial',
            fontSize: '36px',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(DEPTH_STAGE_TEXT).setAlpha(0);

        this.scene.tweens.add({
            targets: text,
            alpha: 1,
            y: text.y - 20,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                this.scene.time.delayedCall(EFFECT_STAGE_TEXT_DURATION, () => {
                    this.scene.tweens.add({
                        targets: text,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => text.destroy(),
                    });
                });
            },
        });
    }

    /** 헬멧 파괴 이펙트: 파괴 파티클 */
    onHelmetBreak(x: number, y: number): void {
        this.particleEmitter.setPosition(x, y);
        this.particleEmitter.setParticleTint(0x2E7D32);
        this.particleEmitter.explode(8, x, y);
    }

    /** 매 프레임 호출: 슬로우모션 타이머 체크 */
    update(): void {
        if (this.isSlowmo) {
            const elapsed = performance.now() - this.slowmoStart;
            if (elapsed >= EFFECT_SLOWMO_DURATION) {
                this.isSlowmo = false;
            }
        }
    }

    reset(): void {
        this.isSlowmo = false;
        this.flashOverlay.setAlpha(0);
    }
}
