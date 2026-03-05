import Phaser from 'phaser';
import { ZObjectPool } from './ZObjectPool';
import { PowerUp } from '../objects/PowerUp';
import { POWERUP_POOL_SIZE_3D } from '../utils/Constants';
import type { PowerUpType } from '../utils/Constants';

export class PowerUpPool extends ZObjectPool<PowerUp> {
    constructor(scene: Phaser.Scene) {
        super(scene, PowerUp, POWERUP_POOL_SIZE_3D);
    }

    spawn(lane: number, z: number, type: PowerUpType, zSpeed: number): PowerUp | null {
        const obj = this.acquire();
        if (obj) obj.activate(lane, z, type, zSpeed);
        return obj;
    }
}
