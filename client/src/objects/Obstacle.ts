import Phaser from 'phaser';
import { DESPAWN_Y, OBSTACLE_CONFIGS } from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

export class Obstacle extends Phaser.Physics.Arcade.Sprite {
    obstacleType: ObstacleType = 'rock';

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'obstacle-rock');
        this.setActive(false);
        this.setVisible(false);
    }

    activate(x: number, y: number, type: ObstacleType, speed: number): void {
        this.obstacleType = type;
        this.setTexture(`obstacle-${type}`);
        this.setPosition(x, y);

        const config = OBSTACLE_CONFIGS[type];
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
