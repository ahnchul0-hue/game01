import Phaser from 'phaser';
import { DESPAWN_Y, POWERUP_CONFIGS } from '../utils/Constants';
import type { PowerUpType } from '../utils/Constants';

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
    powerUpType: PowerUpType = 'helmet';

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'powerup-helmet');
        this.setActive(false);
        this.setVisible(false);
    }

    activate(x: number, y: number, type: PowerUpType, speed: number): void {
        this.powerUpType = type;
        this.setTexture(`powerup-${type}`);
        this.setPosition(x, y);

        const config = POWERUP_CONFIGS[type];
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(config.width, config.height);
        body.setOffset(
            (this.width - config.width) / 2,
            (this.height - config.height) / 2,
        );

        this.setVelocityY(speed);
        this.setActive(true);
        this.setVisible(true);
    }

    deactivate(): void {
        this.setActive(false);
        this.setVisible(false);
        this.setVelocity(0, 0);
        if (this.body) {
            (this.body as Phaser.Physics.Arcade.Body).reset(0, 0);
        }
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        if (this.active && this.y > DESPAWN_Y) {
            this.deactivate();
        }
    }
}
