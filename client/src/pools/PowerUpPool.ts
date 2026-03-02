import Phaser from 'phaser';
import { PowerUp } from '../objects/PowerUp';
import { POWERUP_POOL_SIZE_3D } from '../utils/Constants';
import type { PowerUpType } from '../utils/Constants';

export class PowerUpPool {
    private group: Phaser.Physics.Arcade.Group;

    constructor(scene: Phaser.Scene) {
        this.group = scene.physics.add.group({
            classType: PowerUp,
            maxSize: POWERUP_POOL_SIZE_3D,
            runChildUpdate: true,
            active: false,
            visible: false,
        });
    }

    spawn(lane: number, z: number, type: PowerUpType, zSpeed: number): PowerUp | null {
        const powerUp = this.group.get() as PowerUp | null;
        if (!powerUp) return null;
        powerUp.activate(lane, z, type, zSpeed);
        return powerUp;
    }

    deactivateAll(): void {
        this.group.getChildren().forEach((child) => {
            if (child.active) {
                (child as PowerUp).deactivate();
            }
        });
    }

    getGroup(): Phaser.Physics.Arcade.Group {
        return this.group;
    }
}
