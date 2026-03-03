import Phaser from 'phaser';
import { PerspectiveCamera } from '../systems/PerspectiveCamera';
import {
    DESPAWN_Z,
    PLAYER_Z,
    COLLISION_BAND,
    POWERUP_CONFIGS,
} from '../utils/Constants';
import type { PowerUpType } from '../utils/Constants';

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
    powerUpType: PowerUpType = 'helmet';

    /** 깊이 좌표 */
    z = 1;
    /** 레인 오프셋 (-1, 0, 1) */
    laneOffset = 0;
    /** z 이동 속도 */
    private zSpeed = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'powerup-helmet');
        this.setActive(false);
        this.setVisible(false);
    }

    activate(lane: number, z: number, type: PowerUpType, zSpeed: number): void {
        this.powerUpType = type;
        this.laneOffset = lane;
        this.z = z;
        this.zSpeed = zSpeed;
        this.setTexture(`powerup-${type}`);

        const { screenY, scale } = PerspectiveCamera.projectZ(z);
        const screenX = PerspectiveCamera.getLaneScreenX(z, lane);
        this.setPosition(screenX, screenY);
        this.setScale(scale);

        const config = POWERUP_CONFIGS[type];
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(config.width, config.height);
        body.setOffset(
            (this.width - config.width) / 2,
            (this.height - config.height) / 2,
        );
        body.enable = false;
        this.setVelocity(0, 0);

        this.setActive(true);
        this.setVisible(true);
    }

    deactivate(): void {
        this.setActive(false);
        this.setVisible(false);
        this.setVelocity(0, 0);
        if (this.body) {
            const body = this.body as Phaser.Physics.Arcade.Body;
            body.enable = false;
            body.reset(0, 0);
        }
    }

    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);
        if (!this.active) return;

        const dt = delta / 1000;
        this.z -= this.zSpeed * dt;

        if (this.z < DESPAWN_Z) {
            this.deactivate();
            return;
        }

        const { screenY, scale } = PerspectiveCamera.projectZ(this.z);
        const screenX = PerspectiveCamera.getLaneScreenX(this.z, this.laneOffset);
        this.setPosition(screenX, screenY);
        this.setScale(scale);
        // 깊이 정렬 (플레이어 depth 10 위)
        this.setDepth(12 + (1 - this.z) * 7);

        // 거리 기반 안개 알파
        this.setAlpha(Math.min(1, 0.4 + scale * 0.7));

        const body = this.body as Phaser.Physics.Arcade.Body;
        const inBand = Math.abs(this.z - PLAYER_Z) < COLLISION_BAND;
        body.enable = inBand;
    }
}
