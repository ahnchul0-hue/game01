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
        const { width: w, height: h, color } = config;
        const gfx = this.make.graphics({ x: 0, y: 0 }, false);

        // 그림자 (하단 오프셋)
        gfx.fillStyle(0x000000, 0.25);
        gfx.fillRoundedRect(3, 3, w, h, 8);

        // 메인 바디
        gfx.fillStyle(color, 1);
        gfx.fillRoundedRect(0, 0, w, h, 8);

        // 상단 하이라이트 (3D 볼록 효과)
        gfx.fillStyle(0xFFFFFF, 0.2);
        gfx.fillRoundedRect(3, 2, w - 6, h * 0.35, 6);

        // 하단 어두운 영역
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillRoundedRect(3, h * 0.65, w - 6, h * 0.3, 6);

        // 타입별 시각 구분
        if (type === 'rock') {
            gfx.lineStyle(2, 0x505050, 0.8);
            gfx.strokeRoundedRect(1, 1, w - 2, h - 2, 8);
            // 바위 균열선
            gfx.lineStyle(1, 0x000000, 0.2);
            gfx.lineBetween(w * 0.3, h * 0.2, w * 0.5, h * 0.6);
            gfx.lineBetween(w * 0.5, h * 0.6, w * 0.7, h * 0.4);
        } else if (type === 'branch_high') {
            gfx.lineStyle(3, 0x5C3317, 0.9);
            gfx.lineBetween(8, h / 2, w - 8, h / 2);
            // 잔가지
            gfx.lineStyle(2, 0x5C3317, 0.6);
            gfx.lineBetween(w * 0.3, h / 2, w * 0.2, h * 0.25);
            gfx.lineBetween(w * 0.6, h / 2, w * 0.7, h * 0.25);
        } else if (type === 'puddle') {
            // 물결 3줄
            gfx.lineStyle(2, 0xFFFFFF, 0.4);
            for (let i = 0; i < 3; i++) {
                const y = h * 0.3 + i * (h * 0.2);
                gfx.lineBetween(12, y, w * 0.35, y - 4);
                gfx.lineBetween(w * 0.35, y - 4, w * 0.65, y + 4);
                gfx.lineBetween(w * 0.65, y + 4, w - 12, y);
            }
        } else if (type === 'barrier') {
            // 경고 줄무늬
            gfx.lineStyle(3, 0xFFFF00, 0.6);
            for (let x = 0; x < w; x += 16) {
                gfx.lineBetween(x, 0, x + 8, h);
            }
        } else if (type === 'car') {
            // 차 창문
            gfx.fillStyle(0x88CCFF, 0.6);
            gfx.fillRoundedRect(w * 0.15, h * 0.15, w * 0.7, h * 0.35, 4);
            // 바퀴
            gfx.fillStyle(0x333333, 0.8);
            gfx.fillCircle(w * 0.25, h - 4, 6);
            gfx.fillCircle(w * 0.75, h - 4, 6);
        }

        // 외곽선
        gfx.lineStyle(2, 0x000000, 0.3);
        gfx.strokeRoundedRect(0, 0, w, h, 8);

        gfx.generateTexture(`obstacle-${type}`, w + 4, h + 4);
        gfx.destroy();
    }

    private createItemTexture(name: string, color: number): void {
        const s = ITEM_SIZE;
        const r = s / 2;
        const gfx = this.make.graphics({ x: 0, y: 0 }, false);

        // 글로우 배경
        gfx.fillStyle(color, 0.2);
        gfx.fillCircle(r + 2, r + 2, r + 3);

        // 메인 원
        gfx.fillStyle(color, 1);
        gfx.fillCircle(r, r, r - 1);

        // 상단 하이라이트 (3D 구 효과)
        gfx.fillStyle(0xFFFFFF, 0.35);
        gfx.fillCircle(r - 4, r - 5, r * 0.35);

        // 작은 스파클
        gfx.fillStyle(0xFFFFFF, 0.5);
        gfx.fillCircle(r - 7, r - 8, 2);

        // 하단 그림자
        gfx.fillStyle(0x000000, 0.15);
        gfx.fillCircle(r + 2, r + 4, r * 0.5);

        // 외곽 링
        gfx.lineStyle(1.5, 0x000000, 0.2);
        gfx.strokeCircle(r, r, r - 1);

        gfx.generateTexture(`item-${name}`, s + 4, s + 4);
        gfx.destroy();
    }

    // M3: 파워업 텍스처 (다이아몬드 + 글로우 + 타입별 색상)
    private createPowerUpTexture(type: PowerUpType): void {
        const config = POWERUP_CONFIGS[type];
        const gfx = this.make.graphics({ x: 0, y: 0 }, false);
        const w = config.width;
        const h = config.height;
        const pad = 4; // 글로우 패딩
        const ox = pad; // 오프셋
        const oy = pad;

        // 글로우 배경
        gfx.fillStyle(config.color, 0.15);
        gfx.fillCircle(ox + w / 2, oy + h / 2, Math.max(w, h) * 0.6);

        // 외곽 다이아몬드
        gfx.fillStyle(config.color, 1);
        gfx.beginPath();
        gfx.moveTo(ox + w / 2, oy + 2);
        gfx.lineTo(ox + w - 2, oy + h / 2);
        gfx.lineTo(ox + w / 2, oy + h - 2);
        gfx.lineTo(ox + 2, oy + h / 2);
        gfx.closePath();
        gfx.fillPath();

        // 상단 하이라이트 (3D)
        gfx.fillStyle(0xFFFFFF, 0.3);
        gfx.beginPath();
        gfx.moveTo(ox + w / 2, oy + 8);
        gfx.lineTo(ox + w - 12, oy + h / 2);
        gfx.lineTo(ox + w / 2, oy + h / 2);
        gfx.lineTo(ox + 12, oy + h / 2);
        gfx.closePath();
        gfx.fillPath();

        // 하단 어두운 영역
        gfx.fillStyle(0x000000, 0.15);
        gfx.beginPath();
        gfx.moveTo(ox + w / 2, oy + h / 2);
        gfx.lineTo(ox + w - 12, oy + h / 2);
        gfx.lineTo(ox + w / 2, oy + h - 8);
        gfx.lineTo(ox + 12, oy + h / 2);
        gfx.closePath();
        gfx.fillPath();

        // 타입별 아이콘 심볼
        gfx.fillStyle(0xFFFFFF, 0.85);
        if (type === 'helmet') {
            gfx.fillRoundedRect(ox + w / 2 - 8, oy + h / 2 - 4, 16, 12, 4);
        } else if (type === 'tube') {
            gfx.fillCircle(ox + w / 2, oy + h / 2 + 2, 8);
            gfx.fillStyle(config.color, 1);
            gfx.fillCircle(ox + w / 2, oy + h / 2 + 2, 4);
        } else if (type === 'magnet') {
            // U자 자석
            gfx.fillRoundedRect(ox + w / 2 - 6, oy + h / 2 - 6, 4, 14, 2);
            gfx.fillRoundedRect(ox + w / 2 + 2, oy + h / 2 - 6, 4, 14, 2);
            gfx.fillRoundedRect(ox + w / 2 - 6, oy + h / 2 + 4, 12, 4, 2);
        } else {
            // friend: 하트
            gfx.fillCircle(ox + w / 2 - 4, oy + h / 2 - 1, 5);
            gfx.fillCircle(ox + w / 2 + 4, oy + h / 2 - 1, 5);
        }

        // 외곽선
        gfx.lineStyle(1.5, 0xFFFFFF, 0.4);
        gfx.beginPath();
        gfx.moveTo(ox + w / 2, oy + 2);
        gfx.lineTo(ox + w - 2, oy + h / 2);
        gfx.lineTo(ox + w / 2, oy + h - 2);
        gfx.lineTo(ox + 2, oy + h / 2);
        gfx.closePath();
        gfx.strokePath();

        gfx.generateTexture(`powerup-${type}`, w + pad * 2, h + pad * 2);
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
