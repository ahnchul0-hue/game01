import Phaser from 'phaser';
import {
    LANE_COUNT,
    LANE_POSITIONS,
    PLAYER_Y,
    JUMP_VELOCITY,
    SLIDE_DURATION,
    LANE_MOVE_DURATION,
} from '../utils/Constants';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private currentLane = 1; // 0=좌, 1=중, 2=우
    private isJumping = false;
    private isSliding = false;
    private isMoving = false; // Tween 진행 중 여부
    private isInvincible = false;
    private slideTimer: Phaser.Time.TimerEvent | null = null;
    private originalBodyHeight = 0;
    private originalBodyOffsetY = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'capybara');

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

    destroy(fromScene?: boolean): void {
        if (this.slideTimer) {
            this.slideTimer.destroy();
            this.slideTimer = null;
        }
        super.destroy(fromScene);
    }
}
