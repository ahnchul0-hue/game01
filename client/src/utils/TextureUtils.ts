import Phaser from 'phaser';
import { STAGE_COLORS, SKIN_CONFIGS } from './Constants';
import type { StageType, SkinId } from './Constants';

/**
 * 스테이지 배경 텍스처 lazy 생성.
 * 의사-3D에서는 RoadRenderer가 도로를 그리므로,
 * 스테이지 텍스처는 참조용으로만 유지.
 */
export function ensureStageTextures(scene: Phaser.Scene, stage: StageType): void {
    const skyKey = `bg-sky-${stage}`;
    if (scene.textures.exists(skyKey)) return;

    const colors = STAGE_COLORS[stage];

    const skyGfx = scene.make.graphics({ x: 0, y: 0 }, false);
    skyGfx.fillStyle(colors.sky, 1);
    skyGfx.fillRect(0, 0, 64, 64);
    skyGfx.generateTexture(skyKey, 64, 64);
    skyGfx.destroy();

    const treesGfx = scene.make.graphics({ x: 0, y: 0 }, false);
    treesGfx.fillStyle(colors.trees, 1);
    treesGfx.fillTriangle(0, 256, 128, 40, 256, 256);
    const treeVariant = Phaser.Display.Color.ValueToColor(colors.trees);
    treeVariant.brighten(10);
    treesGfx.fillStyle(treeVariant.color, 1);
    treesGfx.fillTriangle(150, 256, 300, 60, 450, 256);
    treeVariant.darken(20);
    treesGfx.fillStyle(treeVariant.color, 1);
    treesGfx.fillTriangle(350, 256, 480, 90, 512, 256);
    treesGfx.generateTexture(`bg-trees-${stage}`, 512, 256);
    treesGfx.destroy();

    const groundGfx = scene.make.graphics({ x: 0, y: 0 }, false);
    groundGfx.fillStyle(colors.ground, 1);
    groundGfx.fillRect(0, 0, 512, 256);
    const grassColor = Phaser.Display.Color.ValueToColor(colors.trees);
    grassColor.darken(10);
    groundGfx.fillStyle(grassColor.color, 1);
    groundGfx.fillRect(0, 0, 512, 8);
    groundGfx.generateTexture(`bg-ground-${stage}`, 512, 256);
    groundGfx.destroy();
}

/**
 * 카피바라 뒷모습 스킨 텍스처 생성.
 * 의사-3D에서 플레이어는 뒤에서 보이므로:
 * - 둥근 갈색 몸체
 * - 작은 귀 2개 (상단)
 * - 뒷모습이라 눈/코 없음
 * - 짧은 꼬리 (하단)
 */
export function ensureSkinTexture(scene: Phaser.Scene, skinId: SkinId): void {
    const key = `capybara-${skinId}`;
    if (scene.textures.exists(key)) return;

    const config = SKIN_CONFIGS.find(s => s.id === skinId);
    if (!config) return;

    const bodyColor = config.color;
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

    // 몸체 (둥근 사각형)
    gfx.fillStyle(bodyColor, 1);
    gfx.fillRoundedRect(10, 20, 80, 100, 20);

    // 귀
    const earColor = Phaser.Display.Color.ValueToColor(bodyColor);
    earColor.darken(15);
    gfx.fillStyle(earColor.color, 1);
    gfx.fillRoundedRect(18, 8, 18, 20, 8);
    gfx.fillRoundedRect(64, 8, 18, 20, 8);

    // 귀 안쪽 (밝은 색)
    earColor.brighten(25);
    gfx.fillStyle(earColor.color, 1);
    gfx.fillRoundedRect(22, 12, 10, 12, 4);
    gfx.fillRoundedRect(68, 12, 10, 12, 4);

    // 뒷목 톤 변화
    const darkBody = Phaser.Display.Color.ValueToColor(bodyColor);
    darkBody.darken(8);
    gfx.fillStyle(darkBody.color, 1);
    gfx.fillRoundedRect(25, 25, 50, 30, 12);

    // 꼬리 (작은 타원)
    gfx.fillStyle(bodyColor, 1);
    gfx.fillCircle(50, 118, 8);

    gfx.generateTexture(key, 100, 130);
    gfx.destroy();
}
