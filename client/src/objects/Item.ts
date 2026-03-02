import Phaser from 'phaser';
import { DESPAWN_Y, ITEM_POINTS, ITEM_SIZE } from '../utils/Constants';
import type { ItemType } from '../utils/Constants';

export class Item extends Phaser.Physics.Arcade.Sprite {
    itemType: ItemType = 'mandarin';
    points: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'item-mandarin');
        this.setActive(false);
        this.setVisible(false);
    }

    activate(x: number, y: number, type: ItemType, speed: number): void {
        this.itemType = type;
        this.points = ITEM_POINTS[type];
        this.setTexture(`item-${type}`);
        this.setPosition(x, y);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(ITEM_SIZE, ITEM_SIZE);
        body.setOffset(
            (this.width - ITEM_SIZE) / 2,
            (this.height - ITEM_SIZE) / 2,
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
