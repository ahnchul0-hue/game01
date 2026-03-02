import Phaser from 'phaser';
import {
    LANE_COUNT,
    LANE_POSITIONS,
    PLAYER_Y,
    JUMP_VELOCITY,
    SLIDE_DURATION,
    LANE_MOVE_DURATION,
    POWERUP_CONFIGS,
    POWERUP_SCORE_MULTIPLIER_TUBE,
} from '../utils/Constants';
import type { PowerUpType, SkinId } from '../utils/Constants';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private currentLane = 1; // 0=좌, 1=중, 2=우
    private isJumping = false;
    private isSliding = false;
    private isMoving = false; // Tween 진행 중 여부
    private isInvincible = false;
    private slideTimer: Phaser.Time.TimerEvent | null = null;
    private originalBodyHeight = 0;
    private originalBodyOffsetY = 0;

    // M3: 파워업 상태
    private hasHelmet = false;
    private hasTube = false;
    private hasFriend = false;
    private scoreMultiplier = 1;
    private helmetOverlay: Phaser.GameObjects.Sprite | null = null;
    private friendSprite: Phaser.GameObjects.Sprite | null = null;
    private tubeTimerEvent: Phaser.Time.TimerEvent | null = null;
    private friendTimerEvent: Phaser.Time.TimerEvent | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, skinId: SkinId = 'default') {
        super(scene, x, y, `capybara-${skinId}`);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setGravityY(0); // Scene 전역 gravity 사용
        body.setCollideWorldBounds(false);

        this.originalBodyHeight = body.height;
        this.originalBodyOffsetY = body.offset.y;
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
        this.setVelocityY(JUMP_VELOCITY);
    }

    slide(): void {
        if (this.isSliding || this.isJumping) return;
        this.isSliding = true;

        // 히트박스 높이 절반으로 축소
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(body.width, this.originalBodyHeight / 2);
        body.setOffset(body.offset.x, this.originalBodyOffsetY + this.originalBodyHeight / 2);

        // 시각적 피드백: Y 스케일 축소 + 위치 보정 (origin 변경 없이)
        const halfH = this.displayHeight * 0.25;
        this.setScale(this.scaleX, 0.5);
        this.y += halfH;

        this.slideTimer = this.scene.time.delayedCall(SLIDE_DURATION, () => {
            this.endSlide();
        });
    }

    private endSlide(): void {
        this.isSliding = false;

        // 히트박스 복원
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(body.width, this.originalBodyHeight);
        body.setOffset(body.offset.x, this.originalBodyOffsetY);

        // 시각적 복원: 위치를 원래로 되돌림
        const halfH = this.displayHeight * 0.5;
        this.setScale(this.scaleX, 1);
        this.y -= halfH;

        this.slideTimer = null;
    }

    private tweenToLane(): void {
        this.isMoving = true;
        this.scene.tweens.add({
            targets: this,
            x: LANE_POSITIONS[this.currentLane],
            duration: LANE_MOVE_DURATION,
            ease: 'Power2',
            onComplete: () => {
                this.isMoving = false;
            },
        });
    }

    update(): void {
        // 착지 체크
        if (this.isJumping && this.y >= PLAYER_Y) {
            this.y = PLAYER_Y;
            this.setVelocityY(0);
            this.isJumping = false;
        }

        // 바닥 고정 (점프/슬라이드 아닐 때 중력에 의해 떨어지는 것 방지)
        if (!this.isJumping && !this.isSliding && this.y > PLAYER_Y) {
            this.y = PLAYER_Y;
            this.setVelocityY(0);
        }

        // M3: 파워업 오버레이/동반자 위치 동기화
        if (this.helmetOverlay) {
            this.helmetOverlay.setPosition(this.x, this.y - 70);
        }
        if (this.friendSprite) {
            this.friendSprite.setPosition(this.x - 70, this.y + 10);
        }
    }

    setInvincible(duration: number): void {
        this.isInvincible = true;

        // 깜빡임
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

    getIsInvincible(): boolean {
        return this.isInvincible;
    }

    getIsSliding(): boolean {
        return this.isSliding;
    }

    getIsJumping(): boolean {
        return this.isJumping;
    }

    getCurrentLane(): number {
        return this.currentLane;
    }

    // ========== M3: 파워업 메서드 ==========

    applyPowerUp(type: PowerUpType): void {
        switch (type) {
            case 'helmet':
                this.hasHelmet = true;
                if (!this.helmetOverlay) {
                    this.helmetOverlay = this.scene.add.sprite(this.x, this.y - 70, 'helmet-overlay');
                    this.helmetOverlay.setDepth(this.depth + 1);
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
                    this.friendSprite = this.scene.add.sprite(this.x - 70, this.y + 10, 'friend-sprite');
                    this.friendSprite.setDepth(this.depth);
                }
                this.friendSprite.setVisible(true);

                if (this.friendTimerEvent) this.friendTimerEvent.destroy();
                this.friendTimerEvent = this.scene.time.delayedCall(
                    POWERUP_CONFIGS.friend.duration,
                    () => this.clearFriend(),
                );
                break;
        }
    }

    /** 헬멧 소모. 보유 시 true 반환, 미보유 시 false */
    consumeHelmet(): boolean {
        if (!this.hasHelmet) return false;
        this.hasHelmet = false;
        if (this.helmetOverlay) {
            this.helmetOverlay.setVisible(false);
        }
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
        if (this.friendSprite) {
            this.friendSprite.setVisible(false);
        }
        this.friendTimerEvent = null;
    }

    clearAllPowerUps(): void {
        if (this.hasHelmet) this.consumeHelmet();
        if (this.hasTube) {
            if (this.tubeTimerEvent) {
                this.tubeTimerEvent.destroy();
                this.tubeTimerEvent = null;
            }
            this.clearTube();
        }
        if (this.hasFriend) {
            if (this.friendTimerEvent) {
                this.friendTimerEvent.destroy();
                this.friendTimerEvent = null;
            }
            this.clearFriend();
        }
    }

    getScoreMultiplier(): number {
        return this.scoreMultiplier;
    }

    getHasFriend(): boolean {
        return this.hasFriend;
    }

    getHasHelmet(): boolean {
        return this.hasHelmet;
    }

    destroy(fromScene?: boolean): void {
        if (this.slideTimer) {
            this.slideTimer.destroy();
            this.slideTimer = null;
        }
        this.clearAllPowerUps();
        if (this.helmetOverlay) {
            this.helmetOverlay.destroy();
            this.helmetOverlay = null;
        }
        if (this.friendSprite) {
            this.friendSprite.destroy();
            this.friendSprite = null;
        }
        super.destroy(fromScene);
    }
}
