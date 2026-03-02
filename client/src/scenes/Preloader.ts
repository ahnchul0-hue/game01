import Phaser from 'phaser';
import {
    GAME_WIDTH,
    GAME_HEIGHT,
    SCENE_PRELOADER,
    SCENE_MAIN_MENU,
} from '../utils/Constants';

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

        // 프로토타입 에셋: 코드 기반 텍스처 생성
        this.createPlaceholderTextures();
    }

    create(): void {
        // 최소 0.5초 표시 후 메뉴로 전환
        this.time.delayedCall(500, () => {
            this.scene.start(SCENE_MAIN_MENU);
        });
    }

    private createPlaceholderTextures(): void {
        // 카피바라 (갈색 사각형)
        const capyGfx = this.make.graphics({ x: 0, y: 0 }, false);
        capyGfx.fillStyle(0x8B6914, 1);
        capyGfx.fillRoundedRect(0, 0, 60, 80, 10);
        // 얼굴 (눈)
        capyGfx.fillStyle(0x000000, 1);
        capyGfx.fillCircle(20, 25, 4);
        capyGfx.fillCircle(40, 25, 4);
        // 코
        capyGfx.fillStyle(0x654321, 1);
        capyGfx.fillCircle(30, 38, 6);
        capyGfx.generateTexture('capybara', 60, 80);
        capyGfx.destroy();

        // 배경 하늘 (하늘색 → 연보라 그라디언트 느낌)
        const skyGfx = this.make.graphics({ x: 0, y: 0 }, false);
        skyGfx.fillStyle(0x87CEEB, 1);
        skyGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        skyGfx.generateTexture('bg-sky', GAME_WIDTH, GAME_HEIGHT);
        skyGfx.destroy();

        // 중간 배경 (나무/산 — 녹색)
        const treesGfx = this.make.graphics({ x: 0, y: 0 }, false);
        treesGfx.fillStyle(0x228B22, 1);
        // 심플 산 모양
        treesGfx.fillTriangle(0, 300, 180, 50, 360, 300);
        treesGfx.fillTriangle(200, 300, 400, 80, 600, 300);
        treesGfx.fillTriangle(500, 300, 650, 120, 720, 300);
        treesGfx.generateTexture('bg-trees', GAME_WIDTH, 300);
        treesGfx.destroy();

        // 땅 (진한 갈색)
        const groundGfx = this.make.graphics({ x: 0, y: 0 }, false);
        groundGfx.fillStyle(0x8B4513, 1);
        groundGfx.fillRect(0, 0, GAME_WIDTH, 200);
        // 레인 구분선
        groundGfx.lineStyle(2, 0xAAAAAA, 0.3);
        groundGfx.lineBetween(GAME_WIDTH / 3, 0, GAME_WIDTH / 3, 200);
        groundGfx.lineBetween((GAME_WIDTH / 3) * 2, 0, (GAME_WIDTH / 3) * 2, 200);
        groundGfx.generateTexture('bg-ground', GAME_WIDTH, 200);
        groundGfx.destroy();
    }
}
