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
import { StageManager, STAGE_BGM, STAGE_AMBIENT } from '../systems/StageManager';
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
    MAX_FREE_REVIVES,
    RELAX_FREE_REVIVES,
    INVINCIBLE_DURATION,
    SCENE_GAME,
    SCENE_GAME_OVER,
    SCENE_MAIN_MENU,
    EFFECT_SLOWMO_SCALE,
    LS_KEY_TUTORIAL_DONE,
    ROAD_HEIGHT,
    MAGNET_Z_RANGE,
    FONT_FAMILY,
} from '../utils/Constants';
import type { GameMode, CollectedItems, OnsenBuff, CompanionAbility } from '../utils/Constants';
import { NO_COMPANION_ABILITY } from '../utils/Constants';
import { getOnsenLevel, getOnsenBuff, getCompanionAbility } from '../utils/OnsenLogic';
import { InventoryManager } from '../services/InventoryManager';
import { SoundManager } from '../services/SoundManager';
import { fadeToScene } from '../ui/UIFactory';
import { InputController } from '../ui/InputController';
import { ReviveUI } from '../ui/ReviveUI';
import { GameHUD } from '../ui/GameHUD';
import { PauseOverlay } from '../ui/PauseOverlay';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { ComboManager } from '../systems/ComboManager';
import { QuestManager } from '../systems/QuestManager';
import { WeatherSystem } from '../systems/WeatherSystem';
import { QUEST_COMPLETION_BONUS_SCORE } from '../utils/Constants';

type GameState = 'playing' | 'paused' | 'revivePrompt' | 'gameOver';

interface GameInitData {
    mode?: GameMode;
    questId?: string;
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
    private inputController!: InputController;

    // HUD + 콤보
    private hud!: GameHUD;
    private combo = new ComboManager();

    // 부활 UI
    private reviveUI!: ReviveUI;

    // 튜토리얼
    private tutorialOverlay: TutorialOverlay | null = null;

    // 일시정지
    private pauseOverlay: PauseOverlay | null = null;
    private resumeCooldown = false;

    // 퀘스트 모드
    private questManager: QuestManager | null = null;
    private questId: string | null = null;

    // 비주얼 날씨 시스템
    private weatherSystem!: WeatherSystem;

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
        this.revivesUsed = 0;
        this.collectedItems = { mandarin: 0, watermelon: 0, hotspring_material: 0 };
        this.dodgedObstacles = 0;
        this.prevActiveObstacles = new Set();
        this.currentActiveObstacles = new Set();
        this.tutorialOverlay = null;
        this.pauseOverlay = null;
        this.wasJumping = false;
        this.combo.reset();
        this.resumeCooldown = false;
        this.lastQuestFillW = -1;

        // 퀘스트 모드 초기화
        this.questId = data.questId ?? null;
        if (this.mode === 'quest' && this.questId) {
            this.questManager = QuestManager.fromId(this.questId);
        } else {
            this.questManager = null;
        }
    }

    shutdown(): void {
        SoundManager.getInstance().stopAmbient();
        if (this.inputController) this.inputController.destroy();
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.cameras.main.clearMask();
        this.cameras.main.resetPostPipeline();
        if (this.reviveUI) this.reviveUI.destroy();
        if (this.tutorialOverlay) {
            this.tutorialOverlay.destroy();
            this.tutorialOverlay = null;
        }
        if (this.pauseOverlay) {
            this.pauseOverlay.destroy();
            this.pauseOverlay = null;
        }
        if (this.hud) this.hud.destroy();
        if (this.effectManager) this.effectManager.destroy();
        if (this.roadRenderer) this.roadRenderer.destroy();
        if (this.sceneryManager) this.sceneryManager.destroy();
        if (this.speedLineRenderer) this.speedLineRenderer.destroy();
        if (this.weatherSystem) this.weatherSystem.destroy();
        if (this.questBarBg) { this.questBarBg.destroy(); this.questBarBg = null; }
        if (this.questBarFill) { this.questBarFill.destroy(); this.questBarFill = null; }
    }

    create(): void {
        // 릴렉스 모드: 따뜻한 배경색
        if (this.mode === 'relax') {
            this.cameras.main.setBackgroundColor('#FFF3E0');
        }
        // 퀘스트 모드: 약간 다른 배경색으로 구분
        if (this.mode === 'quest') {
            this.cameras.main.setBackgroundColor('#FFF8E1');
        }

        // 의사-3D 렌더링
        this.roadRenderer = new RoadRenderer(this, 'forest');
        this.sceneryManager = new SceneryManager(this, 'forest');
        this.speedLineRenderer = new SpeedLineRenderer(this);

        // 비주얼 날씨 시스템 (하늘 그라데이션 + 날씨 파티클)
        this.weatherSystem = new WeatherSystem(this);

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
        this.stageManager = new StageManager(this, this.roadRenderer, this.mode);
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

        // 입력 (키보드 + 터치)
        const snd = SoundManager.getInstance();
        this.inputController = new InputController(this, {
            isInputActive: () => this.state === 'playing',
            onMoveLeft: () => { this.player.moveLeft(); snd.playSfx('move'); },
            onMoveRight: () => { this.player.moveRight(); snd.playSfx('move'); },
            onJump: () => { this.player.jump(); snd.playSfx('jump'); this.effectManager.onJump(this.player.x, this.player.y); },
            onSlide: () => { this.player.slide(); snd.playSfx('slide'); this.effectManager.onJump(this.player.x, this.player.y); },
        });

        // 부활 UI
        this.reviveUI = new ReviveUI(this);

        // HUD (score, distance, items, power-up timers, combo, popups)
        this.hud = new GameHUD(this, this.mode === 'relax', this.onsenBuff.scoreMultiplier);

        // 퀘스트 모드: 퀘스트 진행 HUD
        if (this.mode === 'quest' && this.questManager) {
            this.createQuestHUD();
        }

        // 일시정지 버튼
        const pauseBtn = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 40, '❚❚', {
            fontFamily: FONT_FAMILY, fontSize: '32px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3,
            padding: { left: 10, right: 10, top: 4, bottom: 4 },
        }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
        pauseBtn.on('pointerdown', () => {
            if (this.state === 'playing' && !this.resumeCooldown) this.pauseGame();
        });

        // 게임 BGM: 릴렉스 모드는 bgm-onsen 고정, 노멀 모드는 현재 스테이지 BGM
        const sound = SoundManager.getInstance();
        sound.playBgm(
            this.mode === 'relax' ? 'bgm-onsen' : (STAGE_BGM[this.stageManager.getCurrentStage()] ?? 'bgm-game'),
        );
        // 릴렉스 모드: ASMR 사운드스케이프 (스테이지별 ambient)
        if (this.mode === 'relax') {
            sound.playAmbient(STAGE_AMBIENT[this.stageManager.getCurrentStage()]);
        }

        // 첫 플레이 튜토리얼
        if (!localStorage.getItem(LS_KEY_TUTORIAL_DONE)) {
            this.showTutorial();
        }
    }

    private pauseGame(): void {
        this.state = 'paused';
        this.physics.pause();
        SoundManager.getInstance().stopBgm();
        SoundManager.getInstance().pauseAmbient();

        this.pauseOverlay = new PauseOverlay(
            this,
            () => this.resumeGame(),
            () => {
                this.pauseOverlay?.destroy();
                this.pauseOverlay = null;
                this.physics.resume();
                fadeToScene(this, SCENE_MAIN_MENU);
            },
        );
    }

    private resumeGame(): void {
        if (this.pauseOverlay) {
            this.pauseOverlay.destroy();
            this.pauseOverlay = null;
        }
        this.physics.resume();
        this.state = 'playing';
        SoundManager.getInstance().playBgm(
            this.mode === 'relax' ? 'bgm-onsen' : (STAGE_BGM[this.stageManager.getCurrentStage()] ?? 'bgm-game'),
        );
        if (this.mode === 'relax') {
            SoundManager.getInstance().resumeAmbient();
        }
        // Prevent immediate re-pause (100ms cooldown)
        this.resumeCooldown = true;
        this.time.delayedCall(100, () => { this.resumeCooldown = false; });
    }

    private showTutorial(): void {
        this.state = 'paused';
        this.physics.pause();

        this.tutorialOverlay = new TutorialOverlay(this, () => {
            if (this.tutorialOverlay) {
                this.tutorialOverlay.destroy();
                this.tutorialOverlay = null;
            }
            localStorage.setItem(LS_KEY_TUTORIAL_DONE, '1');
            this.physics.resume();
            this.state = 'playing';
        });
    }

    update(time: number, delta: number): void {
        if (this.state !== 'playing') return;
        if (!this.player || !this.player.active) return;

        // C3: 시스템별 개별 try-catch (하나의 시스템 오류가 전체 게임을 중단하지 않도록)
        let effectiveDelta = delta;
        try {
            this.effectManager.update(time);
            effectiveDelta = this.effectManager.isSlowmo ? delta * EFFECT_SLOWMO_SCALE : delta;
        } catch (e) { console.error('[EffectManager] update error:', e); }

        const dt = effectiveDelta / 1000;
        const isRelax = this.mode === 'relax';

        try {
            this.gameSpeed = this.difficulty.getSpeed(this.distance, isRelax);
        } catch (e) { console.error('[DifficultyManager] update error:', e); }

        this.distance += this.gameSpeed * dt;

        try {
            const zSpeed = this.gameSpeed / ROAD_HEIGHT;
            this.roadRenderer.update(this.gameSpeed, dt);
            this.sceneryManager.update(zSpeed, dt);
            this.speedLineRenderer.update(this.gameSpeed, dt);
        } catch (e) { console.error('[Renderer] update error:', e); }

        try { this.inputController.pollKeyboard(); }
        catch (e) { console.error('[InputController] error:', e); }

        try {
            this.player.update();
            const jumping = this.player.getIsJumping();
            if (this.wasJumping && !jumping) {
                this.effectManager.onLand(this.player.x, this.player.y);
            }
            this.wasJumping = jumping;
            // G2: 오리 튜브 물결 이펙트
            this.effectManager.setWaterEffect(this.player.getHasTube(), this.player.x, this.player.y);
        } catch (e) { console.error('[Player] update error:', e); }

        try {
            this.spawnManager.update(effectiveDelta, this.distance, this.gameSpeed, isRelax);
        } catch (e) { console.error('[SpawnManager] update error:', e); }

        try {
            const newStage = this.stageManager.update(this.distance);
            if (newStage) {
                this.effectManager.onStageTransition(newStage);
                this.sceneryManager.setStageColors(newStage);
                SoundManager.getInstance().playSfx('levelup');
                // BGM 전환은 StageManager.transitionTo() 내부에서 처리
            }
        } catch (e) { console.error('[StageManager] update error:', e); }

        try {
            this.weatherSystem.update(this.distance, this.stageManager.getCurrentStage(), dt);
            // 날씨→ASMR ambient 자동 연동 (릴렉스 모드)
            if (isRelax) {
                const weatherAmbient = this.weatherSystem.getWeatherAmbient();
                if (weatherAmbient) {
                    SoundManager.getInstance().playAmbient(weatherAmbient);
                }
            }
        } catch (e) { console.error('[WeatherSystem] update error:', e); }

        try {
            const comboExpired = this.combo.update(effectiveDelta);
            if (comboExpired) this.hud.updateCombo(0);
        } catch (e) { console.error('[ComboManager] update error:', e); }

        try {
            if (this.player.getHasMagnet()) {
                this.autoCollectAllLanes(MAGNET_Z_RANGE);
            } else if (this.player.getHasFriend()) {
                this.autoCollectItems(200);
            } else if (this.onsenBuff.itemMagnetRange > 0) {
                this.autoCollectItems(this.onsenBuff.itemMagnetRange);
            } else if (this.companionBuff.itemMagnetRange > 0) {
                this.autoCollectItems(this.companionBuff.itemMagnetRange);
            }
        } catch (e) { console.error('[AutoCollect] error:', e); }

        try {
            this.currentActiveObstacles.clear();
            const obstacleChildren = this.obstaclePool.getGroup().getChildren();
            for (const child of obstacleChildren) {
                const obs = child as Obstacle;
                if (obs.active) this.currentActiveObstacles.add(obs);
            }
            for (const obs of this.prevActiveObstacles) {
                if (!obs.active) {
                    this.dodgedObstacles++;
                    const playerLane = this.player.getCurrentLane();
                    const obsLane = obs.laneOffset + 1;
                    if (Math.abs(playerLane - obsLane) <= 1) {
                        this.showNearMiss(obs.x, obs.y);
                    }
                }
            }
            const tmp = this.prevActiveObstacles;
            this.prevActiveObstacles = this.currentActiveObstacles;
            this.currentActiveObstacles = tmp;
        } catch (e) { console.error('[DodgeDetection] error:', e); }

        try {
            this.hud.updateScore(this.score);
            this.hud.updateDistance(this.distance);
            const totalItems = this.collectedItems.mandarin + this.collectedItems.watermelon + this.collectedItems.hotspring_material;
            this.hud.updateItems(totalItems);
            this.hud.updatePowerUps(this.player.getActivePowerUpTimers());
        } catch (e) { console.error('[GameHUD] update error:', e); }

        // 퀘스트 모드: 진행도 업데이트 + 완료 감지
        if (this.mode === 'quest' && this.questManager) {
            try {
                this.questManager.update(
                    this.distance,
                    this.collectedItems.mandarin,
                    this.dodgedObstacles,
                );
                this.updateQuestHUD();
                if (this.questManager.isComplete()) {
                    this.triggerQuestComplete();
                }
            } catch (e) { console.error('[QuestManager] update error:', e); }
        }
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
        this.player.playHitAnimation();
        this.effectManager.onObstacleHit();

        const maxRevives = this.mode === 'relax' ? RELAX_FREE_REVIVES : MAX_FREE_REVIVES;
        if (this.revivesUsed < maxRevives) {
            this.showRevivePrompt();
        } else {
            this.triggerGameOver();
        }
    }

    // M2: 아이템 수집 + 콤보 시스템
    private onCollectItem(item: Item): void {
        const snd = SoundManager.getInstance();
        snd.playSfx('collect');

        const comboMultiplier = this.combo.hit();
        const comboCount = this.combo.getCount();
        // A2: 콤보 단계별 SFX
        if (comboCount >= 3) snd.playComboHit(comboCount);
        const rawMultiplier = this.player.getScoreMultiplier() * this.onsenBuff.scoreMultiplier * this.companionBuff.scoreMultiplier * comboMultiplier;
        const points = Math.floor(item.points * Math.min(3.0, rawMultiplier));
        this.score += points;
        this.collectedItems[item.itemType]++;

        this.effectManager.onItemCollected(item.x, item.y, this.hud.getScoreText());
        this.hud.showPointsPopup(item.x, item.y, points, comboCount);
        this.hud.updateCombo(comboCount);

        item.deactivate();
    }

    // 니어미스 시각 피드백 + 보너스 점수
    private showNearMiss(x: number, y: number): void {
        const bonus = 5;
        this.score += bonus;
        this.hud.showNearMiss(x, y, bonus);
        // A3: 니어미스 swoosh SFX + 스파크 파티클
        SoundManager.getInstance().playSfx('nearmiss');
        this.effectManager.onNearMiss(x, y);
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
        this.reviveUI.show(
            () => this.revive(),
            () => this.triggerGameOver(),
        );
    }

    // M2: 부활 처리 (3초 카운트다운 후 재개)
    private revive(): void {
        this.revivesUsed++;
        this.reviveUI.hide();

        this.player.clearAllPowerUps();
        this.effectManager.reset();
        this.stageManager.reset();
        this.spawnManager.reset();
        this.player.setInvincible(INVINCIBLE_DURATION);
        this.player.playReviveAnimation();
        SoundManager.getInstance().playSfx('revive');

        // 카운트다운 표시
        const countText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '3', {
            fontSize: '80px',
            fontFamily: FONT_FAMILY,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5).setDepth(100);

        let count = 3;
        const countdownTimer = this.time.addEvent({
            delay: 1000,
            repeat: 2,
            callback: () => {
                count--;
                if (count > 0) {
                    countText.setText(String(count));
                } else {
                    countText.destroy();
                    this.physics.resume();
                    this.state = 'playing';
                }
            },
        });

        // 씬 전환 시 정리
        this.events.once('shutdown', () => {
            countdownTimer.destroy();
            if (countText.scene) countText.destroy();
        });
    }

    triggerGameOver(): void {
        if (this.state === 'gameOver') return;
        if (this.state === 'paused') {
            this.physics.resume();
            if (this.pauseOverlay) { this.pauseOverlay.destroy(); this.pauseOverlay = null; }
        }
        this.state = 'gameOver';

        const snd = SoundManager.getInstance();
        snd.stopBgm();
        snd.stopAmbient();
        snd.playSfx('gameover');

        // 거리 보너스 (1m = 0.5점)
        this.score += Math.floor(this.distance * 0.5);

        this.player.clearAllPowerUps();
        this.reviveUI.hide();
        this.physics.pause();

        this.time.delayedCall(300, () => {
            if (!this.scene || !this.scene.isActive()) return;
            fadeToScene(this, SCENE_GAME_OVER, {
                score: this.score,
                distance: Math.floor(this.distance),
                mode: this.mode,
                collectedItems: { ...this.collectedItems },
                dodgedObstacles: this.dodgedObstacles,
                questId: this.questId ?? undefined,
                questCompleted: false,
            });
        });
    }

    /** 퀘스트 목표 달성 — 보상 지급 후 GameOver Scene으로 전환 */
    private triggerQuestComplete(): void {
        if (this.state === 'gameOver') return;
        this.state = 'gameOver';

        const snd = SoundManager.getInstance();
        snd.stopBgm();
        snd.stopAmbient();
        snd.playSfx('levelup');

        // 퀘스트 완료 보너스 점수
        this.score += QUEST_COMPLETION_BONUS_SCORE;
        // 거리 보너스
        this.score += Math.floor(this.distance * 0.5);

        // 퀘스트 보상 귤을 인벤토리에 즉시 반영
        const quest = this.questManager!.getQuest();
        const inventoryMgr = InventoryManager.getInstance();
        inventoryMgr.addItems({
            mandarin: quest.rewardMandarin,
            watermelon: 0,
            hotspring_material: 0,
        });

        this.player.clearAllPowerUps();
        this.reviveUI.hide();
        this.physics.pause();

        // 완료 연출 — 잠깐 대기 후 GameOver Scene으로 이동
        this.time.delayedCall(600, () => {
            if (!this.scene || !this.scene.isActive()) return;
            fadeToScene(this, SCENE_GAME_OVER, {
                score: this.score,
                distance: Math.floor(this.distance),
                mode: this.mode,
                collectedItems: { ...this.collectedItems },
                dodgedObstacles: this.dodgedObstacles,
                questId: quest.id,
                questCompleted: true,
                questRewardMandarin: quest.rewardMandarin,
            });
        });
    }

    // ─── 퀘스트 HUD ─────────────────────────────────────────────

    /** 퀘스트 진행 바 + 텍스트 (화면 상단) */
    private questBarBg: Phaser.GameObjects.Graphics | null = null;
    private questBarFill: Phaser.GameObjects.Graphics | null = null;
    private questProgressText: Phaser.GameObjects.Text | null = null;

    private createQuestHUD(): void {
        if (!this.questManager) return;
        const quest = this.questManager.getQuest();
        const BAR_X = 60;
        const BAR_Y = 44;
        const BAR_W = GAME_WIDTH - 120;
        const BAR_H = 14;

        // 배경 바
        this.questBarBg = this.add.graphics().setDepth(90);
        this.questBarBg.fillStyle(0x000000, 0.35);
        this.questBarBg.fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, 7);

        // 채움 바
        this.questBarFill = this.add.graphics().setDepth(91);

        // 목표 레이블 (매 프레임 갱신 불필요 — 지역 변수로 유지)
        this.add.text(GAME_WIDTH / 2, BAR_Y - 18, `퀘스트: ${quest.description}`, {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            color: '#FFCC80',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(92);

        // 진행 텍스트
        this.questProgressText = this.add.text(GAME_WIDTH / 2, BAR_Y + BAR_H + 4, '0%', {
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(92);
    }

    private lastQuestFillW = -1;

    private updateQuestHUD(): void {
        if (!this.questManager || !this.questBarFill || !this.questProgressText) return;

        const pct = this.questManager.getProgress();
        const quest = this.questManager.getQuest();
        const current = this.questManager.getCurrent();

        const BAR_X = 60;
        const BAR_Y = 44;
        const BAR_W = GAME_WIDTH - 120;
        const BAR_H = 14;
        const fillW = Math.floor((BAR_W * pct) / 100);

        // dirty flag: 변경 시에만 리드로
        if (fillW !== this.lastQuestFillW) {
            this.lastQuestFillW = fillW;
            this.questBarFill.clear();
            const fillColor = pct >= 90 ? 0xFFD700 : 0xFF7043;
            this.questBarFill.fillStyle(fillColor, 1);
            if (fillW > 0) {
                this.questBarFill.fillRoundedRect(BAR_X, BAR_Y, fillW, BAR_H, 7);
            }

            const unit = quest.type === 'distance' ? 'm' : '개';
            this.questProgressText.setText(`${current} / ${quest.target}${unit}`);
        }
    }
}

