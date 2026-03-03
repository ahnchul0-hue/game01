import Phaser from 'phaser';
import { SoundManager } from '../services/SoundManager';
import { FONT_FAMILY } from '../utils/Constants';

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
        fontFamily: FONT_FAMILY, fontSize, color: '#FFFFFF', fontStyle: 'bold',
    }).setOrigin(0.5);

    // 컨테이너로 묶어서 스케일 애니메이션 적용
    const container = scene.add.container(x, y, [bg, text]);
    bg.setPosition(-x, -y); // 컨테이너 내 로컬 좌표 보정
    text.setPosition(0, 0);

    const hitArea = scene.add.zone(x, y, btnW, btnH).setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
        scene.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    hitArea.on('pointerout', () => {
        scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
        container.setAlpha(1);
    });
    hitArea.on('pointerdown', () => {
        SoundManager.getInstance().playSfx('button');
        container.setAlpha(0.8);
        scene.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 60 });
        scene.time.delayedCall(120, () => {
            if (!scene.scene.isActive()) return;
            container.setAlpha(1);
            scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 });
            callback();
        });
    });
}
