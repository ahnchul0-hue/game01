import Phaser from 'phaser';

export interface ButtonConfig {
    x: number;
    y: number;
    label: string;
    color: number;
    callback: () => void;
    width?: number;
    height?: number;
    fontSize?: string;
    radius?: number;
}

/**
 * Shared UI button factory — replaces duplicated createButton across 5 scenes.
 */
export function createButton(scene: Phaser.Scene, config: ButtonConfig): void {
    const {
        x, y, label, color, callback,
        width: btnW = 240,
        height: btnH = 56,
        fontSize = '26px',
        radius = 14,
    } = config;

    const bg = scene.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, radius);

    const text = scene.add.text(x, y, label, {
        fontFamily: 'Arial', fontSize, color: '#FFFFFF', fontStyle: 'bold',
    }).setOrigin(0.5);

    const hitArea = scene.add.zone(x, y, btnW, btnH).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
        bg.setAlpha(0.7);
        text.setAlpha(0.7);
        scene.time.delayedCall(120, () => {
            bg.setAlpha(1);
            text.setAlpha(1);
            callback();
        });
    });
}
