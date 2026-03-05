import Phaser from 'phaser';
import { ZObject } from './ZObject';
import { OBSTACLE_CONFIGS } from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

export class Obstacle extends ZObject {
    obstacleType: ObstacleType = 'rock';

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'obstacle-rock');
    }

    activate(lane: number, z: number, type: ObstacleType, zSpeed: number): void {
        this.obstacleType = type;
        const config = OBSTACLE_CONFIGS[type];
        this.activateZ(lane, z, zSpeed, `obstacle-${type}`, config.width, config.height);
    }
}
