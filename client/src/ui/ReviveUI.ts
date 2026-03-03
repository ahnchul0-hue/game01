import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_FAMILY } from '../utils/Constants';

/**
 * Modal overlay that asks the player whether to revive or give up.
 * Manages its own container + hit zones and cleans up on hide/destroy.
 */
export class ReviveUI {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container | null = null;
    private hitZones: Phaser.GameObjects.Zone[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    show(onRevive: () => void, onGiveUp: () => void): void {
        this.container = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(300);

        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
        this.container.add(overlay);

        const text = this.scene.add.text(0, -60, 'Continue?', {
            fontFamily: FONT_FAMILY, fontSize: '40px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(text);

        this.createButton(0, 20, 'REVIVE', 0x4CAF50, () => {
            this.destroyHitZones();
            onRevive();
        });

        this.createButton(0, 90, 'GIVE UP', 0x757575, () => {
            this.destroyHitZones();
            onGiveUp();
        });
    }

    hide(): void {
        this.destroyHitZones();
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
    }

    destroy(): void {
        this.hide();
    }

    private createButton(x: number, y: number, label: string, color: number, callback: () => void): void {
        if (!this.container) return;

        const btnW = 200;
        const btnH = 50;
        const bg = this.scene.add.graphics();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(x - btnW / 2, y - btnH / 2, btnW, btnH, 12);
        this.container.add(bg);

        const btnText = this.scene.add.text(x, y, label, {
            fontFamily: FONT_FAMILY, fontSize: '22px', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(btnText);

        const hitArea = this.scene.add.zone(
            GAME_WIDTH / 2 + x,
            GAME_HEIGHT / 2 + y,
            btnW,
            btnH,
        ).setInteractive({ useHandCursor: true });
        this.hitZones.push(hitArea);

        hitArea.on('pointerdown', callback);
    }

    private destroyHitZones(): void {
        for (const zone of this.hitZones) {
            if (!zone.scene) continue;
            zone.destroy();
        }
        this.hitZones = [];
    }
}
