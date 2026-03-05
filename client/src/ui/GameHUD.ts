import Phaser from 'phaser';
import { GAME_WIDTH, FONT_FAMILY } from '../utils/Constants';

interface PowerUpTimer {
    type: string;
    remaining: number;
}

const HUD_COLORS: Record<string, string> = { tube: '#64B5F6', friend: '#FF6F00', magnet: '#CC0000' };
const HUD_NAMES: Record<string, string> = { tube: '튜브', friend: '친구', magnet: '자석' };

/** Manages all in-game HUD text elements and popup animations. */
export class GameHUD {
    private scene: Phaser.Scene;
    private scoreText: Phaser.GameObjects.Text;
    private distanceText: Phaser.GameObjects.Text;
    private itemCounterText: Phaser.GameObjects.Text;
    private powerUpHudTexts: Phaser.GameObjects.Text[] = [];
    private comboText: Phaser.GameObjects.Text | null = null;
    private popupTexts: Phaser.GameObjects.Text[] = [];

    constructor(scene: Phaser.Scene, isRelax: boolean, onsenBuffMultiplier: number) {
        this.scene = scene;

        this.scoreText = scene.add.text(20, 20, '0', {
            fontFamily: FONT_FAMILY, fontSize: '32px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(100);
        if (isRelax) this.scoreText.setVisible(false);

        this.distanceText = scene.add.text(GAME_WIDTH - 20, 20, '0m', {
            fontFamily: FONT_FAMILY, fontSize: '28px', color: '#FFFFFF',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

        this.itemCounterText = scene.add.text(20, 100, '', {
            fontFamily: FONT_FAMILY, fontSize: '18px', color: '#FFD700',
            stroke: '#000000', strokeThickness: 2,
        }).setScrollFactor(0).setDepth(100);

        // Relax mode badge
        if (isRelax) {
            const badge = scene.add.graphics();
            badge.fillStyle(0x81C784, 0.8);
            badge.fillRoundedRect(GAME_WIDTH / 2 - 60, 8, 120, 32, 10);
            badge.setScrollFactor(0).setDepth(99);
            scene.add.text(GAME_WIDTH / 2, 24, 'RELAX', {
                fontFamily: FONT_FAMILY, fontSize: '20px', color: '#FFFFFF', fontStyle: 'bold',
            }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        }

        // Onsen buff indicator
        if (onsenBuffMultiplier > 1) {
            scene.add.text(20, 60, `x${onsenBuffMultiplier.toFixed(1)}`, {
                fontFamily: FONT_FAMILY, fontSize: '18px', color: '#FF8C00',
                stroke: '#000000', strokeThickness: 2,
            }).setScrollFactor(0).setDepth(100);
        }

        // Power-up timer text pool (max 3)
        for (let i = 0; i < 3; i++) {
            const t = scene.add.text(GAME_WIDTH - 20, 160 + i * 40, '', {
                fontFamily: FONT_FAMILY, fontSize: '22px', color: '#FFFFFF',
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(100).setVisible(false);
            this.powerUpHudTexts.push(t);
        }
    }

    getScoreText(): Phaser.GameObjects.Text { return this.scoreText; }

    // ---- Per-frame updates -------------------------------------------------------

    updateScore(score: number): void {
        const s = `${score}`;
        if (this.scoreText.text !== s) this.scoreText.setText(s);
    }

    updateDistance(distance: number): void {
        const s = `${Math.floor(distance)}m`;
        if (this.distanceText.text !== s) this.distanceText.setText(s);
    }

    updateItems(total: number): void {
        const s = total > 0 ? `x${total}` : '';
        if (this.itemCounterText.text !== s) this.itemCounterText.setText(s);
    }

    updatePowerUps(timers: PowerUpTimer[]): void {
        for (let i = 0; i < this.powerUpHudTexts.length; i++) {
            const hudText = this.powerUpHudTexts[i];
            if (i < timers.length) {
                const t = timers[i];
                hudText.setText(`${HUD_NAMES[t.type]} ${Math.ceil(t.remaining / 1000)}s`);
                hudText.setColor(HUD_COLORS[t.type] ?? '#FFFFFF');
                hudText.setVisible(true);
            } else {
                hudText.setVisible(false);
            }
        }
    }

    updateCombo(count: number): void {
        if (count >= 3) {
            if (!this.comboText) {
                this.comboText = this.scene.add.text(GAME_WIDTH / 2, 110, '', {
                    fontFamily: FONT_FAMILY, fontSize: '22px', color: '#FF8800',
                    fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
                }).setOrigin(0.5).setDepth(100);
            }
            this.comboText.setText(`COMBO x${count}`).setVisible(true);
            this.comboText.setColor(count >= 5 ? '#FF4444' : '#FF8800');
        } else if (this.comboText) {
            this.comboText.setVisible(false);
        }
    }

    // ---- Popups ------------------------------------------------------------------

    showPointsPopup(x: number, y: number, points: number, comboCount: number): void {
        const comboLabel = comboCount >= 3 ? ` x${comboCount}` : '';
        const color = comboCount >= 5 ? '#FF4444' : comboCount >= 3 ? '#FF8800' : '#FFD700';
        const size = comboCount >= 3 ? '28px' : '24px';
        this._popup(x, y, `+${points}${comboLabel}`, color, size, 600, 60);
    }

    showNearMiss(x: number, y: number, bonus: number): void {
        this._popup(x, y - 30, `NEAR MISS! +${bonus}`, '#00FF88', '20px', 800, 50);
    }

    private _popup(
        x: number, y: number, text: string,
        color: string, fontSize: string, duration: number, rise: number,
    ): void {
        const popup = this.scene.add.text(x, y, text, {
            fontFamily: FONT_FAMILY, fontSize, color,
            fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(200);
        this.popupTexts.push(popup);

        this.scene.tweens.add({
            targets: popup,
            y: popup.y - rise,
            alpha: 0,
            duration,
            ease: 'Power2',
            onComplete: () => {
                const idx = this.popupTexts.indexOf(popup);
                if (idx !== -1) this.popupTexts.splice(idx, 1);
                popup.destroy();
            },
        });
    }

    // ---- Cleanup -----------------------------------------------------------------

    destroy(): void {
        for (const t of this.popupTexts) { if (t.scene) t.destroy(); }
        this.popupTexts = [];
        for (const t of this.powerUpHudTexts) { if (t.scene) t.destroy(); }
        this.powerUpHudTexts = [];
        if (this.comboText?.scene) this.comboText.destroy();
        this.comboText = null;
    }
}
