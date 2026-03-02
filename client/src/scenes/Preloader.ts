import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_PRELOADER,
    SCENE_MAIN_MENU,
    OBSTACLE_CONFIGS,
    ITEM_SIZE,
    POWERUP_CONFIGS,
    ONSEN_ITEM_DISPLAY_SIZE,
    LS_KEY_SELECTED_SKIN,
} from '../utils/Constants';
import type { ObstacleType, PowerUpType, ItemType } from '../utils/Constants';
import { ensureStageTextures, ensureSkinTexture } from '../utils/TextureUtils';

export class Preloader extends Phaser.Scene {
    constructor() {
        super(SCENE_PRELOADER);
    }

    preload(): void {
        // 프로그레스바 UI
        const barW = 400;
        const barH = 30;
        const barX = (GAME_WIDTH - barW) / 2;
        const barY = GAME_HEIGHT / 2;

        const bgBar = this.add.graphics();
        bgBar.fillStyle(0x444444, 1);
        bgBar.fillRect(barX, barY, barW, barH);

        const fillBar = this.add.graphics();

        this.load.on('progress', (value: number) => {
            fillBar.clear();
            fillBar.fillStyle(0x44cc44, 1);
            fillBar.fillRect(barX, barY, barW * value, barH);
        });

        // 카피바라 스킨 PNG 로드 (assets/capybara-*.png)
        this.load.image('capybara-default', 'assets/capybara-default.png');
        this.load.image('capybara-towel',   'assets/capybara-towel.png');
        this.load.image('capybara-yukata',  'assets/capybara-yukata.png');
        this.load.image('capybara-santa',   'assets/capybara-santa.png');
    }

    create(): void {
        // 프로토타입 에셋: 코드 기반 텍스처 생성
        this.createPlaceholderTextures();

        // 최소 0.5초 표시 후 메뉴로 전환
        this.time.delayedCall(500, () => {
            this.scene.start(SCENE_MAIN_MENU);
        });
    }

    private createPlaceholderTextures(): void {
        // 레거시 2D 배경 텍스처는 의사-3D RoadRenderer가 대체하므로 생성하지 않음

        // 장애물 텍스처 5종
        this.createObstacleTexture('rock', OBSTACLE_CONFIGS.rock);
        this.createObstacleTexture('branch_high', OBSTACLE_CONFIGS.branch_high);
        this.createObstacleTexture('puddle', OBSTACLE_CONFIGS.puddle);
        this.createObstacleTexture('barrier', OBSTACLE_CONFIGS.barrier);
        this.createObstacleTexture('car', OBSTACLE_CONFIGS.car);

        // M2: 아이템 텍스처 3종
        this.createItemTexture('mandarin', 0xFF8C00);
        this.createItemTexture('watermelon', 0x2E8B57);
        this.createItemTexture('hotspring_material', 0xFF69B4);

        // 파워업 텍스처 4종
        this.createPowerUpTexture('helmet');
        this.createPowerUpTexture('tube');
        this.createPowerUpTexture('friend');
        this.createPowerUpTexture('magnet');

        // M3: 스테이지 배경 — 시작 스테이지만 생성 (나머지는 StageManager에서 lazy 생성)
        ensureStageTextures(this, 'forest');

        // M3: 파티클 텍스처 (8x8 흰색)
        const particleGfx = this.make.graphics({ x: 0, y: 0 }, false);
        particleGfx.fillStyle(0xFFFFFF, 1);
        particleGfx.fillCircle(4, 4, 4);
        particleGfx.generateTexture('particle', 8, 8);
        particleGfx.destroy();

        // M3: 동물 친구 스프라이트 (60x60 오렌지 원형)
        const friendGfx = this.make.graphics({ x: 0, y: 0 }, false);
        friendGfx.fillStyle(0xFF6F00, 1);
        friendGfx.fillRoundedRect(0, 0, 60, 60, 12);
        // 눈
        friendGfx.fillStyle(0x000000, 1);
        friendGfx.fillCircle(20, 22, 4);
        friendGfx.fillCircle(40, 22, 4);
        // 코
        friendGfx.fillStyle(0x4A3015, 1);
        friendGfx.fillCircle(30, 35, 5);
        friendGfx.generateTexture('friend-sprite', 60, 60);
        friendGfx.destroy();

        // M3: 헬멧 오버레이 (수박 헬멧 — 50x40 초록)
        const helmetGfx = this.make.graphics({ x: 0, y: 0 }, false);
        helmetGfx.fillStyle(0x2E7D32, 1);
        helmetGfx.fillRoundedRect(0, 0, 50, 40, 10);
        // 수박 줄무늬
        helmetGfx.lineStyle(2, 0x1B5E20, 1);
        helmetGfx.lineBetween(10, 5, 10, 35);
        helmetGfx.lineBetween(25, 3, 25, 37);
        helmetGfx.lineBetween(40, 5, 40, 35);
        helmetGfx.generateTexture('helmet-overlay', 50, 40);
        helmetGfx.destroy();

        // M4: 스킨 — 선택된 스킨만 생성 (나머지는 SkinSelect에서 lazy 생성)
        ensureSkinTexture(this, 'default');
        const selectedSkin = localStorage.getItem(LS_KEY_SELECTED_SKIN);
        if (selectedSkin && selectedSkin !== 'default') {
            ensureSkinTexture(this, selectedSkin as import('../utils/Constants').SkinId);
        }

        // M4: 온천 장식 아이템 텍스처 (원형)
        this.createOnsenDecoTexture('mandarin', 0xFF8C00);
        this.createOnsenDecoTexture('watermelon', 0x2E8B57);
        this.createOnsenDecoTexture('hotspring_material', 0xFF69B4);

        // (온천 배경은 Onsen Scene에서 Graphics로 직접 렌더링 — 데드 텍스처 제거됨)
    }

    private createObstacleTexture(
        type: ObstacleType,
        config: { width: number; height: number; color: number },
    ): void {
        const gfx = this.make.graphics({ x: 0, y: 0 }, false);
        gfx.fillStyle(config.color, 1);
        gfx.fillRoundedRect(0, 0, config.width, config.height, 8);

        // 타입별 시각 구분
        if (type === 'rock') {
            // 어두운 테두리
            gfx.lineStyle(3, 0x505050, 1);
            gfx.strokeRoundedRect(0, 0, config.width, config.height, 8);
        } else if (type === 'branch_high') {
            // 나뭇가지 선
            gfx.lineStyle(2, 0x5C3317, 1);
            gfx.lineBetween(10, config.height / 2, config.width - 10, config.height / 2);
        } else {
            // 물결 (puddle)
            gfx.lineStyle(2, 0xFFFFFF, 0.5);
            gfx.lineBetween(20, config.height / 2, 40, config.height / 2 - 5);
            gfx.lineBetween(40, config.height / 2 - 5, 60, config.height / 2);
        }

        gfx.generateTexture(`obstacle-${type}`, config.width, config.height);
        gfx.destroy();
    }

    private createItemTexture(name: string, color: number): void {
        const gfx = this.make.graphics({ x: 0, y: 0 }, false);
        gfx.fillStyle(color, 1);
        gfx.fillCircle(ITEM_SIZE / 2, ITEM_SIZE / 2, ITEM_SIZE / 2);
        // 하이라이트
        gfx.fillStyle(0xFFFFFF, 0.3);
        gfx.fillCircle(ITEM_SIZE / 2 - 5, ITEM_SIZE / 2 - 5, ITEM_SIZE / 6);
        gfx.generateTexture(`item-${name}`, ITEM_SIZE, ITEM_SIZE);
        gfx.destroy();
    }

    // M3: 파워업 텍스처 (다이아몬드 모양 + 타입별 색상)
    private createPowerUpTexture(type: PowerUpType): void {
        const config = POWERUP_CONFIGS[type];
        const gfx = this.make.graphics({ x: 0, y: 0 }, false);
        const w = config.width;
        const h = config.height;

        // 외곽 다이아몬드
        gfx.fillStyle(config.color, 1);
        gfx.beginPath();
        gfx.moveTo(w / 2, 2);
        gfx.lineTo(w - 2, h / 2);
        gfx.lineTo(w / 2, h - 2);
        gfx.lineTo(2, h / 2);
        gfx.closePath();
        gfx.fillPath();

        // 내부 하이라이트
        gfx.fillStyle(0xFFFFFF, 0.3);
        gfx.beginPath();
        gfx.moveTo(w / 2, 10);
        gfx.lineTo(w - 14, h / 2);
        gfx.lineTo(w / 2, h / 2);
        gfx.lineTo(14, h / 2);
        gfx.closePath();
        gfx.fillPath();

        // 타입별 아이콘 심볼
        gfx.fillStyle(0xFFFFFF, 0.8);
        if (type === 'helmet') {
            gfx.fillRoundedRect(w / 2 - 8, h / 2 - 4, 16, 12, 4);
        } else if (type === 'tube') {
            gfx.fillCircle(w / 2, h / 2 + 2, 8);
            gfx.fillStyle(config.color, 1);
            gfx.fillCircle(w / 2, h / 2 + 2, 4);
        } else {
            gfx.fillCircle(w / 2, h / 2 + 2, 6);
            gfx.fillCircle(w / 2 - 6, h / 2 - 2, 4);
        }

        gfx.generateTexture(`powerup-${type}`, w, h);
        gfx.destroy();
    }

    // M4: 온천 장식 아이템 텍스처
    private createOnsenDecoTexture(name: ItemType, color: number): void {
        const s = ONSEN_ITEM_DISPLAY_SIZE;
        const gfx = this.make.graphics({ x: 0, y: 0 }, false);
        gfx.fillStyle(color, 1);
        gfx.fillCircle(s / 2, s / 2, s / 2);
        gfx.fillStyle(0xFFFFFF, 0.3);
        gfx.fillCircle(s / 2 - 6, s / 2 - 6, s / 5);
        gfx.generateTexture(`onsen-deco-${name}`, s, s);
        gfx.destroy();
    }

    // (스테이지 배경 텍스처는 TextureUtils.ensureStageTextures에서 lazy 생성)
}
