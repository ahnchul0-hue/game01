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
    FONT_FAMILY,
} from '../utils/Constants';
import type { StageType } from '../utils/Constants';
import { ATLAS_UI_KEY } from '../utils/TextureAtlasBuilder';

export class EffectManager {
    private scene: Phaser.Scene;

    // 슬로우모션
    isSlowmo = false;
    private slowmoStart = 0;

    // 빨간 플래시 오버레이 (재사용)
    private flashOverlay: Phaser.GameObjects.Graphics;

    // 파티클 이미터
    private particleEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

    // G2: 오리 튜브 물 파티클
    private waterEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
    private waterActive = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // 빨간 플래시 오버레이 (미리 생성, 숨김)
        this.flashOverlay = scene.add.graphics().setDepth(DEPTH_EFFECT_OVERLAY);
        this.flashOverlay.fillStyle(0xFF0000, 0.3);
        this.flashOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.flashOverlay.setAlpha(0);

        // 파티클 이미터 (burst 모드로 사용)
        this.particleEmitter = scene.add.particles(0, 0, ATLAS_UI_KEY, {
            frame: 'particle',
            speed: { min: 50, max: 150 },
            scale: { start: 1, end: 0 },
            lifespan: EFFECT_PARTICLE_LIFESPAN,
            quantity: 6,
            reserve: 8,
            emitting: false,
        }).setDepth(DEPTH_EFFECT_OVERLAY);

        // 먼지 파티클 (점프/착지용)
        this.dustEmitter = scene.add.particles(0, 0, ATLAS_UI_KEY, {
            frame: 'particle',
            speed: { min: 20, max: 60 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 300,
            tint: 0xBBAAAA,
            quantity: 4,
            reserve: 6,
            emitting: false,
        }).setDepth(DEPTH_EFFECT_OVERLAY);

        // G2: 물결 파티클 (오리 튜브 파워업 활성 시)
        this.waterEmitter = scene.add.particles(0, 0, ATLAS_UI_KEY, {
            frame: 'particle',
            speed: { min: 15, max: 40 },
            scale: { start: 0.8, end: 0.1 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 600,
            tint: 0x4FC3F7,
            gravityY: -20,
            quantity: 1,
            frequency: 120,
            reserve: 6,
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

    /** 장애물 충돌 이펙트: 빨간 플래시 + 수직 카메라 셰이크 */
    onObstacleHit(): void {
        // 빨간 플래시
        this.flashOverlay.setAlpha(1);
        this.scene.tweens.add({
            targets: this.flashOverlay,
            alpha: 0,
            duration: EFFECT_RED_FLASH_DURATION,
            ease: 'Power1',
        });

        // 수직 카메라 셰이크 (의사-3D에서 더 효과적)
        const cam = this.scene.cameras.main;
        cam.shake(200, 0.015);
    }

    /** 파워업 획득 이펙트: 깜빡임 + 줌 펄스 + 슬로우모션 */
    onPowerUpCollected(player: Phaser.GameObjects.Sprite): void {
        // 깜빡임
        this.scene.tweens.add({
            targets: player,
            alpha: 0.5,
            duration: 80,
            yoyo: true,
            repeat: 2,
        });

        // 줌 펄스 (카메라가 살짝 줌인 후 복귀)
        const cam = this.scene.cameras.main;
        this.scene.tweens.add({
            targets: cam,
            zoom: 1.05,
            duration: 150,
            yoyo: true,
            ease: 'Power2',
        });

        // 슬로우모션 활성화
        this.isSlowmo = true;
        this.slowmoStart = this.scene.time.now;
    }

    /** 스테이지 전환 이펙트: 스테이지명 텍스트 */
    onStageTransition(stage: StageType): void {
        const name = STAGE_NAMES[stage];
        const text = this.scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, `${name}에 도착!`, {
            fontFamily: FONT_FAMILY,
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

    /** 점프 시 바닥에서 먼지 파티클 */
    onJump(x: number, y: number): void {
        this.dustEmitter.setPosition(x, y + 30);
        this.dustEmitter.explode(4, x, y + 30);
    }

    /** 착지 시 바닥에서 먼지 파티클 (더 강하게) */
    onLand(x: number, y: number): void {
        this.dustEmitter.setPosition(x, y + 30);
        this.dustEmitter.explode(6, x, y + 30);
    }

    /** A3: 니어미스 스파크 이펙트 */
    onNearMiss(x: number, y: number): void {
        this.particleEmitter.setPosition(x, y);
        this.particleEmitter.setParticleTint(0x00FF88);
        this.particleEmitter.explode(4, x, y);
    }

    /** 헬멧 파괴 이펙트: 파괴 파티클 */
    onHelmetBreak(x: number, y: number): void {
        this.particleEmitter.setPosition(x, y);
        this.particleEmitter.setParticleTint(0x2E7D32);
        this.particleEmitter.explode(8, x, y);
    }

    /** G2: 오리 튜브 물결 이펙트 on/off */
    setWaterEffect(active: boolean, x: number, y: number): void {
        if (active && !this.waterActive) {
            this.waterEmitter.setPosition(x, y + 20);
            this.waterEmitter.start();
            this.waterActive = true;
        } else if (!active && this.waterActive) {
            this.waterEmitter.stop();
            this.waterActive = false;
        } else if (active) {
            this.waterEmitter.setPosition(x, y + 20);
        }
    }

    /** 매 프레임 호출: 슬로우모션 타이머 체크 */
    update(sceneTimeNow: number): void {
        if (this.isSlowmo) {
            const elapsed = sceneTimeNow - this.slowmoStart;
            if (elapsed >= EFFECT_SLOWMO_DURATION) {
                this.isSlowmo = false;
            }
        }
    }

    reset(): void {
        this.isSlowmo = false;
        this.waterActive = false;
        this.flashOverlay.setAlpha(0);
        this.particleEmitter.stop();
        this.dustEmitter.stop();
        this.waterEmitter.stop();
    }

    destroy(): void {
        this.flashOverlay.destroy();
        this.particleEmitter.destroy();
        this.dustEmitter.destroy();
        this.waterEmitter.destroy();
    }
}
