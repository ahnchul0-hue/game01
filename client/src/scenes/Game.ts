import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Obstacle } from '../objects/Obstacle';
import { Item } from '../objects/Item';
import { PowerUp } from '../objects/PowerUp';
import { ObstaclePool } from '../pools/ObstaclePool';
import { ItemPool } from '../pools/ItemPool';
import { PowerUpPool } from '../pools/PowerUpPool';
import { DifficultyManager } from '../systems/DifficultyManager';
import { SpawnManager } from '../systems/SpawnManager';
import { StageManager } from '../systems/StageManager';
import { EffectManager } from '../systems/EffectManager';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    LANE_POSITIONS,
    PLAYER_Y,
    BASE_SPEED,
    SWIPE_THRESHOLD,
    MAX_FREE_REVIVES,
    INVINCIBLE_DURATION,
    SCENE_GAME,
    SCENE_GAME_OVER,
    EFFECT_SLOWMO_SCALE,
} from '../utils/Constants';
import type { GameMode, CollectedItems } from '../utils/Constants';

type GameState = 'playing' | 'revivePrompt' | 'gameOver';

interface GameInitData {
    mode?: GameMode;
}

export class Game extends Phaser.Scene {
    private player!: Player;
    private gameSpeed = BASE_SPEED;
    private distance = 0;
    private score = 0;
    private state: GameState = 'playing';
    private mode: GameMode = 'normal';

    // M2: 풀/매니저
    private obstaclePool!: ObstaclePool;
    private itemPool!: ItemPool;
    private difficulty!: DifficultyManager;
    private spawnManager!: SpawnManager;

    // M3: 파워업/스테이지/이펙트
    private powerUpPool!: PowerUpPool;
    private stageManager!: StageManager;
    private effectManager!: EffectManager;

    // M2: 부활
    private revivesUsed = 0;

    // M2: 수집 아이템 카운트
    private collectedItems: CollectedItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };

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

    // 부활 UI
    private reviveContainer: Phaser.GameObjects.Container | null = null;
    private reviveHitZones: Phaser.GameObjects.Zone[] = [];

    constructor() {
        super(SCENE_GAME);
    }

    init(data: GameInitData): void {
        this.mode = data.mode ?? 'normal';
        this.distance = 0;
        this.score = 0;
        this.gameSpeed = BASE_SPEED;
        this.state = 'playing';
        this.swipeStart = null;
        this.revivesUsed = 0;
        this.collectedItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        this.reviveContainer = null;
        this.reviveHitZones = [];
    }

    create(): void {
        // 배경 (패럴랙스 3레이어 — M3: 스테이지별 텍스처)
        this.bgSky = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg-sky-forest')
            .setOrigin(0, 0).setDepth(0);
        this.bgTrees = this.add.tileSprite(0, GAME_HEIGHT - 512, GAME_WIDTH, 256, 'bg-trees-forest')
            .setOrigin(0, 0).setDepth(1);
        this.bgGround = this.add.tileSprite(0, GAME_HEIGHT - 256, GAME_WIDTH, 256, 'bg-ground-forest')
            .setOrigin(0, 0).setDepth(2);

        // 레인 구분선
        const laneLines = this.add.graphics().setDepth(3);
        laneLines.lineStyle(2, 0xFFFFFF, 0.2);
        const laneX1 = LANE_POSITIONS[0] + (LANE_POSITIONS[1] - LANE_POSITIONS[0]) / 2;
        const laneX2 = LANE_POSITIONS[1] + (LANE_POSITIONS[2] - LANE_POSITIONS[1]) / 2;
        laneLines.lineBetween(laneX1, GAME_HEIGHT - 256, laneX1, GAME_HEIGHT);
        laneLines.lineBetween(laneX2, GAME_HEIGHT - 256, laneX2, GAME_HEIGHT);

        // 플레이어
        this.player = new Player(this, LANE_POSITIONS[1], PLAYER_Y);
        this.player.setDepth(10);

        // M2: 오브젝트 풀 + 매니저
        this.obstaclePool = new ObstaclePool(this);
        this.itemPool = new ItemPool(this);
        this.powerUpPool = new PowerUpPool(this);
        this.difficulty = new DifficultyManager();
        this.spawnManager = new SpawnManager(this.obstaclePool, this.itemPool, this.powerUpPool, this.difficulty);

        // M3: 스테이지/이펙트 매니저
        this.stageManager = new StageManager(this, this.bgSky, this.bgTrees, this.bgGround);
        this.effectManager = new EffectManager(this);

        // M2: 충돌 감지 (processCallback 사용 — 리뷰 C3)
        this.physics.add.overlap(
            this.player,
            this.obstaclePool.getGroup(),
            (_p, _o) => this.onHitObstacle(),
            (_p, o) => this.shouldObstacleCollide(o as unknown as Obstacle),
            this,
        );
        this.physics.add.overlap(
            this.player,
            this.itemPool.getGroup(),
            (_p, i) => this.onCollectItem(i as unknown as Item),
            undefined,
            this,
        );

        // M3: 파워업 충돌 감지
        this.physics.add.overlap(
            this.player,
            this.powerUpPool.getGroup(),
            (_p, pu) => this.onCollectPowerUp(pu as unknown as PowerUp),
            undefined,
            this,
        );

        // 키보드 입력
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        // 터치 입력
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (this.state !== 'playing') return;
            this.swipeStart = { x: p.x, y: p.y };
        });

        this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
            if (!this.swipeStart || this.state !== 'playing') return;
            const dx = p.x - this.swipeStart.x;
            const dy = p.y - this.swipeStart.y;

            if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) this.player.moveRight();
                else this.player.moveLeft();
            } else if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
                if (dy < 0) this.player.jump();
                else this.player.slide();
            }

            this.swipeStart = null;
        });

        // HUD
        this.scoreText = this.add.text(20, 20, '0', {
            fontFamily: 'Arial', fontSize: '32px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(100);

        this.distanceText = this.add.text(GAME_WIDTH - 20, 20, '0m', {
            fontFamily: 'Arial', fontSize: '28px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        // 모드 표시
        if (this.mode === 'relax') {
            this.add.text(GAME_WIDTH / 2, 20, 'RELAX', {
                fontFamily: 'Arial', fontSize: '20px', color: '#81C784',
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
        }
    }

    update(_time: number, delta: number): void {
        if (this.state !== 'playing') return;

        // M3: 슬로우모션 적용
        this.effectManager.update();
        const effectiveDelta = this.effectManager.isSlowmo ? delta * EFFECT_SLOWMO_SCALE : delta;

        const dt = effectiveDelta / 1000;
        const isRelax = this.mode === 'relax';

        // 속도 증가 (DifficultyManager 사용)
        this.gameSpeed = this.difficulty.getSpeed(this.distance, isRelax);

        // 거리 누적
        this.distance += this.gameSpeed * dt;

        // 배경 스크롤
        this.bgSky.tilePositionX += this.gameSpeed * 0.1 * dt;
        this.bgTrees.tilePositionX += this.gameSpeed * 0.4 * dt;
        this.bgGround.tilePositionX += this.gameSpeed * dt;

        // 키보드 입력
        if (this.cursors) {
            if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.player.moveLeft();
            if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.player.moveRight();
            if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) this.player.jump();
            if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) this.player.slide();
        }

        // 플레이어 업데이트
        this.player.update();

        // M2: 스폰 업데이트
        this.spawnManager.update(effectiveDelta, this.distance, this.gameSpeed, isRelax);

        // M3: 스테이지 전환 체크
        const newStage = this.stageManager.update(this.distance);
        if (newStage) {
            this.effectManager.onStageTransition(newStage);
        }

        // M3: friend 자동 수집
        if (this.player.getHasFriend()) {
            this.autoCollectItems();
        }

        // HUD 업데이트
        this.scoreText.setText(`${this.score}`);
        this.distanceText.setText(`${Math.floor(this.distance)}m`);
    }

    // M2: 장애물 충돌 판정 (processCallback — 리뷰 C3)
    private shouldObstacleCollide(obstacle: Obstacle): boolean {
        if (this.player.getIsInvincible()) return false;

        let shouldCollide: boolean;
        switch (obstacle.obstacleType) {
            case 'branch_high': shouldCollide = !this.player.getIsSliding(); break;
            case 'puddle':      shouldCollide = !this.player.getIsJumping(); break;
            case 'rock':        shouldCollide = true; break;
            default:            shouldCollide = true; break;
        }

        // M3: helmet 방어 — 충돌 직전에 소모
        if (shouldCollide && this.player.getHasHelmet()) {
            this.player.consumeHelmet();
            obstacle.deactivate();
            this.effectManager.onHelmetBreak(obstacle.x, obstacle.y);
            return false;
        }

        return shouldCollide;
    }

    // M2: 장애물 충돌 처리
    private onHitObstacle(): void {
        // 동일 프레임 중복 호출 방지 (리뷰 2차 C1)
        if (this.state !== 'playing') return;

        // M3: 이펙트 매니저를 통한 충돌 이펙트 (빨간 플래시 + 강화 카메라 흔들림)
        this.effectManager.onObstacleHit();

        if (this.revivesUsed < MAX_FREE_REVIVES) {
            this.showRevivePrompt();
        } else {
            this.triggerGameOver();
        }
    }

    // M2: 아이템 수집
    private onCollectItem(item: Item): void {
        // M3: 점수 배율 적용 (tube 파워업)
        const points = item.points * this.player.getScoreMultiplier();
        this.score += points;
        this.collectedItems[item.itemType]++;

        // M3: 수집 이펙트 (파티클 + 점수 바운스)
        this.effectManager.onItemCollected(item.x, item.y, this.scoreText);

        // 팝업 텍스트
        const popupText = this.add.text(item.x, item.y, `+${points}`, {
            fontFamily: 'Arial', fontSize: '24px', color: '#FFD700',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: popupText,
            y: popupText.y - 60,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => popupText.destroy(),
        });

        item.deactivate();
    }

    // M3: 파워업 수집
    private onCollectPowerUp(powerUp: PowerUp): void {
        this.player.applyPowerUp(powerUp.powerUpType);
        this.effectManager.onPowerUpCollected(this.player);
        powerUp.deactivate();
    }

    // M3: friend 파워업 — 같은 레인 + Y 근접 아이템 자동 수집
    private autoCollectItems(): void {
        const playerLane = this.player.getCurrentLane();
        const playerY = this.player.y;
        const children = this.itemPool.getGroup().getChildren();

        for (let i = 0; i < children.length; i++) {
            const child = children[i] as Item;
            if (!child.active) continue;

            // 같은 레인인지 확인 (X좌표 비교)
            const itemLane = LANE_POSITIONS.indexOf(
                LANE_POSITIONS.reduce((prev, curr) =>
                    Math.abs(curr - child.x) < Math.abs(prev - child.x) ? curr : prev
                )
            );
            if (itemLane !== playerLane) continue;

            // Y 근접 체크 (200px 이내)
            if (Math.abs(child.y - playerY) < 200) {
                this.onCollectItem(child);
            }
        }
    }

    // M2: 부활 프롬프트
    private showRevivePrompt(): void {
        this.state = 'revivePrompt';
        this.physics.pause();

        this.reviveContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(300);

        // 반투명 배경
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
        this.reviveContainer.add(overlay);

        // 텍스트
        const text = this.add.text(0, -60, 'Continue?', {
            fontFamily: 'Arial', fontSize: '40px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.reviveContainer.add(text);

        // 부활 버튼
        this.createReviveButton(0, 20, 'REVIVE', 0x4CAF50, () => this.revive());
        // 포기 버튼
        this.createReviveButton(0, 90, 'GIVE UP', 0x757575, () => this.triggerGameOver());
    }

    private createReviveButton(x: number, y: number, label: string, color: number, callback: () => void): void {
        if (!this.reviveContainer) return;

        const btnW = 200;
        const btnH = 50;
        const bg = this.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
        this.reviveContainer.add(bg);

        const btnText = this.add.text(x, y, label, {
            fontFamily: 'Arial', fontSize: '22px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.reviveContainer.add(btnText);

        const hitArea = this.add.zone(
            GAME_WIDTH / 2 + x,
            GAME_HEIGHT / 2 + y,
            btnW,
            btnH,
        ).setInteractive({ useHandCursor: true });
        this.reviveHitZones.push(hitArea);

        hitArea.on('pointerdown', () => {
            this.destroyReviveHitZones();
            callback();
        });
    }

    // 부활 UI 히트존 정리
    private destroyReviveHitZones(): void {
        for (const zone of this.reviveHitZones) {
            if (!zone.scene) continue;
            zone.destroy();
        }
        this.reviveHitZones = [];
    }

    // M2: 부활 처리
    private revive(): void {
        this.revivesUsed++;

        this.destroyReviveHitZones();
        if (this.reviveContainer) {
            this.reviveContainer.destroy();
            this.reviveContainer = null;
        }

        // M3: 파워업 초기화
        this.player.clearAllPowerUps();

        // 모든 장애물/아이템 제거
        this.spawnManager.reset();

        // 무적
        this.player.setInvincible(INVINCIBLE_DURATION);

        // 물리 재개 (리뷰 I3)
        this.physics.resume();
        this.state = 'playing';
    }

    triggerGameOver(): void {
        if (this.state === 'gameOver') return;
        this.state = 'gameOver';

        // M3: 파워업 초기화
        this.player.clearAllPowerUps();

        this.destroyReviveHitZones();
        if (this.reviveContainer) {
            this.reviveContainer.destroy();
            this.reviveContainer = null;
        }

        this.physics.pause();

        this.time.delayedCall(500, () => {
            this.scene.start(SCENE_GAME_OVER, {
                score: this.score,
                distance: Math.floor(this.distance),
                mode: this.mode,
                collectedItems: { ...this.collectedItems },
            });
        });
    }
}
