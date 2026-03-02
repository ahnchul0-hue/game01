import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_PRELOADER,
    SCENE_MAIN_MENU,
    OBSTACLE_CONFIGS,
    ITEM_SIZE,
} from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

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

        // 프로토타입에서는 로드할 에셋이 없으므로 progress가 즉시 1.0
        // 실제 에셋 추가 시 this.load.image(...) 등을 여기에 배치
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
        // 카피바라 (100x130, 갈색 둥근 사각형 + 얼굴)
        const capyGfx = this.make.graphics({ x: 0, y: 0 }, false);
        capyGfx.fillStyle(0x8B6914, 1);
        capyGfx.fillRoundedRect(0, 0, 100, 130, 16);
        // 귀
        capyGfx.fillStyle(0x7A5C10, 1);
        capyGfx.fillRoundedRect(10, 0, 20, 16, 6);
        capyGfx.fillRoundedRect(70, 0, 20, 16, 6);
        // 눈
        capyGfx.fillStyle(0x000000, 1);
        capyGfx.fillCircle(35, 45, 6);
        capyGfx.fillCircle(65, 45, 6);
        // 눈 하이라이트
        capyGfx.fillStyle(0xFFFFFF, 1);
        capyGfx.fillCircle(37, 43, 2);
        capyGfx.fillCircle(67, 43, 2);
        // 코
        capyGfx.fillStyle(0x654321, 1);
        capyGfx.fillCircle(50, 65, 10);
        // 콧구멍
        capyGfx.fillStyle(0x4A3015, 1);
        capyGfx.fillCircle(46, 65, 3);
        capyGfx.fillCircle(54, 65, 3);
        // 입 (미소)
        capyGfx.lineStyle(2, 0x654321, 1);
        capyGfx.beginPath();
        capyGfx.arc(50, 72, 12, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170), false);
        capyGfx.strokePath();
        capyGfx.generateTexture('capybara', 100, 130);
        capyGfx.destroy();

        // 배경 하늘 (64x64 POT 단색 — TileSprite에서 반복됨)
        const skyGfx = this.make.graphics({ x: 0, y: 0 }, false);
        skyGfx.fillStyle(0x87CEEB, 1);
        skyGfx.fillRect(0, 0, 64, 64);
        skyGfx.generateTexture('bg-sky', 64, 64);
        skyGfx.destroy();

        // 중간 배경 (512x256 POT, 나무/산)
        const treesGfx = this.make.graphics({ x: 0, y: 0 }, false);
        treesGfx.fillStyle(0x228B22, 1);
        treesGfx.fillTriangle(0, 256, 128, 40, 256, 256);
        treesGfx.fillStyle(0x2E8B2E, 1);
        treesGfx.fillTriangle(150, 256, 300, 60, 450, 256);
        treesGfx.fillStyle(0x1E7B1E, 1);
        treesGfx.fillTriangle(350, 256, 480, 90, 512, 256);
        treesGfx.generateTexture('bg-trees', 512, 256);
        treesGfx.destroy();

        // 땅 (512x256 POT, 진한 갈색)
        const groundGfx = this.make.graphics({ x: 0, y: 0 }, false);
        groundGfx.fillStyle(0x8B4513, 1);
        groundGfx.fillRect(0, 0, 512, 256);
        // 상단 경계선 (풀 느낌)
        groundGfx.fillStyle(0x5D8A2D, 1);
        groundGfx.fillRect(0, 0, 512, 8);
        groundGfx.generateTexture('bg-ground', 512, 256);
        groundGfx.destroy();

        // M2: 장애물 텍스처 3종
        this.createObstacleTexture('rock', OBSTACLE_CONFIGS.rock);
        this.createObstacleTexture('branch_high', OBSTACLE_CONFIGS.branch_high);
        this.createObstacleTexture('puddle', OBSTACLE_CONFIGS.puddle);

        // M2: 아이템 텍스처 3종
        this.createItemTexture('mandarin', 0xFF8C00);
        this.createItemTexture('watermelon', 0x2E8B57);
        this.createItemTexture('hotspring_material', 0xFF69B4);
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
}
