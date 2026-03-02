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
import { RoadRenderer } from '../systems/RoadRenderer';
import { SceneryManager } from '../systems/SceneryManager';
import { SpeedLineRenderer } from '../systems/SpeedLineRenderer';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    LANE_POSITIONS,
    LANE_OFFSETS,
    PLAYER_Y,
    PLAYER_Z,
    BASE_SPEED,
    SWIPE_THRESHOLD,
    MAX_FREE_REVIVES,
    INVINCIBLE_DURATION,
    SCENE_GAME,
    SCENE_GAME_OVER,
    EFFECT_SLOWMO_SCALE,
    LS_KEY_TUTORIAL_DONE,
    ROAD_HEIGHT,
} from '../utils/Constants';
import type { GameMode, CollectedItems, OnsenBuff, CompanionAbility } from '../utils/Constants';
import { NO_COMPANION_ABILITY } from '../utils/Constants';
import { getOnsenLevel, getOnsenBuff, getCompanionAbility } from '../utils/OnsenLogic';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { fadeToScene } from '../ui/UIFactory';

type GameState = 'playing' | 'paused' | 'revivePrompt' | 'gameOver';

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

    // 의사-3D 렌더링
    private roadRenderer!: RoadRenderer;
    private sceneryManager!: SceneryManager;
    private speedLineRenderer!: SpeedLineRenderer;

    // M4: 온천 버프
    private onsenBuff: OnsenBuff = { scoreMultiplier: 1, startingShield: false, itemMagnetRange: 0 };

    // M5: 동물 친구 버프
    private companionBuff: CompanionAbility = NO_COMPANION_ABILITY;

    // M2: 부활
    private revivesUsed = 0;

    // M2: 수집 아이템 카운트
    private collectedItems: CollectedItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };

    // 미션: 회피한 장애물 수
    private dodgedObstacles = 0;

    // 입력
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private swipeStart: { x: number; y: number } | null = null;

    // HUD
    private scoreText!: Phaser.GameObjects.Text;
    private distanceText!: Phaser.GameObjects.Text;
    private itemCounterText!: Phaser.GameObjects.Text;

    // 부활 UI
    private reviveContainer: Phaser.GameObjects.Container | null = null;
    private reviveHitZones: Phaser.GameObjects.Zone[] = [];

    // 튜토리얼
    private tutorialContainer: Phaser.GameObjects.Container | null = null;

    // 일시정지
    private pauseContainer: Phaser.GameObjects.Container | null = null;
    private resumeCooldown = false;

    // 팝업 텍스트 추적 (메모리 누수 방지)
    private popupTexts: Phaser.GameObjects.Text[] = [];

    // 착지 감지 (먼지 파티클용)
    private wasJumping = false;

    // 미션: 이전 프레임에 활성 상태였던 장애물 집합 (회피 감지용)
    private prevActiveObstacles: Set<Obstacle> = new Set();
    // 매 프레임 재사용 Set (GC 압력 감소)
    private currentActiveObstacles: Set<Obstacle> = new Set();

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
        this.dodgedObstacles = 0;
        this.prevActiveObstacles = new Set();
        this.currentActiveObstacles = new Set();
        this.reviveContainer = null;
        this.reviveHitZones = [];
        this.tutorialContainer = null;
        this.pauseContainer = null;
        this.wasJumping = false;
        this.popupTexts = [];
        this.resumeCooldown = false;
    }

    shutdown(): void {
        this.input.off('pointerdown');
        this.input.off('pointerup');
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.cameras.main.resetFX();
        this.destroyReviveHitZones();
        if (this.reviveContainer) {
            this.reviveContainer.destroy();
            this.reviveContainer = null;
        }
        if (this.tutorialContainer) {
            this.tutorialContainer.destroy();
            this.tutorialContainer = null;
        }
        if (this.pauseContainer) {
            this.pauseContainer.destroy();
            this.pauseContainer = null;
        }
        for (const t of this.popupTexts) {
            if (t.scene) t.destroy();
        }
        this.popupTexts = [];
        if (this.effectManager) this.effectManager.destroy();
        if (this.roadRenderer) this.roadRenderer.destroy();
        if (this.sceneryManager) this.sceneryManager.destroy();
        if (this.speedLineRenderer) this.speedLineRenderer.destroy();
    }

    create(): void {
        // 의사-3D 렌더링
        this.roadRenderer = new RoadRenderer(this, 'forest');
        this.sceneryManager = new SceneryManager(this, 'forest');
        this.speedLineRenderer = new SpeedLineRenderer(this);

        // M4: 선택된 스킨 + 온천 버프 읽기
        const inventoryMgr = InventoryManager.getInstance();
        const skinId = inventoryMgr.getSelectedSkin();
        const layout = inventoryMgr.getOnsenLayout();
        const onsenLevel = getOnsenLevel(layout.placedItems.length);
        this.onsenBuff = getOnsenBuff(onsenLevel);

        // M5: 동물 친구 버프 읽기
        const companionId = inventoryMgr.getSelectedCompanion();
        this.companionBuff = getCompanionAbility(companionId);

        // 플레이어
        this.player = new Player(this, LANE_POSITIONS[1], PLAYER_Y, skinId, companionId);
        this.player.setDepth(10);

        // 온천 버프: 시작 방어막
        if (this.onsenBuff.startingShield) {
            this.player.applyPowerUp('helmet');
        }

        // M2: 오브젝트 풀 + 매니저
        this.obstaclePool = new ObstaclePool(this);
        this.itemPool = new ItemPool(this);
        this.powerUpPool = new PowerUpPool(this);
        this.difficulty = new DifficultyManager();
        this.spawnManager = new SpawnManager(this.obstaclePool, this.itemPool, this.powerUpPool, this.difficulty);

        // 스테이지/이펙트 매니저 (RoadRenderer와 연동)
        this.stageManager = new StageManager(this, this.roadRenderer);
        this.effectManager = new EffectManager(this);

        // M2: 충돌 감지
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

            const snd = SoundManager.getInstance();
            if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) this.player.moveRight();
                else this.player.moveLeft();
            } else if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
                if (dy < 0) { this.player.jump(); snd.playSfx('jump'); this.effectManager.onJump(this.player.x, this.player.y); }
                else { this.player.slide(); snd.playSfx('slide'); }
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

        // HUD 아이템 카운터
        this.itemCounterText = this.add.text(20, 100, '', {
            fontFamily: 'Arial', fontSize: '18px', color: '#FFD700',
            stroke: '#000000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // 모드 표시
        if (this.mode === 'relax') {
            this.add.text(GAME_WIDTH / 2, 20, 'RELAX', {
                fontFamily: 'Arial', fontSize: '20px', color: '#81C784',
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
        }

        // 온천 버프 표시
        if (this.onsenBuff.scoreMultiplier > 1) {
            const buffLabel = `x${this.onsenBuff.scoreMultiplier.toFixed(1)}`;
            this.add.text(20, 60, buffLabel, {
                fontFamily: 'Arial', fontSize: '18px', color: '#FF8C00',
                stroke: '#000000', strokeThickness: 2,
            }).setScrollFactor(0).setDepth(100);
        }

        // 일시정지 버튼
        const pauseBtn = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 40, '❚❚', {
            fontFamily: 'Arial', fontSize: '32px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
        pauseBtn.on('pointerdown', () => {
            if (this.state === 'playing' && !this.resumeCooldown) this.pauseGame();
        });

        // 게임 BGM
        SoundManager.getInstance().playBgm(this.mode === 'relax' ? 'bgm-onsen' : 'bgm-game');

        // 첫 플레이 튜토리얼
        if (!localStorage.getItem(LS_KEY_TUTORIAL_DONE)) {
            this.showTutorial();
        }
    }

    private pauseGame(): void {
        this.state = 'paused';
        this.physics.pause();
        SoundManager.getInstance().stopBgm();

        this.pauseContainer = this.add.container(0, 0).setDepth(400);

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.pauseContainer.add(overlay);

        const pauseText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '일시정지', {
            fontFamily: 'Arial', fontSize: '48px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.pauseContainer.add(pauseText);

        const resumeText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, '탭하여 재개', {
            fontFamily: 'Arial', fontSize: '24px', color: '#AAAAAA',
        }).setOrigin(0.5);
        this.pauseContainer.add(resumeText);
        this.tweens.add({ targets: resumeText, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

        const dismissZone = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
            .setInteractive();
        this.pauseContainer.add(dismissZone);
        dismissZone.once('pointerdown', () => this.resumeGame());
    }

    private resumeGame(): void {
        if (this.pauseContainer) {
            this.pauseContainer.destroy();
            this.pauseContainer = null;
        }
        this.physics.resume();
        this.state = 'playing';
        SoundManager.getInstance().playBgm(this.mode === 'relax' ? 'bgm-onsen' : 'bgm-game');
        // Prevent immediate re-pause (100ms cooldown)
        this.resumeCooldown = true;
        this.time.delayedCall(100, () => { this.resumeCooldown = false; });
    }

    private showTutorial(): void {
        this.physics.pause();
        this.tutorialContainer = this.add.container(0, 0).setDepth(400);

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.5);
        overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.tutorialContainer.add(overlay);

        const hints = [
            { icon: '←  →', desc: '좌우 스와이프: 레인 이동', y: GAME_HEIGHT / 2 - 100 },
            { icon: '↑', desc: '위로 스와이프: 점프', y: GAME_HEIGHT / 2 - 30 },
            { icon: '↓', desc: '아래로 스와이프: 슬라이드', y: GAME_HEIGHT / 2 + 40 },
        ];

        for (const h of hints) {
            const iconText = this.add.text(GAME_WIDTH / 2 - 120, h.y, h.icon, {
                fontFamily: 'Arial', fontSize: '32px', color: '#FFD700', fontStyle: 'bold',
            }).setOrigin(0.5);
            const descText = this.add.text(GAME_WIDTH / 2 + 40, h.y, h.desc, {
                fontFamily: 'Arial', fontSize: '22px', color: '#FFFFFF',
            }).setOrigin(0, 0.5);
            this.tutorialContainer.add([iconText, descText]);
        }

        const tapText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140, '탭하여 시작', {
            fontFamily: 'Arial', fontSize: '28px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.tutorialContainer.add(tapText);
        this.tweens.add({ targets: tapText, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

        const dismissZone = this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
            .setInteractive();
        this.tutorialContainer.add(dismissZone);

        dismissZone.once('pointerdown', () => {
            if (this.tutorialContainer) {
                this.tutorialContainer.destroy();
                this.tutorialContainer = null;
            }
            localStorage.setItem(LS_KEY_TUTORIAL_DONE, '1');
            this.physics.resume();
        });
    }

    update(time: number, delta: number): void {
        if (this.state !== 'playing') return;
        if (!this.player || !this.player.active) return;

        // M3: 슬로우모션 적용
        this.effectManager.update(time);
        const effectiveDelta = this.effectManager.isSlowmo ? delta * EFFECT_SLOWMO_SCALE : delta;

        const dt = effectiveDelta / 1000;
        const isRelax = this.mode === 'relax';

        // 속도 증가 (DifficultyManager 사용)
        this.gameSpeed = this.difficulty.getSpeed(this.distance, isRelax);

        // 거리 누적
        this.distance += this.gameSpeed * dt;

        // 의사-3D 렌더링 업데이트
        const zSpeed = this.gameSpeed / ROAD_HEIGHT;
        this.roadRenderer.update(this.gameSpeed, dt);
        this.sceneryManager.update(zSpeed, dt);
        this.speedLineRenderer.update(this.gameSpeed, dt);

        // 키보드 입력
        if (this.cursors) {
            if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) this.player.moveLeft();
            if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) this.player.moveRight();
            if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) { this.player.jump(); SoundManager.getInstance().playSfx('jump'); this.effectManager.onJump(this.player.x, this.player.y); }
            if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) { this.player.slide(); SoundManager.getInstance().playSfx('slide'); }
        }

        // 플레이어 업데이트
        this.player.update();

        // 착지 감지 → 먼지 파티클
        const jumping = this.player.getIsJumping();
        if (this.wasJumping && !jumping) {
            this.effectManager.onLand(this.player.x, this.player.y);
        }
        this.wasJumping = jumping;

        // M2: 스폰 업데이트
        this.spawnManager.update(effectiveDelta, this.distance, this.gameSpeed, isRelax);

        // 스테이지 전환 체크 + 스테이지 BGM 전환
        const newStage = this.stageManager.update(this.distance);
        if (newStage) {
            this.effectManager.onStageTransition(newStage);
            this.sceneryManager.setStageColors(newStage);
            SoundManager.getInstance().playSfx('levelup');
            if (newStage === 'onsen') {
                SoundManager.getInstance().playBgm('bgm-onsen');
            } else if (this.mode !== 'relax') {
                SoundManager.getInstance().playBgm('bgm-game');
            }
        }

        // 자동 수집: magnet(전레인) > friend(같은 레인 200) > 온천 버프 > 동물 친구
        if (this.player.getHasMagnet()) {
            this.autoCollectAllLanes(0.3);
        } else if (this.player.getHasFriend()) {
            this.autoCollectItems(200);
        } else if (this.onsenBuff.itemMagnetRange > 0) {
            this.autoCollectItems(this.onsenBuff.itemMagnetRange);
        } else if (this.companionBuff.itemMagnetRange > 0) {
            this.autoCollectItems(this.companionBuff.itemMagnetRange);
        }

        // 회피 감지: 이전 프레임 활성 장애물 중 현재 비활성으로 전환된 것 = 플레이어가 회피
        this.currentActiveObstacles.clear();
        const obstacleChildren = this.obstaclePool.getGroup().getChildren();
        for (const child of obstacleChildren) {
            const obs = child as Obstacle;
            if (obs.active) this.currentActiveObstacles.add(obs);
        }
        for (const obs of this.prevActiveObstacles) {
            if (!obs.active) {
                // 충돌로 비활성화된 것이 아니라 디스폰으로 통과한 경우 카운트
                // (충돌 시에는 state가 'playing' 에서 'revivePrompt'/'gameOver'로 바뀌어
                //  이 라인에 도달하지 않으므로 안전하게 카운트 가능)
                this.dodgedObstacles++;
            }
        }
        // Swap refs so prevActiveObstacles points to the new set, reuse old set next frame
        const tmp = this.prevActiveObstacles;
        this.prevActiveObstacles = this.currentActiveObstacles;
        this.currentActiveObstacles = tmp;

        // HUD 업데이트 (값 변경 시에만)
        const scoreStr = `${this.score}`;
        if (this.scoreText.text !== scoreStr) this.scoreText.setText(scoreStr);
        const distStr = `${Math.floor(this.distance)}m`;
        if (this.distanceText.text !== distStr) this.distanceText.setText(distStr);
        const totalItems = this.collectedItems.mandarin + this.collectedItems.watermelon + this.collectedItems.hotspring_material;
        const itemStr = totalItems > 0 ? `x${totalItems}` : '';
        if (this.itemCounterText.text !== itemStr) this.itemCounterText.setText(itemStr);
    }

    // 장애물 충돌 판정
    private shouldObstacleCollide(obstacle: Obstacle): boolean {
        if (this.player.getIsInvincible()) return false;

        let shouldCollide: boolean;
        switch (obstacle.obstacleType) {
            case 'branch_high': shouldCollide = !this.player.getIsSliding(); break;
            case 'puddle':      shouldCollide = !this.player.getIsJumping(); break;
            case 'car':         shouldCollide = !this.player.getIsJumping(); break; // 점프로 회피
            case 'rock':        shouldCollide = true; break;
            case 'barrier':     shouldCollide = true; break; // 빈 레인으로 피해야 함
            default:            shouldCollide = true; break;
        }

        // helmet 방어
        if (shouldCollide && this.player.getHasHelmet()) {
            this.player.consumeHelmet();
            obstacle.deactivate();
            this.effectManager.onHelmetBreak(obstacle.x, obstacle.y);
            return false;
        }

        // 동물 친구 확률 방어 (거북이)
        if (shouldCollide && this.companionBuff.shieldChance > 0) {
            if (Math.random() < this.companionBuff.shieldChance) {
                obstacle.deactivate();
                this.effectManager.onHelmetBreak(obstacle.x, obstacle.y);
                return false;
            }
        }

        return shouldCollide;
    }

    // M2: 장애물 충돌 처리
    private onHitObstacle(): void {
        if (this.state !== 'playing') return;

        SoundManager.getInstance().playSfx('hit');
        this.effectManager.onObstacleHit();

        if (this.revivesUsed < MAX_FREE_REVIVES) {
            this.showRevivePrompt();
        } else {
            this.triggerGameOver();
        }
    }

    // M2: 아이템 수집
    private onCollectItem(item: Item): void {
        SoundManager.getInstance().playSfx('collect');
        const points = Math.floor(item.points * this.player.getScoreMultiplier() * this.onsenBuff.scoreMultiplier * this.companionBuff.scoreMultiplier);
        this.score += points;
        this.collectedItems[item.itemType]++;

        this.effectManager.onItemCollected(item.x, item.y, this.scoreText);

        const popupText = this.add.text(item.x, item.y, `+${points}`, {
            fontFamily: 'Arial', fontSize: '24px', color: '#FFD700',
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(200);
        this.popupTexts.push(popupText);

        this.tweens.add({
            targets: popupText,
            y: popupText.y - 60,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => {
                const idx = this.popupTexts.indexOf(popupText);
                if (idx !== -1) this.popupTexts.splice(idx, 1);
                popupText.destroy();
            },
        });

        item.deactivate();
    }

    // M3: 파워업 수집
    private onCollectPowerUp(powerUp: PowerUp): void {
        SoundManager.getInstance().playSfx('powerup');
        this.player.applyPowerUp(powerUp.powerUpType);
        this.effectManager.onPowerUpCollected(this.player);
        powerUp.deactivate();
    }

    // friend 파워업 또는 온천 자석 자동 수집 (z-근접 기반)
    private autoCollectItems(range: number): void {
        const playerLaneOffset = LANE_OFFSETS[this.player.getCurrentLane()];
        const children = this.itemPool.getGroup().getChildren();
        // range를 z 범위로 변환 (200px → ~0.27z)
        const zRange = range / ROAD_HEIGHT;

        for (let i = 0; i < children.length; i++) {
            const child = children[i] as Item;
            if (!child.active) continue;

            // 같은 레인 + z 근접
            if (child.laneOffset !== playerLaneOffset) continue;
            if (Math.abs(child.z - PLAYER_Z) < zRange) {
                this.onCollectItem(child);
            }
        }
    }

    // magnet: 전 레인 z-근접 아이템 흡수
    private autoCollectAllLanes(zRange: number): void {
        const children = this.itemPool.getGroup().getChildren();
        for (let i = 0; i < children.length; i++) {
            const child = children[i] as Item;
            if (!child.active) continue;
            if (Math.abs(child.z - PLAYER_Z) < zRange) {
                this.onCollectItem(child);
            }
        }
    }

    // M2: 부활 프롬프트
    private showRevivePrompt(): void {
        this.state = 'revivePrompt';
        this.physics.pause();

        this.reviveContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(300);

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
        this.reviveContainer.add(overlay);

        const text = this.add.text(0, -60, 'Continue?', {
            fontFamily: 'Arial', fontSize: '40px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.reviveContainer.add(text);

        this.createReviveButton(0, 20, 'REVIVE', 0x4CAF50, () => this.revive());
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

        this.player.clearAllPowerUps();
        this.effectManager.reset();
        this.stageManager.reset();

        this.spawnManager.reset();
        this.player.setInvincible(INVINCIBLE_DURATION);
        this.physics.resume();
        this.state = 'playing';
    }

    triggerGameOver(): void {
        if (this.state === 'gameOver' || this.state === 'paused') return;
        this.state = 'gameOver';

        const snd = SoundManager.getInstance();
        snd.stopBgm();
        snd.playSfx('gameover');

        this.player.clearAllPowerUps();

        this.destroyReviveHitZones();
        if (this.reviveContainer) {
            this.reviveContainer.destroy();
            this.reviveContainer = null;
        }

        this.physics.pause();

        this.time.delayedCall(300, () => {
            if (!this.scene || !this.scene.isActive()) return;
            fadeToScene(this, SCENE_GAME_OVER, {
                score: this.score,
                distance: Math.floor(this.distance),
                mode: this.mode,
                collectedItems: { ...this.collectedItems },
                dodgedObstacles: this.dodgedObstacles,
            });
        });
    }
}
