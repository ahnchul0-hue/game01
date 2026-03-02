import Phaser from 'phaser';
import { STAGE_COLORS, SKIN_CONFIGS } from './Constants';
import type { StageType, SkinId } from './Constants';

/**
 * 스테이지 배경 텍스처 lazy 생성.
 * 이미 존재하면 스킵 (중복 방지).
 * CPU가 좋은 환경에서 메모리 절약을 위해 필요 시점에 호출.
 */
export function ensureStageTextures(scene: Phaser.Scene, stage: StageType): void {
    const skyKey = `bg-sky-${stage}`;
    if (scene.textures.exists(skyKey)) return;

    const colors = STAGE_COLORS[stage];

    // sky (64x64)
    const skyGfx = scene.make.graphics({ x: 0, y: 0 }, false);
    skyGfx.fillStyle(colors.sky, 1);
    skyGfx.fillRect(0, 0, 64, 64);
    skyGfx.generateTexture(skyKey, 64, 64);
    skyGfx.destroy();

    // trees (512x256)
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

    // ground (512x256)
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
 * 스킨 텍스처 lazy 생성.
 * 이미 존재하면 스킵.
 */
export function ensureSkinTexture(scene: Phaser.Scene, skinId: SkinId): void {
    const key = `capybara-${skinId}`;
    if (scene.textures.exists(key)) return;

    const config = SKIN_CONFIGS.find(s => s.id === skinId);
    if (!config) return;

    const bodyColor = config.color;
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(bodyColor, 1);
    gfx.fillRoundedRect(0, 0, 100, 130, 16);
    const earColor = Phaser.Display.Color.ValueToColor(bodyColor);
    earColor.darken(15);
    gfx.fillStyle(earColor.color, 1);
    gfx.fillRoundedRect(10, 0, 20, 16, 6);
    gfx.fillRoundedRect(70, 0, 20, 16, 6);
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(35, 45, 6);
    gfx.fillCircle(65, 45, 6);
    gfx.fillStyle(0xFFFFFF, 1);
    gfx.fillCircle(37, 43, 2);
    gfx.fillCircle(67, 43, 2);
    gfx.fillStyle(0x654321, 1);
    gfx.fillCircle(50, 65, 10);
    gfx.fillStyle(0x4A3015, 1);
    gfx.fillCircle(46, 65, 3);
    gfx.fillCircle(54, 65, 3);
    gfx.lineStyle(2, 0x654321, 1);
    gfx.beginPath();
    gfx.arc(50, 72, 12, Phaser.Math.DegToRad(10), Phaser.Math.DegToRad(170), false);
    gfx.strokePath();
    gfx.generateTexture(key, 100, 130);
    gfx.destroy();
}
