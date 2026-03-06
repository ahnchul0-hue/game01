import Phaser from 'phaser';
import { STAGE_COLORS } from '../utils/Constants';
import type { StageType } from '../utils/Constants';

const SIZE = 120;

export function drawDiaryIllustration(scene: Phaser.Scene, x: number, y: number, stage: StageType): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    const colors = STAGE_COLORS[stage];

    // Sky
    g.fillStyle(colors.sky, 1);
    g.fillRect(x, y, SIZE, SIZE);

    // Ground
    g.fillStyle(colors.ground, 1);
    g.fillRect(x, y + 85, SIZE, 35);

    switch (stage) {
        case 'forest': drawForest(g, x, y, colors); break;
        case 'river':  drawRiver(g, x, y, colors);  break;
        case 'village': drawVillage(g, x, y, colors); break;
        case 'onsen':  drawOnsen(g, x, y, colors);  break;
    }

    return g;
}

function drawForest(g: Phaser.GameObjects.Graphics, x: number, y: number, c: { trees: number }): void {
    for (const tx of [20, 50, 80, 105]) {
        const h = 30 + Math.abs(tx - 60) * 0.3;
        g.fillStyle(c.trees, 1);
        g.fillTriangle(x + tx, y + 85 - h, x + tx - 12, y + 85, x + tx + 12, y + 85);
        g.fillStyle(0x5D4037, 1);
        g.fillRect(x + tx - 2, y + 80, 4, 5);
    }
}

function drawRiver(g: Phaser.GameObjects.Graphics, x: number, y: number, c: { trees: number }): void {
    g.fillStyle(0x4FC3F7, 0.7);
    g.fillRect(x, y + 70, SIZE, 15);
    g.fillStyle(0x795548, 1);
    g.fillRect(x + 30, y + 65, 60, 8);
    g.fillRect(x + 35, y + 58, 4, 12);
    g.fillRect(x + 81, y + 58, 4, 12);
    g.fillStyle(c.trees, 0.5);
    g.fillTriangle(x + 90, y + 25, x + 60, y + 70, x + 120, y + 70);
}

function drawVillage(g: Phaser.GameObjects.Graphics, x: number, y: number, _c: { trees: number }): void {
    for (const hx of [20, 60, 95]) {
        g.fillStyle(0xFFCC80, 1);
        g.fillRect(x + hx - 12, y + 60, 24, 25);
        g.fillStyle(0xD84315, 1);
        g.fillTriangle(x + hx, y + 48, x + hx - 16, y + 60, x + hx + 16, y + 60);
    }
    g.fillStyle(0xBCAAA4, 1);
    g.fillRect(x + 10, y + 88, 100, 8);
}

function drawOnsen(g: Phaser.GameObjects.Graphics, x: number, y: number, _c: { trees: number }): void {
    g.fillStyle(0x80DEEA, 0.8);
    g.fillEllipse(x + 60, y + 75, 80, 30);
    g.fillStyle(0xFFFFFF, 0.3);
    for (const [sx, sy, r] of [[40, 50, 8], [60, 40, 10], [80, 45, 7], [55, 30, 6]] as const) {
        g.fillCircle(x + sx, y + sy, r);
    }
    g.fillStyle(0x795548, 0.8);
    g.fillEllipse(x + 60, y + 70, 16, 10);
    g.fillCircle(x + 68, y + 64, 6);
}
