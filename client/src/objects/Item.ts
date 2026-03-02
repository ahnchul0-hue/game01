import Phaser from 'phaser';
import { PerspectiveCamera } from '../systems/PerspectiveCamera';
import {
    DESPAWN_Z,
    PLAYER_Z,
    COLLISION_BAND,
    ITEM_POINTS,
    ITEM_SIZE,
} from '../utils/Constants';
import type { ItemType } from '../utils/Constants';

export class Item extends Phaser.Physics.Arcade.Sprite {
    itemType: ItemType = 'mandarin';
    points: number = 0;

    /** 깊이 좌표 (1=소실점, 0=카메라) */
    z = 1;
    /** 레인 오프셋 (-1, 0, 1) */
    laneOffset = 0;
    /** z 이동 속도 (units/s) */
    private zSpeed = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'item-mandarin');
        this.setActive(false);
        this.setVisible(false);
    }

    activate(lane: number, z: number, type: ItemType, zSpeed: number): void {
        this.itemType = type;
        this.points = ITEM_POINTS[type];
        this.laneOffset = lane;
        this.z = z;
        this.zSpeed = zSpeed;
        this.setTexture(`item-${type}`);

        // 초기 투영
        const { screenY, scale } = PerspectiveCamera.projectZ(z);
        const screenX = PerspectiveCamera.getLaneScreenX(z, lane);
        this.setPosition(screenX, screenY);
        this.setScale(scale);

        // physics body 설정
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(ITEM_SIZE, ITEM_SIZE);
        body.setOffset(
            (this.width - ITEM_SIZE) / 2,
            (this.height - ITEM_SIZE) / 2,
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
        this.setDepth(5 + (1 - this.z) * 4);

        const body = this.body as Phaser.Physics.Arcade.Body;
        const inBand = Math.abs(this.z - PLAYER_Z) < COLLISION_BAND;
        body.enable = inBand;
    }
}
