import Phaser from 'phaser';
import { PerspectiveCamera } from '../utils/PerspectiveCamera';
import { DESPAWN_Z, PLAYER_Z, COLLISION_BAND } from '../utils/Constants';

/**
 * Base class for z-axis moving game objects (obstacles, items, power-ups).
 * Encapsulates perspective projection, depth sorting, fog alpha, and collision band logic.
 */
export class ZObject extends Phaser.Physics.Arcade.Sprite {
    z = 1;
    laneOffset = 0;
    protected zSpeed = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
        super(scene, x, y, texture);
        this.setActive(false);
        this.setVisible(false);
    }

    /** Shared activation: set z-coords, texture, projection, and physics body. */
    protected activateZ(
        lane: number, z: number, zSpeed: number,
        texture: string, bodyW: number, bodyH: number,
    ): void {
        this.laneOffset = lane;
        this.z = z;
        this.zSpeed = zSpeed;
        this.setTexture(texture);

        const { screenY, scale } = PerspectiveCamera.projectZ(z);
        const screenX = PerspectiveCamera.getLaneScreenX(z, lane);
        this.setPosition(screenX, screenY);
        this.setScale(scale);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(bodyW, bodyH);
        body.setOffset((this.width - bodyW) / 2, (this.height - bodyH) / 2);
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
        this.setDepth(12 + (1 - this.z) * 7);
        this.setAlpha(Math.min(1, 0.4 + scale * 0.7));

        const body = this.body as Phaser.Physics.Arcade.Body;
        const inBand = Math.abs(this.z - PLAYER_Z) < COLLISION_BAND;
        body.enable = inBand;
    }
}
