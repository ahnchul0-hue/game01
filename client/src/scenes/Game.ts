import Phaser from 'phaser';
import { Player } from '../objects/Player';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    LANE_POSITIONS,
    PLAYER_Y,
    BASE_SPEED,
    MAX_SPEED,
    SPEED_INCREMENT,
    SWIPE_THRESHOLD,
    RELAX_SPEED_MULTIPLIER,
    SCENE_GAME,
    SCENE_GAME_OVER,
} from '../utils/Constants';

type GameMode = 'normal' | 'relax';

interface GameInitData {
    mode?: GameMode;
}

export class Game extends Phaser.Scene {
    private player!: Player;
    private gameSpeed = BASE_SPEED;
    private distance = 0;
    private score = 0;
    private isGameOver = false;
    private mode: GameMode = 'normal';

    // 배경 레이어
    private bgSky!: Phaser.GameObjects.TileSprite;
    private bgTrees!: Phaser.GameObjects.TileSprite;
    private bgGround!: Phaser.GameObjects.TileSprite;

    // 입력
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private swipeStart: { x: number; y: number } | null = null;

    // HUD
    private scoreText!: Phaser.GameObjects.Text;
    private distanceText!: Phaser.GameObjects.Text;

    constructor() {
        super(SCENE_GAME);
    }

    init(data: GameInitData): void {
        this.mode = data.mode ?? 'normal';
        this.distance = 0;
        this.score = 0;
        this.gameSpeed = BASE_SPEED;
        this.isGameOver = false;
        this.swipeStart = null;
    }

    create(): void {
        // 배경 (패럴랙스 3레이어)
        this.bgSky = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg-sky')
            .setOrigin(0, 0)
            .setDepth(0);

        this.bgTrees = this.add.tileSprite(0, GAME_HEIGHT - 500, GAME_WIDTH, 300, 'bg-trees')
            .setOrigin(0, 0)
            .setDepth(1);

        this.bgGround = this.add.tileSprite(0, GAME_HEIGHT - 200, GAME_WIDTH, 200, 'bg-ground')
            .setOrigin(0, 0)
            .setDepth(2);

        // 레인 구분선 (프로토타입용)
        const laneLines = this.add.graphics().setDepth(3);
        laneLines.lineStyle(1, 0xFFFFFF, 0.15);
        laneLines.lineBetween(GAME_WIDTH / 3, GAME_HEIGHT - 200, GAME_WIDTH / 3, GAME_HEIGHT);
        laneLines.lineBetween((GAME_WIDTH / 3) * 2, GAME_HEIGHT - 200, (GAME_WIDTH / 3) * 2, GAME_HEIGHT);

        // 플레이어
        this.player = new Player(this, LANE_POSITIONS[1], PLAYER_Y);
        this.player.setDepth(10);

        // 키보드 입력
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        // 터치 입력
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            this.swipeStart = { x: p.x, y: p.y };
        });

        this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (!this.swipeStart) return;
            const dx = p.x - this.swipeStart.x;
            const dy = p.y - this.swipeStart.y;

            if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) {
                    this.player.moveRight();
                } else {
                    this.player.moveLeft();
                }
            } else if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
                if (dy < 0) {
                    this.player.jump();
                } else {
                    this.player.slide();
                }
            }

            this.swipeStart = null;
        });

        // HUD
        this.scoreText = this.add.text(20, 20, '0', {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
        }).setScrollFactor(0).setDepth(100);

        this.distanceText = this.add.text(GAME_WIDTH - 20, 20, '0m', {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        // 모드 표시 (릴렉스)
        if (this.mode === 'relax') {
            this.add.text(GAME_WIDTH / 2, 20, 'RELAX', {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#81C784',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
        }
    }

    update(_time: number, delta: number): void {
        if (this.isGameOver) return;

        const dt = delta / 1000; // ms → seconds

        // 속도 증가 (거리 기반)
        const speedMultiplier = this.mode === 'relax' ? RELAX_SPEED_MULTIPLIER : 1;
        this.gameSpeed = Math.min(
            BASE_SPEED + this.distance * SPEED_INCREMENT,
            MAX_SPEED,
        ) * speedMultiplier;

        // 거리 누적
        this.distance += this.gameSpeed * dt;

        // 배경 스크롤 (패럴랙스)
        this.bgSky.tilePositionX += this.gameSpeed * 0.1 * dt;
        this.bgTrees.tilePositionX += this.gameSpeed * 0.4 * dt;
        this.bgGround.tilePositionX += this.gameSpeed * dt;

        // 키보드 입력
        if (this.cursors) {
            if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
                this.player.moveLeft();
            }
            if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
                this.player.moveRight();
            }
            if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
                this.player.jump();
            }
            if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
                this.player.slide();
            }
        }

        // 플레이어 업데이트
        this.player.update();

        // HUD 업데이트
        this.scoreText.setText(`${this.score}`);
        this.distanceText.setText(`${Math.floor(this.distance)}m`);
    }

    triggerGameOver(): void {
        if (this.isGameOver) return;
        this.isGameOver = true;

        this.time.delayedCall(500, () => {
            this.scene.start(SCENE_GAME_OVER, {
                score: this.score,
                distance: Math.floor(this.distance),
                mode: this.mode,
            });
        });
    }
}
