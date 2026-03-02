import Phaser from 'phaser';
import { Item } from '../objects/Item';
import { ITEM_POOL_SIZE } from '../utils/Constants';
import type { ItemType } from '../utils/Constants';

export class ItemPool {
    private group: Phaser.Physics.Arcade.Group;

    constructor(scene: Phaser.Scene) {
        this.group = scene.physics.add.group({
            classType: Item,
            maxSize: ITEM_POOL_SIZE,
            runChildUpdate: true,
            active: false,
            visible: false,
        });
    }

    spawn(x: number, y: number, type: ItemType, speed: number): Item | null {
        const item = this.group.get() as Item | null;
        if (!item) return null;
        item.activate(x, y, type, speed);
        return item;
    }

    deactivateAll(): void {
        this.group.getChildren().forEach((child) => {
            if (child.active) {
                (child as Item).deactivate();
            }
        });
    }

    getGroup(): Phaser.Physics.Arcade.Group {
        return this.group;
    }
}
