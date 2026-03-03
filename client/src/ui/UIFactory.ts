import Phaser from 'phaser';
import { SoundManager } from '../services/SoundManager';

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

const FADE_DURATION = 400;

/**
 * Fade out the current scene's camera, then start a new scene with fade-in.
 */
export function fadeToScene(scene: Phaser.Scene, targetScene: string, data?: object): void {
    // Prevent double-trigger during fade
    if (scene.cameras.main.fadeEffect.isRunning) return;

    scene.cameras.main.fadeOut(FADE_DURATION, 0, 0, 0);
    scene.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => scene.scene.start(targetScene, data),
    );
}

/**
 * Called in create() of incoming scenes to fade in from black.
 */
export function fadeIn(scene: Phaser.Scene): void {
    scene.cameras.main.fadeIn(FADE_DURATION, 0, 0, 0);
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
        SoundManager.getInstance().playSfx('button');
        bg.setAlpha(0.7);
        text.setAlpha(0.7);
        scene.time.delayedCall(120, () => {
            if (!scene.scene.isActive()) return;
            bg.setAlpha(1);
            text.setAlpha(1);
            callback();
        });
    });
}
