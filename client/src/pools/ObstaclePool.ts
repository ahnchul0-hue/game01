import Phaser from 'phaser';
import { Obstacle } from '../objects/Obstacle';
import { OBSTACLE_POOL_SIZE_3D } from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

export class ObstaclePool {
    private group: Phaser.Physics.Arcade.Group;

    constructor(scene: Phaser.Scene) {
        this.group = scene.physics.add.group({
            classType: Obstacle,
            maxSize: OBSTACLE_POOL_SIZE_3D,
            runChildUpdate: true,
            active: false,
            visible: false,
        });
    }

    spawn(lane: number, z: number, type: ObstacleType, zSpeed: number): Obstacle | null {
        const obstacle = this.group.get() as Obstacle | null;
        if (!obstacle) return null;
        obstacle.activate(lane, z, type, zSpeed);
        return obstacle;
    }

    deactivateAll(): void {
        this.group.getChildren().forEach((child) => {
            if (child.active) {
                (child as Obstacle).deactivate();
            }
        });
    }

    getGroup(): Phaser.Physics.Arcade.Group {
        return this.group;
    }
}
