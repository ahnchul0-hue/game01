/**
 * TextureAtlasBuilder
 *
 * 프로시저럴 텍스처를 하나의 큰 RenderTexture(아틀라스)에 모아서 그린 뒤,
 * Phaser TextureManager에 프레임으로 등록합니다.
 *
 * 이점:
 * - GPU 텍스처 슬롯 절약 (개별 텍스처 18+ → 아틀라스 2장으로 통합)
 * - 같은 아틀라스 내 스프라이트는 Phaser BatchRenderer가 단일 드로우콜로 처리
 * - generateTexture()마다 새 WebGL 텍스처가 생성되는 오버헤드 제거
 *
 * 아틀라스 키:
 * - 'atlas-game'  : 장애물 6종 + 아이템 3종 + 파워업 4종 (512x512)
 * - 'atlas-ui'    : particle + friend-sprite + helmet-overlay + onsen-deco 3종 (256x256)
 *
 * 기존 키 호환:
 * 개별 텍스처 키(obstacle-rock 등)는 아틀라스 프레임 이름으로 그대로 유지됩니다.
 * 코드 수정 없이 `this.add.image(x, y, 'atlas-game', 'obstacle-rock')` 으로 접근하거나,
 * 기존 키 래퍼(`setAtlasTexture`)를 통해 구버전 API 호환도 제공합니다.
 *
 * 확장 지점:
 * [EXTEND] 새 프로시저럴 텍스처 추가 시 해당 draw 함수를 추가하고
 *          ATLAS_GAME_FRAMES 또는 ATLAS_UI_FRAMES에 항목을 추가하세요.
 * [EXTEND] 512x512 초과 시 아틀라스를 분할하거나 크기를 1024x1024로 키우세요.
 */

import Phaser from 'phaser';
import {
    OBSTACLE_CONFIGS,
    ITEM_SIZE,
    POWERUP_CONFIGS,
    ONSEN_ITEM_DISPLAY_SIZE,
} from './Constants';
import type { ObstacleType, PowerUpType, ItemType } from './Constants';

/** 아틀라스 키 상수 — 외부에서 참조 가능 */
export const ATLAS_GAME_KEY = 'atlas-game';
export const ATLAS_UI_KEY = 'atlas-ui';

/** 아틀라스 내 프레임 위치 정보 */
interface FrameRect {
    key: string;   // 프레임 이름 (= 기존 텍스처 키)
    x: number;
    y: number;
    w: number;
    h: number;
}

// ─────────────────────────────────────────────
// atlas-game 레이아웃 (512 x 512)
// 패킹 전략: 행 기반 선반(Shelf) 알고리즘, 4px 패딩
// ─────────────────────────────────────────────
const PAD = 4;

/**
 * 장애물 텍스처 너비 계산 (snake는 혀 돌출로 +14)
 */
function obstacleTexW(type: ObstacleType): number {
    const { width: w } = OBSTACLE_CONFIGS[type];
    return (type === 'snake' ? w + 14 : w) + PAD;
}
function obstacleTexH(type: ObstacleType): number {
    return OBSTACLE_CONFIGS[type].height + PAD;
}

// 수동 팩 레이아웃 계산 (빌드타임 상수화)
// 행 1: rock(84x84), branch_high(104x44), barrier(164x64) → 최대높이 84
// 행 2: puddle(104x34), car(84x104), snake(108x34)         → 최대높이 104
// 행 3: item-mandarin(54x54), item-watermelon(54x54), item-hotspring_material(54x54)
//        powerup-helmet(58x58), powerup-tube(58x58), powerup-friend(58x58), powerup-magnet(58x58)
//        → 최대높이 58

function buildGameAtlasFrames(): FrameRect[] {
    const frames: FrameRect[] = [];

    // --- 행 1: 장애물 묶음 A (높이 ≤ 84)
    let curX = PAD;
    let curY = PAD;
    let rowH = 0;

    const row1Types: ObstacleType[] = ['rock', 'branch_high', 'barrier'];
    for (const type of row1Types) {
        const w = obstacleTexW(type);
        const h = obstacleTexH(type);
        frames.push({ key: `obstacle-${type}`, x: curX, y: curY, w, h });
        curX += w + PAD;
        if (h > rowH) rowH = h;
    }

    // --- 행 2: 장애물 묶음 B (높이 ≤ 104)
    curX = PAD;
    curY += rowH + PAD;
    rowH = 0;

    const row2Types: ObstacleType[] = ['puddle', 'car', 'snake'];
    for (const type of row2Types) {
        const w = obstacleTexW(type);
        const h = obstacleTexH(type);
        frames.push({ key: `obstacle-${type}`, x: curX, y: curY, w, h });
        curX += w + PAD;
        if (h > rowH) rowH = h;
    }

    // --- 행 3: 아이템 3종 (54x54)
    curX = PAD;
    curY += rowH + PAD;
    rowH = 0;

    const itemTypes: { name: string; color: number }[] = [
        { name: 'mandarin', color: 0xFF8C00 },
        { name: 'watermelon', color: 0x2E8B57 },
        { name: 'hotspring_material', color: 0xFF69B4 },
    ];
    const itemSize = ITEM_SIZE + PAD; // 54
    for (const item of itemTypes) {
        frames.push({ key: `item-${item.name}`, x: curX, y: curY, w: itemSize, h: itemSize });
        curX += itemSize + PAD;
        if (itemSize > rowH) rowH = itemSize;
    }

    // --- 행 4: 파워업 4종 (58x58)
    curX = PAD;
    curY += rowH + PAD;
    rowH = 0;

    const powerupTypes: PowerUpType[] = ['helmet', 'tube', 'friend', 'magnet'];
    const pwPad = 4; // createPowerUpTexture의 pad 값
    for (const type of powerupTypes) {
        const { width: w, height: h } = POWERUP_CONFIGS[type];
        const fw = w + pwPad * 2; // 58
        const fh = h + pwPad * 2; // 58
        frames.push({ key: `powerup-${type}`, x: curX, y: curY, w: fw, h: fh });
        curX += fw + PAD;
        if (fh > rowH) rowH = fh;
    }

    return frames;
}

function buildUIAtlasFrames(): FrameRect[] {
    const frames: FrameRect[] = [];
    let curX = PAD;
    let curY = PAD;
    let rowH = 0;

    // particle 8x8
    frames.push({ key: 'particle', x: curX, y: curY, w: 8, h: 8 });
    curX += 8 + PAD;
    rowH = 8;

    // friend-sprite 60x60
    frames.push({ key: 'friend-sprite', x: curX, y: curY, w: 60, h: 60 });
    curX += 60 + PAD;
    if (60 > rowH) rowH = 60;

    // helmet-overlay 50x40
    frames.push({ key: 'helmet-overlay', x: curX, y: curY, w: 50, h: 40 });
    curX += 50 + PAD;
    if (40 > rowH) rowH = 40;

    // onsen-deco 3종 (60x60 each)
    curX = PAD;
    curY += rowH + PAD;

    const decoItems: ItemType[] = ['mandarin', 'watermelon', 'hotspring_material'];
    for (const name of decoItems) {
        const s = ONSEN_ITEM_DISPLAY_SIZE; // 60
        frames.push({ key: `onsen-deco-${name}`, x: curX, y: curY, w: s, h: s });
        curX += s + PAD;
    }

    return frames;
}

// ─────────────────────────────────────────────
// 텍스처 드로우 함수들 (Graphics → RenderTexture)
// ─────────────────────────────────────────────

/** 장애물 텍스처를 gfx에 그린다 (0,0 기준) */
function drawObstacle(
    gfx: Phaser.GameObjects.Graphics,
    type: ObstacleType,
): void {
    const { width: w, height: h, color } = OBSTACLE_CONFIGS[type];

    gfx.fillStyle(0x000000, 0.25);
    gfx.fillRoundedRect(3, 3, w, h, 8);

    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(0, 0, w, h, 8);

    gfx.fillStyle(0xFFFFFF, 0.2);
    gfx.fillRoundedRect(3, 2, w - 6, h * 0.35, 6);

    gfx.fillStyle(0x000000, 0.15);
    gfx.fillRoundedRect(3, h * 0.65, w - 6, h * 0.3, 6);

    if (type === 'rock') {
        gfx.lineStyle(2, 0x505050, 0.8);
        gfx.strokeRoundedRect(1, 1, w - 2, h - 2, 8);
        gfx.lineStyle(1, 0x000000, 0.2);
        gfx.lineBetween(w * 0.3, h * 0.2, w * 0.5, h * 0.6);
        gfx.lineBetween(w * 0.5, h * 0.6, w * 0.7, h * 0.4);
    } else if (type === 'branch_high') {
        gfx.lineStyle(3, 0x5C3317, 0.9);
        gfx.lineBetween(8, h / 2, w - 8, h / 2);
        gfx.lineStyle(2, 0x5C3317, 0.6);
        gfx.lineBetween(w * 0.3, h / 2, w * 0.2, h * 0.25);
        gfx.lineBetween(w * 0.6, h / 2, w * 0.7, h * 0.25);
    } else if (type === 'puddle') {
        gfx.lineStyle(2, 0xFFFFFF, 0.4);
        for (let i = 0; i < 3; i++) {
            const y = h * 0.3 + i * (h * 0.2);
            gfx.lineBetween(12, y, w * 0.35, y - 4);
            gfx.lineBetween(w * 0.35, y - 4, w * 0.65, y + 4);
            gfx.lineBetween(w * 0.65, y + 4, w - 12, y);
        }
    } else if (type === 'barrier') {
        gfx.lineStyle(3, 0xFFFF00, 0.6);
        for (let x = 0; x < w; x += 16) {
            gfx.lineBetween(x, 0, x + 8, h);
        }
    } else if (type === 'car') {
        gfx.fillStyle(0x88CCFF, 0.6);
        gfx.fillRoundedRect(w * 0.15, h * 0.15, w * 0.7, h * 0.35, 4);
        gfx.fillStyle(0x333333, 0.8);
        gfx.fillCircle(w * 0.25, h - 4, 6);
        gfx.fillCircle(w * 0.75, h - 4, 6);
    } else if (type === 'snake') {
        gfx.fillStyle(0x81C784, 0.7);
        gfx.fillRoundedRect(4, h * 0.3, w - 8, h * 0.4, 6);
        gfx.fillStyle(0x388E3C, 0.5);
        for (let sx = 6; sx < w - 6; sx += 10) {
            gfx.fillCircle(sx, h * 0.35, 4);
        }
        gfx.fillStyle(0x2E7D32, 1);
        gfx.fillEllipse(w - 6, h / 2, 14, 18);
        gfx.fillStyle(0xFFFFFF, 1);
        gfx.fillCircle(w - 4, h / 2 - 4, 3);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(w - 3, h / 2 - 4, 1.5);
        gfx.lineStyle(2, 0xE53935, 1);
        gfx.lineBetween(w + 2, h / 2, w + 8, h / 2 - 4);
        gfx.lineBetween(w + 2, h / 2, w + 8, h / 2 + 4);
    }

    gfx.lineStyle(2, 0x000000, 0.3);
    gfx.strokeRoundedRect(0, 0, w, h, 8);
}

/** 아이템 텍스처를 gfx에 그린다 (0,0 기준) */
function drawItem(gfx: Phaser.GameObjects.Graphics, color: number): void {
    const s = ITEM_SIZE;
    const r = s / 2;

    gfx.fillStyle(color, 0.2);
    gfx.fillCircle(r + 2, r + 2, r + 3);

    gfx.fillStyle(color, 1);
    gfx.fillCircle(r, r, r - 1);

    gfx.fillStyle(0xFFFFFF, 0.35);
    gfx.fillCircle(r - 4, r - 5, r * 0.35);

    gfx.fillStyle(0xFFFFFF, 0.5);
    gfx.fillCircle(r - 7, r - 8, 2);

    gfx.fillStyle(0x000000, 0.15);
    gfx.fillCircle(r + 2, r + 4, r * 0.5);

    gfx.lineStyle(1.5, 0x000000, 0.2);
    gfx.strokeCircle(r, r, r - 1);
}

/** 파워업 텍스처를 gfx에 그린다 (0,0 기준, pad 오프셋 포함) */
function drawPowerUp(gfx: Phaser.GameObjects.Graphics, type: PowerUpType): void {
    const config = POWERUP_CONFIGS[type];
    const w = config.width;
    const h = config.height;
    const pad = 4;
    const ox = pad;
    const oy = pad;

    gfx.fillStyle(config.color, 0.15);
    gfx.fillCircle(ox + w / 2, oy + h / 2, Math.max(w, h) * 0.6);

    gfx.fillStyle(config.color, 1);
    gfx.beginPath();
    gfx.moveTo(ox + w / 2, oy + 2);
    gfx.lineTo(ox + w - 2, oy + h / 2);
    gfx.lineTo(ox + w / 2, oy + h - 2);
    gfx.lineTo(ox + 2, oy + h / 2);
    gfx.closePath();
    gfx.fillPath();

    gfx.fillStyle(0xFFFFFF, 0.3);
    gfx.beginPath();
    gfx.moveTo(ox + w / 2, oy + 8);
    gfx.lineTo(ox + w - 12, oy + h / 2);
    gfx.lineTo(ox + w / 2, oy + h / 2);
    gfx.lineTo(ox + 12, oy + h / 2);
    gfx.closePath();
    gfx.fillPath();

    gfx.fillStyle(0x000000, 0.15);
    gfx.beginPath();
    gfx.moveTo(ox + w / 2, oy + h / 2);
    gfx.lineTo(ox + w - 12, oy + h / 2);
    gfx.lineTo(ox + w / 2, oy + h - 8);
    gfx.lineTo(ox + 12, oy + h / 2);
    gfx.closePath();
    gfx.fillPath();

    gfx.fillStyle(0xFFFFFF, 0.85);
    if (type === 'helmet') {
        gfx.fillRoundedRect(ox + w / 2 - 8, oy + h / 2 - 4, 16, 12, 4);
    } else if (type === 'tube') {
        gfx.fillCircle(ox + w / 2, oy + h / 2 + 2, 8);
        gfx.fillStyle(config.color, 1);
        gfx.fillCircle(ox + w / 2, oy + h / 2 + 2, 4);
    } else if (type === 'magnet') {
        gfx.fillRoundedRect(ox + w / 2 - 6, oy + h / 2 - 6, 4, 14, 2);
        gfx.fillRoundedRect(ox + w / 2 + 2, oy + h / 2 - 6, 4, 14, 2);
        gfx.fillRoundedRect(ox + w / 2 - 6, oy + h / 2 + 4, 12, 4, 2);
    } else {
        // friend: 하트
        gfx.fillCircle(ox + w / 2 - 4, oy + h / 2 - 1, 5);
        gfx.fillCircle(ox + w / 2 + 4, oy + h / 2 - 1, 5);
    }

    gfx.lineStyle(1.5, 0xFFFFFF, 0.4);
    gfx.beginPath();
    gfx.moveTo(ox + w / 2, oy + 2);
    gfx.lineTo(ox + w - 2, oy + h / 2);
    gfx.lineTo(ox + w / 2, oy + h - 2);
    gfx.lineTo(ox + 2, oy + h / 2);
    gfx.closePath();
    gfx.strokePath();
}

// ─────────────────────────────────────────────
// 아틀라스 빌드 함수 (공개 API)
// ─────────────────────────────────────────────

/**
 * atlas-game (512x512) 를 빌드하여 TextureManager에 등록.
 *
 * 포함 텍스처:
 * - obstacle-rock, obstacle-branch_high, obstacle-puddle,
 *   obstacle-barrier, obstacle-car, obstacle-snake (6종)
 * - item-mandarin, item-watermelon, item-hotspring_material (3종)
 * - powerup-helmet, powerup-tube, powerup-friend, powerup-magnet (4종)
 *
 * 사용:
 *   `this.add.image(x, y, ATLAS_GAME_KEY, 'obstacle-rock')`
 *
 * 레거시 호환:
 *   각 프레임 이름이 기존 텍스처 키와 동일하므로 `setAtlasTexture()`로 래핑 가능.
 *
 * [EXTEND] 512x512 초과 시 ATLAS_W/ATLAS_H 를 1024로 조정하세요.
 */
function buildGameAtlas(scene: Phaser.Scene): void {
    if (scene.textures.exists(ATLAS_GAME_KEY)) return;

    const ATLAS_W = 512;
    const ATLAS_H = 512;

    const rt = scene.add.renderTexture(0, 0, ATLAS_W, ATLAS_H);
    rt.setVisible(false);

    const frames = buildGameAtlasFrames();

    // 재사용 Graphics 인스턴스 — 매 프레임마다 clear() 후 재사용
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

    // 장애물 6종
    const obstacleTypes: ObstacleType[] = ['rock', 'branch_high', 'puddle', 'barrier', 'car', 'snake'];
    for (const type of obstacleTypes) {
        const frame = frames.find(f => f.key === `obstacle-${type}`)!;
        gfx.clear();
        drawObstacle(gfx, type);
        rt.draw(gfx, frame.x, frame.y);
    }

    // 아이템 3종
    const itemDefs: { name: string; color: number }[] = [
        { name: 'mandarin', color: 0xFF8C00 },
        { name: 'watermelon', color: 0x2E8B57 },
        { name: 'hotspring_material', color: 0xFF69B4 },
    ];
    for (const { name, color } of itemDefs) {
        const frame = frames.find(f => f.key === `item-${name}`)!;
        gfx.clear();
        drawItem(gfx, color);
        rt.draw(gfx, frame.x, frame.y);
    }

    // 파워업 4종
    const powerupTypes: PowerUpType[] = ['helmet', 'tube', 'friend', 'magnet'];
    for (const type of powerupTypes) {
        const frame = frames.find(f => f.key === `powerup-${type}`)!;
        gfx.clear();
        drawPowerUp(gfx, type);
        rt.draw(gfx, frame.x, frame.y);
    }

    gfx.destroy();

    // RenderTexture → 스냅샷 방식으로 TextureManager에 등록
    // Phaser는 rt.texture 를 직접 참조할 수 있으나, 프레임을 수동 추가해야 함
    const atlasTexture = rt.texture;
    for (const f of frames) {
        atlasTexture.add(f.key, 0, f.x, f.y, f.w, f.h);
    }

    // RenderTexture 게임오브젝트는 씬에서 제거 (텍스처는 TextureManager에 유지)
    rt.destroy();
}

/**
 * atlas-ui (256x256) 를 빌드하여 TextureManager에 등록.
 *
 * 포함 텍스처:
 * - particle (8x8)
 * - friend-sprite (60x60)
 * - helmet-overlay (50x40)
 * - onsen-deco-mandarin, onsen-deco-watermelon, onsen-deco-hotspring_material (3종, 60x60 each)
 *
 * [EXTEND] 온천 꾸미기 아이템 추가 시 이 아틀라스에 추가하거나 atlas-ui-2 를 신설하세요.
 */
function buildUIAtlas(scene: Phaser.Scene): void {
    if (scene.textures.exists(ATLAS_UI_KEY)) return;

    const ATLAS_W = 256;
    const ATLAS_H = 256;

    const rt = scene.add.renderTexture(0, 0, ATLAS_W, ATLAS_H);
    rt.setVisible(false);

    const frames = buildUIAtlasFrames();
    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

    // particle
    {
        const frame = frames.find(f => f.key === 'particle')!;
        gfx.clear();
        gfx.fillStyle(0xFFFFFF, 1);
        gfx.fillCircle(4, 4, 4);
        rt.draw(gfx, frame.x, frame.y);
    }

    // friend-sprite
    {
        const frame = frames.find(f => f.key === 'friend-sprite')!;
        gfx.clear();
        gfx.fillStyle(0xFF6F00, 1);
        gfx.fillRoundedRect(0, 0, 60, 60, 12);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(20, 22, 4);
        gfx.fillCircle(40, 22, 4);
        gfx.fillStyle(0x4A3015, 1);
        gfx.fillCircle(30, 35, 5);
        rt.draw(gfx, frame.x, frame.y);
    }

    // helmet-overlay
    {
        const frame = frames.find(f => f.key === 'helmet-overlay')!;
        gfx.clear();
        gfx.fillStyle(0x2E7D32, 1);
        gfx.fillRoundedRect(0, 0, 50, 40, 10);
        gfx.lineStyle(2, 0x1B5E20, 1);
        gfx.lineBetween(10, 5, 10, 35);
        gfx.lineBetween(25, 3, 25, 37);
        gfx.lineBetween(40, 5, 40, 35);
        rt.draw(gfx, frame.x, frame.y);
    }

    // onsen-deco 3종
    const decoDefs: { name: ItemType; color: number }[] = [
        { name: 'mandarin', color: 0xFF8C00 },
        { name: 'watermelon', color: 0x2E8B57 },
        { name: 'hotspring_material', color: 0xFF69B4 },
    ];
    for (const { name, color } of decoDefs) {
        const frame = frames.find(f => f.key === `onsen-deco-${name}`)!;
        const s = ONSEN_ITEM_DISPLAY_SIZE;
        gfx.clear();
        gfx.fillStyle(color, 1);
        gfx.fillCircle(s / 2, s / 2, s / 2);
        gfx.fillStyle(0xFFFFFF, 0.3);
        gfx.fillCircle(s / 2 - 6, s / 2 - 6, s / 5);
        rt.draw(gfx, frame.x, frame.y);
    }

    gfx.destroy();

    const atlasTexture = rt.texture;
    for (const f of frames) {
        atlasTexture.add(f.key, 0, f.x, f.y, f.w, f.h);
    }

    rt.destroy();
}

/**
 * 두 아틀라스를 모두 빌드하는 편의 함수.
 * Preloader.create()에서 단일 호출로 사용.
 */
export function buildAllAtlases(scene: Phaser.Scene): void {
    buildGameAtlas(scene);
    buildUIAtlas(scene);
}
