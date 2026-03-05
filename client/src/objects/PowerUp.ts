import Phaser from 'phaser';
import { ZObject } from './ZObject';
import { POWERUP_CONFIGS } from '../utils/Constants';
import type { PowerUpType } from '../utils/Constants';

export class PowerUp extends ZObject {
    powerUpType: PowerUpType = 'helmet';

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'powerup-helmet');
    }

    activate(lane: number, z: number, type: PowerUpType, zSpeed: number): void {
        this.powerUpType = type;
        const config = POWERUP_CONFIGS[type];
        this.activateZ(lane, z, zSpeed, `powerup-${type}`, config.width, config.height);
    }
}
