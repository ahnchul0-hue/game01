import Phaser from 'phaser';
import { ZObjectPool } from './ZObjectPool';
import { Obstacle } from '../objects/Obstacle';
import { OBSTACLE_POOL_SIZE_3D } from '../utils/Constants';
import type { ObstacleType } from '../utils/Constants';

export class ObstaclePool extends ZObjectPool<Obstacle> {
    constructor(scene: Phaser.Scene) {
        super(scene, Obstacle, OBSTACLE_POOL_SIZE_3D);
    }

    spawn(lane: number, z: number, type: ObstacleType, zSpeed: number): Obstacle | null {
        const obj = this.acquire();
        if (obj) obj.activate(lane, z, type, zSpeed);
        return obj;
    }
}
