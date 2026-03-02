import Phaser from 'phaser';
import { PerspectiveCamera } from '../systems/PerspectiveCamera';
import {
    LANE_COUNT,
    PLAYER_Z,
    LANE_OFFSETS,
    JUMP_VELOCITY,
    SLIDE_DURATION,
    LANE_MOVE_DURATION,
    POWERUP_CONFIGS,
    POWERUP_SCORE_MULTIPLIER_TUBE,
    GRAVITY,
    COMPANION_CONFIGS,
} from '../utils/Constants';
import type { PowerUpType, SkinId, CompanionId } from '../utils/Constants';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private currentLane = 1; // 0=좌, 1=중, 2=우
    private isJumping = false;
    private isSliding = false;
    private isMoving = false;
    private isInvincible = false;
    private slideTimer: Phaser.Time.TimerEvent | null = null;

    // 점프 시뮬레이션 (수동 — physics gravity 미사용)
    private jumpVelocityY = 0;
    private jumpOffsetY = 0; // 투영 Y에서의 오프셋

    // 기본 투영 위치 (z=PLAYER_Z)
    private baseScreenY: number;
    private baseScale: number;

    // 달리기 애니메이션
    private runTime = 0;
    private shadow: Phaser.GameObjects.Ellipse | null = null;

    // 동물 친구 (영구 스프라이트)
    private companionSprite: Phaser.GameObjects.Graphics | null = null;

    // 파워업 상태
    private hasHelmet = false;
    private hasTube = false;
    private hasFriend = false;
    private hasMagnet = false;
    private scoreMultiplier = 1;
    private helmetOverlay: Phaser.GameObjects.Sprite | null = null;
    private friendSprite: Phaser.GameObjects.Sprite | null = null;
    private tubeTimerEvent: Phaser.Time.TimerEvent | null = null;
    private friendTimerEvent: Phaser.Time.TimerEvent | null = null;
    private magnetTimerEvent: Phaser.Time.TimerEvent | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, skinId: SkinId = 'default', companionId: CompanionId = 'none') {
        super(scene, x, y, `capybara-${skinId}`);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setGravityY(0);
        body.setCollideWorldBounds(false);

        // 플레이어 z 고정 위치 계산
        const proj = PerspectiveCamera.projectZ(PLAYER_Z);
        this.baseScreenY = proj.screenY;
        this.baseScale = proj.scale;

        // 초기 위치 설정
        const screenX = PerspectiveCamera.getLaneScreenX(PLAYER_Z, LANE_OFFSETS[this.currentLane]);
        this.setPosition(screenX, this.baseScreenY);
        this.setScale(this.baseScale);
        this.setDepth(10);

        // 그림자 타원
        this.shadow = scene.add.ellipse(screenX, this.baseScreenY + 50 * this.baseScale, 70, 20, 0x000000, 0.3);
        this.shadow.setDepth(9);

        // 동물 친구 스프라이트 (항상 표시)
        if (companionId !== 'none') {
            this.createCompanionSprite(companionId);
        }
    }

    moveLeft(): void {
        if (this.currentLane <= 0 || this.isMoving) return;
        this.currentLane--;
        this.tweenToLane();
    }

    moveRight(): void {
        if (this.currentLane >= LANE_COUNT - 1 || this.isMoving) return;
        this.currentLane++;
        this.tweenToLane();
    }

    jump(): void {
        if (this.isJumping || this.isSliding) return;
        this.isJumping = true;
        this.jumpVelocityY = JUMP_VELOCITY;
        this.jumpOffsetY = 0;
        // Squash/Stretch
        this.scene.tweens.add({
            targets: this, scaleX: this.baseScale * 0.85, scaleY: this.baseScale * 1.2,
            duration: 100, ease: 'Power2',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this, scaleX: this.baseScale, scaleY: this.baseScale,
                    duration: 150, ease: 'Power1',
                });
            },
        });
    }

    slide(): void {
        if (this.isSliding || this.isJumping) return;
        this.isSliding = true;

        // 시각적 축소
        this.setScale(this.baseScale, this.baseScale * 0.5);

        this.slideTimer = this.scene.time.delayedCall(SLIDE_DURATION, () => {
            this.endSlide();
        });
    }

    private endSlide(): void {
        this.isSliding = false;
        this.setScale(this.baseScale);
        this.slideTimer = null;
    }

    private tweenToLane(): void {
        this.isMoving = true;
        const targetX = PerspectiveCamera.getLaneScreenX(PLAYER_Z, LANE_OFFSETS[this.currentLane]);
        this.scene.tweens.add({
            targets: this,
            x: targetX,
            duration: LANE_MOVE_DURATION,
            ease: 'Power2',
            onComplete: () => {
                this.isMoving = false;
            },
        });
    }

    update(): void {
        const dt = this.scene.game.loop.delta / 1000;

        // 달리기 보빙 애니메이션 (sin 곡선)
        this.runTime += dt * 10;
        const runBob = this.isJumping || this.isSliding ? 0 : Math.sin(this.runTime) * 3;

        // 점프 시뮬레이션 (수동 중력)
        if (this.isJumping) {
            this.jumpVelocityY += GRAVITY * dt;
            this.jumpOffsetY += this.jumpVelocityY * dt;

            if (this.jumpOffsetY >= 0) {
                this.jumpOffsetY = 0;
                this.jumpVelocityY = 0;
                this.isJumping = false;
                this.scene.tweens.add({
                    targets: this, scaleX: this.baseScale * 1.25, scaleY: this.baseScale * 0.75,
                    duration: 80, ease: 'Power2',
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: this, scaleX: this.baseScale, scaleY: this.baseScale,
                            duration: 150, ease: 'Bounce.easeOut',
                        });
                    },
                });
            }
        }

        // Y 위치: 기본 투영 Y + 점프 오프셋 + 달리기 보빙
        this.y = this.baseScreenY + this.jumpOffsetY + runBob;

        // 그림자 위치 동기화 (항상 바닥에)
        if (this.shadow) {
            this.shadow.setPosition(this.x, this.baseScreenY + 50 * this.baseScale);
            // 점프 시 그림자 축소
            const shadowScale = this.isJumping ? 0.5 : 1;
            this.shadow.setScale(this.baseScale * shadowScale, this.baseScale * shadowScale * 0.3);
        }

        // 파워업 오버레이/동반자 위치 동기화
        if (this.helmetOverlay) {
            this.helmetOverlay.setPosition(this.x, this.y - 70 * this.baseScale);
            this.helmetOverlay.setScale(this.baseScale);
        }
        if (this.friendSprite) {
            this.friendSprite.setPosition(this.x - 70 * this.baseScale, this.y + 10 * this.baseScale);
            this.friendSprite.setScale(this.baseScale);
        }

        // 동물 친구 위치 동기화 (플레이어 오른쪽 뒤)
        if (this.companionSprite) {
            const bobOffset = Math.sin(this.runTime * 0.7) * 4;
            this.companionSprite.setPosition(
                this.x + 65 * this.baseScale,
                this.y + 20 * this.baseScale + bobOffset,
            );
            this.companionSprite.setScale(this.baseScale * 0.8);
        }
    }

    setInvincible(duration: number): void {
        this.isInvincible = true;
        this.scene.tweens.add({
            targets: this,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: Math.floor(duration / 200),
        });
        this.scene.time.delayedCall(duration, () => {
            this.isInvincible = false;
            this.setAlpha(1);
        });
    }

    private createCompanionSprite(id: CompanionId): void {
        const config = COMPANION_CONFIGS.find(c => c.id === id);
        if (!config) return;

        const gfx = this.scene.add.graphics();
        // 작은 원형 동물 친구 (색상으로 구별)
        gfx.fillStyle(config.color, 1);
        gfx.fillCircle(0, 0, 18);
        // 눈
        gfx.fillStyle(0xFFFFFF, 1);
        gfx.fillCircle(-6, -5, 5);
        gfx.fillCircle(6, -5, 5);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(-5, -5, 2.5);
        gfx.fillCircle(7, -5, 2.5);

        gfx.setDepth(this.depth - 1);
        this.companionSprite = gfx;
    }

    getIsInvincible(): boolean { return this.isInvincible; }
    getIsSliding(): boolean { return this.isSliding; }
    getIsJumping(): boolean { return this.isJumping; }
    getCurrentLane(): number { return this.currentLane; }

    // ========== 파워업 메서드 ==========

    applyPowerUp(type: PowerUpType): void {
        switch (type) {
            case 'helmet':
                this.hasHelmet = true;
                if (!this.helmetOverlay) {
                    this.helmetOverlay = this.scene.add.sprite(this.x, this.y - 70 * this.baseScale, 'helmet-overlay');
                    this.helmetOverlay.setDepth(this.depth + 1);
                    this.helmetOverlay.setScale(this.baseScale);
                }
                this.helmetOverlay.setVisible(true);
                break;

            case 'tube':
                this.hasTube = true;
                this.scoreMultiplier = POWERUP_SCORE_MULTIPLIER_TUBE;
                this.setTint(0x64B5F6);
                if (this.tubeTimerEvent) this.tubeTimerEvent.destroy();
                this.tubeTimerEvent = this.scene.time.delayedCall(
                    POWERUP_CONFIGS.tube.duration,
                    () => this.clearTube(),
                );
                break;

            case 'friend':
                this.hasFriend = true;
                this.isInvincible = true;
                if (!this.friendSprite) {
                    this.friendSprite = this.scene.add.sprite(
                        this.x - 70 * this.baseScale,
                        this.y + 10 * this.baseScale,
                        'friend-sprite'
                    );
                    this.friendSprite.setDepth(this.depth);
                    this.friendSprite.setScale(this.baseScale);
                }
                this.friendSprite.setVisible(true);
                if (this.friendTimerEvent) this.friendTimerEvent.destroy();
                this.friendTimerEvent = this.scene.time.delayedCall(
                    POWERUP_CONFIGS.friend.duration,
                    () => this.clearFriend(),
                );
                break;

            case 'magnet':
                this.hasMagnet = true;
                this.setTint(0xFF4444);
                if (this.magnetTimerEvent) this.magnetTimerEvent.destroy();
                this.magnetTimerEvent = this.scene.time.delayedCall(
                    POWERUP_CONFIGS.magnet.duration,
                    () => this.clearMagnet(),
                );
                break;
        }
    }

    consumeHelmet(): boolean {
        if (!this.hasHelmet) return false;
        this.hasHelmet = false;
        if (this.helmetOverlay) this.helmetOverlay.setVisible(false);
        return true;
    }

    private clearTube(): void {
        this.hasTube = false;
        this.scoreMultiplier = 1;
        this.clearTint();
        this.tubeTimerEvent = null;
    }

    private clearFriend(): void {
        this.hasFriend = false;
        this.isInvincible = false;
        if (this.friendSprite) this.friendSprite.setVisible(false);
        this.friendTimerEvent = null;
    }

    private clearMagnet(): void {
        this.hasMagnet = false;
        if (!this.hasTube) this.clearTint();
        this.magnetTimerEvent = null;
    }

    clearAllPowerUps(): void {
        if (this.hasHelmet) this.consumeHelmet();
        if (this.hasTube) {
            if (this.tubeTimerEvent) { this.tubeTimerEvent.destroy(); this.tubeTimerEvent = null; }
            this.clearTube();
        }
        if (this.hasFriend) {
            if (this.friendTimerEvent) { this.friendTimerEvent.destroy(); this.friendTimerEvent = null; }
            this.clearFriend();
        }
        if (this.hasMagnet) {
            if (this.magnetTimerEvent) { this.magnetTimerEvent.destroy(); this.magnetTimerEvent = null; }
            this.clearMagnet();
        }
    }

    getScoreMultiplier(): number { return this.scoreMultiplier; }
    getHasFriend(): boolean { return this.hasFriend; }
    getHasHelmet(): boolean { return this.hasHelmet; }
    getHasMagnet(): boolean { return this.hasMagnet; }

    destroy(fromScene?: boolean): void {
        if (!this.scene) return;
        if (this.slideTimer) { this.slideTimer.destroy(); this.slideTimer = null; }
        this.clearAllPowerUps();
        this.scene.tweens.killTweensOf(this);
        if (this.helmetOverlay) { this.helmetOverlay.destroy(); this.helmetOverlay = null; }
        if (this.friendSprite) { this.friendSprite.destroy(); this.friendSprite = null; }
        if (this.companionSprite) { this.companionSprite.destroy(); this.companionSprite = null; }
        if (this.shadow) { this.shadow.destroy(); this.shadow = null; }
        super.destroy(fromScene);
    }
}
